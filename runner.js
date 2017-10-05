const util = require('util');
const exec = util.promisify(require('child_process').exec);
const spawn = require('child_process').spawn;
const fs = require('fs-extra');
const fsNative = require('fs');
const path = require('path');
const config = require('./config.json');

const copyLockPath = path.join(config.TMP_DIR, 'copy.lock');
fs.ensureDirSync(config.TMP_DIR);
fsNative.writeFileSync(copyLockPath, '');

const proc = spawn(`node`, ['app.js'], {cwd: process.cwd()});
proc.stdout.on('data', (data) => {
    console.log(data.toString());
});

proc.stderr.on('data', (data) => {
    console.log(data.toString());
});

let copying = false;

for(let signal of ['SIGINT', 'SIGTERM', 'SIGPIPE', 'SIGHUP', 'SIGBREAK']) {
    process.on(signal, () => {
        if (fs.existsSync(copyLockPath)){
            proc.kill('SIGINT');
            fs.removeSync(copyLockPath);
            process.exit(0);
        }
        if (copying) {
            console.log('please wait...');
            return;
        }
        copying = true;
        console.log('Restoring cdn state, place wait...');
        proc.kill('SIGINT');
        exec(`rm -rf ${config.OUTPUT_DIR}/; cp -r ${path.join(config.TMP_DIR, config.TMP_OUTPUT_DIR)}/  ${config.OUTPUT_DIR}; ln -sfn ${config.OUTPUT_DIR} ${config.SYMLINK_PATH}`).then((res) => {
            process.exit(0);
        });
    })
}

