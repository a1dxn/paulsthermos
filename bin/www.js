#!/usr/bin/env node

/*** Logging Initialisation ***/
process.env.LOG_LEVEL = "info";
process.env.LOG_TIME = "abs";
require("log-node")();

/*** Global Variables ***/
/*Logging*/
_log = require("log");
/*Date Utilities*/
dateUtils = require("date-and-time");
dateUtils.plugin(require("date-and-time/plugin/ordinal"));
/*Settings/Constant Mgr*/
CONSTANT = require("../services/settings-manager").initialize().get;
/*Web Sockets*/
WS = null; //Defined in Socket.IO section

/*** State Initialisation ***/
require("../services/thermo-state").initialize();

/*** HTTP Server ***/
_log.get("http").notice("Initialising HTTP Server");
const app  = require("../app");
const port = parseInt(process.env.PORT || 3000);
app.set("port", port);

const server = require("http").createServer(app);
server.listen(port);
server.on("error", onError);
server.on("listening", onListening);

/*** Socket.IO ***/
_log.get("web-socket").notice("Initialising Socket.IO");
const socketManager = require("../services/socket-manager");
WS                  = require("socket.io")(server);
WS.on("connection", (wsClient) => {
	const flog = _log.get("web-socket");
	flog.debug("Connection established: %s", wsClient.id);
	socketManager(WS, wsClient).then(() => {
	});

});

/*** Event Listeners for HTTP Server ***/
function onListening() {
	const addr = server.address();
	const bind = typeof addr==="string" ? "pipe "+addr : "port "+addr.port;
	_log.get("http").notice("Listening on %s", bind);
}

function onError(error) {
	if(error.syscall!=="listen") {
		throw error;
	}

	let bind = typeof port==="string" ? "Pipe "+port : "Port "+port;

	// handle specific listen errors with friendly messages
	switch(error.code) {
		case "EACCES":
			console.error(bind+" requires elevated privileges");
			process.exit(1);
			break;
		case "EADDRINUSE":
			console.error(bind+" is already in use");
			process.exit(1);
			break;
		default:
			throw error;
	}
}
