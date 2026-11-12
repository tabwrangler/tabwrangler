import { type ActiveHours, DAYS_OF_WEEK, MINUTES_PER_DAY } from "../activeHours";
import {
  type RuleOutcome,
  TAB_RULES_VERSION,
  type TabCondition,
  type TabRule,
  type TabRulesConfig,
} from "../tabRules";
import settings, { type SettingsSchema } from "../settings";
import { getStorageSyncPersist } from "../queries";
import { mutateStorageSyncPersist } from "../storage";

export const SETTINGS_EXPORT_TYPE = "tabwrangler-settings";
export const SETTINGS_EXPORT_VERSION = 1;

const THEMES = ["dark", "light", "system"] as const;
type Theme = (typeof THEMES)[number];

/**
 * Settings written to a settings export. Left out on purpose:
 *
 * - `lockedIds` / `lockedWindowIds`: browser tab and window IDs, meaningless in another browser or
 *   after a restart. Locked tabs and the tabs of locked windows are exported by URL instead; see
 *   `LockedTabExport` and `LockedWindowExport`.
 * - `filterAudio`, `filterGroupedTabs`, `minutesInactive`, `secondsInactive`, `whitelist`:
 *   superseded by `tabRules`, which is exported as the rules in effect.
 */
type ExportedSettings = Pick<
  SettingsSchema,
  | "activeHours"
  | "corralTabSortOrder"
  | "createContextMenu"
  | "debounceOnActivated"
  | "lockTabSortOrder"
  | "maxTabs"
  | "minTabs"
  | "minTabsStrategy"
  | "pauseWhenIdle"
  | "purgeClosedTabs"
  | "showBadgeCount"
  | "tabRules"
  | "wrangleOption"
>;
type ExportedSettingKey = keyof ExportedSettings;

interface LockedTabExport {
  title?: string;
  url: string;
}

// A locked window is not a set of locked tabs: its tabs are locked only through the window, as are
// tabs opened in it later. Windows have no identity outside their browser, so one is exported as
// the tabs it holds.
interface LockedWindowExport {
  tabs: LockedTabExport[];
}

interface SettingsExportData {
  exportedAt: string;
  // Tabs locked by hand, by URL. Importing locks the open tabs with the same URLs.
  lockedTabs: LockedTabExport[];
  // Importing locks a window again when one holds every tab of an exported window. Otherwise the
  // window's tabs that are open are locked one by one, so none of them loses its lock.
  lockedWindows: LockedWindowExport[];
  settings: Partial<ExportedSettings>;
  theme?: Theme;
}

/**
 * The settings export file. It has exactly 3 top-level keys on purpose: the closed tabs import
 * (`importData`) rejects any file with fewer than 4, so choosing a settings file there, in this or
 * any earlier version, is refused instead of erasing the Tab Corral.
 */
export interface SettingsExport {
  type: typeof SETTINGS_EXPORT_TYPE;
  version: typeof SETTINGS_EXPORT_VERSION;
  data: SettingsExportData;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isOneOf<T extends string>(options: readonly T[]) {
  return (value: unknown): value is T => options.includes(value as T);
}

function isNullOr<T>(isValid: (value: unknown) => value is T) {
  return (value: unknown): value is T | null => value === null || isValid(value);
}

// At most one window per day, each within the day and not empty. An empty list is valid: Tab
// Wrangler is then never active.
function isActiveHours(value: unknown): value is ActiveHours {
  if (!Array.isArray(value)) return false;
  const days = new Set<number>();
  return value.every((window) => {
    if (!isObject(window)) return false;
    const { dayOfWeek, endMinute, startMinute } = window;
    if (!DAYS_OF_WEEK.includes(dayOfWeek as never) || days.has(dayOfWeek as number)) return false;
    days.add(dayOfWeek as number);
    return (
      isInteger(startMinute, 0, MINUTES_PER_DAY) &&
      isInteger(endMinute, 0, MINUTES_PER_DAY) &&
      startMinute < endMinute
    );
  });
}

function isTabCondition(value: unknown): value is TabCondition {
  if (!isObject(value)) return false;
  switch (value.type) {
    case "audible":
    case "pinned":
      return true;
    case "groupId":
      return value.op === "none" || value.op === "some";
    case "groupTitle":
    case "title":
    case "url":
      return value.op === "includes" && typeof value.value === "string";
    default:
      return false;
  }
}

function isRuleOutcome(value: unknown): value is RuleOutcome {
  if (!isObject(value)) return false;
  switch (value.action) {
    case "lock":
      return true;
    case "stale":
      return (
        typeof value.afterSeconds === "number" &&
        Number.isFinite(value.afterSeconds) &&
        // 0 is not offered by the options page but rules migrated from legacy settings can have it.
        value.afterSeconds >= 0 &&
        (value.save === "corral" || value.save === "none")
      );
    default:
      return false;
  }
}

function isTabRule(value: unknown): value is TabRule {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    (value.match === "every" || value.match === "some") &&
    Array.isArray(value.when) &&
    value.when.every(isTabCondition) &&
    isRuleOutcome(value.then)
  );
}

