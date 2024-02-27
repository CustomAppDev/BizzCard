const express = require("express");
const router = express.Router();
const isAuth = require("../Security/isAuth");
const cardController = require("../controllers/cards");

router.post("/updateOrAddCard", isAuth, cardController.updateOrAddCard);
router.get("/getAllCards", isAuth, cardController.getAllCards);

module.exports = router;
