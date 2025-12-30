import { Database } from "better-sqlite3";
import { Room } from "../models/Room";

export class RoomRepository {
  constructor(private db: Database) {}

  create(
    name: string,
    isPrivate: boolean,
    maxParticipants: number | null,
    creatorUserId?: string | null
  ): Room {
    const createdAt = new Date().toISOString();
    const info = this.db
      .prepare(
        "INSERT INTO rooms(name,isPrivate,maxParticipants,creatorUserId,archived,createdAt) VALUES(?,?,?,?,0,?)"
      )
      .run(name, isPrivate ? 1 : 0, maxParticipants, creatorUserId, createdAt);
    const id = Number(info.lastInsertRowid);
    return new Room(
      id,
      name,
      isPrivate,
      maxParticipants,
      creatorUserId,
      false,
      createdAt
    );
  }

  findActivePublic(): Room[] {
    const rows = this.db
      .prepare(
        "SELECT id,name,isPrivate,maxParticipants,creatorUserId,archived,createdAt FROM rooms WHERE archived = 0 AND isPrivate = 0"
      )
      .all();
    return rows.map(
      (r: any) =>
        new Room(
          r.id,
          r.name,
          Boolean(r.isPrivate),
          r.maxParticipants,
          r.creatorUserId,
          Boolean(r.archived),
          r.createdAt
        )
    );
  }

  findById(id: number): Room | null {
    const r = this.db
      .prepare(
        "SELECT id,name,isPrivate,maxParticipants,creatorUserId,archived,createdAt FROM rooms WHERE id = ?"
      )
      .get(id) as any;
    if (!r) return null;
    return new Room(
      r.id,
      r.name,
      Boolean(r.isPrivate),
      r.maxParticipants,
      r.creatorUserId,
      Boolean(r.archived),
      r.createdAt
    );
  }

  archive(id: number) {
    this.db.prepare("UPDATE rooms SET archived = 1 WHERE id = ?").run(id);
  }

  listArchived(): Room[] {
    const rows = this.db
      .prepare(
        "SELECT id,name,isPrivate,maxParticipants,creatorUserId,archived,createdAt FROM rooms WHERE archived = 1"
      )
      .all();
    return rows.map(
      (r: any) =>
        new Room(
          r.id,
          r.name,
          Boolean(r.isPrivate),
          r.maxParticipants,
          r.creatorUserId,
          Boolean(r.archived),
          r.createdAt
        )
    );
  }
}
