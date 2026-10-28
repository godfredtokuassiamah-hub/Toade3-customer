// Metro config: Expo defaults + production console stripping.
//
// Metro minifies (terser) only for production exports / EAS builds
// (https://docs.expo.dev/guides/minify/), so dev bundles in Expo Go keep
// every log. drop_console as an array removes only these console methods and
// keeps console.warn / console.error (they never log PII or tokens; see
// Docs/security/hardening.md). Expo's default minifierConfig is merged, not
// replaced, so its mangle / output / compress settings stay intact.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const base = config.transformer.minifierConfig ?? {};
config.transformer.minifierConfig = {
  ...base,
  compress: {
    ...(base.compress ?? {}),
    drop_console: ["log", "info", "debug", "trace"],
  },
};

module.exports = config;
