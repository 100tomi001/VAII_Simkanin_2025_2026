// routes/users.js
import express from "express";
import { authRequired } from "../middleware/auth.js";
import { query } from "../db.js";

const router = express.Router();

// Vyhľadávanie pre user/mod/admin (vracia len safe polia)
router.get("/search", authRequired, async (req, res) => {
  const { code, q } = req.query;
  const r = await query(
    `
    SELECT id, username, nickname, user_code, role
    FROM users
    WHERE ($1::text IS NULL OR user_code = $1)
      AND ($2::text IS NULL OR username ILIKE '%'||$2||'%' OR nickname ILIKE '%'||$2||'%')
    ORDER BY id
    LIMIT 50
    `,
    [code || null, q || null]
  );
  res.json(r.rows);
});

export default router;
