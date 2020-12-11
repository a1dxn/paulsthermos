const express = require("express");
const router  = express.Router();
require("../services/thermo-state");
require("lodash");
const log = _log.get("http:api");
require("joi");

router.get("/", function(req, res) {
	res.redirect(CONSTANT("API_DOCUMENTATION_URL"));
});

//API Method for get-config
router.get("/setTemps", async(req, res) => {
	const setTemps = require("../actions/testing/set-temps");
	const flog     = log.get("set-temps");
	const input    = req.query;

	flog.info("Called with params %O", input);

	return setTemps(input,).then(result => {
		flog.debug("Succeeded with result %O", result);
		res.json({input, result});
	}).catch(error => {
		flog.debug("Error response: %O", error);
		res.json({error});
	});

});

module.exports = router;
