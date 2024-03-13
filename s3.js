const aws = require("aws-sdk");
const multerS3 = require("multer-s3");
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

exports.multerS3 = multerS3({
  s3: s3,
  bucket: bucketName,
  metadata: function (req, file, cb) {
    cb(null, { fieldName: file.fieldname });
  },
  key: async function (req, file, cb) {
    const prefix = req.userId;
    const fileName = file.fieldname + "-" + Date.now();
    const extension = path.extname(file.originalname);
    const fullName = fileName + extension;
    const key = `${prefix}/${fullName}`;
    cb(null, key);
  },
});

exports.deleteAllUserImages = async (userId) => {
  let params = { Bucket: bucketName, Prefix: `${userId}/` };
  const data = await s3.listObjects(params).promise();
  data.Contents.forEach(async (object) => {
    params = { Bucket: bucketName, Key: object.Key };
    await s3.deleteObject(params).promise();
  });
};

exports.deleteSpecificUserImage = async (fileName, userId) => {
  let params = { Bucket: bucketName, Prefix: `${userId}/` };
  const data = await s3.listObjects(params).promise();
  data.Contents.forEach(async (object) => {
    if (path.basename(object.Key) == fileName) {
      params = { Bucket: bucketName, Key: object.Key };
      await s3.deleteObject(params).promise();
    }
  });
};

exports.getFileStream = (id, fileName) => {
  var downloadParams = {
    Bucket: bucketName,
    Key: `${id}/${fileName}`,
  };
  return s3.getObject(downloadParams).createReadStream();
};
