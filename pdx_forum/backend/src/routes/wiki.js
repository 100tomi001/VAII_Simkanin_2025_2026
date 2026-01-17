import express from "express";
import { query } from "../db.js";
import { authRequired, blockBanned } from "../middleware/auth.js";

const router = express.Router();
const canEdit = (user) => user?.role === "admin" || user?.role === "moderator";

const selectArticle = `
  SELECT
    a.id, a.title, a.slug, a.summary, a.content, a.cover_image,
    a.status, a.created_at, a.updated_at,
    c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
    u1.username AS created_by, u2.username AS updated_by
  FROM wiki_articles a
  LEFT JOIN wiki_categories c ON c.id = a.category_id
  LEFT JOIN users u1 ON u1.id = a.created_by
  LEFT JOIN users u2 ON u2.id = a.updated_by
`;

// list
router.get("/", async (req, res) => {
  const { category, q, status = "published" } = req.query;
  const cond = [];
  const params = [];
  if (status) {
    cond.push(`a.status = $${params.length + 1}`);
    params.push(status);
  }
  if (category) {
    cond.push(`c.slug = $${params.length + 1}`);
    params.push(category);
  }
  if (q) {
    cond.push(
      `(a.title ILIKE '%'||$${params.length + 1}||'%' OR a.summary ILIKE '%'||$${params.length + 1}||'%')`
    );
    params.push(q);
  }
  const where = cond.length ? "WHERE " + cond.join(" AND ") : "";
  try {
    const r = await query(
      `${selectArticle}
       ${where}
       ORDER BY a.updated_at DESC`,
      params
    );
    res.json(r.rows);
  } catch (err) {
    console.error("WIKI LIST ERROR:", err);
    res.status(500).json({ message: "Server error loading wiki" });
  }
});

// detail by slug
router.get("/:slug", async (req, res) => {
  try {
    const r = await query(`${selectArticle} WHERE a.slug = $1`, [req.params.slug]);
    if (r.rowCount === 0) return res.status(404).json({ message: "Article not found" });
    res.json(r.rows[0]);
  } catch (err) {
    console.error("WIKI DETAIL ERROR:", err);
    res.status(500).json({ message: "Server error loading article" });
  }
});

// create
router.post("/", authRequired, blockBanned, async (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ message: "Not allowed" });
  const { title, summary, content, cover_image, category_id, status = "draft" } = req.body;
  const slug = title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
  if (!title || !content) return res.status(400).json({ message: "Missing title/content" });
  try {
    const r = await query(
      `INSERT INTO wiki_articles (title, slug, summary, content, cover_image, category_id, status, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
       RETURNING *`,
      [title, slug, summary || "", content, cover_image || null, category_id || null, status, req.user.id]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error("WIKI CREATE ERROR:", err);
    res.status(500).json({ message: "Server error creating article" });
  }
});

// update
router.patch("/:id", authRequired, blockBanned, async (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ message: "Not allowed" });
  const { title, summary, content, cover_image, category_id, status } = req.body;
  try {
    // history
    const old = await query("SELECT * FROM wiki_articles WHERE id=$1", [req.params.id]);
    if (old.rowCount === 0) return res.status(404).json({ message: "Article not found" });
    await query(
      `INSERT INTO wiki_article_history (article_id, content, title, summary, cover_image, category_id, status, changed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        req.params.id,
        old.rows[0].content,
        old.rows[0].title,
        old.rows[0].summary,
        old.rows[0].cover_image,
        old.rows[0].category_id,
        old.rows[0].status,
        req.user.id,
      ]
    );

    // update
    const slug = title
      ? title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "")
      : old.rows[0].slug;

    const r = await query(
      `UPDATE wiki_articles
       SET title=COALESCE($1,title),
           slug=$2,
           summary=COALESCE($3,summary),
           content=COALESCE($4,content),
           cover_image=COALESCE($5,cover_image),
           category_id=COALESCE($6,category_id),
           status=COALESCE($7,status),
           updated_by=$8,
           updated_at=NOW()
       WHERE id=$9
       RETURNING *`,
      [
        title,
        slug,
        summary,
        content,
        cover_image,
        category_id,
        status,
        req.user.id,
        req.params.id,
      ]
    );
    res.json(r.rows[0]);
  } catch (err) {
    console.error("WIKI UPDATE ERROR:", err);
    res.status(500).json({ message: "Server error updating article" });
  }
});

// delete/archive
router.delete("/:id", authRequired, blockBanned, async (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ message: "Not allowed" });
  try {
    await query("UPDATE wiki_articles SET status='archived' WHERE id=$1", [req.params.id]);
    res.json({ message: "Archived" });
  } catch (err) {
    console.error("WIKI DELETE ERROR:", err);
    res.status(500).json({ message: "Server error deleting article" });
  }
});

// history
router.get("/:id/history", authRequired, async (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ message: "Not allowed" });
  const r = await query(
    `
    SELECT h.*, u.username AS changed_by_name
    FROM wiki_article_history h
    LEFT JOIN users u ON u.id = h.changed_by
    WHERE h.article_id = $1
    ORDER BY h.created_at DESC
    `,
    [req.params.id]
  );
  res.json(r.rows);
});

// rollback
router.post("/:id/rollback/:historyId", authRequired, async (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ message: "Not allowed" });
  try {
    const h = await query(
      "SELECT * FROM wiki_article_history WHERE id=$1 AND article_id=$2",
      [req.params.historyId, req.params.id]
    );
    if (h.rowCount === 0) return res.status(404).json({ message: "History not found" });

    const row = h.rows[0];
    await query(
      `UPDATE wiki_articles
       SET title=$1, summary=$2, content=$3, cover_image=$4,
           category_id=$5, status=$6, updated_by=$7, updated_at=NOW()
       WHERE id=$8`,
      [
        row.title,
        row.summary,
        row.content,
        row.cover_image,
        row.category_id,
        row.status,
        req.user.id,
        req.params.id,
      ]
    );
    res.json({ message: "Rolled back" });
  } catch (err) {
    console.error("WIKI ROLLBACK ERROR:", err);
    res.status(500).json({ message: "Server error rollback" });
  }
});

export default router;
