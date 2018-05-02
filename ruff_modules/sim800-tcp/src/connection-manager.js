'use strict';

var Connection = require('./connection');

function ConnectionManager(connectionsNum, cmdManager) {
    this._allConnections = new Array(connectionsNum);
    this._cmdManager = cmdManager;
    this._connectionsNum = connectionsNum;

    cmdManager.on('connectionData', this._processConnectionData.bind(this));
    cmdManager.on('connectionState', this._processConnectionState.bind(this));
}
ConnectionManager.prototype.getCmdManager = function () {
    return this._cmdManager;
};
// Added by Yang Jun 2018-4-25
ConnectionManager.prototype.reset = function () {
    for (var i = 0; i < this._allConnections.length; i++) {
        if (!this._allConnections[i]) {
            this._dropConnection(i);
        }
    }
    this._allConnections = new Array(this._connectionsNum);
};

ConnectionManager.prototype.newConnection = function () {
    var index = this._getConnectionIndex();
    if (index === -1) {
        throw new Error('connection pool is full');
    }
    this._allConnections[index] = new Connection(index, this._cmdManager);
    this._wrapConnection(this._allConnections[index]);
    this._allConnections[index].once('close', this._dropConnection.bind(this, index));
    this._allConnections[index].on('error', function (error) {
        console.log('====connection ' + this.fd + ' error====', error);
    });
    return this._allConnections[index];
};

ConnectionManager.prototype._wrapConnection = function (connection, index) {
    var that = this;
    connection._originClose = connection.close;
    connection.close = function (callback) {
        connection._originClose(function (error) {
            that._dropConnection(index);
            if (error) {
                callback(error);
                return;
            }
            callback();
        });
    };
};

ConnectionManager.prototype._dropConnection = function (index) {
    delete this._allConnections[index];
};

ConnectionManager.prototype._getConnectionIndex = function () {
    for (var i = 0; i < this._allConnections.length; i++) {
        if (!this._allConnections[i]) {
            return i;
        }
    }
    return -1;
};

ConnectionManager.prototype._processConnectionData = function (index, data) {
    if (this._allConnections[index]) {
        this._allConnections[index].feed(data);
    } else {
        console.log('[warning] get invalid connection ' + index + ' data');
    }
};

ConnectionManager.prototype._processConnectionState = function (index, status) {
    if (this._allConnections[index]) {
        this._allConnections[index].setStatus(status);
    } else {
        console.log('[warning] get invalud connection ' + index + ' status:', status);
    }
};

module.exports = ConnectionManager;