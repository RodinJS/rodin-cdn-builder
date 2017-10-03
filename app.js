const fs = require("fs-extra");
const path = require("path");
const util = require('util');
const logger = require('./Logger.js');
const Git = require('./Git.js');
const BuildConfig = require('./BuildConfig.js');
const RodinPackage = require('./RodinPackage.js');
const tar = require('tar');
const config = require("./config.json");
const exec = util.promisify(require('child_process').exec);

const tmpOutputDir = path.join(config.TMP_DIR, config.TMP_OUTPUT_DIR);

const clonedGits = {};

async function cleanDirs() {
    logger.info(`Removing tmp dir : ${config.TMP_DIR}`);
    await fs.remove(config.TMP_DIR);
    logger.info(`Success`);

    // logger.info(`Removing output dir : ${config.OUTPUT_DIR}`);
    // await fs.remove(config.OUTPUT_DIR);
    // logger.info(`Success`);
}

async function copyOldOutput() {
    logger.info(`Copying output directory from ${config.OUTPUT_DIR} to ${tmpOutputDir}`);
    await fs.copy(config.OUTPUT_DIR, tmpOutputDir);
    logger.info(`Success`);

    // native_fs.symlinkSync(tmpOutputDir, config.SYMLINK_PATH);
    await exec(`ln -sfn ${tmpOutputDir} ${config.SYMLINK_PATH}`);
}

async function restoreSymlink() {
    logger.info(`Restoring symlink to ${config.OUTPUT_DIR} to ${config.SYMLINK_PATH}`);
    await exec(`ln -sfn ${config.OUTPUT_DIR} ${config.SYMLINK_PATH}`);
    logger.info('Success');
}

async function restore() {
    logger.info(`Restoring ...`);
    await fs.remove(config.OUTPUT_DIR);
    await fs.copy(tmpOutputDir, config.OUTPUT_DIR);
    await restoreSymlink();
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

async function generateMeta(versions, buildConfig, packageOutputDir) {
    const meta = {
        semver: buildConfig.semver || false,
        v: versions.map(i => i.versionCode)
    };

    logger.info(`writing meta file to ${path.join(packageOutputDir, config.META_FILE_NAME)}`);
    await fs.writeJson(path.join(packageOutputDir, config.META_FILE_NAME), meta);
    logger.info('Success');
}

async function createBackup() {
    logger.info('Creating backup');
    await tar.create({
            gzip: true,
            file: path.join(config.BACKUP_DIR, `${new Date().toDateString()}.tgz`)
        },
        [config.OUTPUT_DIR]
    );
    logger.info('Success');
}

async function getGit(url, folder) {
    let curGit = clonedGits[url];
    if (!curGit) {
        curGit = new Git(url);
        await curGit.clone(folder);
        clonedGits[url] = curGit;
    }
    return curGit;
}

async function handleLibrary(jsonPath) {
    logger.info(`Start handle library ${jsonPath}`);

    const buildConfig = new BuildConfig(require(`./${jsonPath}`));

    const packageOutputDir = path.join(config.OUTPUT_DIR, buildConfig.buildConfig.name);
    await fs.ensureDir(packageOutputDir);

    buildConfig.addVersions(await Git.getTags(buildConfig.buildConfig.source.url));
    buildConfig.normalizeVersions();

    await generateMeta(buildConfig.versions, buildConfig.buildConfig, packageOutputDir);

    for (let versionConfig of buildConfig.versions) {

        console.log(versionConfig.versionCode, versionConfig.commands);

        const url = versionConfig.source.url;
        const curGit = await getGit(url, buildConfig.buildConfig.name);

        await curGit.clean();
        await curGit.checkout(versionConfig.source.commit || versionConfig.versionName);


        const checkoutTmpDir = path.join(config.TMP_DIR, `tmp_${curGit.directory}`);
        await fs.copy(path.join(config.TMP_DIR, curGit.directory), checkoutTmpDir);

        for (let i in versionConfig.commands) {
            console.log(i, versionConfig.commands[i], curGit.directory);
            if (versionConfig.commands[i])
                await exec(versionConfig.commands[i], {cwd: checkoutTmpDir});
        }


        for (let i in versionConfig.output) {
            const outputDir = path.join(packageOutputDir, versionConfig.versionCode, i);

            const pathToRemove = path.join(packageOutputDir, versionConfig.versionCode);

            if (fs.existsSync(pathToRemove)) {
                logger.info(`Removing old ${pathToRemove}`);
                await fs.remove(pathToRemove);
                logger.info('Success');
            }

            logger.info(`Copying ${path.join(checkoutTmpDir, versionConfig.output[i].from)} to ${outputDir}`);
            await fs.copy(path.join(checkoutTmpDir, versionConfig.output[i].from), outputDir);
            logger.info('Success');

            // await createRodinPackage(versionConfig.versionCode, buildConfig, outputDir, rodin_package, versionConfig.output[i].main);
        }

        const rodinPackage = new RodinPackage(buildConfig.buildConfig, versionConfig, path.join(checkoutTmpDir, 'rodin_package.json'));
        await rodinPackage.init();
        await rodinPackage.write(path.join(packageOutputDir, versionConfig.versionCode));


        await fs.remove(checkoutTmpDir);
    }

    logger.info(`Success`);
}

async function doStuff() {
    await createBackup();
    await cleanDirs();
    await createTMPDir();
    await copyOldOutput();
    await cloneCDNGIT();

    const cdn_files = (await fs.readdir(path.join(config.TMP_DIR, config.CDN_GIT_NAME))).filter(x => x.endsWith('.json'));
    for (let lib of cdn_files) {
        // todo: dont forget to remove next line
        // if (lib.indexOf('open') === -1) continue; // todo: remove this

        await handleLibrary(path.join(config.TMP_DIR, config.CDN_GIT_NAME, lib));
    }

    await restoreSymlink();
}

doStuff().catch(e => {
    restore().then(() => {
        process.exit(0);
    });
    throw e;
}).then(() => {
    process.exit(0);
});
