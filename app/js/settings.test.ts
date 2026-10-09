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

describe("tabRules migration", () => {
  function mockSyncStorage(items: Record<string, unknown>) {
    (chrome.storage.sync.get as jest.Mock).mockImplementation(
      (_keys: unknown, callback?: (items: Record<string, unknown>) => void) => {
        callback?.(items);
        return Promise.resolve(items);
      },
    );
    (chrome.storage.sync.set as jest.Mock).mockResolvedValue(undefined);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    Settings._initPromise = undefined;
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
      { then: { action: "stale", afterSeconds: 330 }, when: [] },
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
    expect(rules[4].then).toEqual({ action: "stale", afterSeconds: 3600 });
  });

  test("prefers stored tabRules", async () => {
    const stored = {
      version: 1,
      rules: [
        {
          id: "a",
          enabled: true,
          match: "every",
          when: [],
          then: { action: "stale", afterSeconds: 10 },
        },
      ],
    };
    mockSyncStorage({ tabRules: stored, whitelist: ["github.com"] });
    await Settings.init();
    expect(Settings.get("tabRules")).toEqual(stored);
  });
});
