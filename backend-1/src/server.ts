import express from "express";
import http from "http";
import path from "path";
import cors from "cors";
import { DatabaseFactory } from "./storage/DatabaseFactory";
import { UserRepository } from "./storage/UserRepository";
import { RoomRepository } from "./storage/RoomRepository";
import { MessageRepository } from "./storage/MessageRepository";
import { setupProfileRoutes } from "./controllers/ProfileController";
import { setupRoomRoutes } from "./controllers/RoomController";
import { ChatServer } from "./ws/ChatServer";

async function main() {
  const app = express();
  app.use(
    cors({
      origin: "http://localhost:4200",
      credentials: true, // если нужны куки, токены и т.п.
    })
  );
  app.use(express.json());
  app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

  const server = http.createServer(app);

  const db = DatabaseFactory.create(
    path.join(__dirname, "..", "data", "database.sqlite")
  );
  const userRepo = new UserRepository(db);
  const roomRepo = new RoomRepository(db);
  const messageRepo = new MessageRepository(db);

  setupProfileRoutes(app, userRepo);
  setupRoomRoutes(app, roomRepo, messageRepo);

  const chatServer = new ChatServer(server, userRepo, roomRepo, messageRepo);
  chatServer.setup();

  const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
  server.listen(PORT, () =>
    console.log(`Server running at http://localhost:${PORT}`)
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
