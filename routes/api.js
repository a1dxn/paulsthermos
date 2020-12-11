const express = require("express");
const router  = express.Router();
const state   = require("../services/thermo-state");
const _       = require("lodash");
const log     = _log.get("http:api");
const Schema  = require("joi");

/* GET home page. */
router.get("/", async function(req, res) {
	res.redirect(CONSTANT("API_DOCUMENTATION_URL"));
});

//API Method for getting state info
router.get("/state", (req, res) => {
	let input = Schema.object({
								  type: Schema.string().valid("heating", "water", "").lowercase()
							  }).validate(req.query, {abortEarly: false});
	if(input.error) return res.json(input.error);
	else input = input.value;

	let result = {input};
	if(!input.type || input.type==="heating") result.heating = _.omit(state.heating, [ "cronJob" ]);
	if(!input.type || input.type==="water") result.water = _.omit(state.water, [ "cronJob" ]);

	return res.json(result);

});

//API Method for get-schedule
router.get("/schedule", (req, res) => {
	const getSchedule = require("../actions/get-schedule");
	const flog        = log.get("get-schedule");
	const input       = req.query;

	return getSchedule(input).then(items => {
		res.json({items});
	}).catch(error => {
		flog.debug("Error response: %O", error);
		res.json({input, error});
	});
});

//API Method for in-schedule
router.get("/inSchedule", (req, res) => {
	const inSchedule = require("../actions/in-schedule");
	const flog       = log.get("in-schedule");
	const input      = req.query;

	return inSchedule(input).then(items => {
		res.json({items});
	}).catch(error => {
		flog.debug("Error response: %O", error);
		res.json({input, error});
	});
});

//API Method for check-heating
router.get("/checkHeating", (req, res) => {
	const checkHeating = require("../actions/check-heating");
	const flog         = log.get("check-heating");

	return checkHeating().then(result => {
		res.json({result});
	}).catch(error => {
		flog.debug("Error response: %O", error);
		res.json({error});
	});
});

//API Method for check-water
router.get("/checkWater", (req, res) => {
	const checkWater = require("../actions/check-Water");
	const flog       = log.get("check-heating");

	return checkWater().then(result => {
		res.json({result});
	}).catch(error => {
		flog.debug("Error response: %O", error);
		res.json({error});
	});
});

//API Method for set-water-manual
router.get("/setWaterManual", async(req, res) => {
	const setWaterManual = require("../actions/set-water-manual");
	const flog           = log.get("set-water-manual");
	const input          = req.query;
	flog.info("Called with params %O", input);

	return setWaterManual(input).then(result => {
		flog.debug("Succeeded with result %O", result);
		res.json({input, result});
	}).catch(error => {
		flog.debug("Error response: %O", error);
		res.json({error});
	});
});

//API Method for set-heating-manual
router.get("/setHeatingManual", async(req, res) => {
	const setHeatingManual = require("../actions/set-heating-manual");
	const flog             = log.get("set-heating-manual");
	const input            = req.query;
	flog.info("Called with params %O", input);

	return setHeatingManual(input).then(result => {
		flog.debug("Succeeded with result %O", result);
		res.json({input, result});
	}).catch(error => {
		flog.debug("Error response: %O", error);
		res.json({error});
	});
});

//API Method for get-temp-now
router.get("/getTemps", async(req, res) => {
	const getTemps = require("../actions/get-temp-now");
	const flog     = log.get("get-temps");
	const input    = {
		includeDetails: Schema.boolean().truthy("yes").falsy("no")
							  .validate(req.query.includeDetails).value
	};
	try {
		input.mode = req.query.mode.split(",");
	} catch(e) {
		res.json({error: "Input is not a comma-separated list."});
	}

	flog.info("query: %O", req.query);
	flog.info("input: %O", input);

	return getTemps(input.mode, input.includeDetails).then(result => {
		res.json({input, result});
	}).catch(error => {
		flog.debug("Error response: %O", error);
		res.json({error});
	});
});

//API Method for get-config
router.get("/config", async(req, res) => {
	const getConfig = require("../actions/get-config");
	const flog      = log.get("get-config");
	const input     = req.query;

	return getConfig(input).then(result => {
		res.json({input, result});
	}).catch(error => {
		flog.debug("Error response: %O", error);
		res.json({error});
	});
});

module.exports = router;
