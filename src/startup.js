function enableWatchdog(timeout) {
    console.log("enable watchdog");
    ruff.watchdog.enable(timeout);
    ruff.watchdog.feed();
    setInterval(function () {
        ruff.watchdog.feed();
        console.log("feed dog");
    }, timeout / 2);
}

function getBoardUid() {
    var str = Buffer.from(ruff.id.chipId).toString("hex");
    str = str.slice(0, 8) + "-" + str.slice(8, 12) + "-" + str.slice(12, 16) + "-" + str.slice(16, 20) + "-" + str.slice(20, 32);
    return str;
}

exports.printVersion = function () {
    log.setLevel("info");
    console.log = log.info;
    console.log("this is user app");
    console.log("[osVer]:", ruff.versions.os, "[appVer]", ruff.versions.app);
};

exports.printUid = function () {
    var boardUid = getBoardUid();
    console.log("boardUid is", boardUid);
};

exports.enableWatchdog = enableWatchdog;

exports.hookUncaughtException = function () {
    process.on("uncaughtException", function (e) {
        console.log("[uncaughtException]", e);
        setTimeout(function () {
            ruff.softReset();
        }, 5000);
    });
};


exports.setTime = function () {
    var data = new Date("2018-03-30T15:55:05");
    ruff.time.set(data.getTime());
};
exports.getTime = function () {
    var timestamp = ruff.time.get();
    var date = new Date(timestamp);
    console.log("now RTC is", date.toISOString());

};