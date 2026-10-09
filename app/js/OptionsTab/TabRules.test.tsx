import { type TabRulesConfig, buildTabRulesFromLegacySettings } from "../tabRules";
import { fireEvent, render, screen } from "@testing-library/react";
import TabRules from "./TabRules";

const mockSettings: Record<string, unknown> = {};
jest.mock("../useSetting", () => (key: string) => mockSettings[key]);
jest.mock("../settings", () => ({
  __esModule: true,
  default: { get: (key: string) => mockSettings[key] },
}));

beforeEach(() => {
  Object.assign(mockSettings, {
    tabRules: buildTabRulesFromLegacySettings({
      filterAudio: true,
      filterGroupedTabs: false,
      minutesInactive: 20,
      secondsInactive: 0,
      whitelist: ["about:", "chrome://", "example"],
    }),
  });
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
    fireEvent.change(screen.getByLabelText("options_tabRules_condition_urlContains"), {
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
    fireEvent.change(screen.getByLabelText("options_tabRules_condition_urlContains"), {
      target: { value: "example" },
    });
    expect(screen.getByText("options_tabRules_duplicate")).toBeTruthy();
    fireEvent.submit(screen.getByLabelText("options_tabRules_condition_urlContains"));
    expect(onSaveSetting).not.toHaveBeenCalled();
  });

  test("hides the new rule form until requested and on cancel", () => {
    render(<TabRules onSaveSetting={jest.fn()} />);
    expect(screen.queryByLabelText("options_tabRules_condition_urlContains")).toBeNull();
    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    fireEvent.click(screen.getByText("options_tabRules_cancel"));
    expect(screen.queryByLabelText("options_tabRules_condition_urlContains")).toBeNull();
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
    expect(screen.getByText("options_tabRules_duplicate")).toBeTruthy();
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
    const input = screen.getByLabelText("options_tabRules_condition_urlContains");
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
    const minutesInput = screen.getByDisplayValue("20");
    fireEvent.change(minutesInput, { target: { value: "5" } });
    fireEvent.blur(minutesInput);
    const { rules } = lastSavedTabRules(onSaveSetting);
    expect(lastSavedRules(onSaveSetting)).toEqual(["about:", "chrome://", "example", "audible"]);
    expect(rules[rules.length - 1].then).toEqual({ action: "stale", afterSeconds: 300 });
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
    expect(screen.queryByLabelText("options_tabRules_condition_urlContains")).toBeNull();
    fireEvent.click(screen.getByText("options_save"));
    expect(lastSavedTabRules(onSaveSetting).rules[0]).toEqual(
      expect.objectContaining({
        enabled: true,
        then: { action: "lock" },
        when: [{ type: "groupId", op: "some" }],
      }),
    );
  });

  test("disables conditions that already have a rule", () => {
    render(<TabRules onSaveSetting={jest.fn()} />);
    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    const option = (value: string) =>
      screen.getByRole("option", {
        name: `options_tabRules_condition_${value}`,
      }) as HTMLOptionElement;
    expect(option("audible").disabled).toBe(true);
    expect(option("grouped").disabled).toBe(false);
    expect(option("urlContains").disabled).toBe(false);
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
    expect(screen.queryByLabelText("options_tabRules_condition_urlContains")).toBeNull();
  });
});
