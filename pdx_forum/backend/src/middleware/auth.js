import jwt from "jsonwebtoken";
import { query } from "../db.js";

export function authRequired(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ message: "Missing authorization header" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // id + role
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }
  next();
}

export function requireModeratorOrAdmin(req, res, next) {
  if (req.user?.role !== "admin" && req.user?.role !== "moderator") {
    return res.status(403).json({ message: "Moderator only" });
  }
  next();
}

export const requirePermission = (permission) => async (req, res, next) => {
  try {
    if (req.user?.role === "admin") return next();

    const permRes = await query(
      `SELECT ${permission} FROM moderator_permissions WHERE user_id = $1`,
      [req.user.id]
    );

    const has = permRes.rows[0]?.[permission] === true;
    if (!has) {
      return res.status(403).json({ message: "Permission denied" });
    }

    next();
  } catch (err) {
    console.error("PERMISSION CHECK ERROR:", err);
    res.status(500).json({ message: "Server error checking permissions" });
  }
};

export const blockBanned = async (req, res, next) => {
  try {
    const userRes = await query(
      "SELECT is_banned, banned_until FROM users WHERE id = $1",
      [req.user.id]
    );

    if (userRes.rowCount === 0) return next();

    const { is_banned, banned_until } = userRes.rows[0];
    if (is_banned) {
      const now = new Date();
      if (!banned_until || new Date(banned_until) > now) {
        return res.status(403).json({ message: "User is banned" });
      }

      // ban expiroval -> odblokuj
      await query(
        "UPDATE users SET is_banned = false, banned_until = NULL WHERE id = $1",
        [req.user.id]
      );
    }

    next();
  } catch (err) {
    console.error("BAN CHECK ERROR:", err);
    res.status(500).json({ message: "Server error checking ban" });
  }
};
