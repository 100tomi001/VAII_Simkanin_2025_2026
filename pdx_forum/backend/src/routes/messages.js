import express from "express";
import { authRequired, blockBanned } from "../middleware/auth.js";
import { query } from "../db.js";

const router = express.Router();

// vlákno s userom
router.get("/:userId", authRequired, async (req, res) => {
  const otherId = Number(req.params.userId);
  try {
    const r = await query(
      `
      SELECT 
        m.id,
        m.sender_id,
        m.recipient_id,
        m.content,
        m.created_at,
        m.is_read,
        su.nickname AS sender_nickname,
        su.username AS sender_username,
        ru.nickname AS recipient_nickname,
        ru.username AS recipient_username
      FROM messages m
      JOIN users su ON su.id = m.sender_id
      JOIN users ru ON ru.id = m.recipient_id
      WHERE (m.sender_id = $1 AND m.recipient_id = $2)
         OR (m.sender_id = $2 AND m.recipient_id = $1)
      ORDER BY m.created_at ASC
      `,
      [req.user.id, otherId]
    );
    res.json(r.rows);
  } catch (err) {
    console.error("MSG THREAD ERROR:", err);
    res.status(500).json({ message: "Server error loading messages" });
  }
});

// zoznam konverzácií (distinct user_ids, posledná správa)
router.get("/", authRequired, async (req, res) => {
  try {
    const r = await query(
      `
      SELECT
        t.other_id,
        u.nickname AS other_nickname,
        u.username AS other_username,
        t.last_message_at
      FROM (
        SELECT
          other_id,
          MAX(created_at) AS last_message_at
        FROM (
          SELECT recipient_id AS other_id, created_at
          FROM messages WHERE sender_id = $1
          UNION ALL
          SELECT sender_id AS other_id, created_at
          FROM messages WHERE recipient_id = $1
        ) sub
        GROUP BY other_id
      ) t
      JOIN users u ON u.id = t.other_id
      ORDER BY t.last_message_at DESC
      `,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error("MSG THREAD LIST ERROR:", err);
    res.status(500).json({ message: "Server error loading conversations" });
  }
});

// poslať správu
router.post("/", authRequired, blockBanned, async (req, res) => {
  const { recipientId, content } = req.body;
  const recipientIdNum = Number(recipientId);
  const cleanContent = String(content || "").trim();
  if (!Number.isInteger(recipientIdNum) || recipientIdNum <= 0 || !cleanContent) {
    return res.status(400).json({ message: "Missing recipient or content" });
  }
  if (recipientIdNum === req.user.id) {
    return res.status(400).json({ message: "Cannot message yourself" });
  }
  try {
    const recipientMeta = await query(
      "SELECT id, username, nickname FROM users WHERE id = $1",
      [recipientIdNum]
    );
    if (recipientMeta.rowCount === 0) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    const r = await query(
      `
      INSERT INTO messages (sender_id, recipient_id, content, is_read, created_at)
      VALUES ($1, $2, $3, false, NOW())
      RETURNING id, sender_id, recipient_id, content, created_at, is_read
      `,
      [req.user.id, recipientIdNum, cleanContent]
    );

    const senderMeta = await query("SELECT username, nickname FROM users WHERE id = $1", [req.user.id]);

    // notifikácia pre príjemcu
    await query(
      `
      INSERT INTO notifications (user_id, type, payload)
      VALUES ($1, 'message', $2::jsonb)
      `,
      [
        recipientIdNum,
        JSON.stringify({
          from: req.user.id,
          messageId: r.rows[0].id,
          fromUsername: senderMeta.rows[0]?.username,
          fromNickname: senderMeta.rows[0]?.nickname,
          snippet: cleanContent.slice(0, 140),
        }),
      ]
    );

    res.status(201).json({
      ...r.rows[0],
      sender_username: senderMeta.rows[0]?.username,
      sender_nickname: senderMeta.rows[0]?.nickname,
      recipient_username: recipientMeta.rows[0]?.username,
      recipient_nickname: recipientMeta.rows[0]?.nickname,
    });
  } catch (err) {
    console.error("MSG SEND ERROR:", err);
    res.status(500).json({ message: "Server error sending message" });
  }
});

// označiť konkrétnu správu ako prečítanú
router.post("/:id/read", authRequired, async (req, res) => {
  const msgId = req.params.id;
  try {
    await query(
      `UPDATE messages SET is_read = true WHERE id = $1 AND recipient_id = $2`,
      [msgId, req.user.id]
    );
    res.json({ message: "Marked read" });
  } catch (err) {
    console.error("MSG READ ERROR:", err);
    res.status(500).json({ message: "Server error marking message" });
  }
});

// označiť celé vlákno ako prečítané
router.post("/:userId/read", authRequired, async (req, res) => {
  const otherId = Number(req.params.userId);
  try {
    await query(
      `UPDATE messages
       SET is_read = true
       WHERE sender_id = $1 AND recipient_id = $2`,
      [otherId, req.user.id]
    );
    res.json({ message: "Thread marked read" });
  } catch (err) {
    console.error("MSG THREAD READ ERROR:", err);
    res.status(500).json({ message: "Server error marking thread read" });
  }
});

// unread count pre nav-bar badge
router.get("/unread/count/mine", authRequired, async (req, res) => {
  try {
    const r = await query(
      `SELECT COUNT(*)::int AS cnt FROM messages WHERE recipient_id = $1 AND is_read = false`,
      [req.user.id]
    );
    res.json({ count: r.rows[0].cnt });
  } catch (err) {
    console.error("MSG COUNT ERROR:", err);
    res.status(500).json({ message: "Server error counting messages" });
  }
});

export default router;
