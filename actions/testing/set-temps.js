const Schema     = require("joi");
const _          = require("lodash");
const log        = _log.get("testing:set-temps");
const cache      = require("../../services/cache-manager");
const CHILDSTORE = cache.store("CHILDPISTORE", CONSTANT("CHILD_PI_CACHE_TTL"));

module.exports = async function(options) {
	let _obj = {ttl: Schema.number().positive().precision(0).required()}, _valueSchema = Schema.number().integer();
	for(const mode of CONSTANT("HEATING_MODE_ENUM").filter(value => value!=="auto"))
		_obj[mode] = _valueSchema;
	options = Schema.object(_obj).validate(options, {abortEarly: false});
	if(options.error) {
		log.error("Validation error on options argument. %O", options.error);
		throw options.error;
	} else options = options.value;

	let xs = [];

	for(const op in _.omit(options, "ttl")) {
		let x = {
			name       : op,
			temp       : options[op],
			lastChecked: new Date(),
		};
		log.info("Setting %s temperature for %d secs as %o", op, options.ttl, x);
		CHILDSTORE.set(op, x, options.ttl);
		xs.push(x);
	}

	return xs;
};
