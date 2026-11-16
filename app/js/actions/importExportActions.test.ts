import {
  EXPORT_VERSION,
  type ExportFile,
  type ParsedImport,
  applyImport,
  exportData,
  exportFileName,
  parseImport,
  readImportFile,
} from "./importExportActions";
import Settings, { SETTINGS_DEFAULTS } from "../settings";
import type { TabRulesConfig } from "../tabRules";
import { TextEncoder } from "util";

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

const CLOSED_TABS = {
  savedTabs: [
    { closedAt: 1493418190099, id: 36, title: "fish: Tutorial", url: "https://fishshell.com/" },
  ] as unknown as chrome.tabs.Tab[],
  totalTabsRemoved: 256,
  totalTabsUnwrangled: 16,
  totalTabsWrangled: 32,
};

const LOCAL_CLOSED_TABS = {
  savedTabs: [{ id: 1, url: "https://example.com/only-in-this-browser" }],
  totalTabsRemoved: 5,
  totalTabsUnwrangled: 1,
  totalTabsWrangled: 2,
};

const PARSE_OPTIONS = { hasIdlePermission: true, maxTabsLimit: 8000 };
const INVALID_FILE = "options_importExport_error_invalidFile";
const NEWER_VERSION = "options_importExport_error_newerVersion";

function fileEvent(content: unknown) {
  const blob = new Blob([typeof content === "string" ? content : JSON.stringify(content)], {
    type: "text/plain;charset=utf-8",
  });
  return { target: { files: [blob] } } as unknown as React.FormEvent<HTMLInputElement>;
}

function readBlob(blob: Blob): Promise<ExportFile> {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.onload = () => resolve(JSON.parse(String(fileReader.result)));
    fileReader.onerror = reject;
    fileReader.readAsText(blob, "utf-8");
  });
}

function parse(json: unknown, options: Partial<typeof PARSE_OPTIONS> = {}): ParsedImport {
  return parseImport(json, { ...PARSE_OPTIONS, ...options });
}

function resetSettings() {
  Settings._initPromise = undefined;
  Settings._stored = {};
  Settings.cache = { ...SETTINGS_DEFAULTS };
}

// Each test starts as a fresh extension page with nothing stored. The mock keeps sync and local
// storage in one store, so clearing either clears both.
beforeEach(async () => {
  await chrome.storage.local.clear();
  resetSettings();
  chrome.permissions = {
    contains: jest.fn(() => Promise.resolve(true)),
  } as unknown as typeof chrome.permissions;
  (chrome.i18n.getMessage as jest.Mock).mockImplementation((key: string) => key);
});

describe("exportData", () => {
  test("exports the settings in effect, the theme, and closed tabs", async () => {
    await chrome.storage.sync.set({
      activeHours: WEEKDAYS_9_TO_5,
      lockedIds: [7],
      lockedWindowIds: [20],
      // Number inputs on the options page are saved as the strings they hold.
      minTabs: "12",
      "persist:settings": { paused: true, theme: "dark" },
      tabRules: TAB_RULES,
    });
    await chrome.storage.local.set({ "persist:localStorage": { ...CLOSED_TABS, installDate: 1 } });

    const blob = await exportData();
    expect(blob.type).toBe("application/json;charset=utf-8");

    expect(await readBlob(blob)).toEqual({
      version: 2,
      settings: {
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
      },
      theme: "dark",
      ...CLOSED_TABS,
    });
  });

  test("exports the rules derived from legacy settings when Tab Rules were never saved", async () => {
    await chrome.storage.sync.set({ minutesInactive: 5, whitelist: ["github.com"] });

    const { settings } = await readBlob(await exportData());

    expect(settings).not.toHaveProperty("whitelist");
    expect(settings).not.toHaveProperty("minutesInactive");
    expect(settings.tabRules?.rules.map(({ then, when }) => ({ then, when }))).toEqual([
      { then: { action: "lock" }, when: [{ type: "pinned" }] },
      { then: { action: "lock" }, when: [{ type: "url", op: "includes", value: "github.com" }] },
      { then: { action: "lock" }, when: [{ type: "audible" }] },
      { then: { action: "stale", afterSeconds: 300, save: "corral" }, when: [] },
    ]);
  });

  test("exports an empty list of closed tabs when none were ever saved", async () => {
    expect((await readBlob(await exportData())).savedTabs).toEqual([]);
  });

  test("leaves closed tabs out when asked to", async () => {
    await chrome.storage.local.set({ "persist:localStorage": CLOSED_TABS });

    const file = await readBlob(await exportData({ includeClosedTabs: false }));

    expect(file).not.toHaveProperty("savedTabs");
    expect(file).not.toHaveProperty("totalTabsWrangled");
    expect(file.settings.minTabs).toBe(20);
  });

  test("generates a unique file name based on a given date", () => {
    const date = new Date("2017-04-10 00:00:00 GMT");
    const uniqueFileName = exportFileName(date);
    expect(uniqueFileName).toBe("TabWranglerExport-2017-04-10.json");
  });
});

