import { Application, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { UserRepository } from "../storage/UserRepository";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "avatars");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export function setupProfileRoutes(app: Application, userRepo: UserRepository) {
  const storage = multer.memoryStorage();
  const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/gif",
      ];
      cb(null, allowed.includes(file.mimetype));
    },
  });

  app.post(
    "/api/profile/avatar",
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        const userId = String(req.body.userId || "");
        if (!req.file) return res.status(400).json({ error: "No file" });
        const filename = `${Date.now()}-${uuidv4()}.png`;
        const filepath = path.join(UPLOAD_DIR, filename);
        await sharp(req.file.buffer)
          .resize({ width: 64, height: 64, fit: "cover" })
          .png()
          .toFile(filepath);
        const avatarUrl = `/uploads/avatars/${filename}`;
        if (userId) {
          const user = userRepo.findById(userId);
          if (user) {
            user.avatarPath = avatarUrl;
            userRepo.upsert(user);
          } else {
            // create minimal user
            userRepo.upsert({
              id: userId,
              nickname: null,
              color: null,
              avatarPath: avatarUrl,
              connected: false,
              lastSeen: null,
            } as any);
          }
        }
        return res.status(201).json({ avatarUrl });
      } catch (err: any) {
        console.error(err);
        return res.status(400).json({ error: String(err?.message || err) });
      }
    }
  );

  app.post("/api/profile/save", (req: Request, res: Response) => {
    try {
      const body = req.body;
      if (!body || !body.userId)
        return res.status(400).json({ error: "userId required" });
      const { userId, nickname, color, avatarPath } = body;
      userRepo.upsert({
        id: userId,
        nickname,
        color,
        avatarPath,
        connected: true,
        lastSeen: new Date().toISOString(),
      } as any);
      res.json({ ok: true });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  app.get("/api/profile/generateUserId", (req: Request, res: Response) => {
    const userId = uuidv4();
    res.json({ userId });
  });
}
