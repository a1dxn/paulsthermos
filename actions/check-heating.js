const state            = require("../services/thermo-state");
const getTempNow       = require("./get-temp-now");
const broadcastHeating = require("./broadcast-heating");
const inSchedule       = require("./in-schedule");
const log              = _log.get("check-heating");
require("lodash");

const dateFormat = "ddd DDD at h:mmA";

module.exports = async function checkHeating() {

	log.notice("Checking Heating...");
	state.heating.lastChecked = new Date();

	//1. Check current temperature...get default temp first for min check
	let currentTemp;
	try {
		currentTemp = await getTempNow(CONSTANT("HEATING_DEFAULT_MODE"));

	} catch(e) {
		const failover = await HeatingFailover();
		if(!failover) {
			await state.setHeating({on: false});
			await broadcastHeating();
			throw e;
		} else currentTemp = failover;
	}

	//IF TEMP BELOW MINIMUM TEMPERATURE THEN TURN IT ON !!
	//Disregards heating goal, options, manual override and schedule.
	if(currentTemp<CONSTANT("HEATING_MINIMUM_TEMPERATURE")) {
		log.warn("Current temperature is %dC and is below the minimum temperature of %dC.",
				 currentTemp,
				 CONSTANT("HEATING_MINIMUM_TEMPERATURE"));
		await state.setHeating({on: true});
		return broadcastHeating();
	}

	//Now we've checked the minimum against default temp, lets get the temp for chosen heating options!
	try {
		currentTemp = await getTempNow(state.heating.mode);
	} catch(e) {
		const failover = await HeatingFailover();
		if(!failover) {
			await state.setHeating({on: false});
			throw e;
		} else currentTemp = failover;
	}

	//Check schedule if not on manual override.
	let onSchedule = false, event = false;
	if(!state.heating.manual) {
		log.debug("Checking schedule as manual override is off...");
		try {
			// noinspection ES6ConvertVarToLetConst
			({result: onSchedule, event} = await inSchedule("heating"));
		} catch(e) {
			log.error("Unable to fetch schedule!");
			log.error("Error: %O", e);
		}

		if(event) {
			log.info("Heating is scheduled to be set at %dC between %s and %s.", event.temp,
					 dateUtils.format(event.startDT, dateFormat),
					 dateUtils.format(event.endDT, dateFormat));
			await state.setHeating({goal: event.temp, mode: event.mode, startDT: event.startDT, endDT: event.endDT});
		} else { //AKA manual is OFF and schedule is EMPTY... so lets set everything back to defaults!
			log.info("Heating is not scheduled within the next 2Hrs. Reset to defaults.");
			await state.setHeating({
									   on     : false,
									   goal   : CONSTANT("HEATING_MINIMUM_TEMPERATURE"),
									   mode   : CONSTANT("HEATING_DEFAULT_MODE"),
									   manual : false,
									   startDT: null,
									   endDT  : null,
								   });

		}
	}

	//IF MANUAL OVERRIDE OR CURRENTLY SCHEDULED TO BE ON:
	if(state.heating.manual || onSchedule) {

		//IF MANUAL OVERRIDE HAS A SPECIFIED END DATE, EVALUATE THAT FIRST
		if(state.heating.manual && state.heating.endDT) {
			if(new Date()>=state.heating.endDT) {
				log.info("Heating manual override end date of %s has now past. Reset to schedule.",
						 dateUtils.format(state.heating.endDT, dateFormat));
				await state.setHeating({
										   on     : false,
										   manual : false,
										   mode   : CONSTANT("HEATING_DEFAULT_MODE"),
										   startDT: null,
										   endDT  : null
									   });
				return checkHeating(); //Lets go another round to check for schedule this time.
			} else log.debug("Heating manual override end date of %s is still in the future.",
							 dateUtils.format(state.heating.endDT, dateFormat));
		}

		const heatingGoalOffset      = CONSTANT("HEATING_GOAL_OFFSET");
		const heatingGoalOffsetPrint = (Math.sign(heatingGoalOffset)> -1 ? "+" : "")+heatingGoalOffset;
		let goalThreshold            = state.heating.goalTemp+CONSTANT("HEATING_TEMPERATURE_THRESHOLD");

		//IF TEMP HAS REACHED THE GOAL(+OFFSET) THEN TURN OFF
		if(currentTemp>=state.heating.goalTemp+heatingGoalOffset) {
			log.info("Current temperature %dC has reached the goal of %d(%s)C.", currentTemp,
					 state.heating.goalTemp, heatingGoalOffsetPrint);
			await state.setHeating({on: false});
		}

		//IF TEMP IS BELOW (GOAL-THRESHOLD) THEN TURN ON
		else if(currentTemp<goalThreshold) {
			log.info("Current temperature %dC is below the threshold of %dC. Goal is %d(%s)C.", currentTemp,
					 goalThreshold, state.heating.goalTemp, heatingGoalOffsetPrint);
			await state.setHeating({on: true});
		}

		//HEATING IS ON... NO CHANGE NECESSARY.
		else {
			log.info("Current temperature is %dC and rising. Goal is %d(%s)C.", currentTemp,
					 state.heating.goalTemp, heatingGoalOffsetPrint);
			await state.setHeating({on: true});
		}

	}

	return broadcastHeating();
};

async function HeatingFailover() {
	//TODO: extract these as constants?
	let retriesLeft     = 5;
	let sleepMS         = 2000;
	let succeeded       = false;
	let succeededResult = null;

	log.warn("Error occurred fetching default mode of current temperatures. Going to retry every %d secs for %d tries.",
			 sleepMS/1000, retriesLeft);
	log.warn("If no response from any child pi then heating will be turned off!");

	while(retriesLeft>0 && !succeeded) {
		await sleep(2000);
		try {
			log.warn("Failover in progress... Checking temp %d more times", retriesLeft);
			succeededResult = await getTempNow("auto");
			log.info("Failover attempt succeeded! Phew...");
			succeeded = true;
		} catch(e) {
		}
		retriesLeft--;
	}
	if(succeeded) {
		log.notice("Heating failover recovered. Continuing heating check.");
		return succeededResult;
	} else {
		log.error("Heating failover initiated. Heating will be turned %s.", "OFF");
		return false;
	}
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
