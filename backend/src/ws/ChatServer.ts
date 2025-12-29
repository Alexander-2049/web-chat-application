import { Server as HttpServer } from "http";
import WebSocket, { WebSocketServer } from "ws";
import { UserRepository } from "../storage/UserRepository";
import { RoomRepository } from "../storage/RoomRepository";
import { MessageRepository } from "../storage/MessageRepository";
import { v4 as uuidv4 } from "uuid";
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
  private unauthorizedClients: WebSocket[] = [];
  private clients = new Map<string, ClientConnection>();
  private roomParticipants = new Map<number, Set<string>>();
  private roomLastActivity = new Map<number, number>();

  constructor(
    private server: HttpServer,
    private userRepo: UserRepository,
    private roomRepo: RoomRepository,
    private msgRepo: MessageRepository,
    private chatLifeDurationSeconds: number = 60 * 10 // 10 minutes
  ) {}

  setup() {
    this.wss = new WebSocketServer({ server: this.server, path: "/ws/chat" });
    this.wss.on("connection", (ws) => this.onConnection(ws));
  }

  private broadcastRoomsList() {
    if (!this.wss) return;
    const rooms = this.roomRepo.findActivePublic();
    const payload = JSON.stringify({ type: "roomsListUpdate", rooms });
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
  }

  private onConnection(ws: WebSocket) {
    let conn: ClientConnection | null = null;

    // Set a 5-second auth timeout
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

        // First message must be "auth"
        if (!conn) {
          if (msg.type !== "auth" || typeof msg.userId !== "string") {
            return ws.send(
              JSON.stringify({
                type: "error",
                code: "UNAUTHORIZED",
                reason: "First message must be 'auth' with a valid userId",
              })
            );
          }

          // Check if another live connection exists
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

          // Authorize connection
          clearTimeout(authTimeout); // Cancel timeout
          const user = this.userRepo.findById(msg.userId) ?? null;
          conn = { userId: msg.userId, ws, user, rooms: new Set() };
          this.clients.set(msg.userId, conn);

          ws.send(JSON.stringify({ type: "auth_ok", userId: msg.userId }));
          return;
        }

        // Already authorized → normal message flow
        this.handleMessage(conn, msg);
      } catch (err) {
        ws.send(JSON.stringify({ type: "error", error: "Invalid JSON" }));
      }
    });

    ws.on("close", () => {
      clearTimeout(authTimeout); // Ensure timeout is cleared
      if (!conn) return;
      this.onClose(conn);
    });
  }

  private onClose(conn: ClientConnection) {
    // remove from rooms
    for (const roomId of conn.rooms) {
      const participants = this.roomParticipants.get(roomId);
      if (participants) {
        participants.delete(conn.userId);
        this.notifyRoomCount(roomId, participants.size);
      }
    }
    // mark user disconnected
    if (conn.user) {
      conn.user.touchConnected(false);
      this.userRepo.upsert(conn.user);
    }
    this.clients.delete(conn.userId);
  }

  private handleMessage(conn: ClientConnection, msg: any) {
    const ws = conn.ws;
    if (!msg || !msg.type)
      return ws.send(JSON.stringify({ type: "error", error: "type required" }));

    if (msg.type === "init") {
      if (msg.userId && typeof msg.userId === "string") {
        // if existing user in repo -> restore profile
        const u = this.userRepo.findById(msg.userId);
        if (u) {
          conn.userId = u.id;
          conn.user = u;
          this.clients.set(conn.userId, conn);
        } else {
          // keep new generated userId
        }
      }
      return;
    }

    if (msg.type === "profile") {
      const nickname = msg.nickname;
      const color = msg.color;
      const avatarUrl = msg.avatarUrl;
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

      const messages = this.msgRepo.findLastN(roomId, 100);
      ws.send(JSON.stringify({ type: "history", messages }));

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
      const escaped = escapeHtml(content);
      const nickname = conn.user?.nickname ?? null;
      const color = conn.user?.color ?? null;
      const userId = conn.userId;
      const message = new Message(
        null,
        roomId,
        userId,
        nickname,
        color,
        escaped,
        new Date().toISOString()
      );
      this.msgRepo.save(message);

      const participants = this.roomParticipants.get(roomId);
      if (participants) {
        const payload = JSON.stringify({ type: "message", message });
        for (const uid of participants) {
          const c = this.clients.get(uid);
          if (c && c.ws.readyState === WebSocket.OPEN) c.ws.send(payload);
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
      this.roomRepo.archive(roomId);
      this.broadcastRoomDeleted(roomId);
      this.broadcastRoomsList();
      return;
    }

    ws.send(JSON.stringify({ type: "error", error: "unknown type" }));
  }

  private notifyRoomCount(roomId: number, count: number) {
    const update = JSON.stringify({ type: "roomUpdate", roomId, count });
    const set = this.roomParticipants.get(roomId);
    if (!set) return;
    for (const uid of set) {
      const c = this.clients.get(uid);
      if (c && c.ws.readyState === WebSocket.OPEN) c.ws.send(update);
    }
  }

  private broadcastRoomDeleted(roomId: number) {
    const notice = JSON.stringify({ type: "roomDeleted", roomId });
    for (const c of this.clients.values()) {
      if (c.ws.readyState === WebSocket.OPEN) c.ws.send(notice);
    }
  }
}
