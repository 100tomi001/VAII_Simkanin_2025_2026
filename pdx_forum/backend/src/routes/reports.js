import express from "express";
import { authRequired, blockBanned, requireModeratorOrAdmin } from "../middleware/auth.js";
import { query } from "../db.js";

const router = express.Router();
const MAX_REASON_LEN = 500;
const ALLOWED_STATUS = ["open", "reviewed", "closed"];

router.post("/", authRequired, blockBanned, async (req, res) => {
  const { postId, userId, contextPostId, reason = "" } = req.body;
  const cleanReason = String(reason || "").trim();
  const postIdNum = Number(postId);
  const userIdNum = Number(userId);
  const contextPostIdNum = Number(contextPostId);

  if (!Number.isInteger(postIdNum) && !Number.isInteger(userIdNum)) {
    return res.status(400).json({ message: "Missing target" });
  }
  if (!cleanReason || cleanReason.length < 3 || cleanReason.length > MAX_REASON_LEN) {
    return res.status(400).json({ message: "Reason length is invalid" });
  }

  try {
    let targetUserId = null;
    let targetUsername = null;
    let targetPostId = null;
    let contextPost = null;
    let topicId = null;

    if (Number.isInteger(postIdNum)) {
      const postRes = await query(
        `SELECT p.id, p.user_id, p.topic_id, u.username
         FROM posts p
         JOIN users u ON u.id = p.user_id
         WHERE p.id = $1`,
        [postIdNum]
      );
      if (postRes.rowCount === 0) {
        return res.status(404).json({ message: "Post not found" });
      }
      targetPostId = postRes.rows[0].id;
      targetUserId = postRes.rows[0].user_id;
      targetUsername = postRes.rows[0].username;
      topicId = postRes.rows[0].topic_id;
    } else {
      if (userIdNum === req.user.id) {
        return res.status(400).json({ message: "Cannot report yourself" });
      }
      const userRes = await query(
        "SELECT id, username FROM users WHERE id = $1",
        [userIdNum]
      );
      if (userRes.rowCount === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      targetUserId = userRes.rows[0].id;
      targetUsername = userRes.rows[0].username;

      if (Number.isInteger(contextPostIdNum)) {
        const ctxRes = await query(
          `SELECT id, user_id, topic_id FROM posts WHERE id = $1`,
          [contextPostIdNum]
        );
        if (ctxRes.rowCount === 0) {
          return res.status(404).json({ message: "Context post not found" });
        }
        if (ctxRes.rows[0].user_id !== targetUserId) {
          return res.status(400).json({ message: "Context post does not belong to user" });
        }
        contextPost = ctxRes.rows[0];
        topicId = contextPost.topic_id;
      }
    }

    const insertRes = await query(
      `INSERT INTO reports (reporter_id, target_post_id, target_user_id, context_post_id, reason, status)
       VALUES ($1, $2, $3, $4, $5, 'open')
       RETURNING id`,
      [
        req.user.id,
        targetPostId,
        targetUserId,
        contextPost ? contextPost.id : null,
        cleanReason,
      ]
    );

    const reportId = insertRes.rows[0].id;
    const mods = await query(
      "SELECT id FROM users WHERE role IN ('admin', 'moderator')"
    );
    const modIds = mods.rows.map((r) => r.id).filter((id) => id !== req.user.id);
    if (modIds.length > 0) {
      await query(
        `
        INSERT INTO notifications (user_id, type, payload)
        SELECT x, 'report', $2::jsonb
        FROM unnest($1::int[]) AS x
        `,
        [
          modIds,
          JSON.stringify({
            reportId,
            type: targetPostId ? "post" : "user",
            postId: targetPostId,
            contextPostId: contextPost ? contextPost.id : null,
            topicId,
            reporterId: req.user.id,
            targetUserId,
            targetUsername,
          }),
        ]
      );
    }

    res.status(201).json({ id: reportId });
  } catch (err) {
    console.error("REPORT CREATE ERROR:", err);
    res.status(500).json({ message: "Server error creating report" });
  }
});

router.get("/", authRequired, requireModeratorOrAdmin, async (req, res) => {
  const { status } = req.query;
  const cond = [];
  const params = [];

  if (status && ALLOWED_STATUS.includes(status)) {
    params.push(status);
    cond.push(`r.status = $${params.length}`);
  }

  const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";

  try {
    const r = await query(
      `
      SELECT
        r.id,
        r.reason,
        r.status,
        r.created_at,
        r.reporter_id,
        rep.username AS reporter_username,
        r.target_post_id,
        r.target_user_id,
        r.context_post_id,
        tp.content AS post_content,
        tp.is_deleted AS post_deleted,
        cp.content AS context_post_content,
        cp.is_deleted AS context_post_deleted,
        tu.username AS target_username,
        t.id AS topic_id,
        t.title AS topic_title,
        r.resolved_by,
        ru.username AS resolved_by_name,
        r.resolved_at
      FROM reports r
      JOIN users rep ON rep.id = r.reporter_id
      LEFT JOIN posts tp ON tp.id = r.target_post_id
      LEFT JOIN posts cp ON cp.id = r.context_post_id
      LEFT JOIN users tu ON tu.id = COALESCE(r.target_user_id, tp.user_id)
      LEFT JOIN topics t ON t.id = COALESCE(tp.topic_id, cp.topic_id)
      LEFT JOIN users ru ON ru.id = r.resolved_by
      ${where}
      ORDER BY r.created_at DESC
      LIMIT 200
      `,
      params
    );
    res.json(r.rows);
  } catch (err) {
    console.error("REPORTS LIST ERROR:", err);
    res.status(500).json({ message: "Server error loading reports" });
  }
});

router.patch("/:id", authRequired, requireModeratorOrAdmin, async (req, res) => {
  const { status } = req.body;
  if (!ALLOWED_STATUS.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  try {
    const resolvedBy = status === "open" ? null : req.user.id;
    const resolvedAt = status === "open" ? null : new Date();
    const r = await query(
      `
      UPDATE reports
      SET status = $1,
          resolved_by = $2,
          resolved_at = $3
      WHERE id = $4
      RETURNING id, status, resolved_by, resolved_at
      `,
      [status, resolvedBy, resolvedAt, req.params.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ message: "Report not found" });
    res.json(r.rows[0]);
  } catch (err) {
    console.error("REPORT UPDATE ERROR:", err);
    res.status(500).json({ message: "Server error updating report" });
  }
});

export default router;
