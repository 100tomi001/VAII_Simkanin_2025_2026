import express from "express";
import { query } from "../db.js";
import { authRequired, blockBanned, requirePermission } from "../middleware/auth.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await query("SELECT id, name FROM tags ORDER BY name ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("TAGS ERROR (GET /):", err);
    res.status(500).json({ message: "Server error loading tags" });
  }
});

router.post("/", authRequired, blockBanned, requirePermission("can_manage_tags"), async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Missing tag name" });
  }

  try {
    const result = await query(
      "INSERT INTO tags (name) VALUES ($1) RETURNING id, name",
      [name.trim()]
    );

    await query(
      "INSERT INTO tag_audit (tag_id, action, new_name, changed_by) VALUES ($1, $2, $3, $4)",
      [result.rows[0].id, "create", result.rows[0].name, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("TAGS ERROR (POST /):", err);
    res.status(500).json({ message: "Server error creating tag" });
  }
});

router.patch("/:id", authRequired, blockBanned, requirePermission("can_manage_tags"), async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Missing tag name" });
  }

  try {
    const oldRes = await query("SELECT name FROM tags WHERE id = $1", [req.params.id]);
    if (oldRes.rowCount === 0) return res.status(404).json({ message: "Tag not found" });

    const result = await query(
      "UPDATE tags SET name = $1 WHERE id = $2 RETURNING id, name",
      [name.trim(), req.params.id]
    );

    await query(
      "INSERT INTO tag_audit (tag_id, action, old_name, new_name, changed_by) VALUES ($1, $2, $3, $4, $5)",
      [req.params.id, "update", oldRes.rows[0].name, result.rows[0].name, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("TAGS ERROR (PATCH /:id):", err);
    res.status(500).json({ message: "Server error updating tag" });
  }
});

router.delete("/:id", authRequired, blockBanned, requirePermission("can_manage_tags"), async (req, res) => {
  try {
    const oldRes = await query("SELECT name FROM tags WHERE id = $1", [req.params.id]);
    if (oldRes.rowCount === 0) return res.status(404).json({ message: "Tag not found" });

    await query("DELETE FROM tags WHERE id = $1", [req.params.id]);

    await query(
      "INSERT INTO tag_audit (tag_id, action, old_name, changed_by) VALUES ($1, $2, $3, $4)",
      [req.params.id, "delete", oldRes.rows[0].name, req.user.id]
    );

    res.json({ message: "Tag deleted" });
  } catch (err) {
    console.error("TAGS ERROR (DELETE /:id):", err);
    res.status(500).json({ message: "Server error deleting tag" });
  }
});

export default router;
