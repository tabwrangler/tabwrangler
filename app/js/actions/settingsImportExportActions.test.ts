import {
  SETTINGS_EXPORT_TYPE,
  SETTINGS_EXPORT_VERSION,
  type SettingsExport,
  exportSettings,
  importSettings,
  parseSettingsExport,
  settingsExportFileName,
} from "./settingsImportExportActions";
import Settings, { SETTINGS_DEFAULTS } from "../settings";
import type { TabRulesConfig } from "../tabRules";
import { TextEncoder } from "util";
import { importData } from "./importExportActions";

Object.assign(global, { TextEncoder });

// The context menu is created by a `createContextMenu` setter, which needs build-time globals.
jest.mock("../menus", () => ({
  __esModule: true,
  default: { create: jest.fn(), destroy: jest.fn() },
}));

// Chrome leaves keys that are not stored out of the result. The mock returns them as `undefined`,
// which would replace the defaults `settings` holds.
const mockSyncGet = (chrome.storage.sync.get as jest.Mock).getMockImplementation()!;
(chrome.storage.sync.get as jest.Mock).mockImplementation(async (keys: unknown) => {
  const items: Record<string, unknown> = await mockSyncGet(keys);
  return Object.fromEntries(Object.entries(items).filter(([, value]) => value !== undefined));
});

const TAB_RULES: TabRulesConfig = {
  version: 1,
  rules: [
    { id: "pinned", match: "every", when: [{ type: "pinned" }], then: { action: "lock" } },
    {
      id: "video",
      match: "some",
      when: [
        { type: "url", op: "includes", value: "youtube.com" },
        { type: "groupTitle", op: "includes", value: "Training" },
      ],
      then: { action: "stale", afterSeconds: 7200, save: "none" },
    },
    {
      id: "else",
      match: "every",
      when: [],
      then: { action: "stale", afterSeconds: 1800, save: "corral" },
    },
  ],
};

const WEEKDAYS_9_TO_5 = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
  dayOfWeek,
  startMinute: 9 * 60,
  endMinute: 17 * 60,
}));

function settingsFile(data: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    type: SETTINGS_EXPORT_TYPE,
    version: SETTINGS_EXPORT_VERSION,
    data: { exportedAt: "2026-11-12T00:00:00.000Z", lockedTabs: [], settings: {}, ...data },
    ...overrides,
  };
}

function importFile(content: unknown): Promise<void> {
  const blob = new Blob([typeof content === "string" ? content : JSON.stringify(content)], {
    type: "text/plain;charset=utf-8",
  });
  // @ts-expect-error Using only necessary key from `EventTarget`, no need to create real one
  return importSettings({ target: { files: [blob] } });
}

function readBlob(blob: Blob): Promise<SettingsExport> {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.onload = () => resolve(JSON.parse(String(fileReader.result)));
    fileReader.onerror = reject;
    fileReader.readAsText(blob, "utf-8");
  });
}

function mockOpenTabs(tabs: Array<Partial<chrome.tabs.Tab>>) {
  (chrome.tabs.query as jest.Mock).mockResolvedValue(tabs);
}

// Each test starts as a fresh extension page with nothing stored.
beforeEach(async () => {
  await Promise.all([chrome.storage.sync.clear(), chrome.storage.local.clear()]);
  Settings._initPromise = undefined;
  Settings._stored = {};
  Settings.cache = { ...SETTINGS_DEFAULTS };
  mockOpenTabs([]);
  // Messages are the key followed by its substitutions, so tests can tell which setting an error
  // names.
  (chrome.i18n.getMessage as jest.Mock).mockImplementation(
    (key: string, substitutions?: string | string[]) =>
      [key, ...(substitutions == null ? [] : [substitutions].flat())].join(" "),
  );
});

const INVALID_FILE = "options_importExportSettings_error_invalidFile";
const INVALID_SETTING = "options_importExportSettings_error_invalidSetting";

