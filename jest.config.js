/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

module.exports = {
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,

  // Indicates which provider should be used to instrument code for coverage
  coverageProvider: "v8",

  // A map from regular expressions to module names or to arrays of module names that allow to stub out resources with a single module
  moduleNameMapper: {
    "\\.(s?css)$": "identity-obj-proxy",
  },

  // A preset that is used as a base for Jest's configuration
  preset: "ts-jest",

  // The paths to modules that run some code to configure or set up the testing environment before each test
  setupFiles: ["jest-webextension-mock"],

  // The test environment that will be used for testing
  testEnvironment: "jsdom",
};
