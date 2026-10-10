/*
 * Tab Rules are evaluated top-to-bottom and the first enabled rule that matches a tab decides its
 * outcome. A rule matches when all of its conditions match, or any of them with `match: "some"`. A
 * rule with no conditions matches every tab. A tab that matches no rule is never locked or made
 * stale.
 */

export const TAB_RULES_VERSION = 1;
export const DEFAULT_STALE_AFTER_SECONDS = 60 * 60;

export interface TabRulesConfig {
  version: 1;
  rules: TabRule[];
}

export interface TabRule {
  id: string;
  enabled: boolean;
  match: "every" | "some";
  when: TabCondition[];
  then: RuleOutcome;
}

export type TabCondition =
  | { type: "audible" }
  | { type: "groupId"; op: "none" | "some" }
  | { type: "pinned" }
  | { type: "url"; op: "includes"; value: string };

export type RuleOutcome =
  | { action: "lock" }
  | { action: "stale"; afterSeconds: number; save: "corral" | "none" };

export function generateRuleId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function matchesCondition(condition: TabCondition, tab: chrome.tabs.Tab): boolean {
  switch (condition.type) {
    case "url":
      return condition.op === "includes" && tab.url != null && tab.url.includes(condition.value);
    case "audible":
      return tab.audible === true;
    case "groupId": {
      const grouped = "groupId" in tab && tab.groupId > 0;
      return condition.op === "some" ? grouped : !grouped;
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
  return config.rules.find((rule) => rule.enabled && matchesRule(rule, tab)) ?? null;
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
      { id: generateRuleId(), enabled: true, match: "every", when: [], then: { action: "lock" } },
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
    enabled: true,
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
        enabled: true,
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
