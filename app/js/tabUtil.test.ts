import {
  AVERAGE_TAB_BYTES_SIZE,
  findPositionByHostnameAndTitle,
  findPositionByURL,
  findTabsToCloseCandidates,
  getTabClosableStatus,
  getTabIdsOlderThan,
  getTabLockStatus,
  getURLPositionFilterByWrangleOption,
  getWhitelistMatch,
  makeTabPersistKey,
  wrangleTabsAndPersist,
} from "./tabUtil";
import { TextEncoder } from "util";
import { setSavedTabs } from "./actions/localStorageActions";
import settings from "./settings";

function createTab(overrides: Partial<chrome.tabs.Tab>): chrome.tabs.Tab {
  return {
    active: false,
    autoDiscardable: false,
    discarded: false,
    frozen: false,
    groupId: 1,
    highlighted: false,
    id: 1,
    index: 1,
    incognito: false,
    pinned: false,
    selected: false,
    title: "",
    url: "https://github.com/tabwrangler/tabwrangler",
    windowId: 1,
    ...overrides,
  };
}

beforeEach(async () => {
  await chrome.storage.local.clear();
});

describe("wrangleTabsAndPersist", () => {
  test("wrangles new tabs", async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    settings.get = jest.fn(() => 5); //maxTabs

    const testTabs = [createTab({ id: 2 }), createTab({ id: 3 }), createTab({ id: 4 })];
    await wrangleTabsAndPersist(testTabs);

    expect(window.chrome.tabs.remove).toHaveBeenCalledTimes(1);
    expect(window.chrome.tabs.remove).toHaveBeenCalledWith([2, 3, 4]);

    const data = await chrome.storage.local.get("persist:localStorage");
    expect(data["persist:localStorage"].savedTabs.map((tab: chrome.tabs.Tab) => tab.id)).toEqual([
      4, 3, 2,
    ]);
  });

  test("wrangles max tabs", async () => {
    const testTabs = [
      createTab({ id: 2 }),
      createTab({ id: 3 }),
      createTab({ id: 4 }),
      createTab({ id: 5 }),
    ];

    await wrangleTabsAndPersist(testTabs);

    expect(window.chrome.tabs.remove).toHaveBeenCalledTimes(1);
    expect(window.chrome.tabs.remove).toHaveBeenCalledWith([2, 3, 4, 5]);

    const data = await chrome.storage.local.get("persist:localStorage");
    expect(data["persist:localStorage"].totalTabsWrangled).toEqual(4);
  });

  test("replaces duplicate tab in the corral if exact URL matches", async () => {
    settings.get = jest
      .fn()
      .mockImplementationOnce(() => 100)
      .mockImplementationOnce(() => "exactURLMatch");
    await setSavedTabs([
      createTab({ id: 1, url: "https://www.github.com" }),
      createTab({ id: 2, url: "https://www.google.com" }),
      createTab({ id: 3, url: "https://www.nytimes.com" }),
    ]);

    const testTabs = [createTab({ id: 4, url: "https://www.nytimes.com" })];

    await wrangleTabsAndPersist(testTabs);
    expect(window.chrome.tabs.remove).toHaveBeenCalledWith([4]);
    const data = await chrome.storage.local.get("persist:localStorage");
    expect(data["persist:localStorage"].totalTabsWrangled).toEqual(1);
  });

  test("replaces duplicate tab in the corral if hostname and title match", async () => {
    settings.get = jest
      .fn()
      .mockImplementationOnce(() => 100)
      .mockImplementationOnce(() => "hostnameAndTitleMatch");
    await setSavedTabs([
      createTab({ id: 1, url: "https://www.github.com", title: "Github" }),
      createTab({ id: 2, url: "https://www.google.com", title: "Google" }),
      createTab({ id: 3, url: "https://www.nytimes.com", title: "New York Times" }),
    ]);

    const testTabs = [
      createTab({ id: 4, url: "https://www.nytimes.com", title: "New York Times" }),
    ];

    await wrangleTabsAndPersist(testTabs);

    expect(window.chrome.tabs.remove).toHaveBeenCalledTimes(1);
    expect(window.chrome.tabs.remove).toHaveBeenCalledWith([4]);
    const data = await chrome.storage.local.get("persist:localStorage");
    expect(data["persist:localStorage"].totalTabsWrangled).toEqual(1);
  });

  test("Tab saved size should not be higher than average", async () => {
    // respectively: 237, 1050 and 240 bytes as stored, when this test has been added
    const testTabs = [
      createTab({ id: 1, url: "https://www.github.com" }),
      createTab({
        id: 2,
        url: "https://httpbin.org/get?a=longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls",
      }),
      createTab({ id: 3, url: "https://www.wikipedia.org" }),
    ];

    await wrangleTabsAndPersist(testTabs);

    const encodedSize = (value: Array<chrome.tabs.Tab>) =>
      new TextEncoder().encode(JSON.stringify(value)).length;

    const data = await chrome.storage.local.get("persist:localStorage");

    const wrangledTabs = data["persist:localStorage"].totalTabsWrangled;
    const savedTabsSize = encodedSize(
      data["persist:localStorage"].savedTabs.splice(0, wrangledTabs),
    );
    expect(savedTabsSize).toBeGreaterThan(0);
    expect(savedTabsSize / testTabs.length).toBeLessThanOrEqual(AVERAGE_TAB_BYTES_SIZE);
  });

  test.failing(
    "Tab saved size should not be higher than average (using getBytesInUse)",
    async () => {
      // respectively: 237, 1050 and 240 bytes as stored, when this test has been added
      const testTabs = [
        createTab({ id: 1, url: "https://www.github.com" }),
        createTab({
          id: 2,
          url: "https://httpbin.org/get?a=longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls_longargumenttochecksizeofurls",
        }),
        createTab({ id: 3, url: "https://www.wikipedia.org" }),
      ];

      await wrangleTabsAndPersist(testTabs);

      // StorageLocalPersistState has some extra overhead compared to the bare `savedTabs`
      // but AVERAGE_TAB_BYTES_SIZE should be generous enough to cover that
      const size = await chrome.storage.local.getBytesInUse();

      expect(size).toBeGreaterThan(0); // fails here because getBytesInUse() returns 0 in nodejs
      expect(size / testTabs.length).toBeLessThanOrEqual(AVERAGE_TAB_BYTES_SIZE);
    },
  );
});

