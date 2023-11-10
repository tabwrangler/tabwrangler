import TabManager, {
  findPositionByHostnameAndTitle,
  findPositionByURL,
  getURLPositionFilterByWrangleOption,
} from "../tabmanager";
import { setSavedTabs } from "../actions/localStorageActions";
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

beforeEach(async () => {
  await chrome.storage.local.clear();
  jest.clearAllMocks();
});

describe("wrangleTabs", () => {
  test("wrangles new tabs", async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    settings.get = jest.fn(() => 5); //maxTabs
    const tabManager = new TabManager();

    const testTabs = [createTab({ id: 2 }), createTab({ id: 3 }), createTab({ id: 4 })];
    await tabManager.wrangleTabs(testTabs);

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

    const tabManager = new TabManager();
    await tabManager.wrangleTabs(testTabs);

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

    const tabManager = new TabManager();
    const testTabs = [createTab({ id: 4, url: "https://www.nytimes.com" })];

    await tabManager.wrangleTabs(testTabs);
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

    const tabManager = new TabManager();
    const testTabs = [
      createTab({ id: 4, url: "https://www.nytimes.com", title: "New York Times" }),
    ];

    await tabManager.wrangleTabs(testTabs);

    expect(window.chrome.tabs.remove).toHaveBeenCalledTimes(1);
    expect(window.chrome.tabs.remove).toHaveBeenCalledWith([4]);
    const data = await chrome.storage.local.get("persist:localStorage");
    expect(data["persist:localStorage"].totalTabsWrangled).toEqual(1);
  });
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
        "The New York Times - Breaking News, World News & Multimedia"
      )
    ).toBe(2);
  });

  test("should return -1 of tab if no title provided", () => {
    expect(findPositionByHostnameAndTitle(savedTabs, "https://www.nytimes.com")).toBe(-1);
  });
});

describe("getURLPositionFilterByWrangleOption", () => {
  test("should return function that always returns -1", () => {
    const filterFunction = getURLPositionFilterByWrangleOption([], "withDuplicates");
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
