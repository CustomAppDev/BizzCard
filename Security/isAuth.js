const jwt = require("jsonwebtoken");

const db = require("../util/database");

module.exports = (req, res, next) => {
  const authHeader = req.get("Authorization");
  if (!authHeader) {
    const error = new Error("Not authenticated.");
    error.statusCode = 401;
    throw error;
  }
  const token = authHeader.split(" ")[1];
  let decodedToken;
  try {
    decodedToken = jwt.verify(token, process.env.JSON_KEY);
  } catch (err) {
    err.statusCode = 500;
    throw err;
  }
  if (!decodedToken) {
    const error = new Error("Not authenticated.");
    error.statusCode = 401;
    throw error;
  }

  db.execute("SELECT * FROM users where id = ?", [decodedToken.id])
    .then(([[user]]) => {
      if (user == null) {
        res.status(200).json({
          Validity: "Invalid User",
        });
      } else {
        var tokenDate = new Date(decodedToken.currentDate);
        var latestLoginDate = new Date(user.last_login);

        if (tokenDate.getTime() != latestLoginDate.getTime()) {
          res.status(200).json({
            invalidToken: true,
          });
        } else {
          req.userId = decodedToken.id;
          next();
        }
      }
    })
    .catch((err) => {
      console.log(err);
    });
};
