import { Database } from "better-sqlite3";
import { User } from "../models/User";

export class UserRepository {
  constructor(private db: Database) {}

  findById(id: string): User | null {
    const row = this.db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(id) as any;
    if (!row) return null;
    return new User(
      row.id,
      row.nickname,
      row.color,
      row.avatarPath,
      Boolean(row.connected),
      row.lastSeen
    );
  }

  upsert(user: User) {
    const exists = this.db
      .prepare("SELECT 1 FROM users WHERE id = ?")
      .get(user.id);
    if (exists) {
      this.db
        .prepare(
          "UPDATE users SET nickname = ?, color = ?, avatarPath = ?, connected = ?, lastSeen = ? WHERE id = ?"
        )
        .run(
          user.nickname,
          user.color,
          user.avatarPath,
          user.connected ? 1 : 0,
          user.lastSeen,
          user.id
        );
    } else {
      this.db
        .prepare(
          "INSERT INTO users(id,nickname,color,avatarPath,connected,lastSeen) VALUES(?,?,?,?,?,?)"
        )
        .run(
          user.id,
          user.nickname,
          user.color,
          user.avatarPath,
          user.connected ? 1 : 0,
          user.lastSeen
        );
    }
  }

  touchConnected(id: string, connected: boolean) {
    const lastSeen = new Date().toISOString();
    this.db
      .prepare("UPDATE users SET connected = ?, lastSeen = ? WHERE id = ?")
      .run(connected ? 1 : 0, lastSeen, id);
  }
}
