import {
  DEFAULT_STALE_AFTER_SECONDS,
  type TabRulesConfig,
  buildTabRulesFromLegacySettings,
} from "../tabRules";
import { fireEvent, render, screen, within } from "@testing-library/react";
import TabRules from "./TabRules";

const mockSettings: Record<string, unknown> = {};
jest.mock("../useSetting", () => (key: string) => mockSettings[key]);
jest.mock("../settings", () => ({
  __esModule: true,
  default: { get: (key: string) => mockSettings[key] },
}));

beforeEach(() => {
  const tabRules = buildTabRulesFromLegacySettings({
    filterAudio: true,
    filterGroupedTabs: false,
    minutesInactive: 20,
    secondsInactive: 0,
    whitelist: ["about:", "chrome://", "example"],
  });
  // Most tests work with the URL and audio rules; the pinned rule has its own tests.
  tabRules.rules = tabRules.rules.filter((rule) => rule.when[0]?.type !== "pinned");
  Object.assign(mockSettings, { tabRules });
  Object.assign(chrome.i18n, { getMessage: (key: string) => key });
  Object.assign(chrome.tabs, { query: () => Promise.resolve([]) });
  // jsdom has no Web Animations API; reduced motion skips the animations.
  window.matchMedia = jest.fn(() => ({ matches: true }) as MediaQueryList);
});

function lastSavedTabRules(onSaveSetting: jest.Mock): TabRulesConfig {
  const [key, value] = onSaveSetting.mock.lastCall;
  expect(key).toBe("tabRules");
  return value;
}

// Summarizes each saved rule above the final "Else" rule as its URL text, or its condition type
// when it has no text
function lastSavedRules(onSaveSetting: jest.Mock): string[] {
  return lastSavedTabRules(onSaveSetting)
    .rules.slice(0, -1)
    .map(({ when: [condition] }) => (condition.type === "url" ? condition.value : condition.type));
}

