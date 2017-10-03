const semver = require('semver');


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
                    commit:  i[0]
                },
                versionName: i[1],
                versionCode: this.buildConfig.semver ? semver.clean(i[1]) : i[1]
            })).filter(i => i.versionCode);

            const res = {};
            for (let i in versions) {
                res[versions[i].versionCode] = versions[i];
            }

            this.buildConfig.versions = Object.assign(res, this.buildConfig.versions);
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
                curCommands = Object.assign(curCommands, version.commands);
            }

            if (version.source) {
                curSource = Object.assign(curSource, version.source);
            }

            if (version.output) {
                curOutput = version.output;
            }

            version.commands = curCommands;
            version.source = curSource;
            version.output = curOutput;
        }


    }

}

BuildConfig.git = 'git';

module.exports = BuildConfig;