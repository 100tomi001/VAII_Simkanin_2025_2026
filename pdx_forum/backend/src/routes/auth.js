import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../db.js";

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9._-]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  const cleanUsername = String(username || "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPassword = String(password || "");

  if (!cleanUsername || !cleanEmail || !cleanPassword)
    return res.status(400).json({ message: "Missing fields" });

  if (cleanUsername.length < 3 || cleanUsername.length > 30 || !USERNAME_RE.test(cleanUsername)) {
    return res.status(400).json({ message: "Invalid username" });
  }
  if (cleanEmail.length > 254 || !EMAIL_RE.test(cleanEmail)) {
    return res.status(400).json({ message: "Invalid email" });
  }
  if (!PASSWORD_RE.test(cleanPassword)) {
    return res.status(400).json({ message: "Invalid password" });
  }

  const exists = await query(
    "SELECT id FROM users WHERE username = $1 OR LOWER(email) = LOWER($2)",
    [cleanUsername, cleanEmail]
  );

  if (exists.rowCount > 0)
    return res
      .status(400)
      .json({ message: "Username or email already exists" });

  const hash = await bcrypt.hash(cleanPassword, 10);

  const result = await query(
    `INSERT INTO users (username, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, username, email, role`,
    [cleanUsername, cleanEmail, hash]
  );

  const user = result.rows[0];
  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token, user });
});

router.post("/login", async (req, res) => {
  const { usernameOrEmail, password } = req.body;

  const loginValue = String(usernameOrEmail || "").trim();
  const passwordValue = String(password || "");
  if (!loginValue || !passwordValue) {
    return res.status(400).json({ message: "Missing fields" });
  }
  if (loginValue.length < 2 || loginValue.length > 254) {
    return res.status(400).json({ message: "Invalid username/email" });
  }

  const existing = await query(
    "SELECT * FROM users WHERE username = $1 OR LOWER(email) = LOWER($1)",
    [loginValue]
  );

  if (existing.rowCount === 0)
    return res.status(400).json({ message: "User not found" });

  const user = existing.rows[0];

  const match = await bcrypt.compare(passwordValue, user.password_hash);

  if (!match) return res.status(400).json({ message: "Invalid password" });

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  delete user.password_hash;

  res.json({ token, user });
});

export default router;