describe("filter", () => {
  const savedTabs = [
    createTab({ id: 1, url: "https://www.github.com", title: "GitHub" }),
    createTab({ id: 2, url: "https://www.google.com", title: "Google" }),
    createTab({
      id: 3,
      url: "https://www.nytimes.com",
      title: "The New York Times - Breaking News, World News & Multimedia",
    }),
  ];

  test("should return index of tab if the url matches", () => {
    expect(findPositionByURL(savedTabs, "https://www.nytimes.com")).toBe(2);
  });

  test("should return -1 if the url does not match any tab", () => {
    expect(findPositionByURL(savedTabs, "https://www.mozilla.org")).toBe(-1);
  });

  test("should return -1 if the url is undefined", () => {
    expect(findPositionByURL(savedTabs)).toBe(-1);
  });

  test("should return -1 if the url is null", () => {
    expect(findPositionByURL(savedTabs, null)).toBe(-1);
  });

  test("should return index of tab if the url matches", () => {
    expect(
      findPositionByHostnameAndTitle(
        savedTabs,
        "https://www.nytimes.com",
        "The New York Times - Breaking News, World News & Multimedia",
      ),
    ).toBe(2);
  });

  test("should return -1 of tab if no title provided", () => {
    expect(findPositionByHostnameAndTitle(savedTabs, "https://www.nytimes.com")).toBe(-1);
  });
});

describe("getWhitelistMatch", () => {
  test("returns the matching pattern when the URL contains it", () => {
    expect(getWhitelistMatch("https://www.github.com/foo", { whitelist: ["github.com"] })).toBe(
      "github.com",
    );
  });

  test("returns the first matching pattern when multiple match", () => {
    expect(
      getWhitelistMatch("https://www.github.com/foo", { whitelist: ["github.com", "github"] }),
    ).toBe("github.com");
  });

  test("returns null when no pattern matches", () => {
    expect(getWhitelistMatch("https://www.github.com", { whitelist: ["google.com"] })).toBeNull();
  });

  test("returns null when the whitelist is empty", () => {
    expect(getWhitelistMatch("https://www.github.com", { whitelist: [] })).toBeNull();
  });

  test("returns null when url is undefined", () => {
    expect(getWhitelistMatch(undefined, { whitelist: ["github.com"] })).toBeNull();
  });
});

