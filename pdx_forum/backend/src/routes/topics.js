import express from "express";
import { query } from "../db.js";
import { authRequired, blockBanned, requirePermission } from "../middleware/auth.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const { category } = req.query;
  try {
    const params = [];
    let where = "";
    if (category) {
      params.push(category);
      where = `WHERE c.slug = $${params.length}`;
    }

    const result = await query(
      `
      SELECT 
        t.id,
        t.title,
        t.created_at,
        t.is_sticky,
        t.is_locked,
        c.id AS category_id,
        c.name AS category_name,
        c.slug AS category_slug,
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
      LEFT JOIN forum_categories c ON c.id = t.category_id
      LEFT JOIN posts p ON p.topic_id = t.id
      LEFT JOIN topic_tags tt ON tt.topic_id = t.id
      LEFT JOIN tags tg ON tg.id = tt.tag_id
      ${where}
      GROUP BY t.id, t.title, t.created_at, t.is_sticky, t.is_locked, c.id, c.name, c.slug, u.id, u.username
      ORDER BY t.is_sticky DESC, last_activity DESC;
      `,
      params
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
        t.is_sticky,
        t.is_locked,
        c.id AS category_id,
        c.name AS category_name,
        c.slug AS category_slug,
        u.id AS author_id,
        u.username AS author,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', tg.id, 'name', tg.name))
          FILTER (WHERE tg.id IS NOT NULL),
          '[]'
        ) AS tags
      FROM topics t
      JOIN users u ON u.id = t.user_id
      LEFT JOIN forum_categories c ON c.id = t.category_id
      LEFT JOIN topic_tags tt ON tt.topic_id = t.id
      LEFT JOIN tags tg ON tg.id = tt.tag_id
      WHERE t.id = $1
      GROUP BY t.id, t.title, t.created_at, t.is_sticky, t.is_locked, c.id, c.name, c.slug, u.id, u.username
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
  const { title, content, tagIds = [], category_id } = req.body;

  if (!title || !content || !category_id) {
    return res.status(400).json({ message: "Missing title/content/category" });
  }

  try {
    const catCheck = await query("SELECT id FROM forum_categories WHERE id = $1", [category_id]);
    if (catCheck.rowCount === 0) {
      return res.status(400).json({ message: "Invalid category" });
    }

    const userRes = await query("SELECT username, nickname FROM users WHERE id = $1", [req.user.id]);
    const authorName = userRes.rows[0]?.nickname || userRes.rows[0]?.username || "User";

    const topicRes = await query(
      `INSERT INTO topics (user_id, title, category_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [req.user.id, title, category_id]
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

    try {
      await query(
        `
        INSERT INTO notifications (user_id, type, payload)
        SELECT uf.follower_id,
               'followed_user_topic',
               jsonb_build_object(
                 'topicId', $1,
                 'topicTitle', $2,
                 'authorId', $3,
                 'authorNickname', $4
               )
        FROM user_follows uf
        WHERE uf.followed_id = $3 AND uf.follower_id <> $3
        `,
        [topicId, title, req.user.id, authorName]
      );
    } catch (notifErr) {
      console.error("Failed to create new topic notification:", notifErr);
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

// PATCH /api/topics/:id/moderation - sticky/lock/category (admin alebo moderator s pravom)
router.patch("/:id/moderation", authRequired, blockBanned, requirePermission("can_manage_tags"), async (req, res) => {
  const topicId = req.params.id;
  const { is_sticky, is_locked, category_id } = req.body;
  try {
    if (category_id) {
      const catCheck = await query("SELECT id FROM forum_categories WHERE id = $1", [category_id]);
      if (catCheck.rowCount === 0) {
        return res.status(400).json({ message: "Invalid category" });
      }
    }
    const r = await query(
      `UPDATE topics
       SET is_sticky = COALESCE($1, is_sticky),
           is_locked = COALESCE($2, is_locked),
           category_id = COALESCE($3, category_id)
       WHERE id = $4
       RETURNING id, is_sticky, is_locked, category_id`,
      [is_sticky, is_locked, category_id, topicId]
    );
    if (r.rowCount === 0) return res.status(404).json({ message: "Topic not found" });
    res.json(r.rows[0]);
  } catch (err) {
    console.error("TOPIC MODERATION ERROR:", err);
    res.status(500).json({ message: "Server error updating topic" });
  }
});

// DELETE /api/topics/:id - autor alebo admin/moderator s can_delete_posts
router.delete("/:id", authRequired, blockBanned, async (req, res) => {
  const topicId = req.params.id;

  try {
    const check = await query("SELECT user_id FROM topics WHERE id = $1", [topicId]);
    if (check.rowCount === 0) return res.status(404).json({ message: "Topic not found" });

    const ownerId = check.rows[0].user_id;
    let canDelete = ownerId === req.user.id;

    if (!canDelete && req.user.role === "admin") {
      canDelete = true;
    }

    if (!canDelete && req.user.role === "moderator") {
      const permRes = await query(
        "SELECT can_delete_posts FROM moderator_permissions WHERE user_id = $1",
        [req.user.id]
      );
      if (permRes.rows[0]?.can_delete_posts) canDelete = true;
    }

    if (!canDelete) {
      return res.status(403).json({ message: "Not allowed to delete this topic" });
    }

    await query("DELETE FROM topics WHERE id = $1", [topicId]);
    res.json({ message: "Topic deleted" });
  } catch (err) {
    console.error("DELETE TOPIC ERROR:", err);
    res.status(500).json({ message: "Server error deleting topic" });
  }
});

export default router;