describe("exportSettings", () => {
  test("exports the settings in effect, the theme and locked tabs by URL", async () => {
    await chrome.storage.sync.set({
      activeHours: WEEKDAYS_9_TO_5,
      lockedIds: [7, 9, 404],
      lockedWindowIds: [20, 404],
      // Number inputs on the options page are saved as the strings they hold.
      minTabs: "12",
      "persist:settings": { paused: true, theme: "dark" },
      tabRules: TAB_RULES,
    });
    mockOpenTabs([
      { id: 7, title: "Docs", url: "https://example.com/docs", windowId: 10 },
      { id: 8, title: "Not locked", url: "https://example.com/other", windowId: 10 },
      { id: 9, url: "https://example.com/untitled", windowId: 10 },
      // In a locked window: locked through the window, not by hand.
      { id: 11, title: "Video", url: "https://example.com/video", windowId: 20 },
      { id: 12, title: "Notes", url: "https://example.com/notes", windowId: 20 },
    ]);

    const blob = await exportSettings();
    expect(blob.type).toBe("application/json;charset=utf-8");

    const file = await readBlob(blob);
    expect(file.type).toBe("tabwrangler-settings");
    expect(file.version).toBe(1);
    expect(file.data.theme).toBe("dark");
    expect(file.data.lockedTabs).toEqual([
      { title: "Docs", url: "https://example.com/docs" },
      { url: "https://example.com/untitled" },
    ]);
    expect(file.data.lockedWindows).toEqual([
      {
        tabs: [
          { title: "Video", url: "https://example.com/video" },
          { title: "Notes", url: "https://example.com/notes" },
        ],
      },
    ]);
    expect(file.data.settings).toEqual({
      activeHours: WEEKDAYS_9_TO_5,
      corralTabSortOrder: null,
      createContextMenu: true,
      debounceOnActivated: true,
      lockTabSortOrder: null,
      maxTabs: 1000,
      minTabs: 12,
      minTabsStrategy: "givenWindow",
      pauseWhenIdle: false,
      purgeClosedTabs: false,
      showBadgeCount: false,
      tabRules: TAB_RULES,
      wrangleOption: "withDupes",
    });
  });

  test("exports the rules derived from legacy settings when Tab Rules were never saved", async () => {
    await chrome.storage.sync.set({ minutesInactive: 5, whitelist: ["github.com"] });

    const { data } = await readBlob(await exportSettings());

    expect(data.settings).not.toHaveProperty("whitelist");
    expect(data.settings).not.toHaveProperty("minutesInactive");
    expect(data.settings.tabRules?.rules.map(({ then, when }) => ({ then, when }))).toEqual([
      { then: { action: "lock" }, when: [{ type: "pinned" }] },
      { then: { action: "lock" }, when: [{ type: "url", op: "includes", value: "github.com" }] },
      { then: { action: "lock" }, when: [{ type: "audible" }] },
      { then: { action: "stale", afterSeconds: 300, save: "corral" }, when: [] },
    ]);
  });

  // The closed tabs import accepts any file with 4 or more top-level keys, in every version.
  test("has fewer top-level keys than the closed tabs import accepts", async () => {
    const file = await readBlob(await exportSettings());
    expect(Object.keys(file).length).toBeLessThan(4);
  });

  test("names the file after the date", () => {
    expect(settingsExportFileName(new Date("2026-11-12T10:00:00Z"))).toBe(
      "TabWranglerSettings-2026-11-12.json",
    );
  });
});

