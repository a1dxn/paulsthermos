const log         = _log.get("set-water-manual");
const Schema      = require("joi");
const state       = require("../services/thermo-state");
const cronManager = require("../services/cron-manager");
const checkWater  = require("./check-water");

/*
To set the water to manual, you should specify a duration in minutes >=10 OR provide a Date object of the end date-time.
 */

module.exports = async function(options) {
	options = Schema.object({
								duration: Schema.number()
												.precision(0)
												.min(CONSTANT("WATER_MANUAL_MINIMUM_DURATION"))
												.max(CONSTANT("WATER_MANUAL_MAXIMUM_DURATION")),
								endDT   : Schema.date(),
								off     : Schema.boolean().truthy("yes", "").disallow(false, "no")
							})
					.xor("duration", "endDT", "off") //either specify a duration or endDT but not both!
					.validate(options, {abortEarly: false});
	if(options.error) {
		log.error("Validation error on options argument. %O", options.error);
		throw options.error;
	} else options = options.value; //Values would be casted to correct data types

	const now   = new Date();
	const endDT = options.endDT || dateUtils.addMinutes(now, options.duration || 0);

	if(options.off || endDT<=now) {
		log.info("Water manual override has been turned %s.", "OFF");
		await state.setWater({manual: false}); //Turning off manual
	} else {
		log.info("Water manual override has been turned %s.", "ON");
		const waterOptions = {manual: true, endDT};
		if(!state.water.manual) waterOptions.startDT = now;
		await state.setWater(waterOptions); //Lets set the water to manual

		//Lets create a checkWater job at the end date-time given
		let cronIdentifier = "water_"+endDT.toISOString();
		if(!cronManager.isAlive(cronIdentifier)) {
			cronManager.forceClean(cronIdentifier);
			cronManager.jobstore.set(cronIdentifier, new cronManager.job({
																			 cronTime: endDT,
																			 onTick  : checkWater,
																			 start   : true,
																		 }));
		}
	}
	return checkWater();
};
