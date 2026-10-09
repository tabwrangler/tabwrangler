/*
 * Tab Rules are evaluated top-to-bottom and the first enabled rule that matches a tab decides its
 * outcome. A rule matches when all of its conditions match, or any of them with `match: "any"`. A
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
  match: "all" | "any";
  when: TabCondition[];
  then: RuleOutcome;
}

export type TabCondition =
  | { type: "audible" }
  | { type: "groupId"; op: "none" | "some" }
  | { type: "pinned" }
  | { type: "url"; op: "contains"; value: string };

export type RuleOutcome = { action: "lock" } | { action: "stale"; afterSeconds: number };

export function generateRuleId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function matchesCondition(condition: TabCondition, tab: chrome.tabs.Tab): boolean {
  switch (condition.type) {
    case "url":
      return condition.op === "contains" && tab.url != null && tab.url.includes(condition.value);
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
  return rule.match === "any"
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
export function getElseRule(config: TabRulesConfig): TabRule | null {
  const rule = config.rules[config.rules.length - 1];
  return rule != null && rule.when.length === 0 ? rule : null;
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

// Changes when anything that decides a tab's stale timeout changes; lock-only edits leave it alone.
export function getStaleTimeoutsKey(config: TabRulesConfig): string {
  return JSON.stringify(config.rules.filter((rule) => rule.then.action === "stale"));
}

export function isUrlContainsRule(
  rule: TabRule,
): rule is TabRule & { when: [{ type: "url"; op: "contains"; value: string }] } {
  return (
    rule.when.length === 1 &&
    rule.when[0].type === "url" &&
    rule.when[0].op === "contains" &&
    rule.then.action === "lock"
  );
}

export function createLockRule(condition: TabCondition): TabRule {
  return {
    id: generateRuleId(),
    enabled: true,
    match: "all",
    when: [condition],
    then: { action: "lock" },
  };
}

export function createUrlContainsRule(value: string): TabRule {
  return createLockRule({ type: "url", op: "contains", value });
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
      ...whitelist.map(createUrlContainsRule),
      ...(legacy.filterAudio ? [createLockRule({ type: "audible" })] : []),
      ...(legacy.filterGroupedTabs ? [createLockRule({ type: "groupId", op: "some" })] : []),
      {
        id: generateRuleId(),
        enabled: true,
        match: "all",
        when: [],
        then: {
          action: "stale",
          afterSeconds:
            Number.isFinite(afterSeconds) && afterSeconds >= 0
              ? afterSeconds
              : DEFAULT_STALE_AFTER_SECONDS,
        },
      },
    ],
  };
}
