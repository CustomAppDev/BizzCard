const express = require("express");
const router = express.Router();
const isAuth = require("../Security/isAuth");
const authController = require("../controllers/auth");
const multer = require("multer");
const { multerS3 } = require("../s3");

const upload = multer({
  storage: multerS3,
}).fields([
  { name: "image", maxCount: 12 },
  { name: "cardFront", maxCount: 12 },
  { name: "cardBack", maxCount: 12 },
]);

router.post("/register", authController.registerUser);
router.post("/login", authController.login);
router.post("/generateValidationCode", authController.generateValidationCode);
router.post(
  "/checkIfEmailAlreadyExists",
  authController.checkIfEmailAlreadyExists
);
router.post("/checkIfSameDevice", authController.checkIfSameDevice);
router.post("/changePassword", authController.changePassword);
router.post("/saveData", isAuth, upload, authController.saveData);
router.post("/remove", isAuth, authController.removeAccount);
router.post("/getSpecificUserData", isAuth, authController.getSpecificUserData);
router.get("/logout", isAuth, authController.logout);
router.get("/getUserData", isAuth, authController.getUserData);

module.exports = router;