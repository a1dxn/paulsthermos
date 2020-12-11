const Schema = require("joi");
const tiny   = require("tiny-json-http");
const log    = _log.get("get-temp-now");
const cache  = require("../services/cache-manager");
const state  = require("../services/thermo-state");

const CHILDSTORE = cache.store("CHILDPISTORE", CONSTANT("CHILD_PI_CACHE_TTL"));

module.exports = async function(mode, includeDetails) {
	const modeSchema = Schema.string().lowercase().pattern(new RegExp(`(${CONSTANT("HEATING_MODE_ENUM").join("|")})`),
														   "Heating Modes ENUM").required();
	mode             = Schema.alternatives().try(
		modeSchema, //singular options
		Schema.array().items(modeSchema.required()).unique() //array of modes excluding auto
	).validate(mode);
	if(mode.error) {
		log.error("Validation error on options argument. %O", mode.error);
		throw mode.error;
	} else if(!Array.isArray(mode.value)) mode = [ mode.value ];
	else mode = mode.value.sort((a, b) => b==="auto" ? 1 : -1);

	//Choosing what pi's to eat...ehem 'talk to'
	const actions = [], ipAddresses = CONSTANT("CHILD_PI_IP_ADDRESSES");
	if(mode[0]==="auto") for(const child in ipAddresses) actions.push(fetch(child, ipAddresses[child]));
	else for(const child of mode) actions.push(fetch(child, ipAddresses[child]));

	return Promise.allSettled(actions)
				  .then(results => {
					  const fulfilled = results.filter(result => result.status==="fulfilled").map(v => v.value);
					  if(fulfilled.length<1) {
						  log.error("No temperatures could be fetched! Cannot proceed.");
						  throw "No temperatures could be fetched! Cannot proceed.";
					  }
					  log.info("Fulfilled!");

					  const modeResults = {};
					  for(const result of fulfilled) modeResults[result.name] = includeDetails ? result : result.temp;
					  if(mode[0]==="auto") {
						  let auto         = state._heatingAutoMode(fulfilled.map(v => v.temp));
						  modeResults.auto = {};
						  if(includeDetails) modeResults.auto.temp = auto;
						  else modeResults.auto = auto;
					  }
					  if(mode.length===1) return mode[0]==="auto" ? modeResults.auto : modeResults[0];
					  else return modeResults;
				  });

};

async function fetch(identifier, ip) {
	let cached = CHILDSTORE.get(identifier);
	if(cached) {
		log.debug("Fetched cached temperature data for child pi %s", identifier);
		return cached;
	}

	let id, timeout = new Promise((resolve, reject) => {
		id = setTimeout(() => {
			reject("Fetch timed out for "+identifier);
		}, 1000); //todo: extract this as a constant!
	});

	const url = `http://${ip}:${CONSTANT("CHILD_PI_PORT")}/${CONSTANT("CHILD_PI_TEMP_URL")}/`;
	return Promise.race([
							timeout,
							tiny.get({url})
						])
				  .then(response => {
					  clearTimeout(id);
					  log.info(`Fetched temperature data from child pi '%s'`, identifier);
					  if(response.name!==identifier)
						  log.warn("Mismatched identifier for %s. local:%s remote:%s", ip, identifier, response.name);
					  CHILDSTORE.set(identifier, response);
					  return response;
				  })
				  .catch(error => {
					  log.error("Unable to fetch temperature from child pi '%s' (%s)...Go check on that!",
								identifier, url);
					  log.debug("Error: %O", error);
					  throw error;
				  });
}
