import { Server as HttpServer } from "http";
import WebSocket, { WebSocketServer } from "ws";
import { UserRepository } from "../storage/UserRepository";
import { RoomRepository } from "../storage/RoomRepository";
import { MessageRepository } from "../storage/MessageRepository";
import escapeHtml from "escape-html";
import { User } from "../models/User";
import { Message } from "../models/Message";

type ClientConnection = {
  userId: string;
  ws: WebSocket;
  user?: User | null;
  rooms: Set<number>;
};

export class ChatServer {
  private wss?: WebSocketServer;
  private clients = new Map<string, ClientConnection>();
  private roomParticipants = new Map<number, Set<string>>();
  private roomLastActivity = new Map<number, number>();

  constructor(
    private server: HttpServer,
    private userRepo: UserRepository,
    private roomRepo: RoomRepository,
    private msgRepo: MessageRepository,
    private chatLifeDurationSeconds: number = 120
  ) {}

  setup() {
    this.wss = new WebSocketServer({ server: this.server, path: "/ws/chat" });
    this.wss.on("connection", (ws) => this.onConnection(ws));
    this.startRoomCleanupLoop();
  }

  /* ---------------------- CONNECTION / AUTH ---------------------- */

  private onConnection(ws: WebSocket) {
    let conn: ClientConnection | null = null;

    const authTimeout = setTimeout(() => {
      if (!conn) {
        ws.send(
          JSON.stringify({
            type: "error",
            code: "AUTH_TIMEOUT",
            reason: "Authentication required within 5 seconds",
          })
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
              JSON.stringify({
                type: "error",
                code: "UNAUTHORIZED",
                reason: "First message must be 'auth' with valid userId",
              })
            );
          }

          const existing = this.clients.get(msg.userId);
          if (existing && existing.ws.readyState === WebSocket.OPEN) {
            return ws.send(
              JSON.stringify({
                type: "error",
                code: "DUPLICATE_CONNECTION",
                reason: "Only 1 connection can be established at a time",
              })
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
        ws.send(JSON.stringify({ type: "error", error: "Invalid JSON" }));
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

  /* ---------------------- MESSAGE HANDLING ---------------------- */

  private handleMessage(conn: ClientConnection, msg: any) {
    const ws = conn.ws;
    if (!msg?.type)
      return ws.send(JSON.stringify({ type: "error", error: "type required" }));

    if (msg.type === "profile") {
      const { nickname, color, avatarUrl } = msg;
      let user = this.userRepo.findById(conn.userId);
      if (!user) {
        user = new User(
          conn.userId,
          nickname,
          color,
          avatarUrl,
          true,
          new Date().toISOString()
        );
      } else {
        user.setProfile(nickname, color, avatarUrl);
        user.touchConnected(true);
      }
      this.userRepo.upsert(user);
      conn.user = user;
      return;
    }

    if (msg.type === "join") {
      const roomId = Number(msg.roomId);
      const room = this.roomRepo.findById(roomId);
      if (!room || room.archived)
        return ws.send(
          JSON.stringify({ type: "error", error: "room not found or archived" })
        );

      let participants = this.roomParticipants.get(roomId);
      if (!participants) {
        participants = new Set();
        this.roomParticipants.set(roomId, participants);
      }

      participants.add(conn.userId);
      conn.rooms.add(roomId);
      this.touchRoom(roomId);

      ws.send(
        JSON.stringify({
          type: "history",
          messages: this.msgRepo.findLastN(roomId, 100),
        })
      );

      this.notifyRoomCount(roomId, participants.size);
      this.broadcastRoomsList();
      return;
    }

    if (msg.type === "leave") {
      const roomId = Number(msg.roomId);
      const participants = this.roomParticipants.get(roomId);
      if (participants) {
        participants.delete(conn.userId);
        conn.rooms.delete(roomId);
        this.notifyRoomCount(roomId, participants.size);
        this.touchRoom(roomId);
      }
      return;
    }

    if (msg.type === "message") {
      const roomId = Number(msg.roomId);
      const content = String(msg.content || "").slice(0, 200);
      if (!content)
        return ws.send(
          JSON.stringify({ type: "error", error: "empty message" })
        );

      const room = this.roomRepo.findById(roomId);
      if (!room || room.archived)
        return ws.send(
          JSON.stringify({ type: "error", error: "room not found" })
        );

      const message = new Message(
        null,
        roomId,
        conn.userId,
        conn.user?.nickname ?? null,
        conn.user?.color ?? null,
        escapeHtml(content),
        new Date().toISOString()
      );

      this.msgRepo.save(message);
      this.touchRoom(roomId);

      const participants = this.roomParticipants.get(roomId);
      if (participants) {
        const payload = JSON.stringify({ type: "message", message });
        for (const uid of participants) {
          const c = this.clients.get(uid);
          if (c?.ws.readyState === WebSocket.OPEN) c.ws.send(payload);
        }
      }
      return;
    }

    if (msg.type === "deleteRoom") {
      const roomId = Number(msg.roomId);
      const room = this.roomRepo.findById(roomId);
      if (!room || room.archived)
        return ws.send(
          JSON.stringify({ type: "error", error: "room not found" })
        );

      if (room.creatorUserId && room.creatorUserId !== conn.userId)
        return ws.send(
          JSON.stringify({ type: "error", error: "only creator can delete" })
        );

      this.archiveRoom(roomId);
      return;
    }

    ws.send(JSON.stringify({ type: "error", error: "unknown type" }));
  }

  /* ---------------------- ROOM LIFECYCLE ---------------------- */

  private touchRoom(roomId: number) {
    this.roomLastActivity.forEach((v, k) => {
      console.log(`${k}:${v}`);
    });
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
    this.roomParticipants.delete(roomId);
    this.roomLastActivity.delete(roomId);

    this.broadcastRoomDeleted(roomId);
    this.broadcastRoomsList();
  }

  /* ---------------------- BROADCASTS ---------------------- */

  private notifyRoomCount(roomId: number, count: number) {
    const payload = JSON.stringify({ type: "roomUpdate", roomId, count });
    const set = this.roomParticipants.get(roomId);
    if (!set) return;

    for (const uid of set) {
      const c = this.clients.get(uid);
      if (c?.ws.readyState === WebSocket.OPEN) c.ws.send(payload);
    }
  }

  private broadcastRoomDeleted(roomId: number) {
    const payload = JSON.stringify({ type: "roomDeleted", roomId });
    for (const c of this.clients.values()) {
      if (c.ws.readyState === WebSocket.OPEN) c.ws.send(payload);
    }
  }

  private broadcastRoomsList() {
    if (!this.wss) return;
    const activePublicRooms = this.roomRepo.findActivePublic();
    const rooms = {
      ...activePublicRooms,
      currentParticipants: Array.from(this.roomParticipants.entries()).map(
        ([roomId, participants]) => ({
          roomId,
          count: participants.size,
        })
      ),
    };
    const payload = JSON.stringify({ type: "roomsListUpdate", rooms });

    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
  }
}
