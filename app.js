const express = require("express");
const bodyParser = require("body-parser");

const authRoutes = require("./routes/authRoutes");
const cardRoutes = require("./routes/cardRoutes");
const { getFileStream } = require("./s3");
const app = express();

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


app.get("/:id/:key", (req, res, next) => {
  var id = req.params.id;
  var fileName = req.params.key;
  var readStream = getFileStream(id, fileName);
  readStream.pipe(res);
});

app.use("/", (req, res, next) => {
  res.json({
    message: "Wrong URL",
  });
});

// var ip = require("ip");
// console.dir(ip.address());

app.listen(process.env.PORT || 8080);
