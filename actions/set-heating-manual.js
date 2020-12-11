const log          = _log.get("set-heating-manual");
const Schema       = require("joi");
const state        = require("../services/thermo-state");
const cronManager  = require("../services/cron-manager");
const checkHeating = require("./check-heating");

module.exports = async function(options) {
	options = Schema.object({
								goal    : Schema.number().precision(1).positive()
												.min(CONSTANT("HEATING_MINIMUM_TEMPERATURE")),
								mode    : Schema.string().lowercase()
												.pattern(new RegExp(`(${CONSTANT("HEATING_MODE_ENUM").join("|")})`),
														 "Heating Modes ENUM"),
								duration: Schema.number()
												.precision(0)
												.min(CONSTANT("HEATING_MANUAL_MINIMUM_DURATION"))
												.max(CONSTANT("HEATING_MANUAL_MAXIMUM_DURATION")),
								endDT   : Schema.date(),
								off     : Schema.boolean().truthy("yes", "").disallow(false, "no"),
							})
					.xor("duration", "endDT", "off") //either specify a duration or endDT but not both!
					.with("duration", "goal")
					.with("endDT", "goal")
					.validate(options, {abortEarly: false});
	if(options.error) {
		log.error("Validation error on options argument. %O", options.error);
		throw options.error;
	} else options = options.value; //Values would be casted to correct data types

	//todo: set heating manual

	const now   = new Date();
	const endDT = options.endDT || dateUtils.addMinutes(now, options.duration || 0);

	if(options.off || endDT<=now) {
		log.info("Heating manual override has been turned %s.", "OFF");
		await state.setHeating({manual: false}); //Turning off manual
	} else {
		log.info("Heating manual override has been turned %s.", "ON");
		const heatingOptions = {manual: true, endDT};
		if(!state.water.manual) heatingOptions.startDT = now;
		if(options.goal) heatingOptions.goal = options.goal;
		if(options.mode) heatingOptions.mode = options.mode;
		await state.setHeating(heatingOptions); //Lets set the water to manual

		//Lets create a checkWater job at the end date-time given
		let cronIdentifier = "heating_"+endDT.toISOString();
		if(!cronManager.isAlive(cronIdentifier)) {
			cronManager.forceClean(cronIdentifier);
			cronManager.jobstore.set(cronIdentifier, new cronManager.job({
																			 cronTime: endDT,
																			 onTick  : checkHeating,
																			 start   : true,
																		 }));
		}
	}

	return checkHeating();
};
