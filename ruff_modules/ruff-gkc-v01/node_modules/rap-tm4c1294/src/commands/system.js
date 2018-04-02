'use strict';

const parametersJS = require('./parameters.js');

exports.system = function (rap, program, trace) {
    program
        .command('upgrade <firmware-binary-file>')
        .description('upgrade ruff firmware')
        .option('-E, --erase', 'erase entire flash')
        .option('--parameters [serial=<serial>]', 'designate device serial')
        .action((binPath, options) => {
            trace.push('upgrade');

            // get program.serail
            var parameters = parametersJS.getParameters(rap, program);
            if (parameters === undefined) {
                program.serial = undefined;
            } else {
                program.serial = parameters.serial;
            }

            const fs = require('fs');
            const { Promise } = require('thenfail');
            const { flash } = require('../lib/lm4flash');

            if (!fs.existsSync(binPath)) {
                console.error('The binary file specified does not exist.');
                process.exit(1);
            }

            let cp = flash({
                binary: binPath,
                serial: program.serial,
                address: 0,
                erase: options.erase
            });

            return Promise.for(cp);
        });
};
