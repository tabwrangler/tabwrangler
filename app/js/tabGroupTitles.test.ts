type Listener = (group: chrome.tabGroups.TabGroup) => void;

function createEvent() {
  const listeners: Listener[] = [];
  return {
    addListener: (listener: Listener) => listeners.push(listener),
    fire: (group: Partial<chrome.tabGroups.TabGroup>) =>
      listeners.forEach((listener) => listener(group as chrome.tabGroups.TabGroup)),
  };
}

describe("tabGroupTitles", () => {
  const events = { onCreated: createEvent(), onRemoved: createEvent(), onUpdated: createEvent() };

  beforeEach(() => {
    // jest-webextension-mock has no tabGroups.
    chrome.tabGroups = {
      ...events,
      query: jest.fn(() => Promise.resolve([{ id: 1, title: "Work" }])),
    } as unknown as typeof chrome.tabGroups;
  });

  afterEach(() => {
    delete (chrome as Partial<typeof chrome>).tabGroups;
  });

  test("loads titles, then follows created, renamed and removed groups", async () => {
    await jest.isolateModulesAsync(async () => {
      const { default: tabGroupTitles } = await import("./tabGroupTitles");
      const listener = jest.fn();
      tabGroupTitles.subscribe(listener);
      await tabGroupTitles.init();
      expect(tabGroupTitles.get(1)).toBe("Work");

      events.onCreated.fire({ id: 2, title: "" });
      events.onUpdated.fire({ id: 2, title: "Reading" });
      expect(tabGroupTitles.get(2)).toBe("Reading");

      events.onRemoved.fire({ id: 1 });
      expect(tabGroupTitles.get(1)).toBeUndefined();
      expect(listener).toHaveBeenCalledTimes(4);
    });
  });

  test("keeps a rename that arrives while titles are loading", async () => {
    let resolveQuery: (groups: Partial<chrome.tabGroups.TabGroup>[]) => void = () => {};
    (chrome.tabGroups.query as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveQuery = resolve;
      }),
    );
    await jest.isolateModulesAsync(async () => {
      const { default: tabGroupTitles } = await import("./tabGroupTitles");
      const init = tabGroupTitles.init();
      events.onUpdated.fire({ id: 1, title: "Renamed" });
      resolveQuery([
        { id: 1, title: "Work" },
        { id: 2, title: "Reading" },
      ]);
      await init;
      expect(tabGroupTitles.get(1)).toBe("Renamed");
      expect(tabGroupTitles.get(2)).toBe("Reading");
    });
  });
});
