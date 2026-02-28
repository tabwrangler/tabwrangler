import Settings from "./settings";

describe("settings", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    Settings.init();
  });

  test("sets maxTabs to 1000", () => {
    Settings.set("maxTabs", 1000);
    expect(Settings.get("maxTabs")).toBe(1000);
    expect(chrome.storage.sync.set).toHaveBeenCalledTimes(1);
  });

  test("sets maxTabs to 1", () => {
    Settings.set("maxTabs", 1);
    expect(Settings.get("maxTabs")).toBe(1);
    expect(chrome.storage.sync.set).toHaveBeenCalledTimes(1);
  });

  test("throws an exception when maxTabs is < 1", () => {
    expect(() => Settings.set("maxTabs", 0)).toThrowError();
  });

  test("throws an exception when maxTabs would exceed browser quota", () => {
    expect(() => Settings.set("maxTabs", 10000)).toThrowError();
  });
});
