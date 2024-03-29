const semver = require('semver');
const deepMerge = require('merge-deep');


class BuildConfig {
    constructor(buildConfig) {
        this.buildConfig = buildConfig;
        this.versions = [];
    }

    parseVersion(version) {
        if (this.buildConfig.semver) {
            return semver.clean(version);
        }
        return version;
    }

    addVersions(versions, type = BuildConfig.git) {
        if (type === BuildConfig.git) {
            versions = versions.map(i => ({
                source: {
                    type: 'git',
                    commit:  i[0],
                    url: this.buildConfig.source.url
                },
                versionName: i[1],
                versionCode: this.buildConfig.semver ? semver.clean(i[1]) : i[1]
            })).filter(i => i.versionCode);

            const res = {};
            for (let i in versions) {
                res[versions[i].versionCode] = versions[i];
            }

            this.buildConfig.versions = deepMerge(res, this.buildConfig.versions);
            versions = Object.entries(this.buildConfig.versions).map(i => {
                return Object.assign({
                    versionName: i[0],
                    versionCode: this.parseVersion(i[0])
                }, i[1])
            });
            versions.sort((i, j) => this.buildConfig.semver ? semver.compare(i.versionCode, j.versionCode) : 1);
            this.versions = versions;
        }

    }

    normalizeVersions(){
        if (this.buildConfig.excludeVersions) {
            if (this.buildConfig.semver) {
                this.versions = this.versions.filter(i => !semver.satisfies(i.versionCode, this.buildConfig.excludeVersions));
            } else {
                this.versions = this.versions.filter(i => this.buildConfig.excludeVersions.indexOf(i.versionCode) === -1);
            }
        }

        let curCommands = this.buildConfig.commands;
        let curSource = this.buildConfig.source;
        let curOutput = this.buildConfig.output;

        for (let version of this.versions){
            if (version.commands) {
                curCommands = version.commands;
            }

            if (version.source) {
                curSource = version.source;
            }

            if (version.output) {
                curOutput = version.output;
            }

            version.commands = Object.assign({}, curCommands);
            version.source = Object.assign({}, curSource);
            version.output = Object.assign({}, curOutput);
        }
        console.log(JSON.stringify(this.versions, null, 4));
    }
}

BuildConfig.git = 'git';

module.exports = BuildConfig;