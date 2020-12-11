const _           = require("lodash");
const Schema      = require("joi");
const cronManager = require("./cron-manager");
const log         = _log.get("thermo-state");

module.exports = {

	heating: {
		//Boolean to show if heating is currently switched on.
		on: false,

		//Temperature we're trying to reach!
		goalTemp: null,

		//What value to take as the current temperature. see CONSTANT for desc.
		mode: null,

		//Date and time the heating was last switched on.
		startDT: null,

		//If scheduled, the date and time the heating will switch off, or change temperature.
		//OR if a duration was manually specified through web interface.
		endDT: null,

		//When true, the schedule will be disregarded and values given through web interface will be used.
		manual: false,

		cronJob: null,

		lastChecked: null,

		lastUpdated: null,
	},

	water: {
		//Boolean to show if the hot water is currently switched on.
		on: false,

		//Date and time the hot water was last switched on.
		startDT: null,

		//If scheduled, the date and time the hot water will switch off.
		//OR if a duration was manually specified through web interface.
		endDT: null,

		//When true, the schedule will be disregarded and values given through web interface will be used.
		manual: false,

		cronJob: null,

		lastChecked: null,

		lastUpdated: null,
	},

	initialize: function() {
		const flog = log.get("initialize");
		flog.notice(`Initialising State and base cron jobs.`);
		if(!this.heating.manual) {
			let min               = CONSTANT("HEATING_MINIMUM_TEMPERATURE");
			this.heating.goalTemp = min;
			flog.info("Heating Goal Temperature has been reset to %dC", min);

			let mode          = CONSTANT("HEATING_DEFAULT_MODE");
			this.heating.mode = mode;
			flog.info("Heating Mode has been reset to %s", mode);
		}

		let heatMins  = CONSTANT("HEATING_CHECK_INTERVAL_MINUTES");
		let waterMins = CONSTANT("WATER_CHECK_INTERVAL_MINUTES");
		flog.info("Auto Heating Check has been set to %d minutes", heatMins);
		flog.info("Auto Water Check has been set to %d minutes", waterMins);

		cronManager.initialize();

		if(this.heating.cronJob) this.heating.cronJob.stop();
		this.heating.cronJob = new cronManager.job({
													   cronTime : `0 */${heatMins} * * * *`,
													   context  : this,
													   onTick   : require("../actions/check-heating"),
													   start    : true,
													   runOnInit: true,
												   });

		if(this.water.cronJob) this.water.cronJob.stop();
		this.water.cronJob = new cronManager.job({
													 cronTime : `5 */${waterMins} * * * *`,
													 context  : this,
													 onTick   : require("../actions/check-water"),
													 start    : true,
													 runOnInit: true,
												 });

		log.debug("Heating configuration: %O", _.omit(this.heating, [ "cronJob" ]));
		log.debug("Water configuration: %O", _.omit(this.water, [ "cronJob" ]));

	},

	_heatingAutoMode: function(tempsArray) {
		//Return lowest value of them all
		return tempsArray.sort((a, b) => a>b ? 1 : -1)[0];
	},

	setHeating: async function(options) {
		//options {on, goal, options, manual, startDT, endDT}
		let flog                = log.get("set-heating");
		const optionsValidation = Schema.object({
													on     : Schema.boolean(),
													goal   : Schema.number().positive(),
													mode   : Schema.string().lowercase()
																   .pattern(new RegExp(
																	   `(${CONSTANT("HEATING_MODE_ENUM").join("|")})`),
																			"Heating Modes ENUM"),
													manual : Schema.boolean(),
													startDT: Schema.date().allow(null),
													endDT  : Schema.date().allow(null),
												})
										.validate(options, {abortEarly: false});
		if(_.has(optionsValidation, "error")) {
			flog.error("Validation error on options argument. %O", optionsValidation.error);
			throw optionsValidation.error;
		} else options = optionsValidation.value; //Values would be casted to correct data types

		if(_.has(options, "goal")) this.heating.goalTemp = options.goal;
		if(_.has(options, "mode")) this.heating.mode = options.mode;
		if(_.has(options, "manual")) this.heating.manual = options.manual;
		if(_.has(options, "startDT")) this.heating.startDT = options.startDT;
		if(_.has(options, "endDT")) this.heating.endDT = options.endDT;

		if(_.has(options, "on") && options.on!==this.heating.on) {
			flog.notice("Heating is toggling %s", options.on ? "ON" : "OFF");
			this.heating.on          = options.on;
			this.heating.lastUpdated = new Date();
		} else {
			flog.info("Heating is %s", this.heating.on ? "ON" : "OFF");
		}

		flog.debug("Heating settings: %O", _.omit(this.heating, [ "cronJob" ]));
		return this.heating.on;
	},

	setWater: async function(options) {
		let flog                = log.get("set-water");
		const optionsValidation = Schema.object({
													on     : Schema.boolean(),
													manual : Schema.boolean(),
													startDT: Schema.date().allow(null),
													endDT  : Schema.date().allow(null),
												})
										.validate(options, {abortEarly: false});
		if(_.has(optionsValidation, "error")) {
			flog.error("Validation error on options argument. %O", optionsValidation.error);
			throw optionsValidation.error;
		} else options = optionsValidation.value; //Values would be casted to correct data types

		if(_.has(options, "manual")) this.water.manual = options.manual;
		if(_.has(options, "startDT")) this.water.startDT = options.startDT;
		if(_.has(options, "endDT")) this.water.endDT = options.endDT;

		if(_.has(options, "on") && options.on!==this.water.on) {
			flog.notice("Water is toggling %s", options.on ? "ON" : "OFF");
			this.water.on          = options.on;
			this.water.lastUpdated = new Date();
		} else {
			flog.info("Water is %s", this.water.on ? "ON" : "OFF");
		}

		flog.debug("Water settings: %O", _.omit(this.water, [ "cronJob" ]));
		return this.water.on;
	},

};
