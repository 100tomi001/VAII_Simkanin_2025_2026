import express from "express";
import { authRequired } from "../middleware/auth.js";
import { query } from "../db.js";

const router = express.Router();

// posledných 50 notifikácií (alebo unread)
router.get("/", authRequired, async (req, res) => {
  const { unread } = req.query;
  try {
    const r = await query(
      `
      SELECT id, type, payload, is_read, created_at
      FROM notifications
      WHERE user_id = $1
      ${unread ? "AND is_read = false" : ""}
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error("NOTIF LIST ERROR:", err);
    res.status(500).json({ message: "Server error loading notifications" });
  }
});

router.post("/mark-read", authRequired, async (req, res) => {
  const { ids = [] } = req.body;
  try {
    const rawIds = Array.isArray(ids) ? ids : [];
    const cleanIds = rawIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
    if (rawIds.length > 0 && cleanIds.length === 0) {
      return res.status(400).json({ message: "Invalid ids" });
    }
    if (cleanIds.length > 200) {
      return res.status(400).json({ message: "Too many ids" });
    }
    if (cleanIds.length > 0) {
      await query(
        `UPDATE notifications SET is_read = true WHERE user_id = $1 AND id = ANY($2::int[])`,
        [req.user.id, cleanIds]
      );
    }
    res.json({ message: "Marked read" });
  } catch (err) {
    console.error("NOTIF MARK READ ERROR:", err);
    res.status(500).json({ message: "Server error marking notifications" });
  }
});

router.get("/unread-count", authRequired, async (req, res) => {
  try {
    const r = await query(
      `SELECT COUNT(*)::int AS cnt FROM notifications WHERE user_id = $1 AND is_read = false`,
      [req.user.id]
    );
    res.json({ count: r.rows[0].cnt });
  } catch (err) {
    console.error("NOTIF COUNT ERROR:", err);
    res.status(500).json({ message: "Server error counting notifications" });
  }
});

export default router;
