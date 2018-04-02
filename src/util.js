var watchdogHandle;
var watchdogState = 0;

exports.delayedReboot = function (delay) {
    setTimeout(function () {
        ruff.softReset();
    }, delay);
};