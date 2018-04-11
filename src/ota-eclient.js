"use strict";

var otalib = require("otalib-1294-user");
var Comm = otalib.Communication;

function EClient(netDev, connConfig, handles) {
  console.log("create EClient");
  this._ok = false;
  this._ecnt = 0;
  this._net = netDev;
  this.socket = null;
  this._host = connConfig.host;
  this._port = connConfig.port;
  this._handles = handles;
  console.log("[Eclient] connect to " + this._host + ":" + this._port);
}

EClient.prototype.cleanup = function () {
  this._gprs = null;
};

EClient.prototype.connect = function (timeout) {
  console.log("[Econnect try]", ++this._ecnt);
  if (this._ecnt >= 5) {
    console.log("Eclient " + this._ecnt + " connect failed, will reboot");
    setTimeout(this._handles.reboot, 5000);
  }
  var that = this;
  var client = that._net.createConnection({
    port: that._port,
    host: that._host
  });
  client.on("connect", function () {
    that.socket = client;
    that._ecnt = 0;
    console.log("[Eclient] connected");
    that._handles.state && that._handles.state.turnOn();
    that.start();
  });
  client.on("error", function (error) {
    that.socket = null;
    console.log("[Eclient error]", error);
  });
  client.on("close", function (hasError) {
    that.socket = null;
    console.log("[Eclient close]", hasError);
    that._handles.state && that._handles.state.turnOff();
    client.removeAllListeners();
    setTimeout(function () {
      that.connect(timeout);
    }, timeout);
  });
};

EClient.prototype.start = function () {
  var that = this;
  if (!this.socket) {
    console.log("[Error]: eClient is invalid");
    return;
  }
  var comm = new Comm(this.socket);
  this.socket.on("close", function () {
    comm.removeAllListeners();
  });
  var hbCounts = 0;
  comm.on("hbs", function (state) {
    console.log("[Eclient]: heart beat state is", state, hbCounts);
    if (state) {
      that._ok = true;
      hbCounts = 0;
    } else {
      hbCounts++;
    }
    if (that._ok === true && hbCounts === 5) {
      console.log("Eclient heartbeat failed 5 times, will reboot");
      setTimeout(that._handles.reboot, 5000);
    }
  });

  comm.tryConnect(8000, function () {
    comm.tryHeartbeat(20000);
  });
};

module.exports = EClient;