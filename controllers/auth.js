const db = require("../util/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const crypto = require("crypto");
const { deleteSpecificUserImage, deleteAllUserImages } = require("../s3");

var loggedInUsers = [];

const OAUTH2Client = new google.auth.OAuth2(
  process.env.clientId,
  process.env.clientSecret,
  process.env.redirectUrl
);
OAUTH2Client.setCredentials({ refresh_token: process.env.refreshToken });
let transporter = null;

async function loadAccessToken() {
  const accessToken = await OAUTH2Client.getAccessToken();
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: process.env.emailVal,
      clientId: process.env.clientId,
      clientSecret: process.env.clientSecret,
      refreshToken: process.env.refreshToken,
      accessToken: accessToken,
    },
  });
}

exports.logout = (req, res, next) => {
  for (var i = 0; i < loggedInUsers.length; i++) {
    if (req.userId == loggedInUsers[i].id) {
      loggedInUsers.splice(i, 1);
    }
  }

  res.status(200).json({
    message: "Logged Out Successfully !!",
  });
};

exports.removeAccount = async (req, res, next) => {
  const password = req.body.password;
  let [[user]] = await db.execute("Select * from users where id = ?", [
    req.userId,
  ]);
  var isEqual = await bcrypt.compare(password, user.password);
  if (isEqual) {
    let [groupIds] = await db.execute(
      "Select id from groupdata where userId = ?",
      [req.userId]
    );
    await db.execute("Delete from groupdata where userId = ?", [req.userId]);
    for (var i = 0; i < groupIds.length; i++) {
      await db.execute("Delete from groupcarddata where groupId = ?", [
        groupIds[i]["id"],
      ]);
    }

    deleteAllUserImages(req.userId);
    await db.execute("Delete from users where id = ?", [req.userId]);
    var [cardIds] = await db.execute(
      "Select id from carddata where userId = ?",
      [req.userId]
    );

    await db.execute("Delete from carddata where userId = ?", [req.userId]);
    for (var i = 0; i < cardIds.length; i++) {
      await db.execute("Delete from phone where cardDataId = ?", [
        cardIds[i]["id"],
      ]);
      await db.execute("Delete from notes where cardDataId = ?", [
        cardIds[i]["id"],
      ]);
    }

    for (var i = 0; i < loggedInUsers.length; i++) {
      if (req.userId == loggedInUsers[i].id) {
        loggedInUsers.splice(i, 1);
      }
    }
    res.status(200).json({
      message: "Account Removed Successfully !!",
      removed: true,
    });
  } else {
    res.status(200).json({
      message: "Your Password is Incorrect",
      removed: false,
    });
  }
};

async function fetchPhoneData(cardDataId) {
  let [phone] = await db.execute(
    "SELECT id, isoCode, countryCode, phone FROM phone WHERE cardDataId = ?",
    [cardDataId]
  );

  return phone;
}

exports.getSpecificUserData = async (req, res, next) => {
  try {
    let [[data]] = await db.execute("SELECT * from carddata where id = ?", [
      req.body.id,
    ]);
    data.phone = await fetchPhoneData(data.id);

    res.status(200).json({
      message: "Fetched card successfully !!",
      data: data,
    });
  } catch (error) {
    console.error("Error fetching card data:", error);
    res.status(500).json({
      message: "An error occurred while fetching card data",
      error: error.message,
    });
  }
};

exports.getUserData = async (req, res, next) => {
  try {
    let [data] = await db.execute("SELECT * from carddata where userId = ?", [
      req.userId,
    ]);

    for (var val of data) {
      val["phone"] = await fetchPhoneData(val["id"]);
      var [result] = await db.execute(
        "SELECT id,title,text,dateTime from notes where cardDataId = ? And userId = ?",
        [val["id"], req.userId]
      );
      val["notes"] = result;
    }

    res.status(200).json({
      message: "Fetched cards successfully !!",
      data: data,
    });
  } catch (error) {
    console.error("Error fetching user cards data:", error);
    res.status(500).json({
      message: "An error occurred while fetching user cards data",
      error: error.message,
    });
  }
};

function getFilePath(files, fieldName, index, cd) {
  if (fieldName in cd) {
    return cd[fieldName];
  } else {
    return files[fieldName][index]["key"];
  }
}

function deleteImage(previousImage, imagePath, userId) {
  if (previousImage !== null && imagePath !== null) {
    if (previousImage !== imagePath) {
      deleteSpecificUserImage(previousImage, userId);
      deleteSpecificUserImage(imagePath, userId);
    } else {
      deleteSpecificUserImage(imagePath, userId);
    }
  } else if (previousImage !== null) {
    deleteSpecificUserImage(previousImage, userId);
  } else if (imagePath !== null) {
    deleteSpecificUserImage(imagePath, userId);
  }
}

