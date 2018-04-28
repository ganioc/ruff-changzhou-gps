"use strict";

var otalib = require("otalib-1294-user");
var Comm = otalib.Communication;

function EClient(netDev, connConfig, handles) {
  console.log("create EClient");
  this._ok = false;
  this._ecnt = 0;
  this._net = netDev;
  // this.socket = null;
  this._host = connConfig.host;
  this._port = connConfig.port;
  this._handles = handles;
  this.client = null;
  this.comm = null;
  console.log("[Eclient] connect to " + this._host + ":" + this._port);

  var that = this;

  this.client = new netDev.Socket();
  that.client.on("connect", function () {
    // that.socket = client;
    that._ecnt = 0;
    console.log("[Eclient] connected");
    that._handles.state && that._handles.state.turnOn();
    that.start();
  });
  that.client.on("error", function (error) {
    // that.socket = null;
    console.log("[Eclient error]", error);
  });
  that.client.on("close", function (hasError) {
    // that.socket = null;
    console.log("[Eclient close]", hasError);
    that._handles.state && that._handles.state.turnOff();
    // client.removeAllListeners();
    setTimeout(function () {
      that.connect(40000);
    }, 2000);
  });

  that.client.on("close", function () {
    that.comm.removeAllListeners();
    that.comm._cleanup();
  });
}

EClient.prototype.connect = function (timeout) {
  console.log("[Econnect try]", ++this._ecnt, " times");

  var that = this;

  if (this._ecnt >= that._handles.timesErrorToReboot) {
    console.log("Eclient " + this._ecnt + " connect failed, will reboot");
    setTimeout(ruff.softReset, 5000);
  }

  setTimeout(function () {
    that.client.connect({
      port: that._port,
      host: that._host
    });
  }, timeout);
};

EClient.prototype.start = function () {
  var that = this;
  console.log("[Eclient]: start");

  this.hbCounts = 0;

  this.comm = new Comm(this.client);
  this.hbCounts = 0;

  this.comm.on("hbs", function (state) {
    console.log("[Eclient]: heart beat state is", state, that.hbCounts);
    if (state) {
      that._ok = true;
      that.hbCounts = 0;
    } else {
      that.hbCounts++;
    }
    if (that._ok === true && that.hbCounts >= 5) {
      console.log("Eclient heartbeat failed >5 times:", that.hbCounts);
      console.log("Consider to reboot");
      // Without rebooting 
      //setTimeout(that._handles.reboot, 5000);
    }
    if (that._ok === true && 0 > that._handles.timesErrorToReboot && that.hbCounts > that._handles.timesErrorToReboot) {
      console.log("hbCount larger than 100, reboot... ... ... ...");
      setTimeout(function () {
        ruff.softReset();
      }, 5000);
    }
  });

  that.comm.tryConnect(8000, function () {
    that.comm.tryHeartbeat(that._handles.periodHeartbeat ||
      20000);
  });
};

module.exports = EClient;