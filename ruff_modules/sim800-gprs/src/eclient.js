"use strict";

var otalib = require("otalib-1294-user");
var Comm = otalib.Communication;

var debug = (function () {
  var header = "[" + __filename + "]";
  return function () {
    Array.prototype.unshift.call(arguments, header);
    console.log.apply(this, arguments);
  };
  // return function(){};
})();

function EClient(netDev, connConfig, handles) {
  console.log("create EClient");
  this._ok = false;
  this._ecnt = 0;
  this._host = connConfig.host;
  this._port = connConfig.port;
  this._periodHeartbeat = handles.periodHeartbeat;
  this._timesOTAConnect = handles.timesOTAConnect || 500;
  this._handles = handles;
  this._client = new netDev.Socket();
  this._comm = new Comm(this._client);
  this._hbCounts = 0;

  var that = this;

  this._comm.on("hbs", function (state) {
    debug("[Eclient]: heart beat state is", state, that._hbCounts);
    if (state) {
      that._ok = true;
      that._hbCounts = 0;
    } else {
      that._hbCounts++;
    }
    if (that._ok === true && that._hbCounts === 5) {
      debug("Eclient heartbeat failed 5 times, will reboot after:", handles.timesOTAConnect);
    }
    if (that._hbCounts >= handles.timesOTAConnect && handles.timesOTAConnect > 0) {
      debug("Reboot ...");
      setTimeout(ruff.softReset, 5000);
    }
  });

  this._client.on("connect", function () {
    that._ecnt = 0;
    console.log("[Eclient] connected");
    that._connected = true;

    setTimeout(that.start.bind(that), 3000);
  });
  this._client.on("error", function (error) {
    debug("[Eclient error]", error);
  });

  this._client.on("end", function () {
    debug("[Eclient] end");
  });
  debug("[Eclient] connect to " + this._host + ":" + this._port);
}

EClient.prototype.cleanup = function () {
  this._gprs = null;
};

EClient.prototype.connect = function () {
  console.log("[Econnect try]", ++this._ecnt);
  if (this._ecnt >= 5) {
    debug("Eclient " + this._ecnt + " connect failed, will reboot");
  }
  if (this._ecnt >= this._timesOTAConnect && this._timesOTAConnect > 0) {
    console.log("Reboot ...");
    setTimeout(ruff.softReset, 5000);
  }
  var that = this;
  this._client.connect({
    port: that._port,
    host: that._host
  });

};

EClient.prototype.start = function () {
  var that = this;
  console.log("[Eclient] start");

  if (this._comm) {
    console.log("_comm  exist");
  } else {
    console.log("_comm non exist");
  }

  that._comm.tryConnect(8000, function () {
    that._comm.tryHeartbeat(that._periodHeartbeat);
  });

  that._comm.syncTime();
};

module.exports = EClient;