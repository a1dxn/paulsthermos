const nodeCache = require("node-cache");
const _         = require("lodash");
const log       = _log.get("cache-manager");

module.exports = {

	_highstreet: new Map(),

	store: function(name, ttl /*seconds*/) {
		if(_.isEmpty(name)) throw new Error("Missing store parameters");
		let foundStore = this._highstreet.get(name);
		if(_.isEmpty(foundStore)) {
			log.info("Cache store %s does not exist... Creating new store...", name);
			foundStore = new nodeCache({
										   stdTTL     : ttl || 0,
										   checkperiod: ttl ? ttl*0.2 : 0,
										   useClones  : false,
									   });
			this._highstreet.set(name, foundStore);
		}
		log.debug("Cache store fetched.");
		return foundStore;
	},

	isAlive: function(name) {
		if(_.isEmpty(name)) throw new Error("Missing store parameters");
		let exists = (this._highstreet.get(name)!==null);
		log.debug("%s %s exist.", name, exists ? "DOES" : "DOES NOT");
		return exists;
	}

};
