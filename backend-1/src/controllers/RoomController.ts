import { Application, Request, Response } from "express";
import { RoomRepository } from "../storage/RoomRepository";
import { MessageRepository } from "../storage/MessageRepository";

export function setupRoomRoutes(
  app: Application,
  roomRepo: RoomRepository,
  msgRepo: MessageRepository
) {
  app.get("/api/rooms", (req: Request, res: Response) => {
    const rooms = roomRepo.findActivePublic();
    res.json(rooms);
  });

  app.post("/api/rooms", (req: Request, res: Response) => {
    const { name, isPrivate, maxParticipants, creatorUserId } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    const room = roomRepo.create(
      name,
      Boolean(isPrivate),
      typeof maxParticipants === "number" ? maxParticipants : null,
      creatorUserId || null
    );
    res.status(201).json(room);
  });

  app.get("/api/archive/rooms", (req: Request, res: Response) => {
    const rooms = roomRepo.listArchived();
    res.json(rooms);
  });

  app.get("/api/archive/rooms/:id", (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const room = roomRepo.findById(id);
    if (!room) return res.status(404).json({ error: "room not found" });
    const messages = msgRepo.findAllByRoom(id);
    res.json({ roomId: id, messages });
  });
}
