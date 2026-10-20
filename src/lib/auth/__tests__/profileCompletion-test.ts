/// <reference types="jest" />
import {
  hasAddress,
  hasProfileDetails,
  isProfileComplete,
  routeForProfile,
  TimeoutError,
  withTimeout,
} from "../profileCompletion";

const ADDR = "University Avenue";

describe("hasProfileDetails", () => {
  test.each([
    [null, false],
    [undefined, false],
    [{ full_name: null, phone: null }, false],
    [{ full_name: "", phone: "+233201234567" }, false],
    [{ full_name: "   ", phone: "+233201234567" }, false],
    [{ full_name: "Ama Mensah", phone: null }, false],
    [{ full_name: "Ama Mensah", phone: " " }, false],
    [{ full_name: "Ama Mensah", phone: "+233201234567" }, true],
  ])("%p -> %s", (p, expected) => {
    expect(hasProfileDetails(p)).toBe(expected);
  });
});

describe("hasAddress", () => {
  test.each([
    [null, false],
    [{ full_name: "Ama", phone: "+233201234567" }, false],
    [{ full_name: "Ama", phone: "+233201234567", address_label: null }, false],
    [{ full_name: "Ama", phone: "+233201234567", address_label: "" }, false],
    [{ full_name: "Ama", phone: "+233201234567", address_label: "   " }, false],
    [{ full_name: "Ama", phone: "+233201234567", address_label: ADDR }, true],
  ])("%p -> %s", (p, expected) => {
    expect(hasAddress(p)).toBe(expected);
  });
});

describe("isProfileComplete", () => {
  test("needs name, phone and address", () => {
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete({ full_name: "Ama", phone: "+233201234567" })).toBe(false);
    expect(
      isProfileComplete({ full_name: "Ama", phone: null, address_label: ADDR }),
    ).toBe(false);
    expect(
      isProfileComplete({ full_name: "Ama", phone: "+233201234567", address_label: ADDR }),
    ).toBe(true);
  });
});

describe("routeForProfile", () => {
  test("new user -> /complete-profile", () => {
    expect(routeForProfile(null)).toBe("/complete-profile");
    expect(routeForProfile({ full_name: "Ama", phone: null })).toBe(
      "/complete-profile",
    );
  });
  test("address but no phone -> /complete-profile", () => {
    expect(
      routeForProfile({ full_name: "Ama", phone: null, address_label: ADDR }),
    ).toBe("/complete-profile");
  });
  test("name + phone, no address -> /complete-address", () => {
    expect(routeForProfile({ full_name: "Ama", phone: "+233201234567" })).toBe(
      "/complete-address",
    );
    expect(
      routeForProfile({ full_name: "Ama", phone: "+233201234567", address_label: " " }),
    ).toBe("/complete-address");
  });
  test("complete user -> /home", () => {
    expect(
      routeForProfile({ full_name: "Ama", phone: "+233201234567", address_label: ADDR }),
    ).toBe("/home");
  });
});

describe("withTimeout", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("resolves when the promise settles first", async () => {
    const p = withTimeout(Promise.resolve(42), 1000);
    await expect(p).resolves.toBe(42);
  });

  test("passes through rejections", async () => {
    const p = withTimeout(Promise.reject(new Error("x")), 1000);
    await expect(p).rejects.toThrow("x");
  });

  test("rejects with TimeoutError when too slow", async () => {
    const p = withTimeout(new Promise<number>(() => {}), 1000);
    jest.advanceTimersByTime(1000);
    await expect(p).rejects.toBeInstanceOf(TimeoutError);
  });
});
