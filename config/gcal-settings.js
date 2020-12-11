const SERVICE_ACCT_ID = "checkcal@paulsthermos-1606573682425.iam.gserviceaccount.com";
const TIMEZONE        = "UTC+00:00";
const KEY             = require("./gcal_paulsthermos-9bf6df801a3c.json").private_key;
const CALENDAR_URL    = `https://calendar.google.com/calendar/u/0?cid=ZDZrZnRwZ3RzMzhmaTZja2FxbnJwYXBzMG9AZ3JvdXAuY2FsZW5kYXIuZ29vZ2xlLmNvbQ`;
const CALENDAR_ID     = {
	boiler: "d6kftpgts38fi6ckaqnrpaps0o@group.calendar.google.com",
};

module.exports.serviceAcctId = SERVICE_ACCT_ID;
module.exports.timezone      = TIMEZONE;
module.exports.calendarUrl   = CALENDAR_URL;
module.exports.calendarId    = CALENDAR_ID;
module.exports.key           = KEY;
