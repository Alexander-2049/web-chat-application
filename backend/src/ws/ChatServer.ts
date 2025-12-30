import { Server as HttpServer } from "http";
import { RoomRepository } from "../storage/RoomRepository";
import { MessageRepository } from "../storage/MessageRepository";
import WebSocket, { WebSocketServer } from "ws";
import { User } from "../models/User";
import { WebsocketMessage } from "../models/WebsocketMessage";

type ClientConnection = {
  userId: string;
  ws: WebSocket;
  user?: User | null;
  rooms: Set<number>;
};

export class ChatServer {
  private wss?: WebSocketServer;
  private roomLastActivity = new Map<number, number>();
  private roomConnectedClients = new Map<
    number,
    Map<string, ClientConnection>
  >();

  // all currently connected clients
  private clients = new Map<string, ClientConnection>();

  // all users independently of current connection state
  private users = new Map<string, User>();

  constructor(
    private server: HttpServer,
    private roomRepo: RoomRepository,
    private msgRepo: MessageRepository,
    private chatLifeDurationSeconds: number = 120
  ) {}

  setup() {
    this.wss = new WebSocketServer({ server: this.server, path: "/ws/chat" });
    this.wss.on("connection", (ws) => this.onConnection(ws));
    this.startRoomCleanupLoop();
  }

  /* ---------------------- ROOM LIFECYCLE ---------------------- */

  private touchRoom(roomId: number) {
    this.roomLastActivity.set(roomId, Date.now());
  }

  private startRoomCleanupLoop() {
    setInterval(() => {
      const now = Date.now();
      const ttl = this.chatLifeDurationSeconds * 1000;

      for (const [roomId, last] of this.roomLastActivity.entries()) {
        if (now - last >= ttl) {
          this.archiveRoom(roomId);
        }
      }
    }, 10_000);
  }

  private archiveRoom(roomId: number) {
    const room = this.roomRepo.findById(roomId);
    if (!room || room.archived) return;

    this.roomRepo.archive(roomId);
    // this.roomParticipants.delete(roomId);
    this.roomLastActivity.delete(roomId);

    // this.broadcastRoomDeleted(roomId);
    // this.broadcastRoomsList();
  }

  /* ---------------------- CONNECTION / AUTH ---------------------- */

  private onConnection(ws: WebSocket) {
    let conn: ClientConnection | null = null;

    const authTimeout = setTimeout(() => {
      if (!conn) {
        ws.send(
          new WebsocketMessage({
            type: "error",
            code: "AUTH_TIMEOUT",
          }).json()
        );
        ws.close();
      }
    }, 5000);

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // AUTH REQUIRED
        if (!conn) {
          if (msg.type !== "auth" || typeof msg.userId !== "string") {
            return ws.send(
              new WebsocketMessage({
                type: "error",
                code: "UNAUTHORIZED",
              }).json()
            );
          }

          const existing = this.clients.get(msg.userId);
          if (existing && existing.ws.readyState === WebSocket.OPEN) {
            existing.ws.send(
              new WebsocketMessage({
                type: "closed",
                code: "DUBLICATE_CONNECTION",
              }).json()
            );
            existing.ws.close();
          }

          clearTimeout(authTimeout);

          const user = this.users.get(msg.userId);
          conn = { userId: msg.userId, ws, user, rooms: new Set() };
          this.clients.set(msg.userId, conn);

          ws.send(JSON.stringify({ type: "auth_ok", userId: msg.userId }));
          return;
        }

        this.handleMessage(conn, msg);
      } catch {
        ws.send(
          new WebsocketMessage({ type: "error", code: "INVALID_JSON" }).json()
        );
      }
    });

    ws.on("close", () => {
      clearTimeout(authTimeout);
      if (conn) this.onClose(conn);
    });
  }

  private onClose(conn: ClientConnection) {
    for (const roomId of conn.rooms) {
      const participants = this.roomConnectedClients.get(roomId);
      if (participants) {
        participants.delete(conn.userId);
        this.streamRoomToRoom(roomId);
        this.touchRoom(roomId);
      }
    }

    if (conn.user) {
      this.clients.delete(conn.userId);
      this.users.set(conn.userId, conn.user);
    }

    this.clients.delete(conn.userId);
  }

  /* ---------------------- MESSAGE HANDLING ---------------------- */

  private handleMessage(conn: ClientConnection, msg: any) {}

  /* ------------------------- STREAM DATA ------------------------ */

  private streamAllRoomsToClient(client: ClientConnection) {
    const rooms = this.roomRepo.findActive();

    const roomsList = rooms.map((room) => {
      const connected = this.roomConnectedClients.get(room.id);
      return {
        roomId: room.id,
        name: room.name,
        connectedClientsAmount: connected?.size || 0,
        maxClients: room.maxParticipants ?? null,
        creatorUserId: room.creatorUserId,
        archived: room.archived,
      };
    });

    const payload = new WebsocketMessage({
      type: "allActiveRooms",
      data: { rooms: roomsList },
    }).json();

    client.ws.send(payload);
  }

  private streamAllRoomsToAllConnectedClients() {
    const rooms = this.roomRepo.findActive();

    // update per-room clients about their room state
    rooms.forEach((room) => this.streamRoomToRoom(room.id));

    // broadcast aggregated rooms list to all connected clients
    const roomsList = rooms.map((room) => {
      const connected = this.roomConnectedClients.get(room.id);
      return {
        roomId: room.id,
        name: room.name,
        connectedClientsAmount: connected?.size || 0,
        maxClients: room.maxParticipants ?? null,
        creatorUserId: room.creatorUserId,
        archived: room.archived,
      };
    });

    const payload = new WebsocketMessage({
      type: "allActiveRooms",
      data: { rooms: roomsList },
    }).json();

    for (const client of this.clients.values()) {
      client.ws.send(payload);
    }
  }

  private streamRoomToRoom(roomId: number) {
    const clients = this.roomConnectedClients.get(roomId) || [];
    const roomConnectedClients = this.roomConnectedClients.get(roomId);
    const room = this.roomRepo.findById(roomId);

    if (!room || !roomConnectedClients) {
      return clients.forEach((client) => {
        client.ws.send(
          new WebsocketMessage({
            type: "roomDestroyed",
            data: {
              roomId: roomId,
            },
          }).json()
        );
      });
    }

    clients.forEach((client) => {
      client.ws.send(
        new WebsocketMessage({
          type: "roomData",
          data: {
            roomId: roomId,
            name: room.name,
            connectedClientsAmount: roomConnectedClients.size || 0,
            maxClients: room.maxParticipants,
            creatorUserId: room.creatorUserId,
            archived: room.archived,
          },
        }).json()
      );
    });

    clients.forEach((client) => {
      client.ws.send(
        new WebsocketMessage({
          type: "roomConnectedClients",
          data: {
            roomId,
            clients: Array.from(roomConnectedClients.values()).map((e) => {
              return {
                id: e.userId,
                nickname: e.user?.nickname || "",
              };
            }),
          },
        }).json()
      );
    });
  }
}
