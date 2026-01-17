import express from "express";
import bcrypt from "bcryptjs";
import { authRequired, blockBanned } from "../middleware/auth.js";
import { query } from "../db.js";

const router = express.Router();

const selectUserWithBadges = `
  SELECT
    u.id,
    u.username,
    u.nickname,
    u.avatar_url,
    u.user_code,
    u.role,
    u.hide_badges,
    u.is_banned,
    u.banned_until,
    COALESCE(
      array_agg(ub.badge_id) FILTER (WHERE ub.badge_id IS NOT NULL),
      '{}'
    ) AS badge_ids
  FROM users u
  LEFT JOIN user_badges ub ON ub.user_id = u.id
  WHERE u.id = $1
  GROUP BY u.id
`;

router.get("/me", authRequired, async (req, res) => {
  const r = await query(selectUserWithBadges, [req.user.id]);
  if (r.rowCount === 0) return res.status(404).json({ message: "Profile not found" });
  res.json(r.rows[0]);
});

router.get("/:id", async (req, res) => {
  const r = await query(selectUserWithBadges, [req.params.id]);
  if (r.rowCount === 0) return res.status(404).json({ message: "Profile not found" });
  res.json(r.rows[0]);
});

router.patch("/me", authRequired, blockBanned, async (req, res) => {
  const { nickname, avatar_url, hide_badges } = req.body;
  await query(
    "UPDATE users SET nickname = COALESCE($1, nickname), avatar_url = COALESCE($2, avatar_url), hide_badges = COALESCE($3, hide_badges) WHERE id = $4",
    [nickname?.trim(), avatar_url?.trim(), hide_badges, req.user.id]
  );
  const r = await query(selectUserWithBadges, [req.user.id]);
  res.json(r.rows[0]);
});

router.post("/change-password", authRequired, blockBanned, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const u = await query("SELECT password_hash FROM users WHERE id=$1", [req.user.id]);
  if (u.rowCount === 0) return res.status(404).json({ message: "User not found" });

  const ok = await bcrypt.compare(currentPassword, u.rows[0].password_hash);
  if (!ok) return res.status(400).json({ message: "Wrong current password" });

  const hash = await bcrypt.hash(newPassword, 10);
  await query("UPDATE users SET password_hash=$1 WHERE id=$2", [hash, req.user.id]);
  res.json({ message: "Password changed" });
});

export default router;
