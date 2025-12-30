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
  private clients = new Map<string, ClientConnection>();

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
            return ws.send(
              new WebsocketMessage({
                type: "error",
                code: "DUPLICATE_CONNECTION",
              }).json()
            );
          }

          clearTimeout(authTimeout);

          const user = this.userRepo.findById(msg.userId) ?? null;
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
      const participants = this.roomParticipants.get(roomId);
      if (participants) {
        participants.delete(conn.userId);
        this.notifyRoomCount(roomId, participants.size);
        this.touchRoom(roomId);
      }
    }

    if (conn.user) {
      conn.user.touchConnected(false);
      this.userRepo.upsert(conn.user);
    }

    this.clients.delete(conn.userId);
  }
}
