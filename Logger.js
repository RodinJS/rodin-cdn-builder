const winston = require('winston');
const fs = require('fs-extra');
const path = require('path');
const config = require('./config.json');

class Logger extends winston.Logger {

    constructor() {
        const logPath = path.join(config.LOG_DIR, new Date().toDateString() + '.log');

        try {
            fs.statSync(logPath);
        } catch (ex) {
            fs.createFileSync(logPath);
        }

        let transports = [];

        if (config.LOG_TYPE === 'console') {
            transports.push(new winston.transports.Console());
        } else if (config.LOG_TYPE === 'file') {
            transports.push(new winston.transports.File({filename: logPath}));
        }

        super({
            transports: transports
        });

        this.info(`Logs started at ${new Date()}`);
    };
}

module.exports = new Logger();