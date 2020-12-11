const fs            = require("fs");
const deepFreeze    = require("deep-freeze");
const _             = require("lodash");
const SETTINGS_PATH = "config/settings.json";
const log           = _log.get("settings-manager");
const Schema        = require("joi");
const cache         = require("../services/cache-manager");

const _CONSTANTSTORE = cache.store("ERIGUFHOREUGHBLJGKBDFL", 0);

module.exports = {

	//TODO: Ability to update settings

	initialize: function() {
		log.notice("Settings Manager initialized.");
		this._readFile();
		return this;
	},

	_readFile: function() {
		try {
			let raw  = fs.readFileSync(SETTINGS_PATH);
			// noinspection JSCheckFunctionSignatures
			let json = JSON.parse(raw);
			log.debug("read and parsed %s", SETTINGS_PATH);

			//Going to warn if any settings dont have a defined name or description
			let settingsSchema = Schema.object({
												   name                   : Schema.string().required(),
												   desc                   : Schema.string().required(),
												   value                  : Schema.any().required(),
												   initializeFilesOnChange: Schema.array().optional()
											   });
			for(let k in json) {
				let val = settingsSchema.validate(json[k]);
				if(val.error) {
					if(!_.has(json[k], "value")) {
						log.error("Settings property %s does NOT have a value assigned!!", k);
						// noinspection ExceptionCaughtLocallyJS
						throw "Settings property missing a value.";
					} else log.warn("Settings property %s does not have a name or desc...Should probably add one!", k);
				}
			}

			//Continue on with deeper validation
			let validatedData = this._validateSchema(json, true);
			log.debug("validated read data against schema");

			//Time to stash all these constants in the cache!
			for(let constant in validatedData)
				this._updateConstantObj(constant, validatedData[constant]);

			log.notice("Settings read, validated and stored as constants.");
			return validatedData;
		} catch(e) {
			log.error("Unable to read, validate or parse %s", SETTINGS_PATH);
			throw e;
		}
	},

	_updateConstantObj: function(name, newConstantObj) {
		deepFreeze(newConstantObj);
		_CONSTANTSTORE.set(name, newConstantObj);
	},

	_writeFile: function(data) {
		let rawData = JSON.stringify(data, null, 4);
		fs.writeFileSync(SETTINGS_PATH, rawData);
		log.notice("Settings saved.");
	},

	has: function(name) {
		return _CONSTANTSTORE.has(name);
	},

	get: function(name, includeDetails) {
		let retrieved = _CONSTANTSTORE.get(name);
		if(retrieved!==undefined) {
			return includeDetails ? retrieved : retrieved.value;
		} else {
			log.error(`Constant %s does not exist.`, name);
			throw new Error(`Constant '${name}' does not exist.`);
		}
	},

	_getAll: function(includeDetails) {
		const keys = _CONSTANTSTORE.keys();
		let x      = {};
		for(const key of keys) {
			let retrieved = _CONSTANTSTORE.get(key);
			x[key]        = includeDetails ? retrieved : retrieved.value;
		}
		return x;
	},

	_validateSchema: function(data, readFile) {
		const flog = log.get("validate-schema");
		flog.debug("Running _validateSchema");

		let dataValues = {};
		if(readFile) {
			for(let d in data) dataValues[d] = data[d].value;
		} else dataValues = data;
		flog.debug("DataValues: %O", dataValues);

		let schemas = {
			HEATING_GOAL_OFFSET                   : Schema.number().precision(1),
			HEATING_TEMPERATURE_THRESHOLD         : Schema.number().precision(1)
														  .max(dataValues["HEATING_GOAL_OFFSET"]),
			HEATING_MINIMUM_TEMPERATURE           : Schema.number().precision(1),
			HEATING_MODE_ENUM                     : Schema.array().unique()
														  .items(Schema.string().valid("auto").required(),
																 Schema.string()),
			HEATING_DEFAULT_MODE                  : Schema.string()
														  .pattern(new RegExp(
															  `(${dataValues["HEATING_MODE_ENUM"].join("|")})`),
																   "Heating Modes ENUM"),
			HEATING_CHECK_INTERVAL_MINUTES        : Schema.number().integer().precision(0).min(1),
			WATER_CHECK_INTERVAL_MINUTES          : Schema.number().integer().precision(0).min(1),
			CRON_JOBSTORE_AUTO_CLEAN_INTERVAL     : Schema.number().integer().precision(0).min(1),
			GET_SCHEDULE_SAVED_CALENDAR_IDENTIFIER: Schema.string().min(1),
			CALENDAR_CACHE_TTL                    : Schema.number().integer().precision(0).min(1),
			CALENDAR_CRON_JOB_TIME_OFFSET         : Schema.number().integer().precision(0).min(1),
			HEATING_MANUAL_MINIMUM_DURATION       : Schema.number().integer().precision(0).min(1),
			HEATING_MANUAL_MAXIMUM_DURATION       : Schema.number().integer().precision(0)
														  .greater(dataValues["HEATING_MANUAL_MINIMUM_DURATION"]),
			WATER_MANUAL_MINIMUM_DURATION         : Schema.number().integer().precision(0).min(1),
			WATER_MANUAL_MAXIMUM_DURATION         : Schema.number().integer().precision(0)
														  .greater(dataValues["WATER_MANUAL_MINIMUM_DURATION"]),
		};

		//CHILD_PI_IP_ADDRESSES - address required for each non-auto heating options
		let piIpAddresses = {};
		for(let x of dataValues["HEATING_MODE_ENUM"]) {
			if(x==="auto") continue; //dont require one for 'auto' options!
			piIpAddresses[x] = Schema.string().ip({version: "ipv4", cidr: "forbidden"}).required();
		}
		schemas.CHILD_PI_IP_ADDRESSES = Schema.object(piIpAddresses);

		/** Schema is done... now for validation! **/

		const guide = _.cloneDeep(readFile ? data : this._getAll(true)); //to keep name and descs!
		flog.debug("Guide: %O", guide);

		for(let key in dataValues) {
			flog.debug("Validating property %s", key);
			//Validate the value given and parse dataType according to schema.
			if(!_.has(guide, key)) {
				flog.error("Property '%s' does not exist. New properties cannot be added during runtime. Ignoring.");
				continue;
			}

			let validation = {};
			if(!_.has(schemas, key)) {
				flog.warn("Property '%s' does not have a Schema associated with it in _validateSchema. Property "+
						  "value cannot be validated and cannot not be updated to prevent errors.", key);
				if(!readFile) continue;
			} else {
				validation = schemas[key].validate(dataValues[key]);
				if(validation.error) {
					flog.error("Validation error occurred with property '%s': %O", key, validation.error);
					throw validation.error;
				}
			}

			guide[key].value = _.defaultTo(validation.value, dataValues[key]);
			flog.debug("%s value has been validated. Value: %O", key, guide[key].value);
		}

		flog.debug("Final guide: %O", guide);
		return guide;

	}

};
