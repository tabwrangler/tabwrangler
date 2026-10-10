import {
  type LegacyRuleSettings,
  type TabRulesConfig,
  buildTabRulesFromLegacySettings,
  findMatchingRule,
  getElseRule,
  getStaleAfterMs,
  getTabOutcome,
} from "./tabRules";

const LEGACY_DEFAULTS: LegacyRuleSettings = {
  filterAudio: true,
  filterGroupedTabs: false,
  minutesInactive: 60,
  secondsInactive: 0,
  whitelist: ["about:", "chrome://"],
};

function elseOf(config: TabRulesConfig) {
  return getElseRule(config)?.then;
}

function createTab(overrides: Partial<chrome.tabs.Tab> = {}): chrome.tabs.Tab {
  return {
    active: false,
    autoDiscardable: false,
    discarded: false,
    frozen: false,
    groupId: -1,
    highlighted: false,
    id: 1,
    index: 1,
    incognito: false,
    pinned: false,
    selected: false,
    url: "https://example.com/",
    windowId: 1,
    ...overrides,
  };
}

describe("buildTabRulesFromLegacySettings", () => {
  test("maps legacy settings to rules in the order the Tab Rules UI shows them", () => {
    const config = buildTabRulesFromLegacySettings({ ...LEGACY_DEFAULTS, filterGroupedTabs: true });
    expect(config.version).toBe(1);
    expect(config.rules.map(({ enabled, then, when }) => ({ enabled, then, when }))).toEqual([
      { enabled: true, then: { action: "lock" }, when: [{ type: "pinned" }] },
      {
        enabled: true,
        then: { action: "lock" },
        when: [{ type: "url", op: "includes", value: "about:" }],
      },
      {
        enabled: true,
        then: { action: "lock" },
        when: [{ type: "url", op: "includes", value: "chrome://" }],
      },
      { enabled: true, then: { action: "lock" }, when: [{ type: "audible" }] },
      { enabled: true, then: { action: "lock" }, when: [{ type: "groupId", op: "some" }] },
      { enabled: true, then: { action: "stale", afterSeconds: 3600 }, when: [] },
    ]);
    expect(config.rules.every((rule) => rule.match === "every")).toBe(true);
  });

  test("omits audio and tab group rules whose toggles were off, but always locks pinned tabs", () => {
    const config = buildTabRulesFromLegacySettings({
      ...LEGACY_DEFAULTS,
      filterAudio: false,
      filterGroupedTabs: false,
      whitelist: [],
    });
    expect(config.rules.map((rule) => rule.when)).toEqual([[{ type: "pinned" }], []]);
  });

  test("gives every rule a unique ID", () => {
    const config = buildTabRulesFromLegacySettings({ ...LEGACY_DEFAULTS, whitelist: ["a", "a"] });
    expect(new Set(config.rules.map((rule) => rule.id)).size).toBe(config.rules.length);
  });

  test("combines minutes and seconds into one timeout", () => {
    expect(
      elseOf(
        buildTabRulesFromLegacySettings({
          ...LEGACY_DEFAULTS,
          minutesInactive: 20,
          secondsInactive: 30,
        }),
      ),
    ).toEqual({ action: "stale", afterSeconds: 1230 });
  });

  test("coerces timeouts stored as strings", () => {
    expect(
      elseOf(
        buildTabRulesFromLegacySettings({
          ...LEGACY_DEFAULTS,
          minutesInactive: "5",
          secondsInactive: "15",
        }),
      ),
    ).toEqual({ action: "stale", afterSeconds: 315 });
  });

  test("falls back to the default timeout when the stored one is not a number", () => {
    expect(
      elseOf(buildTabRulesFromLegacySettings({ ...LEGACY_DEFAULTS, minutesInactive: "abc" })),
    ).toEqual({ action: "stale", afterSeconds: 3600 });
  });

  test("ignores a whitelist that is not an array of strings", () => {
    expect(
      buildTabRulesFromLegacySettings({ ...LEGACY_DEFAULTS, whitelist: undefined }).rules,
    ).toHaveLength(3);
    expect(
      buildTabRulesFromLegacySettings({ ...LEGACY_DEFAULTS, whitelist: ["a", 1, null] }).rules,
    ).toHaveLength(4);
  });

  test("matches whitelist entries by substring of the raw URL, like the legacy whitelist", () => {
    const config = buildTabRulesFromLegacySettings({
      ...LEGACY_DEFAULTS,
      // `*` is literal and matching is case-sensitive against the raw URL
      whitelist: ["Example.com?q=a*b", "Example.com/x?q"],
    });
    expect(findMatchingRule(createTab({ url: "https://Example.com?q=a*b" }), config)).toBe(
      config.rules[1],
    );
    expect(findMatchingRule(createTab({ url: "https://Example.com?q=aXb" }), config)).toBe(
      getElseRule(config),
    );
    expect(findMatchingRule(createTab({ url: "https://example.com/x?q" }), config)).toBe(
      getElseRule(config),
    );
  });
});

