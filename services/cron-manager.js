let log = _log.get("cron-manager");

module.exports = {

	job: require("cron").CronJob,

	time: require("cron").CronTime,

	jobstore: new Map(),

	isAlive: function(job) {
		if(typeof job=="string") {
			job = this.jobstore.get(job);
			if(!job) return false;
		}

		try {
			job.nextDate();
			return true;
		} catch(e) {
			return false;
		}
	},

	forceClean: function(k) {
		let flog = log.get("force-clean");
		if(k) {
			let job = this.jobstore.get(k);
			if(!job) return false;
			job.stop();
			this.jobstore.delete(k);
			flog.notice("Cron Job '%s' was cleaned forcefully", k);
			return true;
		}
		flog.warn("Forcefully cleaning ALL jobs in jobstore");
		this.jobstore.forEach((v, k, m) => {
			v.stop();
			m.delete(k);
			flog.notice("Cron Job '%s' was cleaned forcefully", k);
		});
		return true;
	},

	clean: function() {
		let flog = log.get("clean");
		this.jobstore.forEach((v, k, m) => {
			if(!this.isAlive(v)) {
				v.stop();
				m.delete(k);
				flog.info("Cron Job '%s' was cleaned", k);
			}
		});
	},

	initialize: function() {
		let flog = log.get("initialize");
		flog.notice("Initializing Cron Manager");
		flog.info("Auto clean set to %d seconds", CONSTANT("CRON_JOBSTORE_AUTO_CLEAN_INTERVAL"));

		if(this._cronCleaner) this._cronCleaner.stop();
		this._cronCleaner = new this.job({
											 cronTime: `0 */${CONSTANT("CRON_JOBSTORE_AUTO_CLEAN_INTERVAL")} * * * *`,
											 context : this,
											 onTick  : this.clean,
											 start   : true,
										 });
	},

};
