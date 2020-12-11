const GoogleCalendar = require("node-google-calendar");
const CONFIG         = require("../config/gcal-settings");
const googleCalendar = new GoogleCalendar(CONFIG);
const cronManager    = require("../services/cron-manager");
const log            = _log.get("get-schedule");
const Schema         = require("joi");

const calendarCache = require("../services/cache-manager").store("calendarCache", CONSTANT("CALENDAR_CACHE_TTL"));

module.exports = async(options) => {
	options = Schema.object({
								hours  : Schema.number().positive().precision(0)
											   .failover(CONSTANT("CALENDAR_DEFAULT_HOURS_FUTURE")),
								startDT: Schema.date(),
								endDT  : Schema.date().greater(Schema.ref("startDT")),
								type   : Schema.allow("heating", "water").optional(),
							})
					.xor("hours", "startDT")
					.xor("hours", "endDT")
					.with("startDT", "endDT")
					.with("endDT", "startDT")
					.validate(options, {abortEarly: false});
	if(options.error) {
		log.error("Validation error on options argument. %O", options.error);
		throw options.error;
	} else options = options.value; //Values would be casted to correct data types

	//TODO: rework calendar cache!

	// let savedCalendar = calendarCache.get(CONSTANT('GET_SCHEDULE_SAVED_CALENDAR_IDENTIFIER'));
	// if(savedCalendar) {
	// 	log.debug('Returning cached schedule.');
	// 	return savedCalendar;
	// }

	const calendarID = CONFIG.calendarId.boiler;
	let params       = {};
	if(options.hours) {
		log.info("Fetching items %dHrs from now", options.hours);
		let now        = new Date();
		params.timeMin = now.toISOString().replace(/\.\d+/, ""); //New date minus milliseconds
		params.timeMax = dateUtils.addHours(now, options.hours).toISOString().replace(/\.\d+/, ""); //Get schedule for next 2 hours
	} else {
		log.info("Fetching items between %s and %s", options.startDT, options.endDT);
		params.timeMin = options.startDT.toISOString().replace(/\.\d+/, "");
		params.timeMax = options.endDT.toISOString().replace(/\.\d+/, "");
	}
	log.debug("Fetching schedule with params %o", params);

	let calendarItems = [];
	return googleCalendar.Events.list(calendarID, params)
						 .then(items => { //Sort items with overwriting events going first then generate list
							 items.sort((a, b) => a.recurringEventId ? -1 : 1);
							 return generateList(items);
						 })
						 .then(formattedList => { //Sort the generated list into good calendarItems and ones that need more info
							 let tasks = [];
							 for(let item of formattedList) {
								 if(item.single) calendarItems.push(item);
								 else if(!item.single) tasks.push(
									 googleCalendar.Events.instances(calendarID, item.id, params));
							 }
							 return Promise.all(tasks);
						 })
						 .then(queries => { //Generate lists for these extra queries
							 let tasks = [];
							 for(let q of queries) tasks.push(generateList(q));
							 return Promise.all(tasks);
						 })
						 .then(formattedLists => { //add the new generated lists to the good calendarItems
							 for(let list of formattedLists) calendarItems = calendarItems.concat(list);
							 calendarItems.sort((a, b) => a.startDT>b.startDT ? 1 : -1);
							 calendarCache.set(CONSTANT("GET_SCHEDULE_SAVED_CALENDAR_IDENTIFIER"), calendarItems);
							 // log.debug('Final calendarItems (%d) %O', calendarItems.length, calendarItems);
							 return calendarItems;
						 })
						 .then(items => { //Add the unique start/end times in calendarItems as cron jobs
							 let secondOffset = CONSTANT("CALENDAR_CRON_JOB_TIME_OFFSET");
							 let now          = new Date();
							 for(const item of items) {
								 let identifier = item.type+"_"+item.startDT.toISOString();
								 let options    = {
									 cronTime: dateUtils.addSeconds(item.startDT, secondOffset),
									 context : this,
									 onTick  : require(`../actions/check-${item.type}`),
									 start   : true,
								 };
								 if(item.startDT>now && !cronManager.isAlive(identifier)) {
									 cronManager.forceClean(identifier);
									 cronManager.jobstore.set(identifier, new cronManager.job(options));
									 log.info("Schedule generated new job %s", identifier);
								 }

								 options.cronTime = dateUtils.addSeconds(item.endDT, secondOffset);
								 options.onTick   = require(`../actions/check-${item.type}`);
								 identifier       = item.type+"_"+item.endDT.toISOString();
								 if(item.endDT>now && !cronManager.isAlive(identifier)) {
									 cronManager.forceClean(identifier);
									 cronManager.jobstore.set(identifier, new cronManager.job(options));
									 log.info("Schedule generated new job %s", identifier);
								 }
							 }
							 return items;
						 })
						 .then(items => { //Going to split them if needed!
							 if(options.type) items = items.filter((item) => item.type===options.type);
							 return items;
						 })
						 .catch(error => {
							 log.error(error);
							 throw error;
						 });
};

async function generateList(items) {
	let formattedList = [];
	let summaryRegex  = new RegExp(`(${CONSTANT("HEATING_MODE_ENUM").join("|")})_\\d{1,2}`);
	for(const item of items) {
		if(item.status!=="confirmed") continue;

		let obj = {
			id     : item.recurringEventId || item.id,
			startDT: new Date(item.start.dateTime),
			endDT  : new Date(item.end.dateTime),
			type   : item.summary.toLowerCase()==="water" ? "water" : "heating",
			single : !(item.recurrence), //object key wont exist if its empty! (thanks Google)
		};
		if(obj.type==="heating") {
			if(!summaryRegex.test(item.summary)) {
				log.error(
					`Schedule event is not in the format of 'mode_temp' OR the temperature is more than 2 digits. Skipping event: %O`,
					obj);
				continue; //Skipping.
			}
			let titleComponents = item.summary.split("_");
			obj.mode            = titleComponents[0];
			obj.temp            = parseFloat(titleComponents[1]);
		}
		formattedList.push(obj);
	}
	return formattedList;
}
