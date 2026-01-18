import express from "express";
import { authRequired, blockBanned } from "../middleware/auth.js";
import { query } from "../db.js";

const router = express.Router();

router.get("/topics/:id", authRequired, async (req, res) => {
  const topicId = Number(req.params.id);
  if (!Number.isInteger(topicId)) {
    return res.status(400).json({ message: "Invalid topic id" });
  }
  try {
    const r = await query(
      "SELECT 1 FROM topic_follows WHERE user_id = $1 AND topic_id = $2",
      [req.user.id, topicId]
    );
    res.json({ following: r.rowCount > 0 });
  } catch (err) {
    console.error("TOPIC FOLLOW STATUS ERROR:", err);
    res.status(500).json({ message: "Server error loading follow status" });
  }
});

router.post("/topics/:id", authRequired, blockBanned, async (req, res) => {
  const topicId = Number(req.params.id);
  if (!Number.isInteger(topicId)) {
    return res.status(400).json({ message: "Invalid topic id" });
  }
  try {
    const exists = await query("SELECT id FROM topics WHERE id = $1", [topicId]);
    if (exists.rowCount === 0) {
      return res.status(404).json({ message: "Topic not found" });
    }
    await query(
      `INSERT INTO topic_follows (user_id, topic_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, topic_id) DO NOTHING`,
      [req.user.id, topicId]
    );
    res.json({ message: "Followed" });
  } catch (err) {
    console.error("TOPIC FOLLOW ERROR:", err);
    res.status(500).json({ message: "Server error following topic" });
  }
});

router.delete("/topics/:id", authRequired, blockBanned, async (req, res) => {
  const topicId = Number(req.params.id);
  if (!Number.isInteger(topicId)) {
    return res.status(400).json({ message: "Invalid topic id" });
  }
  try {
    await query("DELETE FROM topic_follows WHERE user_id = $1 AND topic_id = $2", [
      req.user.id,
      topicId,
    ]);
    res.json({ message: "Unfollowed" });
  } catch (err) {
    console.error("TOPIC UNFOLLOW ERROR:", err);
    res.status(500).json({ message: "Server error unfollowing topic" });
  }
});

router.get("/users/:id", authRequired, async (req, res) => {
  const followedId = Number(req.params.id);
  if (!Number.isInteger(followedId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }
  try {
    const r = await query(
      "SELECT 1 FROM user_follows WHERE follower_id = $1 AND followed_id = $2",
      [req.user.id, followedId]
    );
    res.json({ following: r.rowCount > 0 });
  } catch (err) {
    console.error("USER FOLLOW STATUS ERROR:", err);
    res.status(500).json({ message: "Server error loading follow status" });
  }
});

router.post("/users/:id", authRequired, blockBanned, async (req, res) => {
  const followedId = Number(req.params.id);
  if (!Number.isInteger(followedId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }
  if (followedId === req.user.id) {
    return res.status(400).json({ message: "Cannot follow yourself" });
  }
  try {
    const exists = await query("SELECT id FROM users WHERE id = $1", [followedId]);
    if (exists.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    await query(
      `INSERT INTO user_follows (follower_id, followed_id)
       VALUES ($1, $2)
       ON CONFLICT (follower_id, followed_id) DO NOTHING`,
      [req.user.id, followedId]
    );
    res.json({ message: "Followed" });
  } catch (err) {
    console.error("USER FOLLOW ERROR:", err);
    res.status(500).json({ message: "Server error following user" });
  }
});

router.delete("/users/:id", authRequired, blockBanned, async (req, res) => {
  const followedId = Number(req.params.id);
  if (!Number.isInteger(followedId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }
  try {
    await query("DELETE FROM user_follows WHERE follower_id = $1 AND followed_id = $2", [
      req.user.id,
      followedId,
    ]);
    res.json({ message: "Unfollowed" });
  } catch (err) {
    console.error("USER UNFOLLOW ERROR:", err);
    res.status(500).json({ message: "Server error unfollowing user" });
  }
});

export default router;