// Versions before 2 import any file with 4 or more top-level keys as closed tabs, reading
// `savedTabs` and the three counters from the top level.
describe("files read by versions before 2", () => {
  test("an export without closed tabs has too few keys for them to accept", async () => {
    const file = await readBlob(await exportData({ includeClosedTabs: false }));
    expect(Object.keys(file).length).toBeLessThan(4);
  });

  test("an export with closed tabs keeps them where those versions read them", async () => {
    await chrome.storage.local.set({ "persist:localStorage": CLOSED_TABS });
    const file = await readBlob(await exportData());
    expect(file).toEqual(expect.objectContaining(CLOSED_TABS));
  });
});

describe("parseImport", () => {
  const file = (fields: Record<string, unknown> = {}) => ({ version: EXPORT_VERSION, ...fields });

  test("reads a file from before version 2 as closed tabs only", () => {
    expect(parse(CLOSED_TABS)).toEqual({
      closedTabs: CLOSED_TABS,
      settings: {},
      skippedSettings: [],
      theme: null,
    });
  });

  test("reads settings, the theme and closed tabs from a version 2 file", () => {
    const settings = { activeHours: WEEKDAYS_9_TO_5, minTabs: 3, tabRules: TAB_RULES };
    expect(parse(file({ settings, theme: "light", ...CLOSED_TABS }))).toEqual({
      closedTabs: CLOSED_TABS,
      settings,
      skippedSettings: [],
      theme: "light",
    });
  });

  test("reads a file without closed tabs as having none to import", () => {
    expect(parse(file({ settings: { minTabs: 3 } })).closedTabs).toBeNull();
  });

  test("keeps closed tabs' counters that are missing from the file out of the import", () => {
    expect(parse({ savedTabs: [], totalTabsWrangled: 4 }).closedTabs).toEqual({
      savedTabs: [],
      totalTabsWrangled: 4,
    });
  });

  test("reads counts the options page stored as strings as numbers", () => {
    expect(parse(file({ settings: { maxTabs: "500", minTabs: "12" } })).settings).toEqual({
      maxTabs: 500,
      minTabs: 12,
    });
  });

  describe("a file from a newer version", () => {
    test("skips settings this version does not have and imports the rest", () => {
      const parsed = parse(file({ settings: { fromTheFuture: { anything: 1 }, minTabs: 3 } }));
      expect(parsed.settings).toEqual({ minTabs: 3 });
      expect(parsed.skippedSettings).toEqual(["fromTheFuture"]);
    });

    test("skips a setting whose value this version does not recognize", () => {
      const parsed = parse(
        file({ settings: { minTabs: 3, wrangleOption: "newerOption" }, theme: "sepia" }),
      );
      expect(parsed.settings).toEqual({ minTabs: 3 });
      expect(parsed.theme).toBeNull();
      expect(parsed.skippedSettings).toEqual(["wrangleOption", "theme"]);
    });

    test("keeps Tab Rules with conditions and actions this version does not know", () => {
      const tabRules = {
        version: 1,
        rules: [
          {
            id: "newer",
            match: "every",
            when: [{ type: "url", op: "includes", value: "learn.example.com" }, { type: "active" }],
            then: { action: "pauseTimers" },
          },
          ...TAB_RULES.rules,
        ],
      };
      const parsed = parse(file({ settings: { tabRules } }));
      expect(parsed.settings.tabRules).toEqual(tabRules);
      expect(parsed.skippedSettings).toEqual([]);
    });

    test("skips Tab Rules in a newer rules format", () => {
      const parsed = parse(file({ settings: { minTabs: 3, tabRules: { version: 2, rules: [] } } }));
      expect(parsed.settings).toEqual({ minTabs: 3 });
      expect(parsed.skippedSettings).toEqual(["tabRules"]);
    });

    test("refuses a newer file format", () => {
      expect(() => parse(file({ version: 3, settings: { minTabs: 3 } }))).toThrow(NEWER_VERSION);
    });
  });

  test("skips settings that are not exported, like locked tab IDs and legacy rule settings", () => {
    const parsed = parse(
      file({ settings: { lockedIds: [1], minTabs: 3, paused: false, whitelist: ["a"] } }),
    );
    expect(parsed.settings).toEqual({ minTabs: 3 });
    expect(parsed.skippedSettings).toEqual(["lockedIds", "paused", "whitelist"]);
  });

  test.each<[string, unknown]>([
    ["minTabs", -1],
    ["minTabs", "many"],
    ["maxTabs", 0],
    ["showBadgeCount", "yes"],
    ["minTabsStrategy", "everyWindow"],
    ["wrangleOption", null],
    ["lockTabSortOrder", "random"],
    ["activeHours", [{ dayOfWeek: 8, startMinute: 0, endMinute: 60 }]],
    ["tabRules", { version: 1, rules: [{ id: "a", match: "every", when: [], then: {} }] }],
  ])("skips an invalid %s", (name, value) => {
    const parsed = parse(file({ settings: { [name]: value, purgeClosedTabs: true } }));
    expect(parsed.settings).toEqual({ purgeClosedTabs: true });
    expect(parsed.skippedSettings).toEqual([name]);
  });

  test("skips Tab Rules too large for one sync storage item", () => {
    const rules = Array.from({ length: 200 }, (_, i) => ({
      id: `rule${i}`,
      match: "every",
      when: [{ type: "url", op: "includes", value: `https://example.com/a/long/path/${i}` }],
      then: { action: "lock" },
    }));
    const parsed = parse(file({ settings: { minTabs: 3, tabRules: { version: 1, rules } } }));
    expect(parsed.settings).toEqual({ minTabs: 3 });
    expect(parsed.skippedSettings).toEqual(["tabRules"]);
  });

  test("skips maxTabs over what this browser's storage allows", () => {
    const parsed = parse(file({ settings: { maxTabs: 9000, minTabs: 3 } }));
    expect(parsed.settings).toEqual({ minTabs: 3 });
    expect(parsed.skippedSettings).toEqual(["maxTabs"]);
  });

  test("skips turning on pausing while idle without the browser permission", () => {
    const settings = { pauseWhenIdle: true };
    expect(parse(file({ settings, theme: "dark" }), { hasIdlePermission: false })).toEqual({
      closedTabs: null,
      settings: {},
      skippedSettings: ["pauseWhenIdle"],
      theme: "dark",
    });
    expect(parse(file({ settings })).settings).toEqual(settings);
    expect(
      parse(file({ settings: { pauseWhenIdle: false } }), { hasIdlePermission: false }).settings,
    ).toEqual({ pauseWhenIdle: false });
  });

  test.each<[string, unknown]>([
    ["a JSON value that is not an object", [1, 2, 3]],
    ["a file from before version 2 without closed tabs", { totalTabsRemoved: 256 }],
    ["closed tabs that are not a list", { ...CLOSED_TABS, savedTabs: "none" }],
    ["a closed tab that is not an object", file({ savedTabs: ["https://example.com"] })],
    ["a counter that is not a number", file({ ...CLOSED_TABS, totalTabsRemoved: "many" })],
    ["a version that is not a number", file({ version: "2", settings: { minTabs: 3 } })],
    ["an older numbered version", file({ version: 1, settings: { minTabs: 3 } })],
    ["settings that are not an object", file({ settings: [] })],
    ["a file with nothing this version can use", file({ settings: { fromTheFuture: 1 } })],
    ["an empty version 2 file", file()],
  ])("refuses %s", (_label, json) => {
    expect(() => parse(json)).toThrow(INVALID_FILE);
  });
});

