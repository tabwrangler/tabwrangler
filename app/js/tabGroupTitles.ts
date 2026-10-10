// Tab group titles by group ID. Tabs only carry their `groupId`, so this keeps titles in sync with
// `chrome.tabGroups` events for Tab Rules to match synchronously. This is a SINGLETON used by both
// background.ts and the UI, like `settings`.
const TabGroupTitles = {
  // Groups created, renamed or removed while loading, which the load must not overwrite with its
  // older snapshot. Only set while loading.
  _initChangedIds: null as Set<number> | null,
  _initPromise: undefined as Promise<void> | undefined,
  _listeners: new Set<() => void>(),
  _titles: new Map<number, string>(),
  _version: 0,

  // Loads the titles of all open groups. Later changes arrive through the listeners registered
  // below.
  init(): Promise<void> {
    if (this._initPromise != null) return this._initPromise;
    // Firefox before 139 has no tab groups.
    if (!chrome.tabGroups) {
      this._initPromise = Promise.resolve();
      return this._initPromise;
    }

    const initChangedIds = new Set<number>();
    this._initChangedIds = initChangedIds;
    this._initPromise = (async () => {
      const groups = await chrome.tabGroups.query({});
      groups.forEach((group) => {
        if (!initChangedIds.has(group.id)) this._titles.set(group.id, group.title ?? "");
      });
      this._initChangedIds = null;
      this._notify();
    })();
    return this._initPromise;
  },

  get(groupId: number): string | undefined {
    return this._titles.get(groupId);
  },

  // Changes whenever any title does, for `useSyncExternalStore`.
  getVersion(): number {
    return this._version;
  },

  remove(groupId: number) {
    this._initChangedIds?.add(groupId);
    this._titles.delete(groupId);
    this._notify();
  },

  set(groupId: number, title: string) {
    this._initChangedIds?.add(groupId);
    this._titles.set(groupId, title);
    this._notify();
  },

  subscribe(listener: () => void): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  },

  _notify() {
    this._version += 1;
    this._listeners.forEach((listener) => listener());
  },
};

// Registered when the module loads so a service worker adds them synchronously on its first turn.
if (chrome.tabGroups) {
  const setGroup = (group: chrome.tabGroups.TabGroup) => {
    TabGroupTitles.set(group.id, group.title ?? "");
  };
  chrome.tabGroups.onCreated.addListener(setGroup);
  chrome.tabGroups.onUpdated.addListener(setGroup);
  chrome.tabGroups.onRemoved.addListener((group) => {
    TabGroupTitles.remove(group.id);
  });
}

export default TabGroupTitles;
