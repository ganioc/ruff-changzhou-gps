var SIZE_BLOCK = 64; //bytes per block
var START_BLOCK = 10;
var END_BLOCK = 95;

// addr map to E2PROM address
var ADDR_ID = 0;
var SIZE_ID = 4; // 4 bytes
var NAME_ID = 4;
var SIZE_NAME = 32;

var debug = (function () {
    var header = "[" + __filename + "]";
    return function () {
        Array.prototype.unshift.call(arguments, header);
        console.log.apply(this, arguments);
    };
    // return function(){};
})();

exports.getCapacity = function () {
    return ruff.eeprom.getMaxAddress();
};
// addr 必须是以4字节对齐的
// 
// exports.write = function (addr, b) {
//     ruff.eeprom.write(addr, b);
// };

// exports.read = function (addr, num) {
//     return ruff.eeprom.read(addr, 1);
// };

exports.writeId = function (buf) {
    var data = Buffer.from(buf);
    ruff.eeprom.write(ADDR_ID + START_BLOCK * SIZE_BLOCK, data._ruffBuffer);
};
exports.readId = function () {
    var data = ruff.eeprom.read(ADDR_ID + START_BLOCK * SIZE_BLOCK, SIZE_ID);
    return Buffer.from(data);
};
exports.writeName = function (str) {
    var name = Buffer.from(str);
    debug("Write to E2PROM:", name);
    ruff.eeprom.write(NAME_ID + START_BLOCK * SIZE_BLOCK, name._ruffBuffer);
};
exports.readName = function () {
    var data = ruff.eeprom.read(NAME_ID + START_BLOCK * SIZE_BLOCK, SIZE_NAME);
    return Buffer.from(data);
};