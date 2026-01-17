import express from "express";
import { query } from "../db.js";
import { authRequired, blockBanned, requirePermission } from "../middleware/auth.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await query(
      `
      SELECT 
        t.id,
        t.title,
        t.created_at,
        u.id AS author_id,
        u.username AS author,
        COUNT(p.id) AS replies,
        COALESCE(MAX(p.created_at), t.created_at) AS last_activity,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', tg.id, 'name', tg.name))
          FILTER (WHERE tg.id IS NOT NULL),
          '[]'
        ) AS tags
      FROM topics t
      JOIN users u ON u.id = t.user_id
      LEFT JOIN posts p ON p.topic_id = t.id
      LEFT JOIN topic_tags tt ON tt.topic_id = t.id
      LEFT JOIN tags tg ON tg.id = tt.tag_id
      GROUP BY t.id, t.title, t.created_at, u.id, u.username
      ORDER BY last_activity DESC;
      `
    );

    res.json(result.rows);
  } catch (err) {
    console.error("TOPICS ERROR (GET /):", err);
    res.status(500).json({ message: "Server error loading topics", detail: err.message });
  }
});

router.get("/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const result = await query(
      `
      SELECT
        t.id,
        t.title,
        t.created_at,
        u.id AS author_id,
        u.username AS author,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', tg.id, 'name', tg.name))
          FILTER (WHERE tg.id IS NOT NULL),
          '[]'
        ) AS tags
      FROM topics t
      JOIN users u ON u.id = t.user_id
      LEFT JOIN topic_tags tt ON tt.topic_id = t.id
      LEFT JOIN tags tg ON tg.id = tt.tag_id
      WHERE t.id = $1
      GROUP BY t.id, t.title, t.created_at, u.id, u.username
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Topic not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("TOPIC DETAIL ERROR (GET /:id):", err);
    res.status(500).json({ message: "Server error loading topic" });
  }
});

router.post("/", authRequired, blockBanned, async (req, res) => {
  const { title, content, tagIds = [] } = req.body;

  if (!title || !content) {
    return res.status(400).json({ message: "Missing title or content" });
  }

  try {
    const topicRes = await query(
      `INSERT INTO topics (user_id, title)
       VALUES ($1, $2)
       RETURNING id`,
      [req.user.id, title]
    );

    const topicId = topicRes.rows[0].id;

    await query(
      `INSERT INTO posts (topic_id, user_id, content)
       VALUES ($1, $2, $3)`,
      [topicId, req.user.id, content]
    );

    if (tagIds.length > 0) {
      await query(
        `
        INSERT INTO topic_tags (topic_id, tag_id)
        SELECT $1, id FROM tags WHERE id = ANY($2::int[])
        `,
        [topicId, tagIds]
      );
    }

    return res.status(201).json({ id: topicId, message: "Topic created" });
  } catch (err) {
    console.error("CREATE TOPIC ERROR (POST /):", err);
    return res.status(500).json({ message: "Server error creating topic", detail: err.message });
  }
});

// PATCH /api/topics/:id/tags - moderator/admin s pravom na tagy
router.patch("/:id/tags", authRequired, blockBanned, requirePermission("can_manage_tags"), async (req, res) => {
  const topicId = req.params.id;
  const { tagIds = [] } = req.body;

  try {
    const oldRes = await query(
      "SELECT tag_id FROM topic_tags WHERE topic_id = $1",
      [topicId]
    );
    const oldIds = oldRes.rows.map((r) => r.tag_id);

    await query("DELETE FROM topic_tags WHERE topic_id = $1", [topicId]);

    if (tagIds.length > 0) {
      await query(
        `
        INSERT INTO topic_tags (topic_id, tag_id)
        SELECT $1, id FROM tags WHERE id = ANY($2::int[])
        `,
        [topicId, tagIds]
      );
    }

    await query(
      "INSERT INTO topic_tag_audit (topic_id, changed_by, old_tag_ids, new_tag_ids) VALUES ($1, $2, $3, $4)",
      [topicId, req.user.id, oldIds, tagIds]
    );

    res.json({ message: "Tags updated" });
  } catch (err) {
    console.error("UPDATE TOPIC TAGS ERROR:", err);
    res.status(500).json({ message: "Server error updating tags" });
  }
});

export default router;
