const log   = _log.get("broadcast-water");
const _     = require("lodash");
const state = require("../services/thermo-state");

module.exports = async function() {
	log.debug("Constructing water config object");
	const config = _.omit(state.water, [ "cronJob" ]);

	log.info("Emitting water update");
	WS.emit("water-update", config);
	return config;
};
