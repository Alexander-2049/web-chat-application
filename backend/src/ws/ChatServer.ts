import { Server as HttpServer } from "http";
import WebSocket, { WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";

import { RoomRepository } from "../storage/RoomRepository";
import { MessageRepository } from "../storage/MessageRepository";
import {
  WebsocketMessage,
  WSOutgoingMessage,
} from "../models/WebsocketMessage";
import { Message } from "../models/Message";

type ClientConnection = {
  userId: string;
  ws: WebSocket;
  roomId: number | null;
  nicknames: Map<number, string>;
};

export class ChatServer {
  private wss?: WebSocketServer;

  private roomLastActivity = new Map<number, number>();
  private roomConnectedClients = new Map<
    number,
    Map<string, ClientConnection>
  >();

  private clients = new Map<string, ClientConnection>();

  constructor(
    private server: HttpServer,
    private roomRepo: RoomRepository,
    private msgRepo: MessageRepository,
    private chatLifeDurationSeconds: number = 10 * 60 // 1 minutes
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
      const ttl = this.chatLifeDurationSeconds * 1000;
      const now = Date.now();

      for (const [roomId, last] of this.roomLastActivity) {
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
        this.send(
          client.ws,
          new WebsocketMessage({
            type: "roomDestroyed",
            data: { roomId },
          })
        );
        client.roomId = null;
        client.nicknames.delete(roomId);
      }
      this.roomConnectedClients.delete(roomId);
    }

    this.streamAllRoomsToAllConnectedClients();
  }

  /* ---------------------- CONNECTION ---------------------- */

  private onConnection(ws: WebSocket) {
    let conn: ClientConnection | null = null;

    const authTimeout = setTimeout(() => {
      if (!conn) {
        this.send(
          ws,
          new WebsocketMessage({ type: "error", code: "AUTH_TIMEOUT" })
        );
        ws.close();
      }
    }, 5000);

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        /* ---------- PRE-AUTH ---------- */
        if (!conn) {
          if (msg.type === "requestUserId") {
            const userId = uuidv4();
            return this.send(
              ws,
              new WebsocketMessage({
                type: "userIdIssued",
                userId,
              })
            );
          }

          if (msg.type !== "auth" || typeof msg.userId !== "string") {
            return this.send(
              ws,
              new WebsocketMessage({ type: "error", code: "UNAUTHORIZED" })
            );
          }

          const existing = this.clients.get(msg.userId);
          if (existing) {
            this.send(
              existing.ws,
              new WebsocketMessage({
                type: "closed",
                code: "DUBLICATE_CONNECTION",
              })
            );
            existing.ws.close();
          }

          clearTimeout(authTimeout);

          conn = {
            userId: msg.userId,
            ws,
            roomId: null,
            nicknames: new Map(),
          };

          this.clients.set(msg.userId, conn);

          this.send(
            ws,
            new WebsocketMessage({
              type: "auth_ok",
              userId: msg.userId,
            })
          );
          return;
        }

        this.handleMessage(conn, msg);
      } catch (e) {
        console.error(e);
        this.send(
          ws,
          new WebsocketMessage({ type: "error", code: "INVALID_JSON" })
        );
      }
    });

    ws.on("close", () => {
      clearTimeout(authTimeout);
      if (conn) this.onClose(conn);
    });
  }

  private onClose(conn: ClientConnection) {
    const current = this.clients.get(conn.userId);

    if (current !== conn) {
      return;
    }

    const roomId = conn.roomId;
    if (roomId !== null) {
      const participants = this.roomConnectedClients.get(roomId);
      if (participants) {
        participants.delete(conn.userId);
        this.streamRoomStateToParticipants(roomId);
        this.touchRoom(roomId);
      }
    }

    this.clients.delete(conn.userId);
    console.log(`[WS] Client fully removed: ${conn.userId}`);
  }

  private send(ws: WebSocket, msg: WebsocketMessage<WSOutgoingMessage>) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg.json());
    }
  }

  /* ---------------------- MESSAGE HANDLING ---------------------- */

  private handleMessage(conn: ClientConnection, msg: any) {
    switch (msg.type) {
      case "getAllRooms":
        this.streamAllRoomsToClient(conn);
        break;

      case "getAllArchivedRooms":
        this.send(
          conn.ws,
          new WebsocketMessage({
            type: "allArchivedRooms",
            data: {
              rooms: this.roomRepo.listArchived().map((r) => ({
                roomId: r.id,
                name: r.name,
                creatorUserId: r.creatorUserId,
                createdAt: r.createdAt,
              })),
            },
          })
        );
        break;

      case "getArchivedRoom": {
        const { roomId } = msg;

        if (typeof roomId !== "number") {
          return this.send(
            conn.ws,
            new WebsocketMessage({
              type: "error",
              code: "INVALID_ROOM_ID",
            })
          );
        }

        const room = this.roomRepo.findById(roomId);
        if (!room) {
          return this.send(
            conn.ws,
            new WebsocketMessage({
              type: "error",
              code: "ROOM_NOT_FOUND",
            })
          );
        }

        if (!room.archived) {
          return this.send(
            conn.ws,
            new WebsocketMessage({
              type: "error",
              code: "ROOM_NOT_ARCHIVED",
            })
          );
        }

        const messages = this.msgRepo.findAllByRoom(roomId);

        this.send(
          conn.ws,
          new WebsocketMessage({
            type: "archivedRoomData",
            data: {
              room: {
                roomId: room.id,
                name: room.name,
                creatorUserId: room.creatorUserId,
                createdAt: room.createdAt,
                archived: room.archived,
              },
              messages: messages.map((m) => ({
                id: m.messageId!,
                userId: m.userId,
                nickname: m.nickname,
                content: m.content,
                sentAt: m.sentAt,
              })),
            },
          })
        );

        break;
      }

      case "joinRoom": {
        const { roomId, nickname } = msg;

        if (typeof nickname !== "string" || !nickname.trim()) {
          return this.send(
            conn.ws,
            new WebsocketMessage({
              type: "error",
              code: "NICKNAME_REQUIRED",
            })
          );
        }

        const room = this.roomRepo.findById(roomId);
        if (!room)
          return this.send(
            conn.ws,
            new WebsocketMessage({ type: "error", code: "ROOM_NOT_FOUND" })
          );

        if (room.archived)
          return this.send(
            conn.ws,
            new WebsocketMessage({ type: "error", code: "ROOM_ARCHIVED" })
          );

        let participants = this.roomConnectedClients.get(roomId);
        if (!participants) {
          participants = new Map();
          this.roomConnectedClients.set(roomId, participants);
        }

        if (!room.canJoin(participants.size)) {
          return this.send(
            conn.ws,
            new WebsocketMessage({ type: "error", code: "ROOM_FULL" })
          );
        }

        participants.set(conn.userId, conn);
        conn.roomId = roomId;
        conn.nicknames.set(roomId, nickname);

        for (const m of this.msgRepo.findAllByRoom(roomId)) {
          this.send(
            conn.ws,
            new WebsocketMessage({
              type: "chatMessage",
              data: {
                roomId,
                id: m.messageId!,
                userId: m.userId,
                nickname: m.nickname,
                content: m.content,
                sentAt: m.sentAt,
              },
            })
          );
        }

        this.touchRoom(roomId);
        this.streamRoomStateToParticipants(roomId);
        this.streamAllRoomsToAllConnectedClients();
        break;
      }

      case "leaveRoom": {
        const roomId = conn.roomId;

        if (roomId === null) {
          return this.send(
            conn.ws,
            new WebsocketMessage({
              type: "error",
              code: "NOT_IN_ROOM",
            })
          );
        }

        const participants = this.roomConnectedClients.get(roomId);
        if (participants) {
          participants.delete(conn.userId);

          // If room becomes empty, keep it alive until TTL cleanup
          if (participants.size === 0) {
            this.roomConnectedClients.delete(roomId);
          } else {
            this.streamRoomStateToParticipants(roomId);
          }
        }

        conn.roomId = null;
        conn.nicknames.delete(roomId);

        this.touchRoom(roomId);
        this.streamAllRoomsToAllConnectedClients();

        this.send(
          conn.ws,
          new WebsocketMessage({
            type: "success",
            code: "ROOM_LEFT",
            data: { roomId },
          })
        );

        break;
      }

      case "archiveRoom": {
        const room = this.roomRepo.findById(msg.roomId);
        if (!room || room.creatorUserId !== conn.userId) {
          return this.send(
            conn.ws,
            new WebsocketMessage({
              type: "error",
              code: "NOT_ROOM_OWNER",
            })
          );
        }
        this.archiveRoom(msg.roomId);
        break;
      }

      case "createRoom": {
        const { name, maxParticipants } = msg;

        if (typeof name !== "string" || !name.trim()) {
          return this.send(
            conn.ws,
            new WebsocketMessage({
              type: "error",
              code: "ROOM_NAME_REQUIRED",
            })
          );
        }

        if (
          maxParticipants !== null &&
          (typeof maxParticipants !== "number" || maxParticipants <= 0)
        ) {
          return this.send(
            conn.ws,
            new WebsocketMessage({
              type: "error",
              code: "INVALID_MAX_PARTICIPANTS",
            })
          );
        }

        const room = this.roomRepo.create(
          name.trim(),
          maxParticipants ?? null,
          conn.userId
        );

        this.touchRoom(room.id);
        this.streamAllRoomsToAllConnectedClients();

        this.send(
          conn.ws,
          new WebsocketMessage({
            type: "success",
            code: "ROOM_CREATED",
          })
        );
        break;
      }

      case "sendMessage": {
        const { roomId, content } = msg;

        if (
          typeof roomId !== "number" ||
          typeof content !== "string" ||
          !content.trim()
        ) {
          return this.send(
            conn.ws,
            new WebsocketMessage({
              type: "error",
              code: "INVALID_MESSAGE_FORMAT",
            })
          );
        }

        if (conn.roomId !== roomId) {
          return this.send(
            conn.ws,
            new WebsocketMessage({
              type: "error",
              code: "NOT_IN_ROOM",
            })
          );
        }

        const nickname = conn.nicknames.get(roomId)!;

        const message = this.msgRepo.save(
          new Message(null, roomId, conn.userId, nickname, content.trim())
        );

        const participants = this.roomConnectedClients.get(roomId);
        if (!participants) return;

        for (const client of participants.values()) {
          this.send(
            client.ws,
            new WebsocketMessage({
              type: "chatMessage",
              data: {
                roomId,
                id: message.messageId!,
                userId: message.userId,
                nickname: message.nickname,
                content: message.content,
                sentAt: message.sentAt,
              },
            })
          );
        }

        this.touchRoom(roomId);
        break;
      }

      default:
        this.send(
          conn.ws,
          new WebsocketMessage({
            type: "error",
            code: "UNKNOWN_MESSAGE_TYPE",
          })
        );
    }
  }

  /* ------------------------- STREAM DATA ------------------------ */

  private streamAllRoomsToClient(client: ClientConnection) {
    this.send(
      client.ws,
      new WebsocketMessage({
        type: "allActiveRooms",
        data: {
          rooms: this.roomRepo.findActive().map((room) => ({
            roomId: room.id,
            name: room.name,
            connectedClientsAmount:
              this.roomConnectedClients.get(room.id)?.size || 0,
            maxClients: room.maxParticipants ?? null,
            creatorUserId: room.creatorUserId,
            archived: room.archived,
          })),
        },
      })
    );
  }

  private streamAllRoomsToAllConnectedClients() {
    for (const client of this.clients.values()) {
      this.streamAllRoomsToClient(client);
    }
  }

  private streamRoomStateToParticipants(roomId: number) {
    const room = this.roomRepo.findById(roomId);
    const participants = this.roomConnectedClients.get(roomId);
    if (!participants || !room) return;

    for (const client of participants.values()) {
      this.send(
        client.ws,
        new WebsocketMessage({
          type: "roomData",
          data: {
            roomId,
            name: room.name,
            connectedClientsAmount: participants.size,
            maxClients: room.maxParticipants ?? null,
            creatorUserId: room.creatorUserId,
            archived: room.archived,
          },
        })
      );

      this.send(
        client.ws,
        new WebsocketMessage({
          type: "roomConnectedClients",
          data: {
            roomId,
            clients: Array.from(participants.values()).map((c) => ({
              id: c.userId,
              nickname: c.nicknames.get(roomId)!,
            })),
          },
        })
      );
    }
  }
}
