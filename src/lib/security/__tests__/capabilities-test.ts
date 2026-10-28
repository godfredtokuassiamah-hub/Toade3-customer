/// <reference types="jest" />
// Capability checks: Expo Go vs development build vs release build, and the
// native protections that must stay off until a dev build adds them.
type Env = "storeClient" | "standalone" | "bare";

function load(env: Env, expoGo: boolean, os: "ios" | "android" | "web" = "ios") {
  let mod: typeof import("../capabilities") | undefined;
  jest.isolateModules(() => {
    jest.doMock("expo-constants", () => ({
      __esModule: true,
      default: { executionEnvironment: env, expoGoConfig: expoGo ? { debuggerHost: "x" } : null },
      ExecutionEnvironment: { Bare: "bare", Standalone: "standalone", StoreClient: "storeClient" },
    }));
    jest.doMock("react-native", () => ({ Platform: { OS: os } }));
    // Fresh module instance with this test's mocks.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("../capabilities") as typeof import("../capabilities");
  });
  if (!mod) throw new Error("module not loaded");
  return mod;
}

afterEach(() => {
  jest.dontMock("expo-constants");
  jest.dontMock("react-native");
});

describe("isExpoGo", () => {
  test("true inside Expo Go", () => {
    expect(load("storeClient", true).isExpoGo()).toBe(true);
  });
  test("false in a development build (storeClient without expoGoConfig)", () => {
    expect(load("storeClient", false).isExpoGo()).toBe(false);
  });
  test("false in a release build", () => {
    expect(load("standalone", false).isExpoGo()).toBe(false);
  });
});

describe("isReleaseBuild", () => {
  // Jest runs with __DEV__ = true, so even a standalone environment is not a
  // release build here; that is the point of the __DEV__ term.
  test("false while __DEV__", () => {
    expect(load("standalone", false).isReleaseBuild()).toBe(false);
  });
  test("false in Expo Go", () => {
    expect(load("storeClient", true).isReleaseBuild()).toBe(false);
  });
});

describe("nativeProtections", () => {
  test("screen capture on Android only, integrity / pinning / root detection off", () => {
    for (const os of ["ios", "android"] as const) {
      expect(load("storeClient", true, os).nativeProtections()).toEqual({
        screenCapture: os === "android",
        appIntegrity: false,
        tlsPinning: false,
        rootDetection: false,
      });
    }
  });
  test("no screen capture on iOS (secure canvas blacks out behind the keyboard)", () => {
    expect(load("standalone", false, "ios").nativeProtections().screenCapture).toBe(false);
  });
  test("no screen capture on web", () => {
    expect(load("bare", false, "web").nativeProtections().screenCapture).toBe(false);
  });
});
