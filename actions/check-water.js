const state          = require("../services/thermo-state");
const inSchedule     = require("./in-schedule");
const broadcastWater = require("./broadcast-water");
const log            = _log.get("check-water");

module.exports = async function checkWater() {

	log.notice("Checking Water...");
	const dateFormat        = "ddd DDD at h:mmA";
	let now                 = new Date();
	state.water.lastChecked = now;

	if(state.water.manual) {
		log.debug("Water is set to MANUAL."); //Ignoring schedule when manual.

		//IF END DATE HAS NOT PAST, TURN/KEEP WATER ON.
		if(state.water.endDT && now<state.water.endDT) {
			log.info("Water is manually %s until %s", "ON", dateUtils.format(state.water.endDT, dateFormat));
			await state.setWater({on: true});
		}

		//IF END DATE IS IN THE PAST, TURN OFF WATER AND RESET TO SCHEDULE.
		else {
			log.info("Water manual override end date of %s has now past. Reset to schedule.",
					 dateUtils.format(state.water.endDT, dateFormat));
			await state.setWater({manual: false});
			//Going to continue on as we now need to check for the schedule!
		}
	}

	let on = false, event = false;
	if(!state.water.manual) {
		log.debug("Checking schedule...");
		try {
			// noinspection ES6ConvertVarToLetConst
			({result: on, event} = await inSchedule("water"));
		} catch(e) {
			log.error("Unable to fetch schedule!");
			log.error("Error: %O", e);
		}

		//WATER SHOULD BE SCHEDULED WITHIN THE NEXT 2HRS.
		if(event) {
			log.info("Water is scheduled to be ON between %s and %s.", dateUtils.format(event.startDT, dateFormat),
					 dateUtils.format(event.endDT, dateFormat));
			await state.setWater({
									 on,
									 startDT: event.startDT,
									 endDT  : event.endDT
								 });
		}

		//WATER IS NOT SCHEDULED WITHIN THE NEXT 2HRS.
		else {
			log.info("Water is not scheduled within the next 2Hrs. Reset to defaults.");
			await state.setWater({
									 on,
									 startDT: null,
									 endDT  : null
								 });
		}
	}

	return broadcastWater();
};
