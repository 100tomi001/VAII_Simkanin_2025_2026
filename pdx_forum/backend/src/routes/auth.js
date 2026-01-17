import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../db.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password)
    return res.status(400).json({ message: "Missing fields" });

  const exists = await query(
    "SELECT id FROM users WHERE username = $1 OR email = $2",
    [username, email]
  );

  if (exists.rowCount > 0)
    return res
      .status(400)
      .json({ message: "Username or email already exists" });

  const hash = await bcrypt.hash(password, 10);

  const result = await query(
    `INSERT INTO users (username, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, username, email, role`,
    [username, email, hash]
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

  const existing = await query(
    "SELECT * FROM users WHERE username = $1 OR email = $1",
    [usernameOrEmail]
  );

  if (existing.rowCount === 0)
    return res.status(400).json({ message: "User not found" });

  const user = existing.rows[0];

  const match = await bcrypt.compare(password, user.password_hash);

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
