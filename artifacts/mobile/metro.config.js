const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
// Avoid Metro crashing while watching openid-client's temp cache directory.
config.resolver.blockList = [/\.cache\/openid-client\/.*/];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@/')) {
    return context.resolveRequest(
      context,
      path.join(__dirname, moduleName.slice(2)),
      platform,
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
