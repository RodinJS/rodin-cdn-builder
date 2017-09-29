const semver = require('semver');
const child_process = require('child_process');
const fs = require("fs-extra");
const path = require("path");
const util = require('util');
const logger = require('./Logger.js');
const Git = require('./Git.js');

const config = require("./config.json");

const exec = util.promisify(require('child_process').exec);

const clonedGits = {};

async function removeTMPDir() {
    logger.info(`Removing tmp dir : ${config.TMP_DIR}`);
    await fs.remove(config.TMP_DIR);
    logger.info(`Success`);
}

async function createTMPDir() {
    logger.info(`Creating tmp dir : ${config.TMP_DIR}`);
    await fs.mkdir(config.TMP_DIR);
    logger.info(`Success`);
}

async function cloneCDNGIT() {
    await new Git(config.CDN_GIT_URL).clone(config.CDN_GIT_NAME);
}

async function handleLibrary(jsonPath) {
    logger.info(`Start handle library ${jsonPath}`);

    const pkg = require(`./${jsonPath}`);


    const packageOutputDir = path.join(config.OUTPUT_DIR, pkg.name);
    await fs.ensureDir(packageOutputDir);

    let tags = (await Git.getTags(pkg.source.url)).map(i => ({
        commit: i[0],
        versionName: i[1],
        versionCode: pkg.semver ? semver.clean(i[1]) : i[1]
    })).filter(i => i.versionCode);

    for (let i in pkg.versions) {
        let found = false;
        for (let j of tags) {
            if (j.versionCode === i || j.versionName === i) {
                j.commands = pkg.versions[i].commands;
                j.source = pkg.versions[i].source;
                found = true;
                break;
            }
        }

        if (!found) {
            tags.push({
                commit: pkg.versions[i].commit,
                versionName: i,
                versionCode: pkg.semver ? semver.clean(i) : i,
                commands: pkg.versions[i].commands,
                source: pkg.versions[i]
            })
        }
    }

    tags.sort((i, j) => semver.lt(i.versionCode, j.versionCode) ? -1 : 1);

    let curCommands = pkg.commands;
    let curSource = pkg.source;

    for (let versionConfig of tags) {
        if (versionConfig.commands) {
            curCommands = Object.assign(curCommands, versionConfig.commands);
        }

        if (versionConfig.source) {
            curSource = Object.assign(curSource, versionConfig.source);
        }

        console.log(versionConfig.versionCode, curCommands);

        const url = curSource.url;

        let curGit = clonedGits[url];
        if (!curGit) {
            curGit = new Git(url);
            await curGit.clone(pkg.name);
            clonedGits[url] = curGit;
        }

        await curGit.checkout(versionConfig.commit || versionConfig.versionName);

        for (let i in curCommands) {
            console.log(i, curCommands[i], curGit.directory);
            await exec(curCommands[i], {cwd: path.join(config.TMP_DIR, curGit.directory)});
        }

        for (let i in pkg.output) {
            await fs.copy(path.join(config.TMP_DIR, curGit.directory, pkg.output[i]), path.join(packageOutputDir, versionConfig.versionCode, pkg.output[i]));
        }

    }

    logger.info(`Success`);
}

async function doStuff() {
    await removeTMPDir();
    await createTMPDir();
    await cloneCDNGIT();

    const cdn_files = (await fs.readdir(path.join(config.TMP_DIR, config.CDN_GIT_NAME))).filter(x => x.endsWith('.json'));
    for (let lib of cdn_files) {
        if (lib.indexOf('rodin') !== -1) continue; // todo: remove this

        await handleLibrary(path.join(config.TMP_DIR, config.CDN_GIT_NAME, lib));
    }
}

doStuff();