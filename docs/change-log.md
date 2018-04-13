# update 2018-4-13
## 请替换src/eeprom.js, src/flash.js,用下面两个文件
- eeprom.js
- flash.js

## eeprom, flash操作例程

*请仅使用用户区域的block,其它block被用于系统更新等*

```
// 在src/index.js 文件头部增加引用
var EEPROM = require("./eeprom.js");
var Flash = require("./flash.js");

// 使用实例
function runE2PROM() {
    //EEPROM.writeName("Mechanical");
    var name = EEPROM.readName();
    console.log(name);
}

function runFlash() {
    //Flash.eraseBlock(0);
    //Flash.write(0, "hello world");
    var data = Flash.read(0, 11);
    console.log(data);
}

```

