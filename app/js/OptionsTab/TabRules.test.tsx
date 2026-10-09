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
    filterAudio: true,
    filterGroupedTabs: false,
    minutesInactive: 20,
    secondsInactive: 0,
    whitelist: ["about:", "chrome://", "example"],
  });
  Object.assign(chrome.i18n, { getMessage: (key: string) => key });
  Object.assign(chrome.tabs, { query: () => Promise.resolve([]) });
  // jsdom has no Web Animations API; reduced motion skips the animations.
  window.matchMedia = jest.fn(() => ({ matches: true }) as MediaQueryList);
});

describe("TabRules", () => {
  test("adds new rules to the top", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    fireEvent.change(screen.getByLabelText("options_tabRules_condition_urlContains"), {
      target: { value: "news" },
    });
    fireEvent.click(screen.getByText("options_save"));
    expect(onSaveSetting).toHaveBeenCalledWith("whitelist", [
      "news",
      "about:",
      "chrome://",
      "example",
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
    expect(onSaveSetting).toHaveBeenLastCalledWith("whitelist", ["about:", "example", "chrome://"]);
    fireEvent.click(screen.getAllByLabelText("options_tabRules_moveDown")[0]);
    expect(onSaveSetting).toHaveBeenLastCalledWith("whitelist", ["chrome://", "about:", "example"]);
  });

  test("removes a rule", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getAllByLabelText("options_tabRules_remove")[1]);
    expect(onSaveSetting).toHaveBeenCalledWith("whitelist", ["about:", "example"]);
  });

  test("toggles the playing audio rule", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getAllByLabelText("options_tabRules_enabled")[0]);
    expect(onSaveSetting).toHaveBeenCalledWith("filterAudio", false);
  });

  test("disables the tab group rule when the browser has no tab groups", () => {
    render(<TabRules onSaveSetting={jest.fn()} />);
    expect(
      (screen.getAllByLabelText("options_tabRules_enabled")[1] as HTMLInputElement).disabled,
    ).toBe(true);
  });

  test("labels the first rule If, the rest Else if, and the fallback Else", () => {
    render(<TabRules onSaveSetting={jest.fn()} />);
    expect(screen.getAllByText("options_tabRules_if")).toHaveLength(1);
    expect(screen.getAllByText("options_tabRules_elseIf")).toHaveLength(4);
    expect(screen.getAllByText("options_tabRules_else")).toHaveLength(1);
    expect(
      screen.getAllByText("options_tabRules_if")[0].closest(".tab-rule-clause")?.textContent,
    ).toContain("about:");

    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    expect(screen.getAllByText("options_tabRules_if")).toHaveLength(1);
    expect(screen.getAllByText("options_tabRules_elseIf")).toHaveLength(5);
  });

  test("edits a rule in place", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getAllByLabelText("options_tabRules_edit")[1]);
    const input = screen.getByDisplayValue("chrome://");
    fireEvent.change(input, { target: { value: "chrome://settings" } });
    fireEvent.submit(input);
    expect(onSaveSetting).toHaveBeenCalledWith("whitelist", [
      "about:",
      "chrome://settings",
      "example",
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
});
