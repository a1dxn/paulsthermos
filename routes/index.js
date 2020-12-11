const express = require("express");
const router  = express.Router();
require("../services/thermo-state");
require("date-and-time");

/* GET home page. */
router.get("/", async function(req, res) {

	res.render("index", {title: "something"});
});

module.exports = router;
