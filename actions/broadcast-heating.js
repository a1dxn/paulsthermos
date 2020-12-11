const log      = _log.get("broadcast-heating");
const _        = require("lodash");
const getTemps = require("./get-temp-now");
const state    = require("../services/thermo-state");

module.exports = async function() {
	log.debug("Constructing heating config object");
	let config   = _.omit(state.heating, [ "cronJob" ]);
	config.temps = null;
	try {
		config.temps = await getTemps(CONSTANT("HEATING_MODE_ENUM"), true);
	} catch(e) {
		log.error("Unable to fetch temps to broadcast!");
	}

	log.info("Emitting heating update");
	WS.emit("heating-update", config);
	return config;
};
