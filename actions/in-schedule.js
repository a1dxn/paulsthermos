const getSchedule = require("./get-schedule");
const log         = _log.get("in-schedule");
const Schema      = require("joi");

module.exports = async(typeOrOptions) => {
	if(typeof typeOrOptions!=="object") {
		typeOrOptions = {
			type : typeOrOptions,
			hours: "",
		};
	}
	typeOrOptions = Schema.object({
									  type: Schema.allow("heating", "water").required()
								  })
						  .validate(typeOrOptions, {abortEarly: false, allowUnknown: true});
	if(typeOrOptions.error) {
		log.error("Validation error on options argument. %O", typeOrOptions.error);
		throw typeOrOptions.error;
	} else typeOrOptions = typeOrOptions.value; //Values would be casted to correct data types

	return getSchedule(typeOrOptions)
		.then(schedule => {
			let r = {now: new Date(), result: false, event: null, schedule: schedule};
			if(schedule.length>0) {
				log.debug("Schedule has %d items.", schedule.length);
				if(r.now>=schedule[0].startDT && r.now<schedule[0].endDT) r.result = true;
				r.event = schedule[0];
			} else {
				log.debug("No scheduled items");
			}
			return r;
		})
		.catch(error => {
			log.error("Error with getSchedule: %O", error);
			throw error;
		});
};
