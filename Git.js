const child_process = require('child_process');
const path = require('path');
const logger = require('./Logger.js');
const util = require('util');

const config = require("./config.json");


const exec = util.promisify(require('child_process').exec);


class Git {
    constructor(url) {
        this.url = url;
        this.directory = null;
    }

    async clone(directory = null, recursive = false) {
        this.directory = directory || url.split('/').splice(-1)[0].split('.git')[0];
        console.log('directory is ', this.directory);

        logger.info(`Cloning ${this.url} into ${this.directory}`);
        await exec(`git clone ${this.url} ${this.directory} ${recursive ? '--recursive' : ''}`, {cwd: config.TMP_DIR});
        logger.info('Success');
    }

    async checkout(checkout) {
        logger.info(`Checking out ${this.url} to ${checkout}`);
        await exec(`git checkout ${checkout}`, {cwd: path.join(config.TMP_DIR, this.directory)});
        logger.info('Success');
    }

    async clean(){
        logger.info(`Stashing ${this.url}`);
        await exec(`git stash`, {cwd: path.join(config.TMP_DIR, this.directory)});
        logger.info('Success');
    }
}

Git.getTags = async function (url) {
    logger.info(`Getting tags of ${url}`);
    let res = (await exec(`git ls-remote --tags ${url}`, {cwd: config.TMP_DIR})).stdout;
    res = res.split(/\n/).map(i => i.split(`\trefs/tags/`)).filter(i => i[1] && i[1].indexOf('^{}') === -1);
    // console.log(`TAGS FOR ${url}`, JSON.stringify(res, null, 4));
    logger.info('Success');
    return res;
};


module.exports = Git;