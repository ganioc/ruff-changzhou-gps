"use strict";

function getEConnConfig(sysconfig) {
  if (!sysconfig) {
    return null;
  }
  var config = Object.create(null);
  try {
    var hostV = sysconfig.k(["explorer", "host"]);
    config.host = hostV && hostV.v();
    var portV = sysconfig.k(["explorer", "port"]);
    config.port = portV && portV.v();
    if (typeof config.port === "string") {
      config.port = Number(config.port);
    }
  } catch (e) {
    console.log("get EConnConfig error", e);
    return null;
  }
  return config;
}
exports.getEConnConfig = getEConnConfig;