function deleteImageIfNotFound(previousImage, imagePath, userId) {
  if (previousImage !== null && previousImage !== imagePath) {
    deleteSpecificUserImage(previousImage, userId);
  }
}
async function setImagesForDeletion(
  imagePath,
  cardFrontPath,
  cardBackPath,
  imageDelete,
  userId,
  id
) {
  var previousImage = await db.execute(
    "Select image,cardFront,cardback from carddata where userId = ? And id = ?",
    [userId, id]
  );
  imageDelete(previousImage["image"], imagePath, userId);
  imageDelete(previousImage["cardFront"], cardFrontPath, userId);
  imageDelete(previousImage["cardback"], cardBackPath, userId);
}

exports.saveData = async (req, res, next) => {
  var insertedData = [];
  var data = JSON.parse(req.body["data"]);
  for (let i = 0; i < data.length; i++) {
    var cd = data[i];
    var imagePath = getFilePath(req.files, "image", i, cd);
    var cardFrontPath = getFilePath(req.files, "cardFront", i, cd);
    var cardBackPath = getFilePath(req.files, "cardBack", i, cd);
    if (cd["id"] == null) {
      let [result] = await db.execute(
        "Insert into carddata (name,email,image,cardFront,cardBack,companyName,address,companyWebsite,designation,department,stateName,cityName,countryName,isBorderRadiusApplied,userId) Values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          cd["name"],
          cd["email"],
          imagePath,
          cardFrontPath,
          cardBackPath,
          cd["companyName"],
          cd["address"],
          cd["companyWebsite"],
          cd["designation"],
          cd["department"],
          cd["stateName"],
          cd["cityName"],
          cd["countryName"],
          cd["isBorderRadiusApplied"],
          req.userId,
        ]
      );

      insertedData.push({
        cardId: result.insertId,
        image: imagePath,
        cardFront: cardFrontPath,
        cardBack: cardBackPath,
        phoneId: [],
        notesId: [],
      });

      for (let val of JSON.parse(cd["phone"])) {
        let [phoneResult] = await db.execute(
          "Insert into phone (isoCode,countryCode,phone,cardDataId) Values (?,?,?,?)",
          [val["isoCode"], val["countryCode"], val["phone"], result.insertId]
        );
        insertedData[i]["phoneId"].push(phoneResult.insertId);
      }

      for (let val of JSON.parse(cd["notes"])) {
        let [notesResult] = await db.execute(
          "Insert into notes (title,text,dateTime,cardDataId,userId) Values (?,?,?,?,?)",
          [
            val["title"],
            val["text"],
            val["dateTime"],
            result.insertId,
            req.userId,
          ]
        );
        insertedData[i]["notesId"].push(notesResult.insertId);
      }
    } else if (cd["isDeleted"]) {
      setImagesForDeletion(
        imagePath,
        cardFrontPath,
        cardBackPath,
        deleteImage,
        req.userId,
        cd["id"]
      );

      await db.execute("Delete from carddata where userId = ? And id = ?", [
        req.userId,
        cd["id"],
      ]);
      await db.execute("Delete from phone where cardDataId = ?", [cd["id"]]);
      await db.execute("Delete from notes where cardDataId = ?", [cd["id"]]);
    } else if (cd["isUpdated"]) {
      setImagesForDeletion(
        imagePath,
        cardFrontPath,
        cardBackPath,
        deleteImageIfNotFound,
        req.userId,
        cd["id"]
      );

      await db.execute(
        "Update carddata set name = ?,email = ?,image = ?,cardFront = ?,cardback = ?,companyName = ?,address = ?,companyWebsite = ?,designation = ?,department = ?,stateName = ?,cityName = ?,countryName = ?,isBorderRadiusApplied = ? where userId = ? And id = ?",
        [
          cd["name"],
          cd["email"],
          imagePath,
          cardFrontPath,
          cardBackPath,
          cd["companyName"],
          cd["address"],
          cd["companyWebsite"],
          cd["designation"],
          cd["department"],
          cd["stateName"],
          cd["cityName"],
          cd["countryName"],
          cd["isBorderRadiusApplied"],
          req.userId,
          cd["id"],
        ]
      );

      insertedData.push({
        phoneId: [],
        notesId: [],
      });
      let lastIndex = insertedData.length - 1;

      for (let val of cd["phone"]) {
        if (val["id"] == null) {
          let phoneResult = await db.execute(
            "Insert into phone (isoCode,countryCode,phone,cardDataId) Values (?,?,?,?)",
            [val["isoCode"], val["countryCode"], val["phone"], cd["id"]]
          );
          insertedData[lastIndex][phoneId].push(phoneResult.insertId);
        } else if (val["isUpdated"]) {
          await db.execute(
            "Update phone set isoCode = ?,countryCode = ?,phone = ? where cardDataId = ? And id = ?",
            [
              val["isoCode"],
              val["countryCode"],
              val["phone"],
              cd["id"],
              val["id"],
            ]
          );
        } else if (val["isDeleted"]) {
          await db.execute(
            "Delete from phone where cardDataId = ? And id = ?",
            [cd["id"], val["id"]]
          );
        }
      }
      for (let val of cd["notes"]) {
        if (val["id"] == null) {
          let notesResult = await db.execute(
            "Insert into notes (title,text,dateTime,cardDataId,userId) Values (?,?,?,?,?)",
            [val["title"], val["text"], val["dateTime"], cd["id"], req.userId]
          );
          insertedData[lastIndex][notesId].push(notesResult.insertId);
        } else if (val["isUpdated"]) {
          await db.execute(
            "Update notes set title = ?,text = ?,dateTime = ? where cardDataId = ? And id = ?",
            [val["title"], val["text"], val["dateTime"], cd["id"], val["id"]]
          );
        } else if (val["isDeleted"]) {
          await db.execute(
            "Delete from notes where cardDataId = ? And id = ?",
            [cd["id"], val["id"]]
          );
        }
      }
    }
  }

  res.status(200).json({
    message: "User Data Saved Successfully !!",
    data: insertedData,
  });
};

