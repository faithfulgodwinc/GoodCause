const fs = require("fs");
const path = require("path");

try {
  const gracefulFs = require("graceful-fs");
  gracefulFs.gracefulify(fs);

  if (fs.promises) {
    const wrapRetry = (origFn) => {
      if (typeof origFn !== "function") return origFn;
      return async (...args) => {
        let retries = 0;
        while (true) {
          try {
            return await origFn(...args);
          } catch (err) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE") && retries < 15) {
              retries++;
              await new Promise((resolve) => setTimeout(resolve, 30 * retries));
            } else {
              throw err;
            }
          }
        }
      };
    };

    if (fs.promises.open) fs.promises.open = wrapRetry(fs.promises.open);
    if (fs.promises.readFile) fs.promises.readFile = wrapRetry(fs.promises.readFile);
    if (fs.promises.stat) fs.promises.stat = wrapRetry(fs.promises.stat);
  }
} catch (e) {
  // Fallback
}

const { getDefaultConfig } = require("expo/metro-config");
const { FileStore } = require("metro-cache");

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react-native-css-interop/jsx-runtime") {
    return {
      filePath: require.resolve("react-native-css-interop/dist/runtime/jsx-runtime.js"),
      type: "sourceFile",
    };
  }
  if (moduleName === "react-native-css-interop/jsx-dev-runtime") {
    return {
      filePath: require.resolve("react-native-css-interop/dist/runtime/jsx-dev-runtime.js"),
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

if (!process.env.EAS_BUILD && !process.env.CI) {
  const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, ".metro-cache");
  config.cacheStores = [
    new FileStore({ root: path.join(root, "cache") }),
  ];
}

const projectRoot = path.resolve(__dirname).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
config.resolver.blockList = [
  new RegExp("^" + projectRoot + "[\\\\/]backend[\\\\/].*"),
  new RegExp("^" + projectRoot + "[\\\\/]android[\\\\/].*"),
  new RegExp("^" + projectRoot + "[\\\\/]ios[\\\\/].*"),
  new RegExp("^" + projectRoot + "[\\\\/]dist[\\\\/].*"),
  new RegExp("^" + projectRoot + "[\\\\/].git[\\\\/].*"),
  new RegExp("^" + projectRoot + "[\\\\/].expo[\\\\/].*"),
  new RegExp("^" + projectRoot + "[\\\\/].metro-cache[\\\\/].*"),
];

config.maxWorkers = 2;

module.exports = config;
