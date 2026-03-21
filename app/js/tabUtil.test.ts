import {
  AVERAGE_TAB_BYTES_SIZE,
  findPositionByHostnameAndTitle,
  findPositionByURL,
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
  test("returns lastAccessed::url when both are present", () => {
    expect(
      makeTabPersistKey(createTab({ url: "https://www.github.com", lastAccessed: 1000 })),
    ).toBe("1000::https://www.github.com");
  });

  test("falls back to url alone when lastAccessed is absent", () => {
    expect(
      makeTabPersistKey(createTab({ url: "https://www.github.com", lastAccessed: undefined })),
    ).toBe("https://www.github.com");
  });

  test("returns undefined when url is absent and lastAccessed is absent", () => {
    expect(
      makeTabPersistKey(createTab({ url: undefined, lastAccessed: undefined })),
    ).toBeUndefined();
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
