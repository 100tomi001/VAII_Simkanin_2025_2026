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
    u.about,
    u.avatar_url,
    u.user_code,
    u.role,
    u.hide_badges,
    u.is_banned,
    u.banned_until,
    u.created_at,
    COALESCE(
      array_agg(ub.badge_id) FILTER (WHERE ub.badge_id IS NOT NULL),
      '{}'
    ) AS badge_ids,
    (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id AND p.is_deleted = false) AS posts_count,
    (SELECT COUNT(*) FROM topics t WHERE t.user_id = u.id) AS topics_count,
    (
      COALESCE(
        (SELECT COUNT(*) FROM post_reactions pr
         JOIN reactions r ON r.id = pr.reaction_id
         JOIN posts p2 ON p2.id = pr.post_id
         WHERE p2.user_id = u.id AND r.key = 'like'), 0
      ) +
      COALESCE(
        (SELECT COUNT(*) FROM topic_reactions tr
         JOIN reactions r2 ON r2.id = tr.reaction_id
         JOIN topics t2 ON t2.id = tr.topic_id
         WHERE t2.user_id = u.id AND r2.key = 'like'), 0
      )
    ) AS reaction_score
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

// profilove prispevky (komentare)
router.get("/:id/posts", async (req, res) => {
  try {
    const r = await query(
      `
      SELECT
        p.id,
        p.content,
        p.created_at,
        p.is_deleted,
        t.id AS topic_id,
        t.title AS topic_title
      FROM posts p
      JOIN topics t ON t.id = p.topic_id
      WHERE p.user_id = $1 AND p.is_deleted = false
      ORDER BY p.created_at DESC
      LIMIT 50
      `,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error("PROFILE POSTS ERROR:", err);
    res.status(500).json({ message: "Server error loading profile posts" });
  }
});

// profilove temy (topics)
router.get("/:id/topics", async (req, res) => {
  try {
    const r = await query(
      `
      SELECT
        t.id,
        t.title,
        t.created_at,
        COUNT(p.id) AS replies,
        COALESCE(MAX(p.created_at), t.created_at) AS last_activity
      FROM topics t
      LEFT JOIN posts p ON p.topic_id = t.id
      WHERE t.user_id = $1
      GROUP BY t.id, t.title, t.created_at
      ORDER BY t.created_at DESC
      LIMIT 50
      `,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error("PROFILE TOPICS ERROR:", err);
    res.status(500).json({ message: "Server error loading profile topics" });
  }
});

// latest activity (komentare + reakcie)
router.get("/:id/activity", async (req, res) => {
  try {
    const r = await query(
      `
      SELECT * FROM (
        SELECT
          'post' AS type,
          p.id AS post_id,
          p.content AS content,
          p.created_at AS created_at,
          t.id AS topic_id,
          t.title AS topic_title,
          NULL::text AS reaction_label
        FROM posts p
        JOIN topics t ON t.id = p.topic_id
        WHERE p.user_id = $1 AND p.is_deleted = false

        UNION ALL

        SELECT
          'reaction' AS type,
          pr.post_id AS post_id,
          NULL::text AS content,
          pr.created_at AS created_at,
          t.id AS topic_id,
          t.title AS topic_title,
          r.label AS reaction_label
        FROM post_reactions pr
        JOIN posts p ON p.id = pr.post_id
        JOIN topics t ON t.id = p.topic_id
        JOIN reactions r ON r.id = pr.reaction_id
        WHERE pr.user_id = $1

        UNION ALL

        SELECT
          'reaction' AS type,
          NULL::int AS post_id,
          NULL::text AS content,
          tr.created_at AS created_at,
          t.id AS topic_id,
          t.title AS topic_title,
          r.label AS reaction_label
        FROM topic_reactions tr
        JOIN topics t ON t.id = tr.topic_id
        JOIN reactions r ON r.id = tr.reaction_id
        WHERE tr.user_id = $1
      ) s
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error("PROFILE ACTIVITY ERROR:", err);
    res.status(500).json({ message: "Server error loading activity" });
  }
});

router.get("/:id", async (req, res) => {
  const r = await query(selectUserWithBadges, [req.params.id]);
  if (r.rowCount === 0) return res.status(404).json({ message: "Profile not found" });
  res.json(r.rows[0]);
});

router.patch("/me", authRequired, blockBanned, async (req, res) => {
  const { nickname, avatar_url, hide_badges, about } = req.body;
  await query(
    "UPDATE users SET nickname = COALESCE($1, nickname), avatar_url = COALESCE($2, avatar_url), hide_badges = COALESCE($3, hide_badges), about = COALESCE($4, about) WHERE id = $5",
    [nickname?.trim(), avatar_url?.trim(), hide_badges, about?.trim(), req.user.id]
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
