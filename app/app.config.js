// Dev-variant switch: `APP_VARIANT=development expo run:android` builds under a
// separate package id so debug (hot-reload) installs coexist on a device with
// the release-signed Obtainium app. CI/release builds never set APP_VARIANT and
// use app.json verbatim.
const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = ({ config }) => ({
  ...config,
  ...(IS_DEV
    ? {
        name: 'mitsume (dev)',
        android: { ...config.android, package: 'com.carrein.mitsume.dev' },
      }
    : {}),
});
