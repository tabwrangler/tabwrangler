import Settings, { SETTINGS_DEFAULTS } from "./settings";

function mockSyncStorage(items: Record<string, unknown>) {
  (chrome.storage.sync.get as jest.Mock).mockResolvedValue(items);
  (chrome.storage.sync.set as jest.Mock).mockResolvedValue(undefined);
}

// Each test loads settings again, as a fresh extension page would.
function resetSettings() {
  jest.resetAllMocks();
  Settings._initPromise = undefined;
  Settings.cache = { ...SETTINGS_DEFAULTS };
}

describe("settings", () => {
  beforeEach(async () => {
    resetSettings();
    mockSyncStorage({});
    await Settings.init();
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

describe("tabRules migration", () => {
  beforeEach(() => {
    resetSettings();
  });

  test("derives tabRules from legacy settings when none are stored", async () => {
    mockSyncStorage({
      filterAudio: false,
      filterGroupedTabs: true,
      minutesInactive: 5,
      secondsInactive: 30,
      whitelist: ["github.com"],
    });
    await Settings.init();
    const tabRules = Settings.get("tabRules");
    expect(tabRules.rules.map(({ then, when }) => ({ then, when }))).toEqual([
      { then: { action: "lock" }, when: [{ type: "pinned" }] },
      { then: { action: "lock" }, when: [{ type: "url", op: "includes", value: "github.com" }] },
      { then: { action: "lock" }, when: [{ type: "groupId", op: "some" }] },
      { then: { action: "stale", afterSeconds: 330, save: "corral" }, when: [] },
    ]);
  });

  test("uses legacy defaults for settings that were never changed", async () => {
    mockSyncStorage({});
    await Settings.init();
    const { rules } = Settings.get("tabRules");
    expect(rules.map(({ when }) => when)).toEqual([
      [{ type: "pinned" }],
      [{ type: "url", op: "includes", value: "about:" }],
      [{ type: "url", op: "includes", value: "chrome://" }],
      [{ type: "audible" }],
      [],
    ]);
    expect(rules[4].then).toEqual({ action: "stale", afterSeconds: 3600, save: "corral" });
  });

  test("prefers stored tabRules", async () => {
    const stored = {
      version: 1,
      rules: [
        {
          id: "a",
          match: "every",
          when: [],
          then: { action: "stale", afterSeconds: 10, save: "corral" },
        },
      ],
    };
    mockSyncStorage({ tabRules: stored, whitelist: ["github.com"] });
    await Settings.init();
    expect(Settings.get("tabRules")).toEqual(stored);
  });

  test("adds a locking Else rule to stored tabRules without one", async () => {
    mockSyncStorage({ tabRules: { version: 1, rules: [] } });
    await Settings.init();
    expect(Settings.get("tabRules").rules).toEqual([
      expect.objectContaining({ then: { action: "lock" }, when: [] }),
    ]);
  });
});

describe("storage changes", () => {
  beforeEach(async () => {
    resetSettings();
    mockSyncStorage({ maxTabs: 500 });
    await Settings.init();
  });

  test("updates the cache and notifies subscribers", () => {
    const listener = jest.fn();
    Settings.subscribe("maxTabs", listener);
    Settings._onStorageChanged({ maxTabs: { newValue: 200, oldValue: 500 } }, "sync");
    expect(Settings.get("maxTabs")).toBe(200);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("ignores other storage areas", () => {
    Settings._onStorageChanged({ maxTabs: { newValue: 200 } }, "local");
    expect(Settings.get("maxTabs")).toBe(500);
  });

  test("falls back to the default when a setting is removed", () => {
    Settings._onStorageChanged({ maxTabs: { oldValue: 500 } }, "sync");
    expect(Settings.get("maxTabs")).toBe(SETTINGS_DEFAULTS.maxTabs);
  });

  test("derives tabRules from legacy settings when they are removed", () => {
    Settings._onStorageChanged(
      { tabRules: { oldValue: SETTINGS_DEFAULTS.tabRules }, whitelist: { newValue: [] } },
      "sync",
    );
    expect(Settings.get("tabRules").rules.map(({ when }) => when)).toEqual([
      [{ type: "pinned" }],
      [{ type: "audible" }],
      [],
    ]);
  });

  test("keeps a change made while settings were loading", async () => {
    resetSettings();
    let resolveGet: (items: Record<string, unknown>) => void = () => {};
    (chrome.storage.sync.get as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveGet = resolve;
      }),
    );
    const init = Settings.init();
    Settings._onStorageChanged({ maxTabs: { newValue: 200 } }, "sync");
    resolveGet({ maxTabs: 500, minTabs: 3 });
    await init;
    expect(Settings.get("maxTabs")).toBe(200);
    expect(Settings.get("minTabs")).toBe(3);
  });
});