exports.changePassword = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  let loadedUser;
  db.execute("SELECT * FROM users where email = ?", [email])
    .then(([[user]]) => {
      if (user != null) {
        loadedUser = user;
        return bcrypt.hash(password, 12);
      } else {
        return;
      }
    })
    .then((hashedPw) => {
      if (loadedUser != null) {
        return db.execute("Update users set password = ? where email = ?", [
          hashedPw,
          email,
        ]);
      }
    })
    .then((result) => {
      if (result != null) {
        res.status(200).json({
          changed: true,
        });
      } else {
        res.status(200).json({
          changed: false,
        });
      }
    })
    .catch((err) => {
      console.log(err);
    });
};

function generateOTP(length) {
  const chars = "0123456789";
  const charsLength = chars.length;
  let otp = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charsLength);
    otp += chars[randomIndex];
  }

  return otp;
}

exports.generateValidationCode = (req, res, next) => {
  const email = req.body.email;
  const otp = generateOTP(6);
  loadAccessToken()
    .then((data) => {
      transporter.sendMail(
        {
          from: process.env.emailVal, // TODO: email sender
          to: email, // TODO: email receiver
          subject: "Signup Validation!",
          text: `Business Card App validation code is ${otp}`,
        },
        (err, data) => {
          if (err) {
            console.log(err);
            console.log("Error Sending Email !!");
            res.status(200).json({
              message:
                "Error occured while sending validation code to your email",
            });
          } else {
            res.status(200).json({
              validation: otp,
              message: "Validation code sent",
            });
            console.log("Email sent!!!");
          }
        }
      );
    })
    .catch((err) => {
      console.log(err);
    });
};

function userExists(fieldName, value, res) {
  db.execute("SELECT * FROM users where " + fieldName + " = ?", [value])
    .then(([[user]]) => {
      if (user != null) {
        res.status(200).json({
          exists: true,
        });
      } else {
        res.status(200).json({
          exists: false,
        });
      }
    })
    .catch((err) => {
      console.log(err);
    });
}

exports.checkIfEmailAlreadyExists = (req, res, next) => {
  userExists("email", req.body.email, res);
};

exports.checkIfSameDevice = (req, res, next) => {
  userExists("deviceId", req.body.deviceId, res);
};

exports.registerUser = async (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  const deviceId = req.body.deviceId;

  //because date time is not stored correctly in database
  var currentDate = new Date(
    new Date().toISOString().slice(0, 19).replace("T", " ")
  );

  let hashedPw = await bcrypt.hash(password, 12);
  if (hashedPw != null) {
    [[user]] = await db.execute("SELECT * FROM users where email = ?", [email]);
    if (user == null) {
      let [result] = await db.execute(
        "Insert into users (email,password,deviceId,createdAt,last_login) Values (?,?,?,?,?)",
        [email, hashedPw, deviceId, currentDate, currentDate]
      );
      if (result != null) {
        loggedInUsers.push({
          id: result.insertId,
        });

        const token = jwt.sign(
          {
            id: result.insertId.toString(),
            email: email,
            currentDate: currentDate,
          },
          process.env.JSON_KEY
        );

        res.status(200).json({
          token: token,
          message: "SignUp Successfull",
          id: result.insertId,
        });
      }
    } else {
      res.status(200).json({
        message: "Account with the same email is already added !!",
      });
    }
  }
};

exports.login = async (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  let [[user]] = await db.execute("SELECT * FROM users where email = ?", [
    email,
  ]);

  if (user == null) {
    res.status(200).json({
      message: "Your Email Address is Incorrect",
    });
  } else {
    var isEqual = await bcrypt.compare(password, user.password);
    if (!isEqual) {
      res.status(200).json({
        message: "Your Password is Incorrect",
      });
    } else {
      var found = false;
      for (var i = 0; i < loggedInUsers.length; i++) {
        if (user.id == loggedInUsers[i].id) {
          found = true;
        }
      }

      var currentDate = new Date(
        new Date().toISOString().slice(0, 19).replace("T", " ")
      );
      await db.execute("Update users set last_login = ? where email = ?", [
        currentDate,
        email,
      ]);

      const token = jwt.sign(
        {
          id: user.id.toString(),
          email: user.email,
          currentDate: currentDate,
        },
        process.env.JSON_KEY
      );

      if (!found) {
        loggedInUsers.push({
          id: user.id,
        });
      }

      res.status(200).json({
        found: found,
        token: token,
      });
    }
  }
};