describe("getTabLockStatus", () => {
  const defaultOptions = {
    filterAudio: false,
    filterGroupedTabs: false,
    lockedIds: [],
    lockedWindowIds: [],
    whitelist: [],
  };

  test("returns not locked for a normal tab", () => {
    expect(getTabLockStatus(createTab({ groupId: -1 }), defaultOptions)).toEqual({
      locked: false,
    });
  });

  test("locks a pinned tab", () => {
    expect(getTabLockStatus(createTab({ pinned: true }), defaultOptions)).toEqual({
      locked: true,
      reason: "pinned",
    });
  });

  test("locks an audible tab when filterAudio is enabled", () => {
    expect(
      getTabLockStatus(createTab({ audible: true }), { ...defaultOptions, filterAudio: true }),
    ).toEqual({ locked: true, reason: "audible" });
  });

  test("does not lock an audible tab when filterAudio is disabled", () => {
    expect(
      getTabLockStatus(createTab({ audible: true, groupId: -1 }), {
        ...defaultOptions,
        filterAudio: false,
      }),
    ).toEqual({ locked: false });
  });

  test("locks a grouped tab when filterGroupedTabs is enabled", () => {
    // groupId > 0 means the tab is in a group
    expect(
      getTabLockStatus(createTab({ groupId: 2 }), {
        ...defaultOptions,
        filterGroupedTabs: true,
      }),
    ).toEqual({ locked: true, reason: "grouped" });
  });

  test("does not lock a grouped tab when filterGroupedTabs is disabled", () => {
    expect(
      getTabLockStatus(createTab({ groupId: 2 }), {
        ...defaultOptions,
        filterGroupedTabs: false,
      }),
    ).toEqual({ locked: false });
  });

  test("locks a tab whose URL matches the whitelist", () => {
    expect(
      getTabLockStatus(createTab({ groupId: -1, url: "https://www.github.com" }), {
        ...defaultOptions,
        whitelist: ["github.com"],
      }),
    ).toEqual({ locked: true, reason: "whitelist", whitelistMatch: "github.com" });
  });

  test("locks a tab whose ID is in lockedIds", () => {
    expect(
      getTabLockStatus(createTab({ groupId: -1, id: 42 }), {
        ...defaultOptions,
        lockedIds: [42],
      }),
    ).toEqual({ locked: true, reason: "manual" });
  });

  test("locks a tab whose windowId is in lockedWindowIds", () => {
    expect(
      getTabLockStatus(createTab({ groupId: -1, windowId: 7 }), {
        ...defaultOptions,
        lockedWindowIds: [7],
      }),
    ).toEqual({ locked: true, reason: "window" });
  });

  test("pinned takes priority over audible", () => {
    expect(
      getTabLockStatus(createTab({ pinned: true, audible: true }), {
        ...defaultOptions,
        filterAudio: true,
      }),
    ).toEqual({ locked: true, reason: "pinned" });
  });
});

describe("makeTabPersistKey", () => {
  test("returns index::url when both are present", () => {
    expect(makeTabPersistKey(createTab({ index: 45, url: "https://www.github.com" }))).toBe(
      "45::https://www.github.com",
    );
  });

  test("falls back to url alone when index is absent", () => {
    expect(makeTabPersistKey(createTab({ index: undefined, url: "https://www.github.com" }))).toBe(
      "https://www.github.com",
    );
  });

  test("returns undefined when url is absent and index is absent", () => {
    expect(makeTabPersistKey(createTab({ index: undefined, url: undefined }))).toBeUndefined();
  });
});

describe("getURLPositionFilterByWrangleOption", () => {
  test("should return function that always returns -1", () => {
    const filterFunction = getURLPositionFilterByWrangleOption([], "withDupes");
    expect(filterFunction).not.toBeNull();
    expect(filterFunction(createTab({ url: "http://www.test.com" }))).toBe(-1);
  });

  test("should return function that will return the tab position by exact URL match", () => {
    const filterFunction = getURLPositionFilterByWrangleOption([], "exactURLMatch");
    expect(filterFunction).not.toBeNull();
    expect(filterFunction(createTab({ url: "http://www.test.com" }))).toBe(-1);
  });

  test("should return function that will return the tab position by hostname and title", () => {
    const filterFunction = getURLPositionFilterByWrangleOption([], "hostnameAndTitleMatch");
    expect(filterFunction).not.toBeNull();
    expect(filterFunction(createTab({ url: "http://www.test.com", title: "test" }))).toBe(-1);
  });
});

