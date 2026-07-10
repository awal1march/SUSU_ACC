const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");

// ===================== AUTH MIDDLEWARE =====================
function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: "No token ❌" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    next();

  } catch (err) {
    console.log("AUTH ERROR ❌", err.message);
    return res.status(401).json({ message: "Invalid token ❌" });
  }
}


// ===================== GET BALANCE =====================
router.get("/balance", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      "SELECT wallet FROM users WHERE id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ balance: 0 });
    }

    res.json({
      balance: result.rows[0].wallet || 0
    });

  } catch (err) {
    console.log("BALANCE ERROR ❌", err.message);
    res.status(500).json({ message: "Server error ❌" });
  }
});

module.exports = router;