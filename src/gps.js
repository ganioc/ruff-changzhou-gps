var gpsHandle;

var latestData = {
    latitude: 0,
    longitude: 0, // ddmm.mmmm
    timeStamp: 0 // dddmm.mmmm
};
var debug = (function () {
    var header = "[" + __filename + "]";
    false && header;
    return function () {
        Array.prototype.unshift.call(arguments, header);
        console.log.apply(this, arguments);
    };
    //return function () {};
})();

function parseGPS(str) {
    var lst = str.split(",");

    if (lst[2] === "A" && lst[3].length >= 2 && lst[5].length >= 3) {
        latestData.timeStamp = new Date().getTime();
        var degree = parseFloat(lst[3].substring(0, 2));
        var minute = parseFloat(lst[3].substring(2));
        latestData.latitude = (degree + minute / 60.0).toFixed(6) + lst[4];

        degree = parseFloat(lst[5].substring(0, 3));
        minute = parseFloat(lst[5].substring(3));
        latestData.longitude = (degree + minute / 60.0).toFixed(6) + lst[6];
        //console.log("location succeed:");
        //console.log(latestData.longitude, latestData.latitude);
    }
}

exports.test = function () {
    debug("TestGPS====>");
    parseGPS("$GNRMC,032859.000,A,3110.8142,N,12136.0075,E,3.37,254.13,190318,,,A*78\r\n");
    debug(latestData.latitude);
    debug(latestData.longitude);
};

exports.attach = function () {

    latestData.timeStamp = new Date().getTime();

    $("#gps").on("data", function (data) {

        var dataTemp = data.toString();
        var index1 = dataTemp.indexOf("$GNRMC");

        //console.log("<--", dataTemp);

        if (index1 === 0) {
            //debug("[GPS^RX]", data.toString().replace(/\r/g, "\\r").replace(/\n/g, "\\n"));
            // console.log("==========>");
            // update to latestData
            parseGPS(data.toString().replace(/\r/g, "\\r").replace(/\n/g, "\\n"));

        } else {
            //debug("[GPS^RX]", data.toString().replace(/\r/g, "\\r").replace(/\n/g, "\\n"));
        }
    });
};
exports.getGPS = function () {
    var now = new Date().getTime();

    var output = {
        latitude: 0,
        longitude: 0
    };
    console.log(now, latestData.timeStamp);

    if (now - latestData.timeStamp < 120000) {
        output.latitude = latestData.latitude;
        output.longitude = latestData.longitude;
    } else {
        console.log("GPS data is invalid");
    }
    console.log(output.latitude, output.longitude);
    return output;
};