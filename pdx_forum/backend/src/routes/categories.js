import express from "express";
import { authRequired, blockBanned, requirePermission } from "../middleware/auth.js";
import { query } from "../db.js";

const router = express.Router();

// list categories (public)
router.get("/", async (_req, res) => {
  try {
    const r = await query(
      `SELECT id, name, slug, description, sort_order
       FROM forum_categories
       ORDER BY sort_order ASC, name ASC`
    );
    res.json(r.rows);
  } catch (err) {
    console.error("CATEGORIES LIST ERROR:", err);
    res.status(500).json({ message: "Server error loading categories" });
  }
});

// create (admin/mod with permission)
router.post("/", authRequired, blockBanned, requirePermission("can_manage_tags"), async (req, res) => {
  const { name, description = "", sort_order = 0 } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: "Missing name" });
  const slug = name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
  try {
    const r = await query(
      `INSERT INTO forum_categories (name, slug, description, sort_order)
       VALUES ($1,$2,$3,$4)
       RETURNING id, name, slug, description, sort_order`,
      [name.trim(), slug, description || "", Number(sort_order) || 0]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error("CATEGORIES CREATE ERROR:", err);
    res.status(500).json({ message: "Server error creating category" });
  }
});

// update
router.patch("/:id", authRequired, blockBanned, requirePermission("can_manage_tags"), async (req, res) => {
  const { name, description, sort_order } = req.body;
  try {
    const slug = name
      ? name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "")
      : null;
    const r = await query(
      `UPDATE forum_categories
       SET name=COALESCE($1,name),
           slug=COALESCE($2,slug),
           description=COALESCE($3,description),
           sort_order=COALESCE($4,sort_order)
       WHERE id=$5
       RETURNING id, name, slug, description, sort_order`,
      [name?.trim(), slug, description, sort_order, req.params.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ message: "Category not found" });
    res.json(r.rows[0]);
  } catch (err) {
    console.error("CATEGORIES UPDATE ERROR:", err);
    res.status(500).json({ message: "Server error updating category" });
  }
});

// delete
router.delete("/:id", authRequired, blockBanned, requirePermission("can_manage_tags"), async (req, res) => {
  try {
    await query("DELETE FROM forum_categories WHERE id=$1", [req.params.id]);
    res.json({ message: "Category deleted" });
  } catch (err) {
    console.error("CATEGORIES DELETE ERROR:", err);
    res.status(500).json({ message: "Server error deleting category" });
  }
});

export default router;
