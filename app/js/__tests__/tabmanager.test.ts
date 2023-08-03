import { Action } from "redux";
import TabManager from "../tabmanager";
import configureMockStore from "../__mocks__/configureMockStore";

function createTab(overrides: Partial<chrome.tabs.Tab>): chrome.tabs.Tab {
  return {
    active: false,
    autoDiscardable: false,
    discarded: false,
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

beforeEach(() => {
  const TW = (window.TW = {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    settings: {},
    store: configureMockStore(),
  });

  window.chrome = {
    storage: {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore:next-line
      local: {},
    },
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    tabs: {},
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    browserAction: {},
    extension: {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore:next-line
      getBackgroundPage: () => {
        return {
          TW,
        };
      },
    },
  };
});

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore:next-line
  window.chrome = {};
});

describe("wrangleTabs", () => {
  let tabManager: TabManager;

  beforeEach(() => {
    tabManager = new TabManager();
  });

  test("should wrangle new tabs", () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    window.TW.settings.get = jest.fn(() => 5); //maxTabs
    window.chrome.tabs.remove = jest.fn();

    const testTabs = [createTab({ id: 2 }), createTab({ id: 3 }), createTab({ id: 4 })];
    tabManager.wrangleTabs(testTabs);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    expect(window.chrome.tabs.remove.mock.calls.length).toBe(3);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    expect(window.chrome.tabs.remove.mock.calls).toEqual([[2], [3], [4]]);

    const setSavedTabsAction = window.TW.store
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore:next-line
      .getActions()
      .find((action: Action) => action.type === "SET_SAVED_TABS");
    expect(setSavedTabsAction).toBeDefined();
    expect(setSavedTabsAction.savedTabs.map((tab: chrome.tabs.Tab) => tab.id)).toEqual([4, 3, 2]);
  });

  test("should wrangle max tabs", () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    window.TW.settings.get = jest.fn(() => 3);
    window.chrome.tabs.remove = jest.fn();

    const testTabs = [
      createTab({ id: 2 }),
      createTab({ id: 3 }),
      createTab({ id: 4 }),
      createTab({ id: 5 }),
    ];
    window.chrome.storage.local.set = jest.fn();

    window.chrome.browserAction.setBadgeText = jest.fn();
    tabManager.wrangleTabs(testTabs);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    expect(window.chrome.tabs.remove.mock.calls.length).toBe(4);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    expect(window.chrome.tabs.remove.mock.calls).toEqual([[2], [3], [4], [5]]);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    expect(window.TW.store.getActions()).toContainEqual({
      totalTabsWrangled: 4,
      type: "SET_TOTAL_TABS_WRANGLED",
    });
  });

  test("replaces duplicate tab in the corral if exact URL matches", () => {
    window.TW.settings.get = jest
      .fn()
      .mockImplementationOnce(() => 100)
      .mockImplementationOnce(() => "exactURLMatch");
    window.chrome.tabs.remove = jest.fn();
    window.TW.store = configureMockStore({
      localStorage: {
        savedTabs: [
          { id: 1, url: "https://www.github.com" },
          { id: 2, url: "https://www.google.com" },
          { id: 3, url: "https://www.nytimes.com" },
        ],
      },
    });

    window.chrome.storage.local.set = jest.fn();
    window.chrome.browserAction.setBadgeText = jest.fn();

    // reset all mocks
    jest.clearAllMocks();

    const testTabs = [createTab({ id: 4, url: "https://www.nytimes.com" })];

    tabManager.wrangleTabs(testTabs);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    expect(window.chrome.tabs.remove.mock.calls.length).toBe(1);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    expect(window.chrome.tabs.remove.mock.calls).toEqual([[4]]);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    expect(window.TW.store.getActions()).toContainEqual({
      totalTabsWrangled: 1,
      type: "SET_TOTAL_TABS_WRANGLED",
    });

    // TODO: Test for tabs
  });

  test("replaces duplicate tab in the corral if hostname and title match", () => {
    window.TW.settings.get = jest
      .fn()
      .mockImplementationOnce(() => 100)
      .mockImplementationOnce(() => "hostnameAndTitleMatch");
    window.chrome.tabs.remove = jest.fn();
    window.TW.store = configureMockStore({
      localStorage: {
        savedTabs: [
          { id: 1, url: "https://www.github.com", title: "Github" },
          { id: 2, url: "https://www.google.com", title: "Google" },
          { id: 3, url: "https://www.nytimes.com", title: "New York Times" },
        ],
      },
    });

    window.chrome.storage.local.set = jest.fn();
    window.chrome.browserAction.setBadgeText = jest.fn();

    // reset all mocks
    jest.clearAllMocks();

    const testTabs = [
      createTab({ id: 4, url: "https://www.nytimes.com", title: "New York Times" }),
    ];

    tabManager.wrangleTabs(testTabs);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    expect(window.chrome.tabs.remove.mock.calls.length).toBe(1);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    expect(window.chrome.tabs.remove.mock.calls).toEqual([[4]]);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    expect(window.TW.store.getActions()).toContainEqual({
      totalTabsWrangled: 1,
      type: "SET_TOTAL_TABS_WRANGLED",
    });

    // TODO: Test for tabs
  });
});

