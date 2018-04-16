# AT+CGATT? 增加查看次数从3 -> 5
延长 attach 等待的时间

# 增加AT command timeout 属性


# 代码解释
## cmd-manager.js

```
CmdManager.sendAT()
  this._cmdQueue.push(this, [cmd], callback);

state: idle, waitingResponse

this._cmdQueue = new Queue(this._processCmd)

.sendAT
.sendData

._processCmd 会从queue中取一个cmd出来，根据命令的种类，进行执行。移入队列，并不会立即执行。先进先出。FIFO
将data发送出去

this._getResponse(cmd, invokeCallbackOnce); // 在这里增加了可选的timeout , 从AT命令而来;

各命令的最大Response Time:
AT+CIPSEND,  645 seconds
AT+CGATT , 10 seconds

```

## cmd.js

```
sendExAt1()
sendExAt2()
sendExAt3()

```
## parser.js NOT USED


## line-parser.js
LINEMARKER

状态切换不在这个文件里面

emit line, promote, data



