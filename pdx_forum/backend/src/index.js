import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import authRoutes from "./routes/auth.js";
import topicRoutes from "./routes/topics.js";
import postRoutes from "./routes/posts.js";
import tagRoutes from "./routes/tags.js";
import adminRoutes from "./routes/admin.js";
import moderationRoutes from "./routes/moderation.js";
import profileRoutes from "./routes/profil.js";
import userRoutes from "./routes/users.js";
import badgeRoutes from "./routes/badges.js";
import wikiRoutes from "./routes/wiki.js";
import notificationRoutes from "./routes/notifications.js";
import messageRoutes from "./routes/messages.js";
import reactionRoutes from "./routes/reactions.js";
import categoryRoutes from "./routes/categories.js";
import followRoutes from "./routes/follows.js";
import uploadRoutes from "./routes/uploads.js";
import reportRoutes from "./routes/reports.js";

import { query } from "./db.js";

const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

const rawOrigins = process.env.CORS_ORIGIN || "http://localhost:3000";
const allowedOrigins = rawOrigins
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.set("trust proxy", 1);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      const err = new Error("Not allowed by CORS");
      err.status = 403;
      return callback(err);
    },
  })
);
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Try again later." },
});

app.use("/api", apiLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

app.use("/uploads", express.static("uploads"));

app.use("/api/auth", authRoutes);
app.use("/api/topics", topicRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/moderation", moderationRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/users", userRoutes);
app.use("/api/badges", badgeRoutes);
app.use("/api/wiki", wikiRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/reactions", reactionRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/follows", followRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/reports", reportRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "OK" });
});

app.get("/api/test-db", async (req, res) => {
  try {
    const result = await query("SELECT 1 AS ok");
    res.json({ db: "OK", result: result.rows[0] });
  } catch (err) {
    console.error("DB TEST ERROR:", err);
    res.status(500).json({ db: "ERROR" });
  }
});

app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  const status = err.status || 500;
  res.status(status).json({ message: err.message || "Server error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("Backend bezi na porte " + PORT);
});
