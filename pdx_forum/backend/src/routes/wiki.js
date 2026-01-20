import express from "express";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { authRequired, blockBanned, requirePermission } from "../middleware/auth.js";

const router = express.Router();
const MAX_TITLE_LEN = 120;
const MAX_SUMMARY_LEN = 300;
const MAX_COVER_LEN = 500;
const ALLOWED_STATUS = ["draft", "published", "archived"];
const tryGetUser = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.split(" ")[1];
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null;
  }
};
const canEditWiki = async (user) => {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role !== "moderator") return false;
  const r = await query(
    "SELECT can_edit_wiki FROM moderator_permissions WHERE user_id = $1",
    [user.id]
  );
  return r.rows[0]?.can_edit_wiki === true;
};

const normalizeContent = (content) => {
  if (content === undefined) return undefined;
  if (content === null) return null;
  if (Array.isArray(content)) return content;
  if (typeof content === "string") {
    try {
      const parsed = JSON.parse(content);
      return parsed;
    } catch (err) {
      return "__invalid__";
    }
  }
  if (typeof content === "object") return content;
  return "__invalid__";
};

const toJsonbParam = (value) => {
  if (value === undefined) return undefined;
  return JSON.stringify(value);
};

const slugify = (value) => {
  if (!value) return "";
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

const isSlugTaken = async (slug, excludeId) => {
  const params = [slug];
  let sql = "SELECT 1 FROM wiki_articles WHERE slug=$1";
  if (excludeId) {
    params.push(excludeId);
    sql += " AND id<>$2";
  }
  const r = await query(sql, params);
  return r.rowCount > 0;
};

const suggestSlug = async (baseSlug, excludeId) => {
  let candidate = baseSlug;
  let suffix = 2;
  while (await isSlugTaken(candidate, excludeId)) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  return candidate;
};

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

// categories list
router.get("/categories/list", async (_req, res) => {
  try {
    const r = await query(
      "SELECT id, name, slug, description FROM wiki_categories ORDER BY name ASC"
    );
    res.json(r.rows);
  } catch (err) {
    console.error("WIKI CATEGORIES ERROR:", err);
    res.status(500).json({ message: "Server error loading categories" });
  }
});

// recent changes
router.get("/recent/changes", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 15, 100);
  try {
    const r = await query(
      `
      SELECT
        h.article_id,
        a.title,
        a.slug,
        h.created_at,
        u.username AS changed_by,
        c.name AS category_name,
        c.slug AS category_slug
      FROM wiki_article_history h
      JOIN wiki_articles a ON a.id = h.article_id
      LEFT JOIN wiki_categories c ON c.id = a.category_id
      LEFT JOIN users u ON u.id = h.changed_by
      ORDER BY h.created_at DESC
      LIMIT $1
      `,
      [limit]
    );
    res.json(r.rows);
  } catch (err) {
    console.error("WIKI RECENT ERROR:", err);
    res.status(500).json({ message: "Server error loading recent changes" });
  }
});

// drafts list (editor only)
router.get("/drafts", authRequired, requirePermission("can_edit_wiki"), async (req, res) => {
  try {
    const r = await query(
      `${selectArticle}
       WHERE a.status = 'draft'
       ORDER BY a.updated_at DESC`
    );
    res.json(r.rows);
  } catch (err) {
    console.error("WIKI DRAFTS ERROR:", err);
    res.status(500).json({ message: "Server error loading drafts" });
  }
});

// detail by id (editor only)
router.get("/id/:id", authRequired, requirePermission("can_edit_wiki"), async (req, res) => {
  try {
    const r = await query(`${selectArticle} WHERE a.id = $1`, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ message: "Article not found" });
    res.json(r.rows[0]);
  } catch (err) {
    console.error("WIKI DETAIL BY ID ERROR:", err);
    res.status(500).json({ message: "Server error loading article" });
  }
});

// detail by slug
router.get("/:slug", async (req, res) => {
  try {
    const r = await query(`${selectArticle} WHERE a.slug = $1`, [req.params.slug]);
    if (r.rowCount === 0) return res.status(404).json({ message: "Article not found" });
    const article = r.rows[0];
    if (article.status !== "published") {
      const user = tryGetUser(req);
      const canView = await canEditWiki(user);
      if (!canView) {
        return res.status(404).json({ message: "Article not found" });
      }
    }
    res.json(article);
  } catch (err) {
    console.error("WIKI DETAIL ERROR:", err);
    res.status(500).json({ message: "Server error loading article" });
  }
});