describe("getTabClosableStatus", () => {
  beforeEach(() => {
    settings.get = jest.fn().mockImplementation((key: string) => {
      switch (key) {
        case "filterAudio":
          return false;
        case "filterGroupedTabs":
          return false;
        case "lockedIds":
          return [];
        case "lockedWindowIds":
          return [];
        case "whitelist":
          return [];
        default:
          return undefined;
      }
    });
  });

  test("active tab is not closable", () => {
    const tab = createTab({ active: true });
    expect(getTabClosableStatus(tab)).toEqual({
      closable: false,
      reason: "active",
      tab,
    });
  });

  test("pinned tab is not closable", () => {
    const tab = createTab({ pinned: true });
    expect(getTabClosableStatus(tab)).toEqual({
      closable: false,
      reason: "locked",
      tab,
      tabLockStatus: { locked: true, reason: "pinned" },
    });
  });

  test("normal tab is closable", () => {
    const tab = createTab({ groupId: -1 });
    expect(getTabClosableStatus(tab)).toEqual({ closable: true, tab });
  });

  test("manually locked tab is not closable", () => {
    settings.get = jest.fn().mockImplementation((key: string) => {
      if (key === "lockedIds") return [42];
      if (key === "lockedWindowIds") return [];
      if (key === "whitelist") return [];
      if (key === "filterAudio") return false;
      if (key === "filterGroupedTabs") return false;
      return undefined;
    });
    const tab = createTab({ id: 42, groupId: -1 });
    expect(getTabClosableStatus(tab)).toEqual({
      closable: false,
      reason: "locked",
      tab,
      tabLockStatus: { locked: true, reason: "manual" },
    });
  });

  test("whitelisted tab is not closable", () => {
    settings.get = jest.fn().mockImplementation((key: string) => {
      if (key === "whitelist") return ["github.com"];
      if (key === "lockedIds") return [];
      if (key === "lockedWindowIds") return [];
      if (key === "filterAudio") return false;
      if (key === "filterGroupedTabs") return false;
      return undefined;
    });
    const tab = createTab({ groupId: -1, url: "https://github.com/foo" });
    expect(getTabClosableStatus(tab)).toEqual({
      closable: false,
      reason: "locked",
      tab,
      tabLockStatus: { locked: true, reason: "whitelist", whitelistMatch: "github.com" },
    });
  });
});

describe("getTabIdsOlderThan", () => {
  test("returns empty set for empty tabTimes", () => {
    expect(getTabIdsOlderThan({}, 1000)).toEqual(new Set());
  });

  test("returns all IDs when all tabs are older than time", () => {
    const now = Date.now();
    expect(getTabIdsOlderThan({ "1": now - 2000, "2": now - 3000 }, now - 1000)).toEqual(
      new Set([1, 2]),
    );
  });

  test("returns only IDs older than time", () => {
    const now = Date.now();
    expect(getTabIdsOlderThan({ "1": now - 2000, "2": now }, now - 1000)).toEqual(new Set([1]));
  });

  test("returns all IDs when time is 0 (falsy shortcut)", () => {
    const now = Date.now();
    expect(getTabIdsOlderThan({ "1": now, "2": now }, 0)).toEqual(new Set([1, 2]));
  });
});

