const settingsManager = require("../services/settings-manager");
const log             = _log.get("get-config");
const Schema          = require("joi");

module.exports = async function(options) {
	options = Schema.object({
								name          : Schema.string().uppercase()
													  .custom((value, helpers) => {
														  if(!settingsManager.has(value)) {
															  return helpers.message(
																  "Property does not exist by that name.");
														  } else return value;
													  }, "Property Exists"),
								includeDetails: Schema.boolean().truthy("yes").falsy("no", ""),
							})
					.validate(options, {abortEarly: false});
	if(options.error) {
		log.error("Validation error on options argument. %O", options.error);
		throw options.error;
	} else options = options.value; //Values would be casted to correct data types

	if(options.name) return settingsManager.get(options.name, options.includeDetails);
	else return settingsManager._getAll(options.includeDetails);

};
