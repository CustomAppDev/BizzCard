const express = require("express");
const router = express.Router();
const isAuth = require("../Security/isAuth");
const authController = require("../controllers/auth");
const aws = require("aws-sdk");
const multerS3 = require("multer-s3");
const multer = require("multer");
const path = require("path");

const bucketName = process.env.AWS_BUCKET_NAME;
const region = process.env.AWS_BUCKET_REGION;
const accessKey = process.env.AWS_ACCESS_KEY;
const secretKey = process.env.AWS_SECRET_KEY;

aws.config.update({
  accessKeyId: accessKey,
  secretAccessKey: secretKey,
  region: region,
});

const s3 = new aws.S3();

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: bucketName,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: async function (req, file, cb) {
      let params = { Bucket: bucketName, Prefix: `${req.userId}/` };
      const data = await s3.listObjects(params).promise();
      data.Contents.forEach(async (object) => {
        if (path.basename(object.Key).startsWith(file.fieldname)) {
          params = { Bucket: bucketName, Key: object.Key };
          await s3.deleteObject(params).promise();
        }
      });

      const prefix = req.userId;
      const fileName = file.fieldname + "-" + Date.now();
      const extension = path.extname(file.originalname);
      const fullName = fileName + extension;
      const key = `${prefix}/${fullName}`;
      cb(null, key);
    },
  }),
}).fields([
  { name: "image", maxCount: 12 },
  { name: "cardFront", maxCount: 12 },
  { name: "cardBack", maxCount: 12 },
]);

const deleteAllUserImages = async (req, res, next) => {
  let params = { Bucket: bucketName, Prefix: `${req.userId}/` };
  const data = await s3.listObjects(params).promise();
  data.Contents.forEach(async (object) => {
    params = { Bucket: bucketName, Key: object.Key };
    await s3.deleteObject(params).promise();
  });
};

router.get("/:id/:key", (req, res, next) => {
  var id = req.params.id;
  var fileName = req.params.key;
  var downloadParams = {
    Bucket: bucketName,
    Key: `${id}/${fileName}`,
  };
  s3.getObject(downloadParams).createReadStream().pipe(res);
});

router.post("/register", authController.registerUser);
router.post("/login", authController.login);
router.post("/generateValidationCode", authController.generateValidationCode);
router.post(
  "/checkIfEmailAlreadyExists",
  authController.checkIfEmailAlreadyExists
);
router.post("/changePassword", authController.changePassword);
router.post("/saveData", isAuth, upload, authController.saveData);
router.post(
  "/remove",
  isAuth,
  deleteAllUserImages,
  authController.removeAccount
);
router.post("/getSpecificUserData", isAuth, authController.getSpecificUserData);
router.get("/logout", isAuth, authController.logout);
router.get("/getUserData", isAuth, authController.getUserData);
router.get("/checkIsAuth", isAuth, authController.checkIsAuth);

module.exports = router;
