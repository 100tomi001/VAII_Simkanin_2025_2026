import express from "express";
import { authRequired, blockBanned, requirePermission } from "../middleware/auth.js";
import { query } from "../db.js";

const router = express.Router();

router.get("/", async (_req, res) => {
  const r = await query("SELECT id, name, description, icon_url FROM badges ORDER BY id");
  res.json(r.rows);
});

router.post("/", authRequired, blockBanned, requirePermission("can_manage_tags"), async (req, res) => {
  const { name, description, icon_url } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Missing badge name" });
  }
  const cleanName = name.trim();
  if (cleanName.length < 2 || cleanName.length > 50) {
    return res.status(400).json({ message: "Badge name length is invalid" });
  }
  if (description && description.length > 200) {
    return res.status(400).json({ message: "Badge description too long" });
  }
  if (icon_url && icon_url.length > 500) {
    return res.status(400).json({ message: "Icon URL too long" });
  }
  const r = await query(
    "INSERT INTO badges (name, description, icon_url) VALUES ($1,$2,$3) RETURNING *",
    [cleanName, description || null, icon_url || null]
  );
  res.status(201).json(r.rows[0]);
});

router.post("/assign", authRequired, blockBanned, async (req, res) => {
  const { badgeId } = req.body;
  await query(
    "INSERT INTO user_badges (user_id, badge_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
    [req.user.id, badgeId]
  );
  res.json({ message: "Badge assigned" });
});

router.delete("/assign/:badgeId", authRequired, blockBanned, async (req, res) => {
  await query("DELETE FROM user_badges WHERE user_id=$1 AND badge_id=$2", [
    req.user.id,
    req.params.badgeId,
  ]);
  res.json({ message: "Badge removed" });
});

// delete badge (admin/mod with can_manage_tags)
router.delete("/:id", authRequired, blockBanned, requirePermission("can_manage_tags"), async (req, res) => {
  try {
    await query("DELETE FROM user_badges WHERE badge_id = $1", [req.params.id]);
    await query("DELETE FROM badges WHERE id = $1", [req.params.id]);
    res.json({ message: "Badge deleted" });
  } catch (err) {
    console.error("DELETE BADGE ERROR:", err);
    res.status(500).json({ message: "Server error deleting badge" });
  }
});

router.patch("/:id", authRequired, blockBanned, requirePermission("can_manage_tags"), async (req, res) => {
  const { name, description, icon_url } = req.body;
  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ message: "Missing badge name" });
  }
  if (name && (name.trim().length < 2 || name.trim().length > 50)) {
    return res.status(400).json({ message: "Badge name length is invalid" });
  }
  if (description && description.length > 200) {
    return res.status(400).json({ message: "Badge description too long" });
  }
  if (icon_url && icon_url.length > 500) {
    return res.status(400).json({ message: "Icon URL too long" });
  }
  try {
    const r = await query(
      `UPDATE badges
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           icon_url = COALESCE($3, icon_url)
       WHERE id = $4
       RETURNING *`,
      [name?.trim(), description, icon_url, req.params.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ message: "Badge not found" });
    res.json(r.rows[0]);
  } catch (err) {
    console.error("UPDATE BADGE ERROR:", err);
    res.status(500).json({ message: "Server error updating badge" });
  }
});

export default router;
