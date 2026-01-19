import express from "express";
import { authRequired, blockBanned, requirePermission } from "../middleware/auth.js";
import { query } from "../db.js";

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const r = await query("SELECT id, key, label, icon FROM reactions ORDER BY id");
    res.json(r.rows);
  } catch (err) {
    console.error("REACTIONS LIST ERROR:", err);
    res.status(500).json({ message: "Server error loading reactions" });
  }
});

router.post("/", authRequired, blockBanned, requirePermission("can_manage_reactions"), async (req, res) => {
  const { key, label, icon } = req.body;
  if (!key || !label) return res.status(400).json({ message: "Missing key/label" });
  const cleanKey = key.trim();
  const cleanLabel = label.trim();
  if (!/^[a-z0-9_-]{2,32}$/.test(cleanKey)) {
    return res.status(400).json({ message: "Invalid reaction key" });
  }
  if (cleanLabel.length < 2 || cleanLabel.length > 30) {
    return res.status(400).json({ message: "Invalid reaction label length" });
  }
  if (icon && icon.length > 500) {
    return res.status(400).json({ message: "Icon too long" });
  }
  try {
    const r = await query(
      "INSERT INTO reactions (key, label, icon) VALUES ($1,$2,$3) RETURNING id, key, label, icon",
      [cleanKey, cleanLabel, icon || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error("REACTIONS CREATE ERROR:", err);
    res.status(500).json({ message: "Server error creating reaction" });
  }
});

router.delete("/:id", authRequired, blockBanned, requirePermission("can_manage_reactions"), async (req, res) => {
  try {
    const r = await query("SELECT key FROM reactions WHERE id = $1", [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ message: "Reaction not found" });
    if (r.rows[0].key === "like") {
      return res.status(400).json({ message: "Cannot delete like reaction" });
    }
    await query("DELETE FROM post_reactions WHERE reaction_id = $1", [req.params.id]);
    await query("DELETE FROM topic_reactions WHERE reaction_id = $1", [req.params.id]);
    await query("DELETE FROM reactions WHERE id = $1", [req.params.id]);
    res.json({ message: "Reaction deleted" });
  } catch (err) {
    console.error("REACTIONS DELETE ERROR:", err);
    res.status(500).json({ message: "Server error deleting reaction" });
  }
});

router.post("/post/:postId", authRequired, blockBanned, async (req, res) => {
  const postId = req.params.postId;
  const { reactionId } = req.body;
  if (!reactionId) return res.status(400).json({ message: "Missing reactionId" });
  try {
    const exists = await query(
      "SELECT 1 FROM post_reactions WHERE post_id = $1 AND user_id = $2 AND reaction_id = $3",
      [postId, req.user.id, reactionId]
    );
    if (exists.rowCount > 0) {
      await query(
        "DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2 AND reaction_id = $3",
        [postId, req.user.id, reactionId]
      );
      return res.json({ message: "Removed" });
    } else {
      await query(
        "INSERT INTO post_reactions (post_id, user_id, reaction_id) VALUES ($1,$2,$3)",
        [postId, req.user.id, reactionId]
      );
      return res.status(201).json({ message: "Added" });
    }
  } catch (err) {
    console.error("POST REACT ERROR:", err);
    res.status(500).json({ message: "Server error reacting" });
  }
});

router.get("/post/:postId", async (req, res) => {
  const postId = req.params.postId;
  try {
    const r = await query(
      `
      SELECT pr.reaction_id, COUNT(*)::int AS cnt, array_agg(pr.user_id) AS users
      FROM post_reactions pr
      WHERE pr.post_id = $1
      GROUP BY pr.reaction_id
      `,
      [postId]
    );
    res.json(r.rows);
  } catch (err) {
    console.error("POST REACT LIST ERROR:", err);
    res.status(500).json({ message: "Server error loading reactions" });
  }
});

router.get("/posts/summary", async (req, res) => {
  const topicId = Number(req.query.topicId);
  if (!Number.isInteger(topicId)) {
    return res.status(400).json({ message: "Invalid topicId" });
  }
  try {
    const r = await query(
      `
      SELECT pr.post_id, pr.reaction_id, COUNT(*)::int AS cnt, array_agg(pr.user_id) AS users
      FROM post_reactions pr
      JOIN posts p ON p.id = pr.post_id
      WHERE p.topic_id = $1
      GROUP BY pr.post_id, pr.reaction_id
      `,
      [topicId]
    );
    res.json(r.rows);
  } catch (err) {
    console.error("POST REACT SUMMARY ERROR:", err);
    res.status(500).json({ message: "Server error loading reactions" });
  }
});

router.post("/topic/:topicId", authRequired, blockBanned, async (req, res) => {
  const topicId = req.params.topicId;
  const { reactionId } = req.body;
  if (!reactionId) return res.status(400).json({ message: "Missing reactionId" });
  try {
    const exists = await query(
      "SELECT 1 FROM topic_reactions WHERE topic_id = $1 AND user_id = $2 AND reaction_id = $3",
      [topicId, req.user.id, reactionId]
    );
    if (exists.rowCount > 0) {
      await query(
        "DELETE FROM topic_reactions WHERE topic_id = $1 AND user_id = $2 AND reaction_id = $3",
        [topicId, req.user.id, reactionId]
      );
      return res.json({ message: "Removed" });
    } else {
      await query(
        "INSERT INTO topic_reactions (topic_id, user_id, reaction_id) VALUES ($1,$2,$3)",
        [topicId, req.user.id, reactionId]
      );
      return res.status(201).json({ message: "Added" });
    }
  } catch (err) {
    console.error("TOPIC REACT ERROR:", err);
    res.status(500).json({ message: "Server error reacting" });
  }
});

router.get("/topic/:topicId", async (req, res) => {
  const topicId = req.params.topicId;
  try {
    const r = await query(
      `
      SELECT tr.reaction_id, COUNT(*)::int AS cnt, array_agg(tr.user_id) AS users
      FROM topic_reactions tr
      WHERE tr.topic_id = $1
      GROUP BY tr.reaction_id
      `,
      [topicId]
    );
    res.json(r.rows);
  } catch (err) {
    console.error("TOPIC REACT LIST ERROR:", err);
    res.status(500).json({ message: "Server error loading reactions" });
  }
});

export default router;
