const log    = _log.get("web-socket");
const logOUT = log.get("out");
const logIN  = log.get("in");

module.exports = async function(webSocket, wsClient) {
	/*** on 'connection' ***/

	wsClient.emit("welcome", "hello world!");

	//Broadcast the heating and water info
	const checkHeating = require("../actions/check-heating");
	const checkWater   = require("../actions/check-water");

	log.info("New web client... updating with latest water/heating info");
	Promise.all([ checkHeating(), checkWater() ])
		   .then(r => logOUT.debug("Latest heating/water stats sent to all clients"));

	wsClient.emit("hello", "aidan");

	wsClient.on("disconnect", (data) => log.debug("Client disconnected. %O", data));

	/*** on 'set-heating-manual' ***/
	wsClient.on("set-heating-manual", (data) => {
		//TODO: part of webUI - set heating manual
		logIN.info("set-heating-manual: Data received: %O", data);
	});

	/*** on 'set-water-manual' ***/
	wsClient.on("set-water-manual", (data) => {
		//TODO: part of webUI - set water manual
		logIN.info("set-water-manual: Data received: %O", data);
	});

};