function isTabRules(value: unknown): value is TabRulesConfig {
  if (!isObject(value) || value.version !== TAB_RULES_VERSION || !Array.isArray(value.rules))
    return false;
  if (!value.rules.every(isTabRule)) return false;

  // Larger than one sync storage item can hold: writing it would reject after other settings were
  // already imported.
  const bytes = new TextEncoder().encode(`tabRules${JSON.stringify(value)}`).length;
  return bytes <= (chrome.storage.sync.QUOTA_BYTES_PER_ITEM ?? 8192);
}

const SETTING_VALIDATORS: { [K in ExportedSettingKey]: (value: unknown) => boolean } = {
  activeHours: isActiveHours,
  corralTabSortOrder: isNullOr((value): value is string => typeof value === "string"),
  createContextMenu: isBoolean,
  debounceOnActivated: isBoolean,
  lockTabSortOrder: isNullOr(
    isOneOf(["alpha", "chrono", "reverseAlpha", "reverseChrono", "reverseTabOrder", "tabOrder"]),
  ),
  maxTabs: (value) => isInteger(value, 1),
  minTabs: (value) => isInteger(value, 0),
  minTabsStrategy: isOneOf(["allWindows", "givenWindow"]),
  pauseWhenIdle: isBoolean,
  purgeClosedTabs: isBoolean,
  showBadgeCount: isBoolean,
  tabRules: isTabRules,
  wrangleOption: isOneOf(["exactURLMatch", "hostnameAndTitleMatch", "withDupes"]),
};

const EXPORTED_SETTING_KEYS = Object.keys(SETTING_VALIDATORS) as ExportedSettingKey[];

// The options page saves number inputs as the strings they hold, so stored counts can be "20"
// rather than 20. Exports and imports both use the number.
const COUNT_SETTING_KEYS: readonly string[] = ["maxTabs", "minTabs"] satisfies ExportedSettingKey[];
function normalizeSetting(key: string, value: unknown): unknown {
  return COUNT_SETTING_KEYS.includes(key) && typeof value === "string" && value.trim() !== ""
    ? Number(value)
    : value;
}

function isLockedTabs(value: unknown): value is LockedTabExport[] {
  return Array.isArray(value) && value.every((tab) => isObject(tab) && typeof tab.url === "string");
}

function toLockedTabExport({ title, url }: { title?: unknown; url: string }): LockedTabExport {
  return { ...(typeof title === "string" ? { title } : {}), url };
}

function invalidFileError(): Error {
  return new Error(
    chrome.i18n.getMessage("options_importExportSettings_error_invalidFile") ||
      "This is not a Tab Wrangler settings file.",
  );
}

function invalidSettingError(name: string): Error {
  return new Error(
    chrome.i18n.getMessage("options_importExportSettings_error_invalidSetting", [name]) ||
      `The settings file has an invalid value for "${name}". Nothing was imported.`,
  );
}

/**
 * Checks a parsed settings file and returns only what is known and valid. Settings missing from the
 * file are left out and keep their current values on import; unknown ones are ignored so files from
 * newer versions still import. Any known setting with an invalid value rejects the whole file, so
 * an import is never applied in part.
 */
export function parseSettingsExport(json: unknown): SettingsExportData {
  if (
    !isObject(json) ||
    json.type !== SETTINGS_EXPORT_TYPE ||
    json.version !== SETTINGS_EXPORT_VERSION ||
    !isObject(json.data) ||
    !isObject(json.data.settings)
  )
    throw invalidFileError();

  const { data } = json;
  const stored = data.settings as Record<string, unknown>;
  const nextSettings: Record<string, unknown> = {};
  for (const key of EXPORTED_SETTING_KEYS) {
    if (!(key in stored)) continue;
    const value = normalizeSetting(key, stored[key]);
    if (!SETTING_VALIDATORS[key](value)) throw invalidSettingError(key);
    nextSettings[key] = value;
  }

  if (data.theme != null && !isOneOf(THEMES)(data.theme)) throw invalidSettingError("theme");

  const lockedTabs = data.lockedTabs ?? [];
  if (!isLockedTabs(lockedTabs)) throw invalidSettingError("lockedTabs");

  const lockedWindows = data.lockedWindows ?? [];
  if (
    !Array.isArray(lockedWindows) ||
    !lockedWindows.every((window) => isObject(window) && isLockedTabs(window.tabs))
  )
    throw invalidSettingError("lockedWindows");

  return {
    exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : "",
    lockedTabs: lockedTabs.map(toLockedTabExport),
    lockedWindows: lockedWindows
      .map((window) => ({ tabs: (window.tabs as LockedTabExport[]).map(toLockedTabExport) }))
      .filter((window) => window.tabs.length > 0),
    settings: nextSettings as Partial<ExportedSettings>,
    ...(data.theme != null ? { theme: data.theme } : {}),
  };
}

