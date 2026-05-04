// Mock the native modules so jest can render App without a Metro/native bridge.
jest.mock("react-native-app-auth", () => ({
  authorize: jest.fn(),
  refresh: jest.fn(),
  revoke: jest.fn(),
}));

// SafeAreaProvider/SafeAreaView render natively at runtime. In jest, replace
// them with pass-through host components so children mount and we can query
// them with @testing-library/react-native.
jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaProvider: ({ children }) =>
      React.createElement(View, null, children),
    SafeAreaView: ({ children, ...rest }) =>
      React.createElement(View, rest, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 320, height: 640 }),
  };
});

// Hermes provides `atob` globally at runtime; jsdom-style envs don't.
if (typeof global.atob === "undefined") {
  global.atob = (input) => Buffer.from(input, "base64").toString("binary");
}
