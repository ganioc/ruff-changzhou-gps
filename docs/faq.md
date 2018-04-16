# 如何生成用于OTA升级的程序 user.bin?
在项目的根目录下执行

rap deploy --use-32-bit --ota --align 8 --package user.bin

会生成一个user.bin文件

# 如何进行OTA升级
http://139.219.103.144/

用户名:admin,  密码: ruff

点击更新

选择更新类型-> App

Choose file -> 选择本机上的文件:user.bin

点击更新

升级过程大约在3分钟，伴随2次系统重启

# 如何烧写主板程序
project-xinyu工程 , project-xinyu/ruffos/20180330

lm4flash bootloader+ruffos-ruff-gkc-v01-epi-0.9.4.bin

```
💎  :20180330> $ lm4flash bootloader+ruffos-ruff-gkc-v01-epi-0.9.4.bin
flash start address 0x0 (0K)
Found ICDI device with serial: MFG-TEST
ICDI version: 12630
writing: 0x4a000, speed: 10.77KB/s, progress: 56.83%, ETA: 20.96s
```



# 如何配置主板具有OTA功能
1. user app 应集成OTA
  * 目前最新的版本已经集成好了
2. 对主板进行配置
  * 下载project-xinyu工程
  * 在cd tools/factory-reset目录下
  * npm install
  * 在configs目录下放置，appconfig.json, sysconfig.json，配置文件;
  * tools/factory-reset目录下放置admin.bin, user.bin (默认的用户app,回退后的软件)
  * 在cd tools/factory-reset目录下
  * npm run dist-config,  	// 生成配置文件
  * npm run flash-config,   // 烧写配置文件
  * npm run dist-reset  // 生成dist/factory-reset.bin
  * sudo rap deploy --file dist/factory-reset.bin  // 下载，等待重启，完成
```
 $:factory-reset> $sudo rap deploy --file dist/factory-reset.bin
flash start address 0xCA000 (808K)
Found ICDI device with serial: MFG-TEST
ICDI version: 12630
writing: 0xffe00, speed: 10.77KB/s, progress: 100.00%, ETA: 0.05s

```
3. 此时主板已具有OTA功能，可以通过网页进行升级 
  * （注意升级的app必须已经集成了OTA）


