import express from "express";

const router = express.Router();

// dočasný endpoint – vráti prázdne pole
router.get("/", (req, res) => {
  res.json([]);
});

export default router;
