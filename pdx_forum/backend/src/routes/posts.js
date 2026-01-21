import express from "express";
import { authRequired, blockBanned } from "../middleware/auth.js";
import { query } from "../db.js";

const router = express.Router();

router.get("/:topicId", async (req, res) => {
  const topicId = req.params.topicId;

  try {
    const result = await query(
      `
      SELECT 
        p.id,
        p.content,
        p.is_deleted,
        p.created_at,
        p.parent_post_id,
        u.id AS author_id,
        u.username AS author_username,
        u.nickname AS author_nickname,
        u.avatar_url AS author_avatar_url,
        u.role AS author_role,
        u.created_at AS author_created_at,
        u.hide_badges AS author_hide_badges,
        COALESCE(
          (SELECT array_agg(ub.badge_id) FROM user_badges ub WHERE ub.user_id = u.id),
          '{}'
        ) AS badge_ids,
        (
          COALESCE(
            (SELECT COUNT(*) FROM post_reactions pr
             JOIN reactions r ON r.id = pr.reaction_id
             JOIN posts p3 ON p3.id = pr.post_id
             WHERE p3.user_id = u.id AND r.key = 'like'), 0
          ) +
          COALESCE(
            (SELECT COUNT(*) FROM topic_reactions tr
             JOIN reactions r2 ON r2.id = tr.reaction_id
             JOIN topics t2 ON t2.id = tr.topic_id
             WHERE t2.user_id = u.id AND r2.key = 'like'), 0
          )
        ) AS author_karma,
        (SELECT COUNT(*) FROM posts p2 WHERE p2.user_id = u.id AND p2.is_deleted = false) AS messages_count
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.topic_id = $1
      ORDER BY p.created_at ASC
      `,
      [topicId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("POSTS ERROR (GET /:topicId):", err);
    res.status(500).json({ message: "Server error loading posts" });
  }
});

router.post("/:topicId", authRequired, blockBanned, async (req, res) => {
  const topicId = req.params.topicId;
  const { content, parent_post_id = null } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ message: "Missing content" });
  }
  const cleanContent = content.trim();
  if (cleanContent.length < 1 || cleanContent.length > 5000) {
    return res.status(400).json({ message: "Content length is invalid" });
  }

  try {
    const lockRes = await query("SELECT is_locked, title FROM topics WHERE id = $1", [topicId]);
    if (lockRes.rowCount === 0) {
      return res.status(404).json({ message: "Topic not found" });
    }
    if (lockRes.rows[0].is_locked) {
      return res.status(403).json({ message: "Topic is locked" });
    }
    const topicTitle = lockRes.rows[0].title;

    let parentAuthorId = null;
    if (parent_post_id) {
      const parentCheck = await query(
        "SELECT id, user_id FROM posts WHERE id = $1 AND topic_id = $2",
        [parent_post_id, topicId]
      );
      if (parentCheck.rowCount === 0) {
        return res.status(400).json({ message: "Invalid parent_post_id" });
      }
      parentAuthorId = parentCheck.rows[0].user_id;
    }

    const insertRes = await query(
      `
      INSERT INTO posts (topic_id, user_id, content, parent_post_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, content, created_at, parent_post_id
      `,
      [topicId, req.user.id, cleanContent, parent_post_id]
    );

    const postRow = insertRes.rows[0];

    const userRes = await query(
      `SELECT id, username, nickname, avatar_url, hide_badges, role, created_at FROM users WHERE id = $1`,
      [req.user.id]
    );

    const u = userRes.rows[0];
    const karmaRes = await query(
      `
      SELECT
        (
          COALESCE(
            (SELECT COUNT(*) FROM post_reactions pr
             JOIN reactions r ON r.id = pr.reaction_id
             JOIN posts p2 ON p2.id = pr.post_id
             WHERE p2.user_id = $1 AND r.key = 'like'), 0
          ) +
          COALESCE(
            (SELECT COUNT(*) FROM topic_reactions tr
             JOIN reactions r2 ON r2.id = tr.reaction_id
             JOIN topics t2 ON t2.id = tr.topic_id
             WHERE t2.user_id = $1 AND r2.key = 'like'), 0
          )
        ) AS karma
      `,
      [req.user.id]
    );
    const authorKarma = Number(karmaRes.rows[0]?.karma || 0);

    // Notify parent author when someone replies to their comment (skip self-replies)
    if (parentAuthorId && parentAuthorId !== req.user.id) {
      try {
        await query(
          `INSERT INTO notifications (user_id, type, payload)
           VALUES ($1, 'comment_reply', $2::jsonb)`,
          [
            parentAuthorId,
            JSON.stringify({
              topicId,
              postId: postRow.id,
              parentPostId: parent_post_id,
              authorId: u.id,
              authorNickname: u.nickname || u.username,
              snippet: postRow.content.slice(0, 140),
            }),
          ]
        );
      } catch (notifErr) {
        console.error("Failed to create reply notification:", notifErr);
      }
    }

    // Notify followers of topic
    try {
      await query(
        `
        INSERT INTO notifications (user_id, type, payload)
        SELECT tf.user_id,
               'followed_topic_post',
               jsonb_build_object(
                 'topicId', $1::int,
                 'topicTitle', $2::text,
                 'postId', $3::int,
                 'authorId', $4::int,
                 'authorNickname', $5::text,
                 'snippet', $6::text
               )
        FROM topic_follows tf
        WHERE tf.topic_id = $1::int AND tf.user_id <> $4::int
        `,
        [
          topicId,
          topicTitle,
          postRow.id,
          u.id,
          u.nickname || u.username,
          postRow.content.slice(0, 140),
        ]
      );
    } catch (notifErr) {
      console.error("Failed to create topic follow notification:", notifErr);
    }

    // Notify followers of author
    try {
      await query(
        `
        INSERT INTO notifications (user_id, type, payload)
        SELECT uf.follower_id,
               'followed_user_post',
               jsonb_build_object(
                 'topicId', $1::int,
                 'topicTitle', $2::text,
                 'postId', $3::int,
                 'authorId', $4::int,
                 'authorNickname', $5::text,
                 'snippet', $6::text
               )
        FROM user_follows uf
        WHERE uf.followed_id = $4::int AND uf.follower_id <> $4::int
        `,
        [
          topicId,
          topicTitle,
          postRow.id,
          u.id,
          u.nickname || u.username,
          postRow.content.slice(0, 140),
        ]
      );
    } catch (notifErr) {
      console.error("Failed to create user follow notification:", notifErr);
    }

    res.status(201).json({
      id: postRow.id,
      content: postRow.content,
      created_at: postRow.created_at,
      parent_post_id: postRow.parent_post_id,
      author_id: u.id,
      author_username: u.username,
      author_nickname: u.nickname,
      author_avatar_url: u.avatar_url,
      author_role: u.role,
      author_created_at: u.created_at,
      author_karma: authorKarma,
      author_hide_badges: u.hide_badges,
      badge_ids: [],
      messages_count: 0,
      is_deleted: false,
    });
  } catch (err) {
    console.error("CREATE POST ERROR (POST /:topicId):", err);
    res.status(500).json({ message: "Server error creating post" });
  }
});

router.delete("/:id", authRequired, blockBanned, async (req, res) => {
  const postId = req.params.id;

  try {
    const check = await query(
      `SELECT user_id, is_deleted FROM posts WHERE id = $1`,
      [postId]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (check.rows[0].is_deleted) {
      return res.json({ message: "Post already deleted" });
    }

    const ownerId = check.rows[0].user_id;
    const isAuthor = ownerId === req.user.id;
    let canDelete = isAuthor;

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
      return res.status(403).json({ message: "Not allowed to delete this post" });
    }

    await query(
      `UPDATE posts
       SET is_deleted = true, deleted_at = NOW(), deleted_by = $1
       WHERE id = $2`,
      [req.user.id, postId]
    );

    return res.json({ message: "Post deleted" });
  } catch (err) {
    console.error("DELETE POST ERROR:", err);
    res.status(500).json({ message: "Server error deleting post" });
  }
});

router.patch("/:id", authRequired, blockBanned, async (req, res) => {
  const postId = req.params.id;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ message: "Content cannot be empty." });
  }
  const cleanContent = content.trim();
  if (cleanContent.length < 1 || cleanContent.length > 5000) {
    return res.status(400).json({ message: "Content length is invalid." });
  }

  try {
    const check = await query(
      `SELECT user_id, is_deleted FROM posts WHERE id = $1`,
      [postId]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ message: "Post neexistuje." });
    }

    if (check.rows[0].is_deleted) {
      return res.status(400).json({ message: "Post je uz zmazany." });
    }

    if (check.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ message: "Nemozes upravit tento prispevok." });
    }

    const updateRes = await query(
      `
      UPDATE posts
      SET content = $1
      WHERE id = $2
      RETURNING id, topic_id, user_id, content, created_at
      `,
      [cleanContent, postId]
    );

    const updated = updateRes.rows[0];

    res.json({
      id: updated.id,
      topic_id: updated.topic_id,
      content: updated.content,
      created_at: updated.created_at,
      is_deleted: false,
    });
  } catch (err) {
    console.error("UPDATE POST ERROR:", err);
    res.status(500).json({ message: "Server error updating post" });
  }
});

export default router;
