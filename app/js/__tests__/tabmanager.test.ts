import { Action } from "redux";
import TabManager from "../tabmanager";
import configureMockStore from "../__mocks__/configureMockStore";
import settings from "../settings";

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
  jest.clearAllMocks();
});

describe("wrangleTabs", () => {
  let store: ReturnType<typeof configureMockStore>;

  beforeEach(() => {
    store = configureMockStore();
  });

  test("wrangles new tabs", async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    settings.get = jest.fn(() => 5); //maxTabs
    const tabManager = new TabManager(<any>store);

    const testTabs = [createTab({ id: 2 }), createTab({ id: 3 }), createTab({ id: 4 })];
    await tabManager.wrangleTabs(testTabs);

    expect(window.chrome.tabs.remove).toHaveBeenCalledTimes(1);
    expect(window.chrome.tabs.remove).toHaveBeenCalledWith([2, 3, 4]);

    const setSavedTabsAction = store
      .getActions()
      .find((action: Action) => action.type === "SET_SAVED_TABS");
    expect(setSavedTabsAction).toBeDefined();
    expect(setSavedTabsAction.savedTabs.map((tab: chrome.tabs.Tab) => tab.id)).toEqual([4, 3, 2]);
  });

  test("wrangles max tabs", async () => {
    // @ts-expect-error Only partial implementation of `settings` API
    settings.get = jest.fn(() => 3);
    const tabManager = new TabManager(<any>store);

    const testTabs = [
      createTab({ id: 2 }),
      createTab({ id: 3 }),
      createTab({ id: 4 }),
      createTab({ id: 5 }),
    ];
    window.chrome.storage.local.set = jest.fn();

    // FIXME: jest-webextension-mock missing `action` declaration
    // window.chrome.action.setBadgeText = jest.fn();
    await tabManager.wrangleTabs(testTabs);

    expect(window.chrome.tabs.remove).toHaveBeenCalledTimes(1);
    expect(window.chrome.tabs.remove).toHaveBeenCalledWith([2, 3, 4, 5]);
    expect(store.getActions()).toContainEqual({
      totalTabsWrangled: 4,
      type: "SET_TOTAL_TABS_WRANGLED",
    });
  });

  test("replaces duplicate tab in the corral if exact URL matches", async () => {
    settings.get = jest
      .fn()
      .mockImplementationOnce(() => 100)
      .mockImplementationOnce(() => "exactURLMatch");
    store = configureMockStore({
      localStorage: {
        savedTabs: [
          { id: 1, url: "https://www.github.com" },
          { id: 2, url: "https://www.google.com" },
          { id: 3, url: "https://www.nytimes.com" },
        ],
      },
    });
    const tabManager = new TabManager(<any>store);

    window.chrome.storage.local.set = jest.fn();
    // FIXME: jest-webextension-mock missing `action` declaration
    // window.chrome.action.setBadgeText = jest.fn();

    const testTabs = [createTab({ id: 4, url: "https://www.nytimes.com" })];

    await tabManager.wrangleTabs(testTabs);

    expect(window.chrome.tabs.remove).toHaveBeenCalledTimes(1);
    expect(window.chrome.tabs.remove).toHaveBeenCalledWith([4]);
    expect(store.getActions()).toContainEqual({
      totalTabsWrangled: 1,
      type: "SET_TOTAL_TABS_WRANGLED",
    });
  });

  test("replaces duplicate tab in the corral if hostname and title match", async () => {
    settings.get = jest
      .fn()
      .mockImplementationOnce(() => 100)
      .mockImplementationOnce(() => "hostnameAndTitleMatch");
    store = configureMockStore({
      localStorage: {
        savedTabs: [
          { id: 1, url: "https://www.github.com", title: "Github" },
          { id: 2, url: "https://www.google.com", title: "Google" },
          { id: 3, url: "https://www.nytimes.com", title: "New York Times" },
        ],
      },
    });
    const tabManager = new TabManager(<any>store);

    window.chrome.storage.local.set = jest.fn();
    // FIXME: jest-webextension-mock missing `action` declaration
    // window.chrome.action.setBadgeText = jest.fn();

    jest.clearAllMocks();

    const testTabs = [
      createTab({ id: 4, url: "https://www.nytimes.com", title: "New York Times" }),
    ];

    await tabManager.wrangleTabs(testTabs);

    expect(window.chrome.tabs.remove).toHaveBeenCalledTimes(1);
    expect(window.chrome.tabs.remove).toHaveBeenCalledWith([4]);
    expect(store.getActions()).toContainEqual({
      totalTabsWrangled: 1,
      type: "SET_TOTAL_TABS_WRANGLED",
    });
  });
});

describe("filter", () => {
  let store: ReturnType<typeof configureMockStore>;
  let tabManager: TabManager;

  beforeEach(() => {
    store = configureMockStore({
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
    tabManager = new TabManager(<any>store);
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
  let store: ReturnType<typeof configureMockStore>;
  let tabManager: TabManager;

  beforeEach(() => {
    store = configureMockStore();
    tabManager = new TabManager(<any>store);
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