describe("importSettings", () => {
  test("restores exported settings in a browser with default settings", async () => {
    await chrome.storage.sync.set({
      activeHours: WEEKDAYS_9_TO_5,
      maxTabs: 500,
      minTabs: "12",
      minTabsStrategy: "allWindows",
      "persist:settings": { theme: "light" },
      showBadgeCount: true,
      tabRules: TAB_RULES,
      wrangleOption: "exactURLMatch",
    });
    const file = await readBlob(await exportSettings());

    await chrome.storage.sync.clear();
    Settings._initPromise = undefined;
    Settings._stored = {};
    Settings.cache = { ...SETTINGS_DEFAULTS };
    await importFile(file);

    expect(Settings.get("activeHours")).toEqual(WEEKDAYS_9_TO_5);
    expect(Settings.get("maxTabs")).toBe(500);
    expect(Settings.get("minTabs")).toBe(12);
    expect(Settings.get("minTabsStrategy")).toBe("allWindows");
    expect(Settings.get("showBadgeCount")).toBe(true);
    expect(Settings.get("tabRules")).toEqual(TAB_RULES);
    expect(Settings.get("wrangleOption")).toBe("exactURLMatch");

    const stored = await chrome.storage.sync.get(null);
    expect(stored.tabRules).toEqual(TAB_RULES);
    expect(stored.minTabs).toBe(12);
    expect(stored["persist:settings"].theme).toBe("light");
  });

  test("keeps settings missing from the file and ignores ones it does not know", async () => {
    await chrome.storage.sync.set({ minTabs: 7, showBadgeCount: true });

    await importFile(settingsFile({ settings: { fromTheFuture: { anything: 1 }, minTabs: 3 } }));

    const stored = await chrome.storage.sync.get(null);
    expect(stored.minTabs).toBe(3);
    expect(stored.showBadgeCount).toBe(true);
    expect(stored).not.toHaveProperty("fromTheFuture");
  });

  test.each([
    ["paused", true],
    ["running", false],
  ])("leaves a %s Tab Wrangler as it is", async (_label, paused) => {
    await chrome.storage.sync.set({ "persist:settings": { paused, theme: "dark" } });

    // A hand-edited file cannot change it either.
    await importFile(
      settingsFile({ paused: !paused, settings: { paused: !paused }, theme: "light" }),
    );

    const { "persist:settings": persisted } = await chrome.storage.sync.get("persist:settings");
    expect(persisted).toEqual({ paused, theme: "light" });
    expect(await chrome.storage.local.get("pausedAt")).toEqual({});
  });

  test("locks the open tabs with the URLs of exported locked tabs", async () => {
    await chrome.storage.sync.set({ lockedIds: [1] });
    mockOpenTabs([
      { id: 1, url: "https://example.com/already-locked" },
      { id: 2, url: "https://example.com/docs" },
      { id: 3, url: "https://example.com/other" },
      { id: 4, url: "https://example.com/docs" },
    ]);

    await importFile(
      settingsFile({
        lockedTabs: [
          { title: "Docs", url: "https://example.com/docs" },
          { url: "https://example.com/not-open" },
        ],
      }),
    );

    expect(Settings.get("lockedIds")).toEqual([1, 2, 4]);
  });

  test("does not change locked tabs when the file has none", async () => {
    await chrome.storage.sync.set({ lockedIds: [1], lockedWindowIds: [10] });

    await importFile(settingsFile({}));

    expect(Settings.get("lockedIds")).toEqual([1]);
    expect(Settings.get("lockedWindowIds")).toEqual([10]);
    expect(chrome.tabs.query).not.toHaveBeenCalled();
  });

  describe("with an exported locked window", () => {
    const lockedWindows = [
      {
        tabs: [
          { title: "Docs", url: "https://example.com/docs" },
          { url: "https://example.com/video" },
        ],
      },
    ];

    test("locks the window that holds all of its tabs, not the tabs one by one", async () => {
      await chrome.storage.sync.set({ lockedWindowIds: [30] });
      mockOpenTabs([
        { id: 1, url: "https://example.com/docs", windowId: 10 },
        { id: 2, url: "https://example.com/video", windowId: 10 },
        // Opened since the export: the window is still the same one.
        { id: 3, url: "https://example.com/new", windowId: 10 },
        // Holds only one of the window's tabs.
        { id: 4, url: "https://example.com/docs", windowId: 20 },
      ]);

      await importFile(settingsFile({ lockedWindows }));

      expect(Settings.get("lockedWindowIds")).toEqual([30, 10]);
      expect(Settings.get("lockedIds")).toEqual([]);
    });

    test("locks its open tabs one by one when no window holds them all", async () => {
      mockOpenTabs([
        { id: 1, url: "https://example.com/docs", windowId: 10 },
        { id: 2, url: "https://example.com/other", windowId: 10 },
        { id: 3, url: "https://example.com/video", windowId: 20 },
      ]);

      await importFile(settingsFile({ lockedWindows }));

      expect(Settings.get("lockedWindowIds")).toEqual([]);
      expect(Settings.get("lockedIds")).toEqual([1, 3]);
    });

    test("locks nothing when none of its tabs are open", async () => {
      mockOpenTabs([{ id: 1, url: "https://example.com/other", windowId: 10 }]);

      await importFile(settingsFile({ lockedWindows }));

      expect(Settings.get("lockedWindowIds")).toEqual([]);
      expect(Settings.get("lockedIds")).toEqual([]);
      expect(await chrome.storage.sync.get(null)).toEqual({});
    });

    test("ignores an exported window without tabs, which would match every window", async () => {
      mockOpenTabs([{ id: 1, url: "https://example.com/other", windowId: 10 }]);

      await importFile(settingsFile({ lockedWindows: [{ tabs: [] }] }));

      expect(Settings.get("lockedWindowIds")).toEqual([]);
    });
  });

  test.each<[string, unknown]>([
    ["text that is not JSON", "not json"],
    ["a JSON value that is not an object", [1, 2, 3]],
    [
      "a closed tabs export",
      { savedTabs: [], totalTabsRemoved: 1, totalTabsUnwrangled: 2, totalTabsWrangled: 3 },
    ],
    ["a newer file version", settingsFile({}, { version: 2 })],
    ["a file without settings", { type: SETTINGS_EXPORT_TYPE, version: 1, data: {} }],
  ])("rejects %s", async (_label, content) => {
    await expect(importFile(content)).rejects.toThrow(INVALID_FILE);
    expect(await chrome.storage.sync.get(null)).toEqual({});
  });

  test.each<[string, Record<string, unknown>]>([
    ["minTabs", { settings: { minTabs: -1 } }],
    ["minTabs", { settings: { minTabs: "many" } }],
    ["maxTabs", { settings: { maxTabs: 0 } }],
    ["showBadgeCount", { settings: { showBadgeCount: "yes" } }],
    ["minTabsStrategy", { settings: { minTabsStrategy: "everyWindow" } }],
    ["wrangleOption", { settings: { wrangleOption: null } }],
    ["lockTabSortOrder", { settings: { lockTabSortOrder: "random" } }],
    [
      "activeHours",
      { settings: { activeHours: [{ dayOfWeek: 8, startMinute: 0, endMinute: 60 }] } },
    ],
    [
      "activeHours",
      { settings: { activeHours: [{ dayOfWeek: 1, startMinute: 60, endMinute: 60 }] } },
    ],
    [
      "activeHours",
      {
        settings: {
          activeHours: [
            { dayOfWeek: 1, startMinute: 0, endMinute: 60 },
            { dayOfWeek: 1, startMinute: 120, endMinute: 180 },
          ],
        },
      },
    ],
    ["tabRules", { settings: { tabRules: { version: 2, rules: [] } } }],
    [
      "tabRules",
      {
        settings: {
          tabRules: {
            version: 1,
            rules: [{ id: "a", match: "every", when: [], then: { action: "close" } }],
          },
        },
      },
    ],
    [
      "tabRules",
      {
        settings: {
          tabRules: {
            version: 1,
            rules: [
              {
                id: "a",
                match: "every",
                when: [{ type: "url", op: "matches", value: ".*" }],
                then: { action: "lock" },
              },
            ],
          },
        },
      },
    ],
    [
      "tabRules",
      {
        settings: {
          tabRules: {
            version: 1,
            rules: [
              {
                id: "a",
                match: "every",
                when: [],
                then: { action: "stale", afterSeconds: -5, save: "corral" },
              },
            ],
          },
        },
      },
    ],
    ["theme", { theme: "sepia" }],
    ["lockedTabs", { lockedTabs: [{ title: "No URL" }] }],
    ["lockedWindows", { lockedWindows: [{ url: "https://example.com" }] }],
    ["lockedWindows", { lockedWindows: [{ tabs: [{ title: "No URL" }] }] }],
  ])("rejects an invalid %s and imports nothing", async (name, data) => {
    // A valid setting in the same file must not be imported either.
    const file = settingsFile({
      ...data,
      settings: { purgeClosedTabs: true, ...(data.settings as Record<string, unknown>) },
    });

    await expect(importFile(file)).rejects.toThrow(`${INVALID_SETTING} ${name}`);
    expect(await chrome.storage.sync.get(null)).toEqual({});
  });

  test("rejects Tab Rules too large for one sync storage item and imports nothing", async () => {
    const rules = Array.from({ length: 200 }, (_, i) => ({
      id: `rule${i}`,
      match: "every",
      when: [{ type: "url", op: "includes", value: `https://example.com/a/long/path/${i}` }],
      then: { action: "lock" },
    }));

    await expect(
      importFile(settingsFile({ settings: { minTabs: 3, tabRules: { version: 1, rules } } })),
    ).rejects.toThrow(`${INVALID_SETTING} tabRules`);
    expect(await chrome.storage.sync.get(null)).toEqual({});
  });

  test("imports nothing when maxTabs is over what this browser's storage allows", async () => {
    await expect(
      importFile(settingsFile({ settings: { maxTabs: 1_000_000, minTabs: 3 } })),
    ).rejects.toThrow();
    expect(await chrome.storage.sync.get(null)).toEqual({});
  });
});