describe("readImportFile", () => {
  test("reads a file without importing anything", async () => {
    await chrome.storage.local.set({ "persist:localStorage": LOCAL_CLOSED_TABS });

    const parsed = await readImportFile(
      fileEvent({ version: 2, settings: { minTabs: 3 }, ...CLOSED_TABS }),
    );

    expect(parsed.settings).toEqual({ minTabs: 3 });
    expect(parsed.closedTabs).toEqual(CLOSED_TABS);
    expect(await chrome.storage.local.get(null)).toEqual({
      "persist:localStorage": LOCAL_CLOSED_TABS,
    });
  });

  test("checks pausing while idle against the browser permission", async () => {
    (chrome.permissions.contains as jest.Mock).mockResolvedValue(false);
    const parsed = await readImportFile(
      fileEvent({ version: 2, settings: { minTabs: 3, pauseWhenIdle: true } }),
    );
    expect(parsed.skippedSettings).toEqual(["pauseWhenIdle"]);
  });

  test("refuses text that is not JSON", async () => {
    await expect(readImportFile(fileEvent("{345:}"))).rejects.toThrow(INVALID_FILE);
  });

  test("fails when no file was chosen", async () => {
    await expect(
      readImportFile({
        target: { files: [] },
      } as unknown as React.FormEvent<HTMLInputElement>),
    ).rejects.toThrow("Nothing to import");
  });
});

