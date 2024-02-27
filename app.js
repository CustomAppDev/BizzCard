const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const cardRoutes = require("./routes/cardRoutes");
const app = express();
app.use("/images",express.static(path.join(__dirname, "images")));

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use(bodyParser.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "OPTIONS, GET, POST, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

app.use("/auth", authRoutes);
app.use("/card", cardRoutes);

app.use("/", (req, res, next) => {
  res.json({
    message: "Wrong URL",
  });
});

// var ip = require("ip");
// console.dir(ip.address());

app.listen(process.env.PORT || 8080);
