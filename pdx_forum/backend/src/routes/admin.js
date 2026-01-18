import express from "express";
import { query } from "../db.js";
import { authRequired, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.get("/users", authRequired, requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `
      SELECT 
        u.id, u.username, u.email, u.role, u.is_banned, u.banned_until,
        mp.can_manage_tags, mp.can_delete_posts, mp.can_ban_users, mp.can_edit_wiki, mp.can_manage_reactions
      FROM users u
      LEFT JOIN moderator_permissions mp ON mp.user_id = u.id
      ORDER BY u.id ASC
      `
    );

    res.json(result.rows);
  } catch (err) {
    console.error("ADMIN USERS ERROR:", err);
    res.status(500).json({ message: "Server error loading users" });
  }
});

router.patch("/users/:id/role", authRequired, requireAdmin, async (req, res) => {
  const { role } = req.body;
  const userId = req.params.id;

  if (!["user", "moderator", "admin"].includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  try {
    await query("UPDATE users SET role = $1 WHERE id = $2", [role, userId]);

    if (role === "moderator") {
      await query(
        `
        INSERT INTO moderator_permissions (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
        `,
        [userId]
      );
    } else {
      await query("DELETE FROM moderator_permissions WHERE user_id = $1", [userId]);
    }

    res.json({ message: "Role updated" });
  } catch (err) {
    console.error("ADMIN ROLE ERROR:", err);
    res.status(500).json({ message: "Server error updating role" });
  }
});

router.patch("/users/:id/permissions", authRequired, requireAdmin, async (req, res) => {
  const userId = req.params.id;
  const { can_manage_tags, can_delete_posts, can_ban_users, can_edit_wiki, can_manage_reactions } = req.body;

  try {
    await query(
      `
      INSERT INTO moderator_permissions (user_id, can_manage_tags, can_delete_posts, can_ban_users, can_edit_wiki, can_manage_reactions)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) DO UPDATE SET
        can_manage_tags = EXCLUDED.can_manage_tags,
        can_delete_posts = EXCLUDED.can_delete_posts,
        can_ban_users = EXCLUDED.can_ban_users,
        can_edit_wiki = EXCLUDED.can_edit_wiki,
        can_manage_reactions = EXCLUDED.can_manage_reactions
      `,
      [userId, !!can_manage_tags, !!can_delete_posts, !!can_ban_users, !!can_edit_wiki, !!can_manage_reactions]
    );

    // automaticky nastav rolu moderator
    await query("UPDATE users SET role = 'moderator' WHERE id = $1 AND role != 'admin'", [userId]);

    res.json({ message: "Permissions updated" });
  } catch (err) {
    console.error("ADMIN PERMS ERROR:", err);
    res.status(500).json({ message: "Server error updating permissions" });
  }
});

router.get("/users/search", authRequired, requireAdmin, async (req, res) => {
  const { code, q } = req.query;
  const r = await query(
    `
    SELECT id, username, nickname, user_code, role, is_banned
    FROM users
    WHERE ($1::text IS NULL OR user_code = $1)
      AND ($2::text IS NULL OR username ILIKE '%'||$2||'%' OR nickname ILIKE '%'||$2||'%')
    ORDER BY id LIMIT 50
    `,
    [code || null, q || null]
  );
  res.json(r.rows);
});


export default router;
