# AT+CGATT? 增加查看次数从3 -> 5
延长 attach 等待的时间

# 增加AT command timeout 属性


# 代码解释
## cmd-manager.js

```
CmdManager.sendAT()
  this._cmdQueue.push(this, [cmd], callback);



```

## cmd.js

```


```
## parser.js


## line-parser.js