describe("applyImport", () => {
  const parsedImport = (fields: Partial<ParsedImport> = {}): ParsedImport => ({
    closedTabs: null,
    settings: {},
    skippedSettings: [],
    theme: null,
    ...fields,
  });

  async function storedClosedTabs() {
    const { "persist:localStorage": data } = await chrome.storage.local.get("persist:localStorage");
    return data;
  }

  test("restores an export in a browser with default settings", async () => {
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
    await chrome.storage.local.set({ "persist:localStorage": CLOSED_TABS });
    const exported = await readBlob(await exportData());

    await chrome.storage.local.clear();
    resetSettings();
    await applyImport(await readImportFile(fileEvent(exported)), { replaceClosedTabs: true });

    expect(Settings.get("activeHours")).toEqual(WEEKDAYS_9_TO_5);
    expect(Settings.get("maxTabs")).toBe(500);
    expect(Settings.get("minTabs")).toBe(12);
    expect(Settings.get("minTabsStrategy")).toBe("allWindows");
    expect(Settings.get("showBadgeCount")).toBe(true);
    expect(Settings.get("tabRules")).toEqual(TAB_RULES);
    expect(Settings.get("wrangleOption")).toBe("exactURLMatch");
    expect((await chrome.storage.sync.get("persist:settings"))["persist:settings"].theme).toBe(
      "light",
    );
    expect(await storedClosedTabs()).toEqual(CLOSED_TABS);
  });

  test("keeps settings missing from the file", async () => {
    await chrome.storage.sync.set({ minTabs: 7, showBadgeCount: true });

    await applyImport(parsedImport({ settings: { minTabs: 3 } }), { replaceClosedTabs: false });

    expect(Settings.get("minTabs")).toBe(3);
    expect(Settings.get("showBadgeCount")).toBe(true);
  });

  test.each([
    ["paused", true],
    ["running", false],
  ])("leaves a %s Tab Wrangler as it is", async (_label, paused) => {
    await chrome.storage.sync.set({ "persist:settings": { paused, theme: "dark" } });

    await applyImport(parsedImport({ settings: { minTabs: 3 }, theme: "light" }), {
      replaceClosedTabs: false,
    });

    const { "persist:settings": persisted } = await chrome.storage.sync.get("persist:settings");
    expect(persisted).toEqual({ paused, theme: "light" });
  });

  describe("with closed tabs in this browser", () => {
    beforeEach(async () => {
      await chrome.storage.local.set({
        "persist:localStorage": { ...LOCAL_CLOSED_TABS, installDate: 1 },
      });
    });

    test("keeps them unless asked to replace them", async () => {
      await applyImport(parsedImport({ closedTabs: CLOSED_TABS, settings: { minTabs: 3 } }), {
        replaceClosedTabs: false,
      });

      expect(await storedClosedTabs()).toEqual({ ...LOCAL_CLOSED_TABS, installDate: 1 });
      expect(Settings.get("minTabs")).toBe(3);
    });

    test("replaces them with the file's when asked to", async () => {
      await applyImport(parsedImport({ closedTabs: CLOSED_TABS }), { replaceClosedTabs: true });

      expect(await storedClosedTabs()).toEqual({ ...CLOSED_TABS, installDate: 1 });
    });

    test("keeps this browser's counters that the file does not have", async () => {
      await applyImport(parsedImport({ closedTabs: { savedTabs: CLOSED_TABS.savedTabs } }), {
        replaceClosedTabs: true,
      });

      expect(await storedClosedTabs()).toEqual({
        ...LOCAL_CLOSED_TABS,
        installDate: 1,
        savedTabs: CLOSED_TABS.savedTabs,
      });
    });

    test.each<[string, ParsedImport["closedTabs"]]>([
      ["has none", null],
      ["has an empty list of them", { ...CLOSED_TABS, savedTabs: [] }],
    ])("never replaces them from a file that %s", async (_label, closedTabs) => {
      await applyImport(parsedImport({ closedTabs }), { replaceClosedTabs: true });

      expect(await storedClosedTabs()).toEqual({ ...LOCAL_CLOSED_TABS, installDate: 1 });
    });
  });
});
