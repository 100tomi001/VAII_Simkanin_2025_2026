import "dotenv/config";
import express from "express";
import cors from "cors";

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


const app = express();

app.use(cors());
app.use(express.json());

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

import { query } from "./db.js";

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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("Backend beží na porte " + PORT);
});
