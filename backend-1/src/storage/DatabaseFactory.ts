import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { Database as DBType } from "better-sqlite3";

export class DatabaseFactory {
  static create(dbPath: string): DBType {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const db = new Database(dbPath);
    db.pragma("foreign_keys = ON");

    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nickname TEXT,
      color TEXT,
      avatarPath TEXT,
      connected INTEGER DEFAULT 0,
      lastSeen TEXT
    );
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      isPrivate INTEGER DEFAULT 0,
      maxParticipants INTEGER,
      creatorUserId TEXT,
      archived INTEGER DEFAULT 0,
      createdAt TEXT
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roomId INTEGER,
      userId TEXT,
      nickname TEXT,
      color TEXT,
      content TEXT,
      sentAt TEXT,
      FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE
    );
    `);

    return db;
  }
}
