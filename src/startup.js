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

exports.enableNetDev = function (netDev, options, callback) {
    var initTimeout = options.initTimeout >= 0 ? options.initTimeout : 100;
    var powerOnTimeout = options.powerOnTimeout >= 0 ? options.powerOnTimeout : 100;
    var reboot = options.reboot || function () {
        console.log("reboot...");
    };
    var tag = options.tag || "netDev";
    var timer;

    netDev.on("error", function (error) {
        console.log("[" + tag + "] error", error);
    });
    netDev.on("down", function () {
        console.log("[" + tag + "] down, will reboot");
        setTimeout(reboot, 3000);
    });
    netDev.on("end", function () {
        console.log("[" + tag + "] power down");
    });

    netDev.once("ready", function () {
        console.log("[" + tag + "] ready");
        clearTimeout(timer);

        if (netDev.getSignalStrength) {
            netDev.getSignalStrength(function (error, value) {
                if (error) {
                    console.log("[" + tag + "] get signal error", error);
                } else {
                    console.log("[" + tag + "] signal is", value);
                }
            });
        }
        netDev.once("up", function (ip) {
            clearTimeout(timer);
            console.log("[" + tag + "] ip is", ip);
            callback && callback();
        });

        timer = setTimeout(function () {
            console.log("[" + tag + "] init timeout");
            setTimeout(reboot, 5000);
        }, initTimeout);

        if (netDev.autoInit) {
            console.log("AutoInit");
            netDev.autoInit(function (err, data) {
                if (err) {
                    console.log("autoInit failure");

                } else {
                    console.log("autoInit succeed");
                }
            });
        } else if (netDev.init) {
            console.log("Init");
            netDev.init();
        }
    });

    timer = setTimeout(function () {
        console.log("[" + tag + "] poweron timeout");
        setTimeout(reboot, 3000);
    }, powerOnTimeout);

    netDev.powerOn && netDev.powerOn();
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