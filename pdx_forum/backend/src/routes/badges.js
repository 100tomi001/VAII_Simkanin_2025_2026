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
  const r = await query(
    "INSERT INTO badges (name, description, icon_url) VALUES ($1,$2,$3) RETURNING *",
    [name, description || null, icon_url || null]
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

export default router;
