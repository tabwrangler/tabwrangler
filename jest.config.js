// Sync object
/** @type {import('@jest/types').Config.InitialOptions} */

module.exports = async () => {
  return {
    verbose: true,
    testEnvironment: "jsdom",
    globals: {
      chrome: true,
    },
    moduleNameMapper: {
      "\\.(s?css)$": "<rootDir>/app/__mocks__/styleMock.js",
    },
    transform: {
      "^.+\\.jsx?$": "babel-jest",
    },
  };
};
