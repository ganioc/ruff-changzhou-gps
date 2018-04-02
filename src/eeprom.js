exports.getCapacity = function () {
    return ruff.eeprom.getMaxAddress();
}

exports.write = function (addr, b) {
    ruff.eeprom.write(addr, b);
}

exports.read = function (addr, num) {
    return ruff.eeprom.read(addr, 1);
}