module.exports = {
  preset: "react-native",
  setupFiles: ["<rootDir>/jest.setup.js"],
  testEnvironment: "node",
  // RN ships untranspiled ESM; let jest transform it via babel-jest
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native|@react-navigation|react-native-app-auth|react-native-config|react-native-keychain|react-native-safe-area-context)/)",
  ],
  moduleNameMapper: {
    "^react-native-config$": "<rootDir>/__mocks__/react-native-config.js",
  },
};
