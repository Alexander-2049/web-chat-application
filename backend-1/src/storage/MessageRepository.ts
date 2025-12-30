import { Database } from "better-sqlite3";
import { Message } from "../models/Message";

export class MessageRepository {
  constructor(private db: Database) {}

  save(message: Message): Message {
    const info = this.db
      .prepare(
        "INSERT INTO messages(roomId,userId,nickname,color,content,sentAt) VALUES(?,?,?,?,?,?)"
      )
      .run(
        message.roomId,
        message.userId,
        message.nickname,
        message.color,
        message.content,
        message.sentAt
      );
    const id = Number(
      (
        this.db.prepare("SELECT last_insert_rowid() as id").get() as {
          id: number;
        }
      ).id
    );
    message.id = id;
    return message;
  }

  findLastN(roomId: number, limit: number): Message[] {
    const rows = this.db
      .prepare(
        "SELECT id,roomId,userId,nickname,color,content,sentAt FROM messages WHERE roomId = ? ORDER BY id DESC LIMIT ?"
      )
      .all(roomId, limit);
    return rows
      .reverse()
      .map(
        (r: any) =>
          new Message(
            r.id,
            r.roomId,
            r.userId,
            r.nickname,
            r.color,
            r.content,
            r.sentAt
          )
      );
  }

  findAllByRoom(roomId: number): Message[] {
    const rows = this.db
      .prepare(
        "SELECT id,roomId,userId,nickname,color,content,sentAt FROM messages WHERE roomId = ? ORDER BY id ASC"
      )
      .all(roomId);
    return rows.map(
      (r: any) =>
        new Message(
          r.id,
          r.roomId,
          r.userId,
          r.nickname,
          r.color,
          r.content,
          r.sentAt
        )
    );
  }
}
