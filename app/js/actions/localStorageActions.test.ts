import { shiftTabTimes, unwrangleTabs } from "./localStorageActions";
import settings from "../settings";

beforeEach(async () => {
  await chrome.storage.local.clear();
});

describe("shiftTabTimes", () => {
  const pausedAtMs = 1_000;
  const unpausedAtMs = 46_000; // paused for 45 seconds

  test("shifts a tabTime that predates the pause forward by the pause duration", async () => {
    settings.stayOpen = jest.fn(() => 3_600_000); // large stayOpen so clamping never kicks in
    jest.spyOn(Date, "now").mockReturnValue(unpausedAtMs);

    await chrome.storage.local.set({ tabTimes: { "1": 500 } }); // tabTime predates the pause

    await shiftTabTimes(pausedAtMs);

    const { tabTimes } = await chrome.storage.local.get("tabTimes");
    expect(tabTimes["1"]).toBe(500 + (unpausedAtMs - pausedAtMs));
  });

  test("leaves a tabTime that postdates the pause unchanged", async () => {
    settings.stayOpen = jest.fn(() => 3_600_000);
    jest.spyOn(Date, "now").mockReturnValue(unpausedAtMs);

    // Tab was activated while paused (`onActivated` updates tabTimes even when paused), so its
    // time is already accurate and must not be shifted.
    await chrome.storage.local.set({ tabTimes: { "1": 30_000 } });

    await shiftTabTimes(pausedAtMs);

    const { tabTimes } = await chrome.storage.local.get("tabTimes");
    expect(tabTimes["1"]).toBe(30_000);
  });

  test("clamps a shifted tabTime to `now - stayOpen` when stayOpen shrinks during the pause", async () => {
    settings.stayOpen = jest.fn(() => 0);
    jest.spyOn(Date, "now").mockReturnValue(unpausedAtMs);

    await chrome.storage.local.set({ tabTimes: { "1": 500 } }); // predates the pause

    await shiftTabTimes(pausedAtMs);

    const { tabTimes } = await chrome.storage.local.get("tabTimes");
    expect(tabTimes["1"]).toBe(unpausedAtMs);
  });

  test("clamps a postdating tabTime that is already older than `stayOpen`", async () => {
    settings.stayOpen = jest.fn(() => 0);
    jest.spyOn(Date, "now").mockReturnValue(unpausedAtMs);

    await chrome.storage.local.set({ tabTimes: { "1": 2_000 } }); // postdates the pause

    await shiftTabTimes(pausedAtMs);

    const { tabTimes } = await chrome.storage.local.get("tabTimes");
    expect(tabTimes["1"]).toBe(unpausedAtMs);
  });
});

describe("unwrangleTabs", () => {
  const existingGroupId = 7;

  function createSavedTab(overrides: Partial<chrome.tabs.Tab> = {}): chrome.tabs.Tab {
    return {
      active: false,
      autoDiscardable: true,
      discarded: false,
      frozen: false,
      groupId: -1,
      highlighted: false,
      id: 1,
      incognito: false,
      index: 0,
      pinned: false,
      selected: false,
      url: "https://example.com",
      windowId: 1,
      // @ts-expect-error `closedAt` is a TW expando property on tabs
      closedAt: 2000,
      ...overrides,
    };
  }

  const tabsCreateMock = jest.fn(() => Promise.resolve(createSavedTab({ id: 100 })));
  const groupMock = jest.fn(() => Promise.resolve(existingGroupId));
  const tabGroupsGetMock = jest.fn((groupId: number) =>
    groupId === existingGroupId
      ? Promise.resolve({ id: groupId })
      : Promise.reject(new Error(`No group with id: ${groupId}.`)),
  );
  const sessionsRestoreMock = jest.fn(() =>
    Promise.resolve({ lastModified: 0, tab: createSavedTab({ id: 200, groupId: -1 }) }),
  );

  beforeEach(async () => {
    await chrome.storage.local.set({ browserStartedAt: 1000 });
    Object.assign(chrome.tabs, { create: tabsCreateMock, group: groupMock });
    Object.assign(chrome, {
      sessions: { restore: sessionsRestoreMock },
      tabGroups: { get: tabGroupsGetMock },
    });
  });

  test("adds a restored tab to its group when the group still exists", async () => {
    await unwrangleTabs([
      { session: undefined, tab: createSavedTab({ groupId: existingGroupId }) },
    ]);
    expect(groupMock).toHaveBeenCalledWith({ groupId: existingGroupId, tabIds: 100 });
  });

  test("leaves a restored tab ungrouped when its group no longer exists", async () => {
    await unwrangleTabs([{ session: undefined, tab: createSavedTab({ groupId: 99 }) }]);
    expect(tabsCreateMock).toHaveBeenCalled();
    expect(groupMock).not.toHaveBeenCalled();
  });

  test("leaves a restored tab ungrouped when it was not in a group", async () => {
    await unwrangleTabs([{ session: undefined, tab: createSavedTab({ groupId: -1 }) }]);
    expect(tabGroupsGetMock).not.toHaveBeenCalled();
    expect(groupMock).not.toHaveBeenCalled();
  });

  test("adds a tab restored from a session to its group when the group still exists", async () => {
    const tab = createSavedTab({ groupId: existingGroupId });
    await unwrangleTabs([{ session: { lastModified: 0, tab: { ...tab, sessionId: "abc" } }, tab }]);
    expect(sessionsRestoreMock).toHaveBeenCalledWith("abc");
    expect(groupMock).toHaveBeenCalledWith({ groupId: existingGroupId, tabIds: 200 });
  });

  test("opens the tab by URL when its session is no longer valid", async () => {
    sessionsRestoreMock.mockRejectedValueOnce(new Error('Invalid session id: "abc".'));
    const tab = createSavedTab({ groupId: existingGroupId });
    await unwrangleTabs([{ session: { lastModified: 0, tab: { ...tab, sessionId: "abc" } }, tab }]);
    expect(tabsCreateMock).toHaveBeenCalledWith({ active: false, pinned: false, url: tab.url });
    expect(groupMock).toHaveBeenCalledWith({ groupId: existingGroupId, tabIds: 100 });
  });

  test("does not regroup a tab the browser already restored into a group", async () => {
    sessionsRestoreMock.mockResolvedValueOnce({
      lastModified: 0,
      tab: createSavedTab({ id: 200, groupId: 3 }),
    });
    const tab = createSavedTab({ groupId: existingGroupId });
    await unwrangleTabs([{ session: { lastModified: 0, tab: { ...tab, sessionId: "abc" } }, tab }]);
    expect(groupMock).not.toHaveBeenCalled();
  });

  test("leaves a restored tab ungrouped when it was closed before the browser started", async () => {
    await unwrangleTabs([
      // @ts-expect-error `closedAt` is a TW expando property on tabs
      { session: undefined, tab: createSavedTab({ closedAt: 500, groupId: existingGroupId }) },
    ]);
    expect(groupMock).not.toHaveBeenCalled();
  });

  test("leaves a restored tab ungrouped when the tabGroups API is unavailable", async () => {
    Object.assign(chrome, { tabGroups: undefined });
    await unwrangleTabs([
      { session: undefined, tab: createSavedTab({ groupId: existingGroupId }) },
    ]);
    expect(groupMock).not.toHaveBeenCalled();
  });

  test("opens a tab pinned when it was pinned when it was closed", async () => {
    const tab = createSavedTab({ pinned: true });
    await unwrangleTabs([{ session: undefined, tab }]);
    expect(tabsCreateMock).toHaveBeenCalledWith({ active: false, pinned: true, url: tab.url });
  });
});
