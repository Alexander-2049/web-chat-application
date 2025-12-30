import { Server as HttpServer } from "http";
import { RoomRepository } from "../storage/RoomRepository";
import { MessageRepository } from "../storage/MessageRepository";
import WebSocket, { WebSocketServer } from "ws";
import { User } from "../models/User";
import {
  WebsocketMessage,
  WSOutgoingMessage,
} from "../models/WebsocketMessage";
import { Message } from "../models/Message";

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
    this.roomLastActivity.delete(roomId);

    const participants = this.roomConnectedClients.get(roomId);
    if (participants) {
      for (const client of participants.values()) {
        this.send(client.ws, {
          type: "roomDestroyed",
          data: { roomId },
        });
        client.rooms.delete(roomId);
      }
      this.roomConnectedClients.delete(roomId);
    }

    this.streamAllRoomsToAllConnectedClients();
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
        this.streamRoomStateToParticipants(roomId);
        this.touchRoom(roomId);
      }
    }

    this.clients.delete(conn.userId);

    if (conn.user) {
      this.users.set(conn.userId, conn.user);
    }
  }

  private send(ws: WebSocket, msg: WSOutgoingMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  /* ---------------------- MESSAGE HANDLING ---------------------- */

  private handleMessage(conn: ClientConnection, msg: any) {
    switch (msg.type) {
      case "getAllRooms":
        this.streamAllRoomsToClient(conn);
        break;

      case "getAllArchivedRooms": {
        const rooms = this.roomRepo.listArchived();
        this.send(conn.ws, {
          type: "allArchivedRooms",
          data: {
            rooms: rooms.map((r) => ({
              roomId: r.id,
              name: r.name,
              creatorUserId: r.creatorUserId,
              createdAt: r.createdAt,
            })),
          },
        });
        break;
      }

      case "joinRoom": {
        const room = this.roomRepo.findById(msg.roomId);
        if (!room) {
          return this.send(conn.ws, {
            type: "error",
            code: "ROOM_NOT_FOUND",
          });
        }

        if (room.archived) {
          return this.send(conn.ws, {
            type: "error",
            code: "ROOM_ARCHIVED",
          });
        }

        if (conn.rooms.has(room.id)) return;

        let participants = this.roomConnectedClients.get(room.id);
        if (!participants) {
          participants = new Map();
          this.roomConnectedClients.set(room.id, participants);
        }

        if (!room.canJoin(participants.size)) {
          return this.send(conn.ws, {
            type: "error",
            code: "ROOM_FULL",
          });
        }

        participants.set(conn.userId, conn);
        conn.rooms.add(room.id);

        const history = this.msgRepo.findAllByRoom(room.id);
        history.forEach((m) =>
          this.send(conn.ws, {
            type: "chatMessage",
            data: {
              roomId: room.id,
              id: m.messageId!,
              userId: m.userId,
              nickname: m.nickname,
              content: m.content,
              sentAt: m.sentAt,
            },
          })
        );

        this.touchRoom(room.id);
        this.streamRoomStateToParticipants(room.id);
        this.streamAllRoomsToAllConnectedClients();
        break;
      }

      case "leaveRoom": {
        const participants = this.roomConnectedClients.get(msg.roomId);
        if (participants) {
          participants.delete(conn.userId);
          conn.rooms.delete(msg.roomId);
          this.touchRoom(msg.roomId);
          this.streamRoomStateToParticipants(msg.roomId);
          this.streamAllRoomsToAllConnectedClients();
        }
        break;
      }

      case "sendMessage": {
        if (!conn.rooms.has(msg.roomId)) return;

        const message = this.msgRepo.save(
          new Message(
            null,
            msg.roomId,
            conn.userId,
            conn.user?.nickname || "",
            msg.content
          )
        );

        const participants = this.roomConnectedClients.get(msg.roomId);
        if (!participants) return;

        for (const client of participants.values()) {
          this.send(client.ws, {
            type: "chatMessage",
            data: {
              roomId: msg.roomId,
              id: message.messageId!,
              userId: message.userId,
              nickname: message.nickname,
              content: message.content,
              sentAt: message.sentAt,
            },
          });
        }

        this.touchRoom(msg.roomId);
        break;
      }

      default:
        this.send(conn.ws, { type: "error", code: "UNKNOWN_MESSAGE_TYPE" });
    }
  }

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

    this.send(client.ws, {
      type: "allActiveRooms",
      data: { rooms: roomsList },
    });
  }

  private streamAllRoomsToAllConnectedClients() {
    const rooms = this.roomRepo.findActive();

    rooms.forEach((room) => this.streamRoomStateToParticipants(room.id));

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

    for (const client of this.clients.values()) {
      this.send(client.ws, {
        type: "allActiveRooms",
        data: { rooms: roomsList },
      });
    }
  }

  private streamRoomStateToParticipants(roomId: number) {
    const room = this.roomRepo.findById(roomId);
    const participants = this.roomConnectedClients.get(roomId);

    if (!participants || participants.size === 0) return;

    if (!room || room.archived) {
      for (const client of participants.values()) {
        this.send(client.ws, {
          type: "roomDestroyed",
          data: { roomId },
        });
      }
      return;
    }

    for (const client of participants.values()) {
      this.send(client.ws, {
        type: "roomData",
        data: {
          roomId,
          name: room.name,
          connectedClientsAmount: participants.size,
          maxClients: room.maxParticipants ?? null,
          creatorUserId: room.creatorUserId,
          archived: room.archived,
        },
      });

      this.send(client.ws, {
        type: "roomConnectedClients",
        data: {
          roomId,
          clients: Array.from(participants.values()).map((c) => ({
            id: c.userId,
            nickname: c.user?.nickname || "",
          })),
        },
      });
    }
  }
}
