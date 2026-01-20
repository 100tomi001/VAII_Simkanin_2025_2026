import express from "express";
import { query } from "../db.js";
import { authRequired, blockBanned, requirePermission, requireModeratorOrAdmin } from "../middleware/auth.js";

const router = express.Router();

router.get("/permissions/me", authRequired, async (req, res) => {
  try {
    if (req.user.role === "admin") {
      return res.json({
        role: "admin",
        can_manage_tags: true,
        can_delete_posts: true,
        can_ban_users: true,
        can_edit_wiki: true,
        can_manage_reactions: true,
      });
    }

    const permRes = await query(
      "SELECT can_manage_tags, can_delete_posts, can_ban_users, can_edit_wiki, can_manage_reactions FROM moderator_permissions WHERE user_id = $1",
      [req.user.id]
    );

    const perms = permRes.rows[0] || {
      can_manage_tags: false,
      can_delete_posts: false,
      can_ban_users: false,
      can_edit_wiki: false,
      can_manage_reactions: false,
    };

    res.json({ role: req.user.role, ...perms });
  } catch (err) {
    console.error("PERMS ME ERROR:", err);
    res.status(500).json({ message: "Server error loading permissions" });
  }
});

router.post("/warn", authRequired, blockBanned, requirePermission("can_ban_users"), async (req, res) => {
  const { userId, reason = "" } = req.body;

  try {
    const targetRes = await query("SELECT role FROM users WHERE id = $1", [userId]);
    if (targetRes.rowCount === 0) return res.status(404).json({ message: "User not found" });
    if (targetRes.rows[0].role === "admin") {
      return res.status(403).json({ message: "Cannot warn admin" });
    }

    await query(
      "INSERT INTO bans (user_id, action, banned_by, reason, banned_until) VALUES ($1, $2, $3, $4, $5)",
      [userId, "warn", req.user.id, reason, null]
    );

    res.json({ message: "User warned" });
  } catch (err) {
    console.error("WARN ERROR:", err);
    res.status(500).json({ message: "Server error warning user" });
  }
});

router.post("/mute", authRequired, blockBanned, requirePermission("can_ban_users"), async (req, res) => {
  const { userId, reason = "", minutes } = req.body;
  const minutesNum = Number(minutes);

  if (!Number.isInteger(minutesNum) || minutesNum <= 0) {
    return res.status(400).json({ message: "Invalid mute duration" });
  }

  try {
    const targetRes = await query("SELECT role FROM users WHERE id = $1", [userId]);
    if (targetRes.rowCount === 0) return res.status(404).json({ message: "User not found" });
    if (targetRes.rows[0].role === "admin") {
      return res.status(403).json({ message: "Cannot mute admin" });
    }

    const bannedUntil = new Date(Date.now() + minutesNum * 60 * 1000);

    await query(
      "UPDATE users SET is_banned = true, banned_until = $1 WHERE id = $2",
      [bannedUntil, userId]
    );

    await query(
      "INSERT INTO bans (user_id, action, banned_by, reason, banned_until) VALUES ($1, $2, $3, $4, $5)",
      [userId, "mute", req.user.id, reason, bannedUntil]
    );

    res.json({ message: "User muted", banned_until: bannedUntil });
  } catch (err) {
    console.error("MUTE ERROR:", err);
    res.status(500).json({ message: "Server error muting user" });
  }
});

router.post("/ban", authRequired, blockBanned, requirePermission("can_ban_users"), async (req, res) => {
  const { userId, reason = "", bannedUntil = null } = req.body;

  try {
    const targetRes = await query("SELECT role FROM users WHERE id = $1", [userId]);
    if (targetRes.rowCount === 0) return res.status(404).json({ message: "User not found" });
    if (targetRes.rows[0].role === "admin") {
      return res.status(403).json({ message: "Cannot ban admin" });
    }

    await query(
      "UPDATE users SET is_banned = true, banned_until = $1 WHERE id = $2",
      [bannedUntil, userId]
    );

    await query(
      "INSERT INTO bans (user_id, action, banned_by, reason, banned_until) VALUES ($1, $2, $3, $4, $5)",
      [userId, "ban", req.user.id, reason, bannedUntil]
    );

    res.json({ message: "User banned" });
  } catch (err) {
    console.error("BAN ERROR:", err);
    res.status(500).json({ message: "Server error banning user" });
  }
});

router.post("/unban", authRequired, blockBanned, requirePermission("can_ban_users"), async (req, res) => {
  const { userId, reason = "" } = req.body;

  try {
    await query(
      "UPDATE users SET is_banned = false, banned_until = NULL WHERE id = $1",
      [userId]
    );

    await query(
      "INSERT INTO bans (user_id, action, banned_by, reason, banned_until) VALUES ($1, $2, $3, $4, $5)",
      [userId, "unban", req.user.id, reason, null]
    );

    res.json({ message: "User unbanned" });
  } catch (err) {
    console.error("UNBAN ERROR:", err);
    res.status(500).json({ message: "Server error unbanning user" });
  }
});

router.get("/bans", authRequired, requireModeratorOrAdmin, async (req, res) => {
  try {
    const result = await query(
      `
      SELECT b.id, b.user_id, u.username, b.action, b.reason, b.banned_until, b.created_at,
             a.username AS banned_by_name
      FROM bans b
      JOIN users u ON u.id = b.user_id
      JOIN users a ON a.id = b.banned_by
      ORDER BY b.created_at DESC
      LIMIT 100
      `
    );

    res.json(result.rows);
  } catch (err) {
    console.error("BANS LIST ERROR:", err);
    res.status(500).json({ message: "Server error loading bans" });
  }
});

router.get("/tag-audit", authRequired, requireModeratorOrAdmin, async (req, res) => {
  const topicId = req.query.topicId;

  try {
    const result = await query(
      `
      SELECT tta.id, tta.topic_id, tta.old_tag_ids, tta.new_tag_ids, tta.created_at,
             u.username AS changed_by
      FROM topic_tag_audit tta
      JOIN users u ON u.id = tta.changed_by
      WHERE ($1::int IS NULL OR tta.topic_id = $1::int)
      ORDER BY tta.created_at DESC
      LIMIT 50
      `,
      [topicId || null]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("TAG AUDIT ERROR:", err);
    res.status(500).json({ message: "Server error loading tag audit" });
  }
});

export default router;
