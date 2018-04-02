"use strict";

var EventEmitter = require("events");
var util = require("util");
var nativeCan = ruff.can;
var CHUNK_SIZE = 20;

function Can(devPath, baud) {
  EventEmitter.call(this);
  this._fd = nativeCan.open(devPath);
  if (baud > 0) {
    this.setBaudrate(baud);
  }
  this._readNext();
}
util.inherits(Can, EventEmitter);

Can.prototype.close = function () {
  nativeCan.close(this._fd);
};

Can.prototype.setBaudrate = function (baud) {
  nativeCan.set_baudrate(this._fd, baud);
};

Can.prototype.addFilter = function (id, idMask) {
  nativeCan.add_stdfilter(this._fd, id, idMask);
};

Can.prototype.write = function (id, msgBuffer, callback) {
  var _msgbuffer = nativeCan.create_msg_buffer(id, msgBuffer._ruffBuffer);
  uv.fs_write(this._fd, _msgbuffer, -1, callback);
};

Can.prototype.writeMultiple = function (msgs, callback) {
  //var i = 0;
  var _msgbuffer = Buffer.alloc(0);
  var msgbufferArray = msgs.map(function (msg) {
    return Buffer.from(nativeCan.create_msg_buffer(msg.id, msg.data._ruffBuffer));
  });
  _msgbuffer = Buffer.concat(msgbufferArray)._ruffBuffer;
  console.log(Buffer.concat(msgbufferArray));
  uv.fs_write(this._fd, _msgbuffer, -1, callback);
};

Can.prototype._readNext = function () {
  var that = this;
  uv.fs_read(this._fd, CHUNK_SIZE, -1, function (error, data) {
    if (error) {
      that.emit("error", error);
    }
    that._emitData(data);
    setImmediate(that._readNext.bind(that));
  });
};

Can.prototype._emitData = function (data) {
  var msgs = nativeCan.parse_msg_buffer(data);
  var i = 0;
  var msgObj;

  for (i = 0; i < msgs.length; ++i) {
    msgObj = msgs[i];
    msgObj.data = Buffer.from(msgObj.data);
    this.emit("data", msgObj);
  }
};

module.exports = Can;