describe("findTabsToCloseCandidates", () => {
  const OLD_TIME = 0; // always older than any real cutOff

  function mockSettings({ minTabs = 2, stayOpen = 60_000 } = {}) {
    settings.get = jest.fn().mockImplementation((key: string) => {
      switch (key) {
        case "minTabs":
          return minTabs;
        case "filterAudio":
          return false;
        case "filterGroupedTabs":
          return false;
        case "lockedIds":
          return [];
        case "lockedWindowIds":
          return [];
        case "whitelist":
          return [];
        default:
          return undefined;
      }
    });
    jest.spyOn(settings, "stayOpen").mockReturnValue(stayOpen);
  }

  test("returns [] when total tabs does not exceed minTabs", () => {
    mockSettings({ minTabs: 3 });
    const tabs = [createTab({ id: 1 }), createTab({ id: 2 }), createTab({ id: 3 })];
    expect(
      findTabsToCloseCandidates({ "1": OLD_TIME, "2": OLD_TIME, "3": OLD_TIME }, tabs),
    ).toEqual([]);
  });

  test("returns [] when no tabs are old enough", () => {
    mockSettings({ minTabs: 1 });
    const now = Date.now();
    const tabs = [createTab({ id: 1 }), createTab({ id: 2 })];
    expect(findTabsToCloseCandidates({ "1": now, "2": now }, tabs)).toEqual([]);
  });

  test("returns old closable tabs when above minTabs", () => {
    mockSettings({ minTabs: 1 });
    const oldTab = createTab({ id: 1, groupId: -1 });
    const freshTab = createTab({ id: 2 });
    expect(
      findTabsToCloseCandidates({ "1": OLD_TIME, "2": Date.now() }, [oldTab, freshTab]),
    ).toEqual([oldTab]);
  });

  test("limits results so total tabs does not fall below minTabs", () => {
    mockSettings({ minTabs: 2 });
    const tabs = [
      createTab({ id: 1, groupId: -1 }),
      createTab({ id: 2, groupId: -1 }),
      createTab({ id: 3, groupId: -1 }),
      createTab({ id: 4, groupId: -1 }),
    ];
    // 4 tabs, minTabs=2 → at most 2 may be closed
    const result = findTabsToCloseCandidates(
      { "1": OLD_TIME, "2": OLD_TIME, "3": OLD_TIME, "4": OLD_TIME },
      tabs,
    );
    expect(result).toHaveLength(2);
  });

  test("excludes active tabs from candidates", () => {
    mockSettings({ minTabs: 1 });
    const activeOldTab = createTab({ id: 1, active: true });
    const inactiveOldTab = createTab({ id: 2, groupId: -1 });
    const freshTab = createTab({ id: 3 });
    expect(
      findTabsToCloseCandidates({ "1": OLD_TIME, "2": OLD_TIME, "3": Date.now() }, [
        activeOldTab,
        inactiveOldTab,
        freshTab,
      ]),
    ).toEqual([inactiveOldTab]);
  });

  test("excludes locked (pinned) tabs from candidates", () => {
    mockSettings({ minTabs: 1 });
    const pinnedOldTab = createTab({ id: 1, pinned: true });
    const normalOldTab = createTab({ id: 2, groupId: -1 });
    const freshTab = createTab({ id: 3 });
    expect(
      findTabsToCloseCandidates({ "1": OLD_TIME, "2": OLD_TIME, "3": Date.now() }, [
        pinnedOldTab,
        normalOldTab,
        freshTab,
      ]),
    ).toEqual([normalOldTab]);
  });

  test("sorts candidates by lastAccessed ascending (oldest first)", () => {
    mockSettings({ minTabs: 1 });
    const olderTab = createTab({ id: 1, lastAccessed: 100, groupId: -1 });
    const newerTab = createTab({ id: 2, lastAccessed: 200, groupId: -1 });
    const freshTab = createTab({ id: 3 });
    // Pass newerTab first to ensure sorting is applied, not array order
    const result = findTabsToCloseCandidates({ "1": OLD_TIME, "2": OLD_TIME, "3": Date.now() }, [
      newerTab,
      olderTab,
      freshTab,
    ]);
    expect(result.map((t) => t.id)).toEqual([1, 2]);
  });

  test("active tab counts toward minTabs total even though it cannot be closed", () => {
    // 3 tabs: 1 active + 2 old closable. minTabs=2.
    // The active tab should count toward the total (3 non-locked - 2 minTabs = 1 may close),
    // not be excluded from the count (which would incorrectly allow 2 closures).
    mockSettings({ minTabs: 2 });
    const activeTab = createTab({ id: 1, active: true });
    const oldTab1 = createTab({ id: 2, groupId: -1 });
    const oldTab2 = createTab({ id: 3, groupId: -1 });
    const result = findTabsToCloseCandidates({ "1": OLD_TIME, "2": OLD_TIME, "3": OLD_TIME }, [
      activeTab,
      oldTab1,
      oldTab2,
    ]);
    expect(result).toHaveLength(1);
  });

  test("locked tabs do not count toward minTabs total", () => {
    // 4 tabs: 2 pinned (locked) + 1 active + 1 old closable. minTabs=2.
    // Non-locked count = 2 (active + closable). 2 - 2 = 0 → nothing should be closed.
    // If locked tabs were mistakenly counted (tabs.length=4), 4 - 2 = 2 would allow 1 closure.
    mockSettings({ minTabs: 2 });
    const pinnedTab1 = createTab({ id: 1, pinned: true });
    const pinnedTab2 = createTab({ id: 2, pinned: true });
    const activeTab = createTab({ id: 3, active: true });
    const oldTab = createTab({ id: 4, groupId: -1 });
    const result = findTabsToCloseCandidates(
      { "1": OLD_TIME, "2": OLD_TIME, "3": OLD_TIME, "4": OLD_TIME },
      [pinnedTab1, pinnedTab2, activeTab, oldTab],
    );
    expect(result).toHaveLength(0);
  });
});
