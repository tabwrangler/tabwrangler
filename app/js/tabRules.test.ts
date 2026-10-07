import { createTabRule, findTabRule } from "./tabRules";

function createTab(url: string | undefined): chrome.tabs.Tab {
  return { url } as chrome.tabs.Tab;
}

describe("findTabRule", () => {
  const searchRule = createTabRule("google.com/search", 60_000);
  const googleRule = createTabRule("google.com", 120_000);

  test("matches rules whose pattern appears anywhere in the URL", () => {
    expect(findTabRule(createTab("https://mail.google.com/mail/u/0"), [googleRule])).toBe(
      googleRule,
    );
  });

  test("returns the first matching rule", () => {
    const tab = createTab("https://www.google.com/search?q=tabs");
    expect(findTabRule(tab, [searchRule, googleRule])).toBe(searchRule);
    expect(findTabRule(tab, [googleRule, searchRule])).toBe(googleRule);
  });

  test("returns undefined when no rule matches", () => {
    expect(findTabRule(createTab("https://example.com"), [searchRule, googleRule])).toBeUndefined();
  });

  test("returns undefined for tabs without a URL", () => {
    expect(findTabRule(createTab(undefined), [googleRule])).toBeUndefined();
  });
});