// create
router.post("/", authRequired, blockBanned, requirePermission("can_edit_wiki"), async (req, res) => {
  const { title, summary, content, cover_image, category_id, status = "draft", slug: slugOverride } = req.body;
  const baseSlug = slugify(title);
  const requestedSlug = slugOverride ? slugify(slugOverride) : baseSlug;
  if (!title || !content) return res.status(400).json({ message: "Missing title/content" });
  const cleanTitle = title.trim();
  if (cleanTitle.length < 3 || cleanTitle.length > MAX_TITLE_LEN) {
    return res.status(400).json({ message: "Title length is invalid" });
  }
  if (summary && summary.length > MAX_SUMMARY_LEN) {
    return res.status(400).json({ message: "Summary too long" });
  }
  if (cover_image && cover_image.length > MAX_COVER_LEN) {
    return res.status(400).json({ message: "Cover image URL too long" });
  }
  if (status && !ALLOWED_STATUS.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }
  if (!requestedSlug) return res.status(400).json({ message: "Invalid title" });
  try {
    if (await isSlugTaken(requestedSlug)) {
      const suggested = await suggestSlug(baseSlug);
      return res.status(409).json({ message: "Slug already exists", suggestedSlug: suggested });
    }
    const normalized = normalizeContent(content);
    if (normalized === "__invalid__") {
      return res.status(400).json({ message: "Invalid content JSON" });
    }
    const contentJson = toJsonbParam(normalized);
    const r = await query(
      `INSERT INTO wiki_articles (title, slug, summary, content, cover_image, category_id, status, created_by, updated_by)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$8)
       RETURNING *`,
      [cleanTitle, requestedSlug, summary || "", contentJson, cover_image || null, category_id || null, status, req.user.id]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error("WIKI CREATE ERROR:", err);
    res.status(500).json({ message: "Server error creating article" });
  }
});

// update
router.patch("/:id", authRequired, blockBanned, requirePermission("can_edit_wiki"), async (req, res) => {
  const { title, summary, content, cover_image, category_id, status, slug: slugOverride } = req.body;
  try {
    if (title && (title.trim().length < 3 || title.trim().length > MAX_TITLE_LEN)) {
      return res.status(400).json({ message: "Title length is invalid" });
    }
    if (summary && summary.length > MAX_SUMMARY_LEN) {
      return res.status(400).json({ message: "Summary too long" });
    }
    if (cover_image && cover_image.length > MAX_COVER_LEN) {
      return res.status(400).json({ message: "Cover image URL too long" });
    }
    if (status && !ALLOWED_STATUS.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    // history
    const old = await query("SELECT * FROM wiki_articles WHERE id=$1", [req.params.id]);
    if (old.rowCount === 0) return res.status(404).json({ message: "Article not found" });
    const oldContent = normalizeContent(old.rows[0].content);
    const historyJson = toJsonbParam(oldContent === "__invalid__" ? [] : oldContent);
    await query(
      `INSERT INTO wiki_article_history (article_id, content, title, summary, cover_image, category_id, status, changed_by)
       VALUES ($1,$2::jsonb,$3,$4,$5,$6,$7,$8)`,
      [
        req.params.id,
        historyJson,
        old.rows[0].title,
        old.rows[0].summary,
        old.rows[0].cover_image,
        old.rows[0].category_id,
        old.rows[0].status,
        req.user.id,
      ]
    );

    // update
    const baseSlug = title ? slugify(title) : old.rows[0].slug;
    const requestedSlug = slugOverride ? slugify(slugOverride) : baseSlug;
    if (!requestedSlug) return res.status(400).json({ message: "Invalid title" });
    if (requestedSlug !== old.rows[0].slug && (await isSlugTaken(requestedSlug, req.params.id))) {
      const suggested = await suggestSlug(baseSlug, req.params.id);
      return res.status(409).json({ message: "Slug already exists", suggestedSlug: suggested });
    }
    const slug = requestedSlug || old.rows[0].slug;

    const normalized = normalizeContent(content);
    if (normalized === "__invalid__") {
      return res.status(400).json({ message: "Invalid content JSON" });
    }
    const contentJson = normalized === undefined ? null : toJsonbParam(normalized);
    const r = await query(
      `UPDATE wiki_articles
       SET title=COALESCE($1,title),
           slug=$2,
           summary=COALESCE($3,summary),
           content=COALESCE($4::jsonb,content),
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
        contentJson,
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
router.delete("/:id", authRequired, blockBanned, requirePermission("can_edit_wiki"), async (req, res) => {
  try {
    await query("UPDATE wiki_articles SET status='archived' WHERE id=$1", [req.params.id]);
    res.json({ message: "Archived" });
  } catch (err) {
    console.error("WIKI DELETE ERROR:", err);
    res.status(500).json({ message: "Server error deleting article" });
  }
});

// history
router.get("/:id/history", authRequired, requirePermission("can_edit_wiki"), async (req, res) => {
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
router.post("/:id/rollback/:historyId", authRequired, requirePermission("can_edit_wiki"), async (req, res) => {
  try {
    const h = await query(
      "SELECT * FROM wiki_article_history WHERE id=$1 AND article_id=$2",
      [req.params.historyId, req.params.id]
    );
    if (h.rowCount === 0) return res.status(404).json({ message: "History not found" });

    const row = h.rows[0];
    const rollbackContent = normalizeContent(row.content);
    const rollbackJson = toJsonbParam(rollbackContent === "__invalid__" ? [] : rollbackContent);
    await query(
      `UPDATE wiki_articles
       SET title=$1, summary=$2, content=$3::jsonb, cover_image=$4,
           category_id=$5, status=$6, updated_by=$7, updated_at=NOW()
       WHERE id=$8`,
      [
        row.title,
        row.summary,
        rollbackJson,
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
