import express from "express";
import http from "http";
import path from "path";
import { DatabaseFactory } from "./storage/DatabaseFactory";
import { RoomRepository } from "./storage/RoomRepository";
import { MessageRepository } from "./storage/MessageRepository";
import { ChatServer } from "./ws/ChatServer";

const db = DatabaseFactory.create(
  path.join(__dirname, "..", "data", "database.sqlite")
);

process.on("SIGINT", () => {
  console.log("Shutting down...");
  db.close();
  process.exit(0);
});

async function main() {
  const app = express();
  app.use(express.json());

  const server = http.createServer(app);

  const roomRepo = new RoomRepository(db);
  const messageRepo = new MessageRepository(db);

  const chatServer = new ChatServer(server, roomRepo, messageRepo);
  chatServer.setup();

  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    const frontendPath = path.join(
      __dirname,
      "..",
      "..",
      "frontend",
      "dist",
      "chat-app",
      "browser"
    );

    app.use(express.static(frontendPath));

    app.get("*", (_, res) => {
      res.sendFile(path.join(frontendPath, "index.html"));
    });
  }

  const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
  server.listen(PORT, () =>
    console.log(`Server running at http://localhost:${PORT}`)
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