async function applySettingsExport(data: SettingsExportData): Promise<void> {
  await settings.init();

  // `maxTabs` first: it is the only setting whose setter can still reject a validated value (the
  // limit depends on this browser's storage quota), and nothing has been written yet if it does.
  const keys = EXPORTED_SETTING_KEYS.filter((key) => key in data.settings).sort(
    (a, b) => Number(b === "maxTabs") - Number(a === "maxTabs"),
  );

  // Through `settings.set` so each setting's own setter runs, like creating the context menu, and
  // one at a time so every write is a single small sync storage item.
  for (const key of keys) await settings.set(key, data.settings[key] as never);

  // The paused state is in the same sync item as the theme but is never imported: importing
  // settings must not start a paused Tab Wrangler or pause a running one.
  if (data.theme != null) await mutateStorageSyncPersist({ key: "theme", value: data.theme });

  if (data.lockedTabs.length > 0 || data.lockedWindows.length > 0) {
    const tabs = await chrome.tabs.query({});
    const urlsByWindowId = new Map<number, Set<string>>();
    for (const tab of tabs) {
      if (tab.url == null) continue;
      const urls = urlsByWindowId.get(tab.windowId) ?? new Set<string>();
      urlsByWindowId.set(tab.windowId, urls.add(tab.url));
    }

    const lockedUrls = new Set(data.lockedTabs.map((tab) => tab.url));
    const windowIdsToLock: number[] = [];
    for (const lockedWindow of data.lockedWindows) {
      const urls = lockedWindow.tabs.map((tab) => tab.url);
      const windowIds = [...urlsByWindowId]
        .filter(([, openUrls]) => urls.every((url) => openUrls.has(url)))
        .map(([windowId]) => windowId);
      if (windowIds.length > 0) windowIdsToLock.push(...windowIds);
      else urls.forEach((url) => lockedUrls.add(url));
    }

    const tabsToLock = tabs.filter((tab) => tab.url != null && lockedUrls.has(tab.url));
    if (tabsToLock.length > 0) await settings.lockTabs(tabsToLock);
    if (windowIdsToLock.length > 0) await settings.lockWindows(windowIdsToLock);
  }
}

function readFileAsText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.onload = () => resolve(String(fileReader.result));
    fileReader.onerror = () => reject(fileReader.error ?? invalidFileError());
    fileReader.readAsText(file, "utf-8");
  });
}

/**
 * Imports a settings file made by `exportSettings`, replacing the current value of every setting
 * in the file. Closed tabs, statistics and the paused state are not touched.
 *
 * @param event contains the path of the settings file
 */
export async function importSettings(event: React.FormEvent<HTMLInputElement>): Promise<void> {
  const files = (event.target as HTMLInputElement).files;
  if (files == null || !files[0]) throw new Error("Nothing to import");

  let json: unknown;
  try {
    json = JSON.parse(await readFileAsText(files[0]));
  } catch {
    throw invalidFileError();
  }

  await applySettingsExport(parseSettingsExport(json));
}

/**
 * Exports the settings in effect, the theme, and the URLs of tabs locked by hand or through their
 * window. Closed tabs and
 * statistics are exported separately by `exportData`.
 */
export async function exportSettings(): Promise<Blob> {
  await settings.init();
  const [{ theme }, tabs] = await Promise.all([getStorageSyncPersist(), chrome.tabs.query({})]);

  const exportableTabs = tabs.filter(
    (tab): tab is chrome.tabs.Tab & { url: string } => tab.url != null,
  );
  const lockedIds = new Set(settings.get("lockedIds"));
  const lockedTabs = exportableTabs
    .filter((tab) => tab.id != null && lockedIds.has(tab.id))
    .map(toLockedTabExport);
  const lockedWindows = settings
    .get("lockedWindowIds")
    .map((windowId) => ({
      tabs: exportableTabs.filter((tab) => tab.windowId === windowId).map(toLockedTabExport),
    }))
    .filter((window) => window.tabs.length > 0);

  const settingsExport: SettingsExport = {
    type: SETTINGS_EXPORT_TYPE,
    version: SETTINGS_EXPORT_VERSION,
    data: {
      exportedAt: new Date(Date.now()).toISOString(),
      lockedTabs,
      lockedWindows,
      settings: Object.fromEntries(
        EXPORTED_SETTING_KEYS.map((key) => [key, normalizeSetting(key, settings.get(key))]),
      ) as ExportedSettings,
      theme,
    },
  };

  return new Blob([JSON.stringify(settingsExport, null, 2)], {
    type: "application/json;charset=utf-8",
  });
}

export const settingsExportFileName = (date: Date): string =>
  // Use a format like YYYY-MM-DD, which is the first 10 characters of the ISO string format.
  `TabWranglerSettings-${date.toISOString().slice(0, 10)}.json`;
