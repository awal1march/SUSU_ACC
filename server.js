require("dotenv").config();
const express = require("express");
const cors = require("cors");
const groupRoutes = require("./routes/groupRoutes");






const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));



// 🔥 REQUEST LOGGER (VERY IMPORTANT)
app.use((req, res, next) => {
  console.log("REQUEST:", req.method, req.url);
  next();
});


// ROUTES
app.use("/auth", require("./routes/auth"));
app.use("/wallet", require("./routes/wallet"));
app.use("/paystack", require("./routes/paystack"));
app.use("/groups", groupRoutes);

app.get("/", (req, res) => {
  res.send("SUSU API running ✅");
});


const PORT = process.env.PORT || 3000;

const initDatabase = require("./database/initDatabase");


async function startServer() {

  try {

    await initDatabase();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });


  } catch (error) {

    console.error("Server startup failed ❌", error);

  }

}


startServer();

// app.get("/", (req, res) => {
//   res.send("SUSU API running ✅");
// });

// const PORT = process.env.PORT || 3000;

// const initDatabase = require("./database/initDatabase");

// initDatabase();

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });
