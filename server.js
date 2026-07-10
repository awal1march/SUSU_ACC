require("dotenv").config();
const express = require("express");
const cors = require("cors");
const groupRoutes = require("./routes/groupRoutes");



const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/groups", groupRoutes);


// 🔥 REQUEST LOGGER (VERY IMPORTANT)
app.use((req, res, next) => {
  console.log("REQUEST:", req.method, req.url);
  next();
});


// ROUTES
app.use("/auth", require("./routes/auth"));
app.use("/wallet", require("./routes/wallet"));
app.use("/paystack", require("./routes/paystack"));


app.get("/", (req, res) => {
  res.send("SUSU API running ✅");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
