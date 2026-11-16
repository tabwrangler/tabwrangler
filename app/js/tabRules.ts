/*
 * Tab Rules are evaluated top-to-bottom and the first rule that matches a tab decides its outcome.
 * A rule matches when all of its conditions match, or any of them with `match: "some"`. A rule
 * with no conditions matches every tab. A tab that matches no rule is never locked or made stale.
 */

import tabGroupTitles from "./tabGroupTitles";

export const TAB_RULES_VERSION = 1;
export const DEFAULT_STALE_AFTER_SECONDS = 60 * 60;

export interface TabRulesConfig {
  version: 1;
  rules: TabRule[];
}

export interface TabRule {
  id: string;
  match: "every" | "some";
  when: TabCondition[];
  then: RuleOutcome;
}

export type TabCondition =
  | { type: "audible" }
  | { type: "groupId"; op: "none" | "some" }
  | { type: "groupTitle"; op: "includes"; value: string }
  | { type: "pinned" }
  | { type: "title"; op: "includes"; value: string }
  | { type: "url"; op: "includes"; value: string };

export type RuleOutcome =
  | { action: "lock" }
  | { action: "stale"; afterSeconds: number; save: "corral" | "none" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Kept beside `TabCondition` so a new condition type is added to both together.
function isTabCondition(value: unknown): boolean {
  if (!isRecord(value)) return false;
  switch (value.type as TabCondition["type"]) {
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
      // A condition from a newer version. It never matches here: see `matchesCondition`.
      return typeof value.type === "string";
  }
}

// Kept beside `RuleOutcome` so a new action is added to both together.
function isRuleOutcome(value: unknown): boolean {
  if (!isRecord(value)) return false;
  switch (value.action as RuleOutcome["action"]) {
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
      // An action from a newer version. Its tabs are neither locked nor made stale here.
      return typeof value.action === "string";
  }
}

/**
 * Whether a value from outside the extension, like an imported file, can be stored as Tab Rules.
 * Conditions and actions this version knows must be well formed. Ones it does not know are let
 * through as long as they have the shape of one: rules written by a newer version also arrive
 * through sync storage, where they have no effect until this version catches up, and dropping them
 * would let their tabs fall through to a rule that closes them.
 */
export function isTabRulesConfig(value: unknown): value is TabRulesConfig {
  return (
    isRecord(value) &&
    value.version === TAB_RULES_VERSION &&
    Array.isArray(value.rules) &&
    value.rules.every(
      (rule) =>
        isRecord(rule) &&
        typeof rule.id === "string" &&
        (rule.match === "every" || rule.match === "some") &&
        Array.isArray(rule.when) &&
        rule.when.every(isTabCondition) &&
        isRuleOutcome(rule.then),
    )
  );
}

export function generateRuleId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function matchesCondition(condition: TabCondition, tab: chrome.tabs.Tab): boolean {
  switch (condition.type) {
    case "url":
      return condition.op === "includes" && tab.url != null && tab.url.includes(condition.value);
    case "title":
      return (
        condition.op === "includes" && tab.title != null && tab.title.includes(condition.value)
      );
    case "audible":
      return tab.audible === true;
    case "groupId": {
      const grouped = "groupId" in tab && tab.groupId > 0;
      return condition.op === "some" ? grouped : !grouped;
    }
    case "groupTitle": {
      const title = "groupId" in tab && tab.groupId > 0 ? tabGroupTitles.get(tab.groupId) : null;
      return condition.op === "includes" && title != null && title.includes(condition.value);
    }
    case "pinned":
      return tab.pinned;
    default:
      condition satisfies never;
      return false;
  }
}

function matchesRule(rule: TabRule, tab: chrome.tabs.Tab): boolean {
  if (rule.when.length === 0) return true;
  return rule.match === "some"
    ? rule.when.some((condition) => matchesCondition(condition, tab))
    : rule.when.every((condition) => matchesCondition(condition, tab));
}

export function findMatchingRule(tab: chrome.tabs.Tab, config: TabRulesConfig): TabRule | null {
  return config.rules.find((rule) => matchesRule(rule, tab)) ?? null;
}

export function getTabOutcome(tab: chrome.tabs.Tab, config: TabRulesConfig): RuleOutcome | null {
  return findMatchingRule(tab, config)?.then ?? null;
}

// The final "Else" rule: the last rule, when it matches every tab.
export function findElseRule(config: TabRulesConfig): TabRule | null {
  const rule = config.rules[config.rules.length - 1];
  return rule != null && rule.when.length === 0 ? rule : null;
}

/**
 * Ensures the rules end with an "Else" rule so every tab has an outcome. Rules without one, like
 * an empty list from an import or a manual edit, leave unmatched tabs open forever, so the added
 * rule locks them: behavior stays the same and the UI can show and edit it.
 */
export function withElseRule(config: TabRulesConfig): TabRulesConfig {
  if (findElseRule(config) != null) return config;
  return {
    ...config,
    rules: [
      ...config.rules,
      { id: generateRuleId(), match: "every", when: [], then: { action: "lock" } },
    ],
  };
}

/**
 * Milliseconds a tab may stay inactive before it is stale; `Infinity` when its rule never makes it
 * stale. Without a tab, returns the longest stale timeout of any rule so callers clamping all tab
 * times never cut a tab's time short.
 */
export function getStaleAfterMs(config: TabRulesConfig, tab?: chrome.tabs.Tab): number {
  if (tab != null) {
    const outcome = getTabOutcome(tab, config);
    return outcome?.action === "stale" ? outcome.afterSeconds * 1000 : Infinity;
  }
  const staleSeconds = config.rules.flatMap((rule) =>
    rule.then.action === "stale" ? [rule.then.afterSeconds] : [],
  );
  return staleSeconds.length > 0 ? Math.max(...staleSeconds) * 1000 : Infinity;
}

// Whether a tab closed under its rule goes to the corral. Tabs whose rule doesn't make them stale,
// like ones closed by hand, are always saved.
export function shouldSaveToCorral(tab: chrome.tabs.Tab, config: TabRulesConfig): boolean {
  const outcome = getTabOutcome(tab, config);
  return outcome?.action !== "stale" || outcome.save === "corral";
}

export function isUrlIncludesRule(
  rule: TabRule,
): rule is TabRule & { when: [{ type: "url"; op: "includes"; value: string }] } {
  return (
    rule.when.length === 1 &&
    rule.when[0].type === "url" &&
    rule.when[0].op === "includes" &&
    rule.then.action === "lock"
  );
}

export function createLockRule(condition: TabCondition): TabRule {
  return {
    id: generateRuleId(),
    match: "every",
    when: [condition],
    then: { action: "lock" },
  };
}

export function createUrlIncludesRule(value: string): TabRule {
  return createLockRule({ type: "url", op: "includes", value });
}

export interface LegacyRuleSettings {
  filterAudio: unknown;
  filterGroupedTabs: unknown;
  minutesInactive: unknown;
  secondsInactive: unknown;
  whitelist: unknown;
}

export const LEGACY_RULE_SETTINGS: readonly (keyof LegacyRuleSettings)[] = [
  "filterAudio",
  "filterGroupedTabs",
  "minutesInactive",
  "secondsInactive",
  "whitelist",
];

/**
 * Builds Tab Rules equivalent to the settings that preceded them: pinned tabs, then each whitelist
 * entry, then audio, then tab groups, then a final rule making every other tab stale after the
 * inactive timeout. Audio and tab group toggles that were off become no rule at all. New installs
 * get the rules built from the default settings.
 */
export function buildTabRulesFromLegacySettings(legacy: LegacyRuleSettings): TabRulesConfig {
  const whitelist = Array.isArray(legacy.whitelist)
    ? legacy.whitelist.filter((entry): entry is string => typeof entry === "string")
    : [];

  // Older versions may have stored the timeout as strings, so coerce like `stayOpen` always has.
  const afterSeconds = Math.round(
    Number(legacy.minutesInactive) * 60 + Number(legacy.secondsInactive),
  );

  return {
    version: TAB_RULES_VERSION,
    rules: [
      createLockRule({ type: "pinned" }),
      ...whitelist.map(createUrlIncludesRule),
      ...(legacy.filterAudio ? [createLockRule({ type: "audible" })] : []),
      ...(legacy.filterGroupedTabs ? [createLockRule({ type: "groupId", op: "some" })] : []),
      {
        id: generateRuleId(),
        match: "every",
        when: [],
        then: {
          action: "stale",
          afterSeconds:
            Number.isFinite(afterSeconds) && afterSeconds >= 0
              ? afterSeconds
              : DEFAULT_STALE_AFTER_SECONDS,
          save: "corral",
        },
      },
    ],
  };
}
