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

// hub (with stats)
router.get("/hub", async (_req, res) => {
  try {
    const r = await query(
      `
      SELECT
        c.id,
        c.name,
        c.slug,
        c.description,
        c.sort_order,
        COALESCE(tc.topics_count, 0) AS topics_count,
        lt.last_activity,
        lt.last_topic_id,
        lt.last_topic_title
      FROM forum_categories c
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS topics_count
        FROM topics t
        WHERE t.category_id = c.id
      ) tc ON true
      LEFT JOIN LATERAL (
        SELECT t2.id AS last_topic_id,
               t2.title AS last_topic_title,
               COALESCE(MAX(p2.created_at), t2.created_at) AS last_activity
        FROM topics t2
        LEFT JOIN posts p2 ON p2.topic_id = t2.id
        WHERE t2.category_id = c.id
        GROUP BY t2.id
        ORDER BY last_activity DESC
        LIMIT 1
      ) lt ON true
      ORDER BY c.sort_order ASC, c.name ASC
      `
    );
    res.json(r.rows);
  } catch (err) {
    console.error("CATEGORIES HUB ERROR:", err);
    res.status(500).json({ message: "Server error loading category hub" });
  }
});

// create (admin/mod with permission)
router.post("/", authRequired, blockBanned, requirePermission("can_manage_tags"), async (req, res) => {
  const { name, description = "", sort_order = 0 } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: "Missing name" });
  const cleanName = name.trim();
  if (cleanName.length < 2 || cleanName.length > 50) {
    return res.status(400).json({ message: "Category name length is invalid" });
  }
  if (description && description.length > 200) {
    return res.status(400).json({ message: "Category description too long" });
  }
  const orderValue = Number(sort_order) || 0;
  if (orderValue < 0 || orderValue > 999) {
    return res.status(400).json({ message: "Sort order is invalid" });
  }
  const slug = cleanName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
  try {
    const r = await query(
      `INSERT INTO forum_categories (name, slug, description, sort_order)
       VALUES ($1,$2,$3,$4)
       RETURNING id, name, slug, description, sort_order`,
      [cleanName, slug, description || "", orderValue]
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
  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ message: "Missing name" });
  }
  if (name && (name.trim().length < 2 || name.trim().length > 50)) {
    return res.status(400).json({ message: "Category name length is invalid" });
  }
  if (description && description.length > 200) {
    return res.status(400).json({ message: "Category description too long" });
  }
  if (sort_order !== undefined) {
    const orderValue = Number(sort_order);
    if (!Number.isFinite(orderValue) || orderValue < 0 || orderValue > 999) {
      return res.status(400).json({ message: "Sort order is invalid" });
    }
  }
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