describe("TabRules", () => {
  test("adds new rules to the top", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    fireEvent.change(screen.getByLabelText("options_tabRules_condition_url"), {
      target: { value: "news" },
    });
    fireEvent.click(screen.getByText("options_save"));
    expect(lastSavedRules(onSaveSetting)).toEqual([
      "news",
      "about:",
      "chrome://",
      "example",
      "audible",
    ]);
  });

  test("does not add a duplicate rule", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    fireEvent.change(screen.getByLabelText("options_tabRules_condition_url"), {
      target: { value: "example" },
    });
    expect(screen.getByText("options_tabRules_duplicateRule")).toBeTruthy();
    fireEvent.submit(screen.getByLabelText("options_tabRules_condition_url"));
    expect(onSaveSetting).not.toHaveBeenCalled();
  });

  test("hides the new rule form until requested and on cancel", () => {
    render(<TabRules onSaveSetting={jest.fn()} />);
    expect(screen.queryByLabelText("options_tabRules_condition_url")).toBeNull();
    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    fireEvent.click(screen.getByText("options_tabRules_cancel"));
    expect(screen.queryByLabelText("options_tabRules_condition_url")).toBeNull();
  });

  test("moves rules up and down", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getAllByLabelText("options_tabRules_moveUp")[2]);
    expect(lastSavedRules(onSaveSetting)).toEqual(["about:", "example", "chrome://", "audible"]);
    fireEvent.click(screen.getAllByLabelText("options_tabRules_moveDown")[0]);
    expect(lastSavedRules(onSaveSetting)).toEqual(["chrome://", "about:", "example", "audible"]);
  });

  test("removes a rule", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getAllByLabelText("options_tabRules_remove")[1]);
    expect(lastSavedRules(onSaveSetting)).toEqual(["about:", "example", "audible"]);
  });

  test("labels the first rule If, the rest Else if, and the fallback Else", () => {
    render(<TabRules onSaveSetting={jest.fn()} />);
    expect(screen.getAllByText("options_tabRules_if")).toHaveLength(1);
    expect(screen.getAllByText("options_tabRules_elseIf")).toHaveLength(3);
    expect(screen.getAllByText("options_tabRules_else")).toHaveLength(1);
    expect(
      screen.getAllByText("options_tabRules_if")[0].closest(".tab-rule-clause")?.textContent,
    ).toContain("about:");

    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    expect(screen.getAllByText("options_tabRules_if")).toHaveLength(1);
    expect(screen.getAllByText("options_tabRules_elseIf")).toHaveLength(4);
  });

  test("edits a rule in place", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getAllByLabelText("options_tabRules_edit")[1]);
    const input = screen.getByDisplayValue("chrome://");
    fireEvent.change(input, { target: { value: "chrome://settings" } });
    fireEvent.submit(input);
    expect(lastSavedRules(onSaveSetting)).toEqual([
      "about:",
      "chrome://settings",
      "example",
      "audible",
    ]);
  });

  test("does not save an edit that duplicates another rule", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getAllByLabelText("options_tabRules_edit")[1]);
    const input = screen.getByDisplayValue("chrome://");
    fireEvent.change(input, { target: { value: "about:" } });
    expect(screen.getByText("options_tabRules_duplicateRule")).toBeTruthy();
    fireEvent.submit(input);
    expect(onSaveSetting).not.toHaveBeenCalled();
  });

  test("cancels an edit", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getAllByLabelText("options_tabRules_edit")[1]);
    fireEvent.change(screen.getByDisplayValue("chrome://"), { target: { value: "changed" } });
    fireEvent.click(screen.getByText("options_tabRules_cancel"));
    expect(screen.queryByDisplayValue("changed")).toBeNull();
    expect(onSaveSetting).not.toHaveBeenCalled();
  });

  test("rejects new rules containing spaces", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    const input = screen.getByLabelText("options_tabRules_condition_url");
    fireEvent.change(input, { target: { value: "news site" } });
    expect(screen.getByText("options_tabRules_whitespace")).toBeTruthy();
    fireEvent.submit(input);
    expect(onSaveSetting).not.toHaveBeenCalled();
  });

  test("rejects edits containing spaces", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getAllByLabelText("options_tabRules_edit")[1]);
    const input = screen.getByDisplayValue("chrome://");
    fireEvent.change(input, { target: { value: " chrome://" } });
    expect(screen.getByText("options_tabRules_whitespace")).toBeTruthy();
    fireEvent.submit(input);
    expect(onSaveSetting).not.toHaveBeenCalled();
  });

  test("saves the else timeout in seconds", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getByLabelText("options_tabRules_editElse"));
    const minutesInput = screen.getByDisplayValue("20");
    fireEvent.change(minutesInput, { target: { value: "5" } });
    fireEvent.blur(minutesInput);
    expect(onSaveSetting).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("options_save"));
    const { rules } = lastSavedTabRules(onSaveSetting);
    expect(lastSavedRules(onSaveSetting)).toEqual(["about:", "chrome://", "example", "audible"]);
    expect(rules[rules.length - 1].then).toEqual({
      action: "stale",
      afterSeconds: 300,
      save: "corral",
    });
  });

  test("makes the else rule lock tabs", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getByLabelText("options_tabRules_editElse"));
    fireEvent.change(screen.getByLabelText("options_tabRules_action"), {
      target: { value: "lock" },
    });
    expect(screen.queryByDisplayValue("20")).toBeNull();
    fireEvent.click(screen.getByText("options_save"));
    const { rules } = lastSavedTabRules(onSaveSetting);
    expect(rules[rules.length - 1]).toMatchObject({ then: { action: "lock" }, when: [] });
  });

  test("resets the else timeout to the default when switching back to stale", () => {
    const tabRules = mockSettings.tabRules as TabRulesConfig;
    mockSettings.tabRules = {
      ...tabRules,
      rules: tabRules.rules.map((rule) =>
        rule.when.length === 0 ? { ...rule, then: { action: "lock" } } : rule,
      ),
    };
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getByLabelText("options_tabRules_editElse"));
    fireEvent.change(screen.getByLabelText("options_tabRules_action"), {
      target: { value: "stale" },
    });
    fireEvent.click(screen.getByText("options_save"));
    const { rules } = lastSavedTabRules(onSaveSetting);
    expect(rules[rules.length - 1].then).toEqual({
      action: "stale",
      afterSeconds: DEFAULT_STALE_AFTER_SECONDS,
      save: "corral",
    });
  });

  test("cancels editing the else rule without saving", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getByLabelText("options_tabRules_editElse"));
    fireEvent.change(screen.getByLabelText("options_tabRules_action"), {
      target: { value: "lock" },
    });
    fireEvent.click(screen.getByText("options_tabRules_cancel"));
    expect(screen.queryByLabelText("options_tabRules_action")).toBeNull();
    expect(onSaveSetting).not.toHaveBeenCalled();
  });

  test("shows audio and tab group rules alongside URL rules", () => {
    render(<TabRules onSaveSetting={jest.fn()} />);
    expect(screen.getByText("options_tabRules_condition_audible")).toBeTruthy();
  });

  test("adds a rule for another condition chosen from the select", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    fireEvent.change(screen.getByLabelText("options_tabRules_condition"), {
      target: { value: "groupId" },
    });
    expect(screen.queryByLabelText("options_tabRules_condition_url")).toBeNull();
    fireEvent.click(screen.getByText("options_save"));
    expect(lastSavedTabRules(onSaveSetting).rules[0]).toEqual(
      expect.objectContaining({
        then: { action: "lock" },
        when: [{ type: "groupId", op: "some" }],
      }),
    );
  });

  test("does not add a rule identical to another one", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    fireEvent.change(screen.getByLabelText("options_tabRules_condition"), {
      target: { value: "audible" },
    });
    expect(screen.getByText("options_tabRules_duplicateRule")).toBeTruthy();
    fireEvent.click(screen.getByText("options_save"));
    expect(onSaveSetting).not.toHaveBeenCalled();
  });

  test("adds a rule matching all of several conditions", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    fireEvent.change(screen.getByLabelText("options_tabRules_condition_url"), {
      target: { value: "youtube.com" },
    });
    fireEvent.click(screen.getByText("options_tabRules_addCondition"));
    fireEvent.change(screen.getAllByLabelText("options_tabRules_condition")[1], {
      target: { value: "audible" },
    });
    fireEvent.click(screen.getByText("options_save"));
    const [rule] = lastSavedTabRules(onSaveSetting).rules;
    expect(rule.match).toBe("every");
    expect(rule.when).toEqual([
      { type: "url", op: "includes", value: "youtube.com" },
      { type: "audible" },
    ]);
  });

  test("adds a rule matching any of several conditions", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    fireEvent.click(screen.getByText("options_tabRules_addCondition"));
    const [first, second] = screen.getAllByLabelText("options_tabRules_condition_url");
    fireEvent.change(first, { target: { value: "github.com" } });
    fireEvent.change(second, { target: { value: "linear.app" } });
    fireEvent.change(screen.getByLabelText("options_tabRules_match"), {
      target: { value: "some" },
    });
    fireEvent.click(screen.getByText("options_save"));
    expect(lastSavedTabRules(onSaveSetting).rules[0]).toEqual(
      expect.objectContaining({
        match: "some",
        when: [
          { type: "url", op: "includes", value: "github.com" },
          { type: "url", op: "includes", value: "linear.app" },
        ],
      }),
    );
  });

  test("removes a condition from the form", () => {
    render(<TabRules onSaveSetting={jest.fn()} />);
    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    expect(screen.queryByLabelText("options_tabRules_removeCondition")).toBeNull();
    fireEvent.click(screen.getByText("options_tabRules_addCondition"));
    expect(screen.getAllByLabelText("options_tabRules_condition")).toHaveLength(2);
    fireEvent.click(screen.getAllByLabelText("options_tabRules_removeCondition")[1]);
    expect(screen.getAllByLabelText("options_tabRules_condition")).toHaveLength(1);
  });

  test("disables audio and tab group conditions already in the rule", () => {
    render(<TabRules onSaveSetting={jest.fn()} />);
    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    fireEvent.change(screen.getByLabelText("options_tabRules_condition"), {
      target: { value: "groupId" },
    });
    fireEvent.click(screen.getByText("options_tabRules_addCondition"));
    const options = screen.getAllByRole("option", {
      name: "options_tabRules_condition_grouped",
    }) as HTMLOptionElement[];
    expect(options.map((option) => option.disabled)).toEqual([false, true]);
  });

  test("flags the same URL text twice in one rule", () => {
    render(<TabRules onSaveSetting={jest.fn()} />);
    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    fireEvent.click(screen.getByText("options_tabRules_addCondition"));
    const [first, second] = screen.getAllByLabelText("options_tabRules_condition_url");
    fireEvent.change(first, { target: { value: "news" } });
    fireEvent.change(second, { target: { value: "news" } });
    expect(screen.getByText("options_tabRules_duplicateCondition")).toBeTruthy();
  });

  test("adds a rule for title text, which can contain spaces", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    fireEvent.change(screen.getByLabelText("options_tabRules_condition"), {
      target: { value: "title" },
    });
    fireEvent.change(screen.getByLabelText("options_tabRules_condition_title"), {
      target: { value: "Google Search" },
    });
    expect(screen.queryByText("options_tabRules_whitespace")).toBeNull();
    fireEvent.click(screen.getByText("options_save"));
    expect(lastSavedTabRules(onSaveSetting).rules[0].when).toEqual([
      { type: "title", op: "includes", value: "Google Search" },
    ]);
  });

  test("adds a rule for tab group name text, which can contain spaces", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    fireEvent.change(screen.getByLabelText("options_tabRules_condition"), {
      target: { value: "groupTitle" },
    });
    fireEvent.change(screen.getByLabelText("options_tabRules_condition_groupTitle"), {
      target: { value: "Q4 planning" },
    });
    expect(screen.queryByText("options_tabRules_whitespace")).toBeNull();
    fireEvent.click(screen.getByText("options_save"));
    expect(lastSavedTabRules(onSaveSetting).rules[0].when).toEqual([
      { type: "groupTitle", op: "includes", value: "Q4 planning" },
    ]);
  });

  test("allows the same text for a URL and a title condition in one rule", () => {
    render(<TabRules onSaveSetting={jest.fn()} />);
    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    fireEvent.click(screen.getByText("options_tabRules_addCondition"));
    fireEvent.change(screen.getAllByLabelText("options_tabRules_condition")[1], {
      target: { value: "title" },
    });
    fireEvent.change(screen.getByLabelText("options_tabRules_condition_url"), {
      target: { value: "news" },
    });
    fireEvent.change(screen.getByLabelText("options_tabRules_condition_title"), {
      target: { value: "news" },
    });
    expect(screen.queryByText("options_tabRules_duplicateCondition")).toBeNull();
  });

  test("shows each condition after the first with its connector", () => {
    const tabRules = mockSettings.tabRules as TabRulesConfig;
    mockSettings.tabRules = {
      ...tabRules,
      rules: [
        {
          id: "a",
          match: "some",
          when: [{ type: "url", op: "includes", value: "github.com" }, { type: "audible" }],
          then: { action: "lock" },
        },
        ...tabRules.rules,
      ],
    };
    render(<TabRules onSaveSetting={jest.fn()} />);
    expect(screen.getAllByText("options_tabRules_or")).toHaveLength(1);
    expect(screen.queryByText("options_tabRules_and")).toBeNull();
  });

  test("changes a rule's condition when editing", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getAllByLabelText("options_tabRules_edit")[1]);
    const select = screen.getByLabelText("options_tabRules_condition");
    fireEvent.change(select, { target: { value: "groupId" } });
    fireEvent.submit(select);
    expect(lastSavedRules(onSaveSetting)).toEqual(["about:", "groupId", "example", "audible"]);
  });

  test("edits an audio rule with the select showing its condition", () => {
    render(<TabRules onSaveSetting={jest.fn()} />);
    fireEvent.click(screen.getAllByLabelText("options_tabRules_edit")[3]);
    expect((screen.getByLabelText("options_tabRules_condition") as HTMLSelectElement).value).toBe(
      "audible",
    );
    expect(screen.queryByLabelText("options_tabRules_condition_url")).toBeNull();
  });

  test("adds a rule for pinned tabs", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    fireEvent.change(screen.getByLabelText("options_tabRules_condition"), {
      target: { value: "pinned" },
    });
    fireEvent.click(screen.getByText("options_save"));
    expect(lastSavedTabRules(onSaveSetting).rules[0].when).toEqual([{ type: "pinned" }]);
  });

  test("shows the migrated pinned rule", () => {
    mockSettings.tabRules = buildTabRulesFromLegacySettings({
      filterAudio: false,
      filterGroupedTabs: false,
      minutesInactive: 20,
      secondsInactive: 0,
      whitelist: [],
    });
    render(<TabRules onSaveSetting={jest.fn()} />);
    expect(
      screen.getAllByText("options_tabRules_if")[0].closest(".tab-rule-clause")?.textContent,
    ).toContain("options_tabRules_condition_pinned");
  });

  test("adds a rule that marks tabs stale after a set time", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    fireEvent.change(screen.getByLabelText("options_tabRules_condition_url"), {
      target: { value: "news" },
    });
    fireEvent.change(screen.getByLabelText("options_tabRules_action"), {
      target: { value: "stale" },
    });
    // The new rule starts at 1 hour; change it to 2 hours.
    const hours = screen.getAllByDisplayValue("1")[0];
    fireEvent.change(hours, { target: { value: "2" } });
    fireEvent.blur(hours);
    fireEvent.click(screen.getByText("options_save"));
    expect(lastSavedTabRules(onSaveSetting).rules[0].then).toEqual({
      action: "stale",
      afterSeconds: 7200,
      save: "corral",
    });
  });

  test("shows a stale rule's timeout in the list", () => {
    const tabRules = mockSettings.tabRules as TabRulesConfig;
    mockSettings.tabRules = {
      ...tabRules,
      rules: [
        {
          id: "a",
          match: "every",
          when: [{ type: "url", op: "includes", value: "news" }],
          then: { action: "stale", afterSeconds: 600, save: "corral" },
        },
        ...tabRules.rules,
      ],
    };
    render(<TabRules onSaveSetting={jest.fn()} />);
    // The new rule's timeout and the Else rule's.
    expect(screen.getAllByText("options_tabRules_action_staleAfter")).toHaveLength(2);
  });

  test("adds a stale rule that doesn't save closed tabs to the corral", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    fireEvent.change(screen.getByLabelText("options_tabRules_condition_url"), {
      target: { value: "google.com/search" },
    });
    fireEvent.change(screen.getByLabelText("options_tabRules_action"), {
      target: { value: "stale" },
    });
    const save = screen.getByLabelText("options_tabRules_save_corral");
    expect((save as HTMLInputElement).checked).toBe(true);
    fireEvent.click(save);
    fireEvent.click(screen.getByText("options_save"));
    expect(lastSavedTabRules(onSaveSetting).rules[0].then).toEqual({
      action: "stale",
      afterSeconds: DEFAULT_STALE_AFTER_SECONDS,
      save: "none",
    });
  });

  test("notes stale rules that don't save closed tabs in the list", () => {
    const tabRules = mockSettings.tabRules as TabRulesConfig;
    mockSettings.tabRules = {
      ...tabRules,
      rules: [
        {
          id: "a",
          match: "every",
          when: [{ type: "url", op: "includes", value: "news" }],
          then: { action: "stale", afterSeconds: 600, save: "none" },
        },
        ...tabRules.rules,
      ],
    };
    render(<TabRules onSaveSetting={jest.fn()} />);
    expect(screen.getAllByText("options_tabRules_save_none")).toHaveLength(1);
  });

  test("saves a duration typed just before pressing Enter", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    fireEvent.change(screen.getByLabelText("options_tabRules_condition_url"), {
      target: { value: "news" },
    });
    const action = screen.getByLabelText("options_tabRules_action");
    fireEvent.change(action, { target: { value: "stale" } });
    const hours = within(action.closest("form")!).getByDisplayValue("1");
    fireEvent.change(hours, { target: { value: "2" } });
    // Enter submits the form without blurring the input first.
    fireEvent.keyDown(hours, { key: "Enter" });
    fireEvent.submit(hours);
    expect(lastSavedTabRules(onSaveSetting).rules[0].then).toEqual({
      action: "stale",
      afterSeconds: 7200,
      save: "corral",
    });
  });

  test("saves an edit that only changes the duration when pressing Enter", () => {
    const tabRules = mockSettings.tabRules as TabRulesConfig;
    mockSettings.tabRules = {
      ...tabRules,
      rules: [
        {
          id: "a",
          match: "every",
          when: [{ type: "url", op: "includes", value: "news" }],
          then: { action: "stale", afterSeconds: 600, save: "corral" },
        },
        ...tabRules.rules,
      ],
    };
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getAllByLabelText("options_tabRules_edit")[0]);
    const form = screen.getByLabelText("options_tabRules_action").closest("form")!;
    const minutes = within(form).getByDisplayValue("10");
    fireEvent.change(minutes, { target: { value: "15" } });
    fireEvent.keyDown(minutes, { key: "Enter" });
    fireEvent.submit(minutes);
    expect(lastSavedTabRules(onSaveSetting).rules[0].then).toEqual({
      action: "stale",
      afterSeconds: 900,
      save: "corral",
    });
  });

  test("can't save a rule that marks tabs stale after zero time", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    fireEvent.change(screen.getByLabelText("options_tabRules_condition_url"), {
      target: { value: "news" },
    });
    const action = screen.getByLabelText("options_tabRules_action");
    fireEvent.change(action, { target: { value: "stale" } });
    const hours = within(action.closest("form")!).getByDisplayValue("1");
    fireEvent.change(hours, { target: { value: "0" } });
    fireEvent.blur(hours);
    expect(screen.getByText("options_option_timeInactive_error_zero")).toBeTruthy();
    expect((screen.getByText("options_save") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(hours);
    expect(onSaveSetting).not.toHaveBeenCalled();
  });

  test("labels the else rule Always when it is the only rule", () => {
    const tabRules = mockSettings.tabRules as TabRulesConfig;
    mockSettings.tabRules = { ...tabRules, rules: tabRules.rules.slice(-1) };
    render(<TabRules onSaveSetting={jest.fn()} />);
    expect(screen.getByText("options_tabRules_always")).toBeTruthy();
    expect(screen.queryByText("options_tabRules_else")).toBeNull();
    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    expect(screen.getByText("options_tabRules_else")).toBeTruthy();
  });
});