describe("getTabOutcome", () => {
  const config: TabRulesConfig = buildTabRulesFromLegacySettings({
    ...LEGACY_DEFAULTS,
    filterGroupedTabs: true,
  });

  test("locks tabs matching an enabled rule", () => {
    expect(getTabOutcome(createTab({ url: "chrome://extensions" }), config)).toEqual({
      action: "lock",
    });
    expect(getTabOutcome(createTab({ audible: true }), config)).toEqual({ action: "lock" });
    expect(getTabOutcome(createTab({ groupId: 4 }), config)).toEqual({ action: "lock" });
  });

  test("uses the final rule for tabs no other rule matches", () => {
    expect(getTabOutcome(createTab(), config)).toEqual({ action: "stale", afterSeconds: 3600 });
  });

  test("leaves tabs that match no rule alone", () => {
    expect(getTabOutcome(createTab(), { ...config, rules: config.rules.slice(0, -1) })).toBeNull();
  });

  test("skips disabled rules", () => {
    const disabled = {
      ...config,
      rules: config.rules.map((rule) =>
        rule.when[0]?.type === "audible" ? { ...rule, enabled: false } : rule,
      ),
    };
    expect(getTabOutcome(createTab({ audible: true }), disabled)?.action).toBe("stale");
  });

  test("uses the first matching rule", () => {
    const ordered: TabRulesConfig = {
      ...config,
      rules: [
        {
          id: "a",
          enabled: true,
          match: "every",
          when: [{ type: "url", op: "includes", value: "example" }],
          then: { action: "stale", afterSeconds: 10 },
        },
        ...config.rules,
      ],
    };
    expect(getTabOutcome(createTab({ audible: true }), ordered)).toEqual({
      action: "stale",
      afterSeconds: 10,
    });
  });

  test("matches groupId none for ungrouped tabs only", () => {
    const none: TabRulesConfig = {
      ...config,
      rules: [
        {
          id: "a",
          enabled: true,
          match: "every",
          when: [{ type: "groupId", op: "none" }],
          then: { action: "lock" },
        },
      ],
    };
    expect(getTabOutcome(createTab({ groupId: -1 }), none)?.action).toBe("lock");
    expect(getTabOutcome(createTab({ groupId: 3 }), none)).toBeNull();
  });
});

describe("getStaleAfterMs", () => {
  const config: TabRulesConfig = {
    version: 1,
    rules: [
      {
        id: "a",
        enabled: true,
        match: "every",
        when: [{ type: "url", op: "includes", value: "news" }],
        then: { action: "stale", afterSeconds: 7200 },
      },
      {
        id: "b",
        enabled: true,
        match: "every",
        when: [],
        then: { action: "stale", afterSeconds: 60 },
      },
    ],
  };

  test("uses the timeout of the outcome matching the tab", () => {
    expect(getStaleAfterMs(config, createTab({ url: "https://news.example" }))).toBe(7_200_000);
    expect(getStaleAfterMs(config, createTab())).toBe(60_000);
  });

  test("never makes a tab that matches no rule stale", () => {
    expect(getStaleAfterMs({ ...config, rules: config.rules.slice(0, 1) }, createTab())).toBe(
      Infinity,
    );
  });

  test("uses the longest timeout without a tab", () => {
    expect(getStaleAfterMs(config)).toBe(7_200_000);
  });
});

describe("match", () => {
  const rule = (match: "every" | "some"): TabRulesConfig => ({
    version: 1,
    rules: [
      {
        id: "a",
        enabled: true,
        match,
        when: [{ type: "url", op: "includes", value: "youtube.com" }, { type: "audible" }],
        then: { action: "lock" },
      },
    ],
  });
  const youtube = "https://www.youtube.com/watch";

  test("requires every condition with every", () => {
    expect(getTabOutcome(createTab({ audible: true, url: youtube }), rule("every"))).toEqual({
      action: "lock",
    });
    expect(getTabOutcome(createTab({ url: youtube }), rule("every"))).toBeNull();
  });

  test("requires at least one condition with some", () => {
    expect(getTabOutcome(createTab({ url: youtube }), rule("some"))).toEqual({ action: "lock" });
    expect(getTabOutcome(createTab({ audible: true }), rule("some"))).toEqual({ action: "lock" });
    expect(getTabOutcome(createTab(), rule("some"))).toBeNull();
  });

  test("matches every tab when a rule has no conditions, whatever its match", () => {
    const config: TabRulesConfig = {
      version: 1,
      rules: [{ id: "a", enabled: true, match: "some", when: [], then: { action: "lock" } }],
    };
    expect(getTabOutcome(createTab(), config)).toEqual({ action: "lock" });
  });
});