describe("filter", () => {
  let tabManager: TabManager;

  beforeEach(() => {
    tabManager = new TabManager();
    window.TW.store = configureMockStore({
      localStorage: {
        savedTabs: [
          { id: 1, url: "https://www.github.com", title: "GitHub" },
          { id: 2, url: "https://www.google.com", title: "Google" },
          {
            id: 3,
            url: "https://www.nytimes.com",
            title: "The New York Times - Breaking News, World News & Multimedia",
          },
        ],
      },
    });
  });

  test("should return index of tab if the url matches", () => {
    expect(tabManager.findPositionByURL("https://www.nytimes.com")).toBe(2);
  });

  test("should return -1 if the url does not match any tab", () => {
    expect(tabManager.findPositionByURL("https://www.mozilla.org")).toBe(-1);
  });

  test("should return -1 if the url is undefined", () => {
    expect(tabManager.findPositionByURL()).toBe(-1);
  });

  test("should return -1 if the url is null", () => {
    expect(tabManager.findPositionByURL(null)).toBe(-1);
  });

  test("should return index of tab if the url matches", () => {
    expect(
      tabManager.findPositionByHostnameAndTitle(
        "https://www.nytimes.com",
        "The New York Times - Breaking News, World News & Multimedia"
      )
    ).toBe(2);
  });

  test("should return -1 of tab if no title provided", () => {
    expect(tabManager.findPositionByHostnameAndTitle("https://www.nytimes.com")).toBe(-1);
  });
});

describe("getURLPositionFilterByWrangleOption", () => {
  let tabManager: TabManager;

  beforeEach(() => {
    tabManager = new TabManager();
  });

  test("should return function that always returns -1", () => {
    const filterFunction = tabManager.getURLPositionFilterByWrangleOption("withDuplicates");

    expect(filterFunction).not.toBeNull();
    expect(filterFunction(createTab({ url: "http://www.test.com" }))).toBe(-1);
  });

  test("should return function that will return the tab position by exact URL match", () => {
    const filterFunction = tabManager.getURLPositionFilterByWrangleOption("exactURLMatch");

    expect(filterFunction).not.toBeNull();
    expect(filterFunction(createTab({ url: "http://www.test.com" }))).toBe(-1);
  });

  test("should return function that will return the tab position by hostname and title", () => {
    const filterFunction = tabManager.getURLPositionFilterByWrangleOption("hostnameAndTitleMatch");

    expect(filterFunction).not.toBeNull();
    expect(filterFunction(createTab({ url: "http://www.test.com", title: "test" }))).toBe(-1);
  });
});
