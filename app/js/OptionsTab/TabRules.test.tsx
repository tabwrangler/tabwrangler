import { fireEvent, render, screen } from "@testing-library/react";
import TabRules from "./TabRules";

const mockSettings: Record<string, unknown> = {};
jest.mock("../useSetting", () => (key: string) => mockSettings[key]);

beforeEach(() => {
  Object.assign(mockSettings, {
    minutesInactive: 20,
    secondsInactive: 0,
    whitelist: ["about:", "chrome://", "example"],
  });
  Object.assign(chrome.i18n, { getMessage: (key: string) => key });
});

describe("TabRules", () => {
  test("adds new rules to the top", () => {
    const onSaveSetting = jest.fn();
    render(<TabRules onSaveSetting={onSaveSetting} />);
    fireEvent.change(screen.getByLabelText("options_tabRules_condition_urlContains"), {
      target: { value: "news" },
    });
    fireEvent.click(screen.getByText("options_tabRules_addRule"));
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
    fireEvent.change(screen.getByLabelText("options_tabRules_condition_urlContains"), {
      target: { value: "example" },
    });
    fireEvent.click(screen.getByText("options_tabRules_addRule"));
    expect(onSaveSetting).not.toHaveBeenCalled();
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
});
