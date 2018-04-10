var SIZE_BLOCK = 32 * 1024; //bytes per block
var START_BLOCK = 192; // start blcok
var END_BLOCK = 448; // 共256块

// erase SPI Flash , 32KB 对齐
// 擦除以块为单位
// 写没有这个限制

var ADDR_START = 0;
var ADDR_END = 256; // unit: block

var debug = (function () {
  var header = "[" + __filename + "]";
  return function () {
    Array.prototype.unshift.call(arguments, header);
    console.log.apply(this, arguments);
  };
  // return function(){};
})();

exports.eraseBlock = function (block) {
  debug("Flash Erase block:", block);
  ruff.spi_flash.erase32k(block + START_BLOCK);
};
// addr in byte
// 
exports.write = function (addr, input) {
  var data = Buffer.from(input);
  var address = START_BLOCK * SIZE_BLOCK + addr;
  debug("Flash write to :", addr);
  debug(data);
  ruff.spi_flash.write(data._ruffBuffer, address);
};

exports.read = function (addr, size) {
  var address = START_BLOCK * SIZE_BLOCK + addr;
  var data = ruff.spi_flash.read(address, size);
  return Buffer.from(data);
};