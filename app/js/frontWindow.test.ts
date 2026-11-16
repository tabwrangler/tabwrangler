type FocusListener = (windowId: number) => void;

const WINDOW_ID_NONE = -1;

describe("frontWindow", () => {
  let focusListeners: FocusListener[];
  let getLastFocused: jest.Mock;

  function focus(windowId: number) {
    focusListeners.forEach((listener) => listener(windowId));
  }

  beforeEach(() => {
    focusListeners = [];
    getLastFocused = jest.fn(() => Promise.resolve({ id: 1 }));
    // jest-webextension-mock has no windows.
    chrome.windows = {
      WINDOW_ID_NONE,
      getLastFocused,
      onFocusChanged: { addListener: (listener: FocusListener) => focusListeners.push(listener) },
    } as unknown as typeof chrome.windows;
  });

  afterEach(() => {
    delete (chrome as Partial<typeof chrome>).windows;
  });

  test("loads the last focused window, then follows focus", async () => {
    await jest.isolateModulesAsync(async () => {
      const { default: frontWindow } = await import("./frontWindow");
      const listener = jest.fn();
      frontWindow.subscribe(listener);
      expect(frontWindow.get()).toBeUndefined();

      await frontWindow.init();
      expect(frontWindow.get()).toBe(1);

      focus(2);
      expect(frontWindow.get()).toBe(2);
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  test("keeps the window in front while another application has focus", async () => {
    await jest.isolateModulesAsync(async () => {
      const { default: frontWindow } = await import("./frontWindow");
      await frontWindow.init();
      const version = frontWindow.getVersion();

      focus(WINDOW_ID_NONE);

      expect(frontWindow.get()).toBe(1);
      expect(frontWindow.getVersion()).toBe(version);
    });
  });

  test("keeps a focus change that arrives while loading", async () => {
    await jest.isolateModulesAsync(async () => {
      let resolveLastFocused: (window: { id: number }) => void = () => {};
      getLastFocused.mockReturnValue(
        new Promise((resolve) => {
          resolveLastFocused = resolve;
        }),
      );
      const { default: frontWindow } = await import("./frontWindow");
      const loaded = frontWindow.init();

      focus(2);
      resolveLastFocused({ id: 1 });
      await loaded;

      expect(frontWindow.get()).toBe(2);
    });
  });

  test("loads once, however often it is asked to", async () => {
    await jest.isolateModulesAsync(async () => {
      const { default: frontWindow } = await import("./frontWindow");
      await Promise.all([frontWindow.init(), frontWindow.init()]);
      expect(getLastFocused).toHaveBeenCalledTimes(1);
    });
  });

  test("asks the browser again on refresh, in case a focus change was missed", async () => {
    await jest.isolateModulesAsync(async () => {
      const { default: frontWindow } = await import("./frontWindow");
      await frontWindow.init();

      getLastFocused.mockResolvedValue({ id: 3 });
      await frontWindow.refresh();

      expect(frontWindow.get()).toBe(3);
    });
  });

  test("has no front window when none is open", async () => {
    await jest.isolateModulesAsync(async () => {
      getLastFocused.mockRejectedValue(new Error("No last-focused window"));
      const { default: frontWindow } = await import("./frontWindow");
      await frontWindow.init();
      expect(frontWindow.get()).toBeUndefined();
    });
  });

  test("does not notify when focus stays on the same window", async () => {
    await jest.isolateModulesAsync(async () => {
      const { default: frontWindow } = await import("./frontWindow");
      await frontWindow.init();
      const listener = jest.fn();
      const unsubscribe = frontWindow.subscribe(listener);

      focus(1);
      expect(listener).not.toHaveBeenCalled();

      unsubscribe();
      focus(2);
      expect(listener).not.toHaveBeenCalled();
    });
  });
});

describe("frontWindow without the windows API", () => {
  test("loads nothing, like on Firefox for Android", async () => {
    await jest.isolateModulesAsync(async () => {
      const { default: frontWindow } = await import("./frontWindow");
      await frontWindow.init();
      await frontWindow.refresh();
      expect(frontWindow.get()).toBeUndefined();
    });
  });
});
