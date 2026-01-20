import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { authRequired, blockBanned, requirePermission } from "../middleware/auth.js";

const router = express.Router();
const uploadDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const allowedTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || "";
    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowedTypes.has(file.mimetype)) {
      return cb(new Error("Invalid file type"));
    }
    cb(null, true);
  },
});

const toUrl = (req, filename) => `${req.protocol}://${req.get("host")}/uploads/${filename}`;

router.post("/avatar", authRequired, blockBanned, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Missing file" });
  res.json({ url: toUrl(req, req.file.filename) });
});

router.post(
  "/wiki",
  authRequired,
  blockBanned,
  requirePermission("can_edit_wiki"),
  upload.single("file"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ message: "Missing file" });
    res.json({ url: toUrl(req, req.file.filename) });
  }
);

router.post(
  "/badge",
  authRequired,
  blockBanned,
  requirePermission("can_manage_tags"),
  upload.single("file"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ message: "Missing file" });
    res.json({ url: toUrl(req, req.file.filename) });
  }
);

router.post(
  "/reaction",
  authRequired,
  blockBanned,
  requirePermission("can_manage_reactions"),
  upload.single("file"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ message: "Missing file" });
    res.json({ url: toUrl(req, req.file.filename) });
  }
);

router.use((err, req, res, next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ message: "File too large (max 2MB)" });
  }
  if (err) {
    return res.status(400).json({ message: err.message || "Upload error" });
  }
  next();
});

export default router;