describe("parseSettingsExport", () => {
  test("accepts a stale timeout of 0 seconds, which legacy settings can produce", () => {
    const tabRules = {
      version: 1,
      rules: [
        {
          id: "a",
          match: "every",
          when: [],
          then: { action: "stale", afterSeconds: 0, save: "corral" },
        },
      ],
    };
    expect(parseSettingsExport(settingsFile({ settings: { tabRules } })).settings.tabRules).toEqual(
      tabRules,
    );
  });

  test("accepts active hours with no active day", () => {
    expect(
      parseSettingsExport(settingsFile({ settings: { activeHours: [] } })).settings.activeHours,
    ).toEqual([]);
  });
});

// Choosing a settings file with the other Import button must not erase the Tab Corral.
describe("importData", () => {
  test("rejects a settings export and keeps closed tabs", async () => {
    const closedTabs = { savedTabs: [{ id: 1, url: "https://example.com" }], totalTabsWrangled: 1 };
    await chrome.storage.local.set({ "persist:localStorage": closedTabs });
    const blob = await exportSettings();

    await expect(
      // @ts-expect-error Using only necessary key from `EventTarget`, no need to create real one
      importData({ target: { files: [blob] } }),
    ).rejects.toThrow("Invalid backup");

    const { "persist:localStorage": stored } =
      await chrome.storage.local.get("persist:localStorage");
    expect(stored).toEqual(closedTabs);
  });
});
