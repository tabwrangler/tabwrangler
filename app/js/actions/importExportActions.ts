import { ASYNC_LOCK, mutateStorageSyncPersist } from "../storage";
import settings, {
  PORTABLE_SETTING_KEYS,
  type SettingsSchema,
  parsePortableSetting,
} from "../settings";
import { AVERAGE_TAB_BYTES_SIZE } from "../tabUtil";
import { IDLE_PERMISSIONS } from "../constants";
import { getStorageSyncPersist } from "../queries";

export const EXPORT_VERSION = 2;

const THEMES = ["dark", "light", "system"] as const;
type Theme = (typeof THEMES)[number];

// Closed tabs and their counters: the whole export before version 2.
interface ClosedTabsExport {
  savedTabs: chrome.tabs.Tab[];
  totalTabsRemoved?: number;
  totalTabsUnwrangled?: number;
  totalTabsWrangled?: number;
}

/**
 * The export file. Two rules keep files and versions of Tab Wrangler working with each other, and
 * every change to the format must keep them:
 *
 * 1. Versions before 2 import any file with 4 or more top-level keys as closed tabs. So closed tabs
 *    stay at the top level under their original keys, where those versions find them, and a file
 *    without closed tabs has fewer than 4 keys, which they refuse instead of erasing the Tab
 *    Corral. Anything new goes inside `settings`, never beside it.
 * 2. Adding a setting, a rule condition or a rule action does not change `version`. An import
 *    skips settings and values it does not recognize and keeps its own, so a file from a newer
 *    version still imports. `version` changes only when a file can no longer be read this way, and
 *    a file with a newer `version` is refused.
 */
export type ExportFile = Partial<ClosedTabsExport> & {
  version: typeof EXPORT_VERSION;
  settings: Partial<SettingsSchema>;
  theme: Theme;
};

