const deepMerge = require('merge-deep');
const fs = require('fs-extra');
const path = require('path');

class RodinPackage {
    constructor(buildConfig, versionConfig, packageDir) {
        this.buildConfig = buildConfig;
        this.versionConfig = versionConfig;
        this.packageDir = packageDir;
        this.pkg = {};
    }

    async init() {

        this.pkg = {
            name: this.buildConfig.name,
            version: this.versionConfig.versionCode,
            lastUpdated: new Date(),
            sources: []
        };

        for (let i in this.buildConfig.output) {
            const cur = this.buildConfig.output[i];
            this.pkg.sources.push({
                env: cur.env,
                main: path.join(i, cur.main),
                dependencies: cur.dependencies
            })
        }

        if (fs.existsSync(this.packageDir)) {
            const existsingPackage = await fs.readJson(this.packageDir);

            for (let i in existsingPackage) {
                if (RodinPackage.doNotCopy.indexOf(i) !== -1) continue;
                this.pkg[i] = existsingPackage[i];
            }
        }
    }


    async write(outputPath) {
        await fs.writeJson(path.join(outputPath, 'rodin_package.json'), this.pkg);
    }

    normalize(env = this.env) {
        const curSources = this._getEnvSources(env);
        let res = Object.assign({}, this.pkg);
        delete res.sources;
        res = deepMerge(res, curSources);

        return res;
    }


    _getEnvSources(env) {
        for (let i in this.pkg.sources) {
            if (this.pkg.sources[i].env === env) {
                return Object.assign(this.pkg.sources[i], {});
            }
        }
        return {};
    }
}

RodinPackage.defaultEnv = 'prod';
RodinPackage.doNotCopy = ['name', 'version', 'sources', 'lastUpdated'];

module.exports = RodinPackage;