// The ID of the browser window in front: the one that most recently had focus. Tabs only carry
// `active`, which is true for the selected tab of every window, so this lets Tab Rules tell the tab
// in view from the selected tabs of windows behind it, synchronously. Like
// `chrome.windows.getLastFocused`, the front window stays the same one while another application
// has focus. This is a SINGLETON used by both background.ts and the UI, like `settings`.
const FrontWindow = {
  // Set when focus changes while loading, which the load must not overwrite with its older
  // snapshot.
  _changedWhileLoading: false,
  _initPromise: undefined as Promise<void> | undefined,
  _listeners: new Set<() => void>(),
  _version: 0,
  _windowId: undefined as number | undefined,

  // Loads the front window. Later changes arrive through the listener registered below.
  init(): Promise<void> {
    if (this._initPromise != null) return this._initPromise;
    this._changedWhileLoading = false;
    this._initPromise = this._load(() => !this._changedWhileLoading);
    return this._initPromise;
  },

  // Asks the browser again rather than trusting that no focus event was missed, like while a
  // service worker was stopped.
  refresh(): Promise<void> {
    return this._load(() => true);
  },

  get(): number | undefined {
    return this._windowId;
  },

  // Changes whenever the front window does, for `useSyncExternalStore`.
  getVersion(): number {
    return this._version;
  },

  set(windowId: number | undefined) {
    this._changedWhileLoading = true;
    if (windowId === this._windowId) return;
    this._windowId = windowId;
    this._version += 1;
    this._listeners.forEach((listener) => listener());
  },

  subscribe(listener: () => void): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  },

  async _load(shouldApply: () => boolean): Promise<void> {
    // Firefox for Android has no windows.
    if (!chrome.windows) return;
    let windowId: number | undefined;
    try {
      windowId = (await chrome.windows.getLastFocused()).id;
    } catch {
      // No window is open.
      windowId = undefined;
    }
    if (shouldApply()) this.set(windowId);
  },
};

// Registered when the module loads so a service worker adds it synchronously on its first turn.
if (chrome.windows) {
  chrome.windows.onFocusChanged.addListener((windowId) => {
    // `WINDOW_ID_NONE` means every browser window lost focus, like when switching to another
    // application. The window that had it stays in front.
    if (windowId !== chrome.windows.WINDOW_ID_NONE) FrontWindow.set(windowId);
  });
}

export default FrontWindow;
