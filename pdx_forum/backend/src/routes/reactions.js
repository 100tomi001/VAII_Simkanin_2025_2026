import express from "express";
import { authRequired, blockBanned, requirePermission } from "../middleware/auth.js";
import { query } from "../db.js";

const router = express.Router();

// zoznam reakcií
router.get("/", async (_req, res) => {
  try {
    const r = await query("SELECT id, key, label, icon FROM reactions ORDER BY id");
    res.json(r.rows);
  } catch (err) {
    console.error("REACTIONS LIST ERROR:", err);
    res.status(500).json({ message: "Server error loading reactions" });
  }
});

// create reaction (admin/mod s can_manage_tags napr.)
router.post("/", authRequired, blockBanned, requirePermission("can_manage_tags"), async (req, res) => {
  const { key, label, icon } = req.body;
  if (!key || !label) return res.status(400).json({ message: "Missing key/label" });
  try {
    const r = await query(
      "INSERT INTO reactions (key, label, icon) VALUES ($1,$2,$3) RETURNING id, key, label, icon",
      [key.trim(), label.trim(), icon || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error("REACTIONS CREATE ERROR:", err);
    res.status(500).json({ message: "Server error creating reaction" });
  }
});

router.delete("/:id", authRequired, blockBanned, requirePermission("can_manage_tags"), async (req, res) => {
  try {
    await query("DELETE FROM post_reactions WHERE reaction_id = $1", [req.params.id]);
    await query("DELETE FROM reactions WHERE id = $1", [req.params.id]);
    res.json({ message: "Reaction deleted" });
  } catch (err) {
    console.error("REACTIONS DELETE ERROR:", err);
    res.status(500).json({ message: "Server error deleting reaction" });
  }
});

// toggle reaction na post
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

// súhrn reakcií na post
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

export default router;