/** What an import file holds that this version can use. Nothing is written until `applyImport`. */
export interface ParsedImport {
  closedTabs: ClosedTabsExport | null;
  settings: Partial<SettingsSchema>;
  // Settings in the file this version cannot use. They keep their current values.
  skippedSettings: string[];
  theme: Theme | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCountOrMissing(value: unknown): boolean {
  return value === undefined || (typeof value === "number" && Number.isFinite(value));
}

function invalidFileError(): Error {
  return new Error(
    chrome.i18n.getMessage("options_importExport_error_invalidFile") ||
      "This is not a Tab Wrangler export file.",
  );
}

function parseClosedTabs(json: Record<string, unknown>): ClosedTabsExport {
  const { savedTabs, totalTabsRemoved, totalTabsUnwrangled, totalTabsWrangled } = json;
  if (
    !Array.isArray(savedTabs) ||
    !savedTabs.every(isRecord) ||
    ![totalTabsRemoved, totalTabsUnwrangled, totalTabsWrangled].every(isCountOrMissing)
  )
    throw invalidFileError();

  // Counters missing from the file are left out, so the current ones are kept.
  return JSON.parse(
    JSON.stringify({ savedTabs, totalTabsRemoved, totalTabsUnwrangled, totalTabsWrangled }),
  );
}

/**
 * Checks a parsed import file and returns what this version can use from it. See `ExportFile` for
 * how files from older and newer versions are read.
 */
export function parseImport(
  json: unknown,
  { hasIdlePermission, maxTabsLimit }: { hasIdlePermission: boolean; maxTabsLimit: number },
): ParsedImport {
  if (!isRecord(json)) throw invalidFileError();

  // Files from before version 2 have no `version` and hold only closed tabs.
  if (!("version" in json)) {
    return { closedTabs: parseClosedTabs(json), settings: {}, skippedSettings: [], theme: null };
  }

  if (typeof json.version === "number" && json.version > EXPORT_VERSION)
    throw new Error(
      chrome.i18n.getMessage("options_importExport_error_newerVersion") ||
        "This file was made by a newer version of Tab Wrangler. Update Tab Wrangler to import it.",
    );
  if (json.version !== EXPORT_VERSION) throw invalidFileError();
  if (json.settings !== undefined && !isRecord(json.settings)) throw invalidFileError();

  const parsed: ParsedImport = {
    closedTabs: "savedTabs" in json ? parseClosedTabs(json) : null,
    settings: {},
    skippedSettings: [],
    theme: null,
  };

  for (const [key, fileValue] of Object.entries(json.settings ?? {})) {
    let value = parsePortableSetting(key, fileValue);

    // Each of these would fail or mislead once stored, so it is skipped like an unknown value:
    // Tab Rules over the size of one sync storage item cannot be written, `maxTabs` over what this
    // browser's storage holds is rejected by its setter, and "pause while idle" without the
    // browser permission, which a file cannot grant, shows as off while storage says on.
    if (
      (key === "tabRules" &&
        value !== undefined &&
        new TextEncoder().encode(`tabRules${JSON.stringify(value)}`).length >
          (chrome.storage.sync.QUOTA_BYTES_PER_ITEM ?? 8192)) ||
      (key === "maxTabs" && typeof value === "number" && value > maxTabsLimit) ||
      (key === "pauseWhenIdle" && value === true && !hasIdlePermission)
    )
      value = undefined;

    if (value === undefined) parsed.skippedSettings.push(key);
    else Object.assign(parsed.settings, { [key]: value });
  }

  if (json.theme !== undefined) {
    if (THEMES.includes(json.theme as Theme)) parsed.theme = json.theme as Theme;
    else parsed.skippedSettings.push("theme");
  }

  if (
    parsed.closedTabs == null &&
    parsed.theme == null &&
    Object.keys(parsed.settings).length === 0
  )
    throw invalidFileError();

  return parsed;
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
 * Reads an export file without importing anything, so what it holds can be shown first.
 *
 * @param event contains the path of the export file
 */
export async function readImportFile(
  event: React.FormEvent<HTMLInputElement>,
): Promise<ParsedImport> {
  const files = (event.target as HTMLInputElement).files;
  if (files == null || !files[0]) throw new Error("Nothing to import");

  let json: unknown;
  try {
    json = JSON.parse(await readFileAsText(files[0]));
  } catch {
    throw invalidFileError();
  }

  return parseImport(json, {
    hasIdlePermission: await chrome.permissions.contains(IDLE_PERMISSIONS),
    maxTabsLimit: Math.floor(settings._getStorageQuota() / AVERAGE_TAB_BYTES_SIZE),
  });
}

/**
 * Imports what `readImportFile` found. Settings in the file replace the current ones; the paused
 * state is not a setting and is never changed. Closed tabs are only replaced when asked to, since
 * the ones in this browser are lost, and never with a file that has none.
 */
export async function applyImport(
  parsed: ParsedImport,
  { replaceClosedTabs }: { replaceClosedTabs: boolean },
): Promise<void> {
  await settings.init();

  // Through `settings.set` so each setting's own setter runs, like creating the context menu.
  for (const key of PORTABLE_SETTING_KEYS)
    if (key in parsed.settings) await settings.set(key, parsed.settings[key] as never);

  if (parsed.theme != null) await mutateStorageSyncPersist({ key: "theme", value: parsed.theme });

  const { closedTabs } = parsed;
  if (replaceClosedTabs && closedTabs != null && closedTabs.savedTabs.length > 0) {
    await ASYNC_LOCK.acquire("persist:localStorage", async () => {
      const data = await chrome.storage.local.get("persist:localStorage");
      await chrome.storage.local.set({
        "persist:localStorage": { ...data["persist:localStorage"], ...closedTabs },
      });
    });
  }
}

/**
 * Exports the settings in effect and the theme and, unless left out, all closed tabs and their
 * counters. See `ExportFile` for why the file is laid out as it is.
 */
export async function exportData({
  includeClosedTabs = true,
}: { includeClosedTabs?: boolean } = {}): Promise<Blob> {
  await settings.init();
  const [{ theme }, data] = await Promise.all([
    getStorageSyncPersist(),
    chrome.storage.local.get("persist:localStorage"),
  ]);
  const localStorage = data["persist:localStorage"] ?? {};

  const exportFile: ExportFile = {
    version: EXPORT_VERSION,
    settings: Object.fromEntries(
      PORTABLE_SETTING_KEYS.map((key) => [key, parsePortableSetting(key, settings.get(key))]),
    ),
    theme,
    ...(includeClosedTabs
      ? {
          savedTabs: localStorage.savedTabs ?? [],
          totalTabsRemoved: localStorage.totalTabsRemoved,
          totalTabsUnwrangled: localStorage.totalTabsUnwrangled,
          totalTabsWrangled: localStorage.totalTabsWrangled,
        }
      : {}),
  };

  return new Blob([JSON.stringify(exportFile)], {
    type: "application/json;charset=utf-8",
  });
}

export const exportFileName = (date: Date): string => {
  // Use a format like YYYY-MM-DD, which is the first 10 characters of the ISO string format.
  const localeDateString = date.toISOString().substr(0, 10);
  return `TabWranglerExport-${localeDateString}.json`;
};
