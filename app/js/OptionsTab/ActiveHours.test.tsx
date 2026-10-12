import { fireEvent, render, screen, within } from "@testing-library/react";
import { ALWAYS_ACTIVE_HOURS } from "../activeHours";
import ActiveHours from "./ActiveHours";

const mockSettings: Record<string, unknown> = {};
jest.mock("../useSetting", () => (key: string) => mockSettings[key]);

beforeEach(() => {
  Object.assign(mockSettings, { activeHours: ALWAYS_ACTIVE_HOURS });
  Object.assign(chrome.i18n, {
    getMessage: (key: string, substitutions?: string) =>
      substitutions == null ? key : `${key}:${substitutions}`,
  });
  // Sunday first, like en-US.
  Object.assign(Intl.Locale.prototype, { getWeekInfo: () => ({ firstDay: 7, weekend: [6, 7] }) });
});

function lastSaved(onSaveSetting: jest.Mock) {
  const [key, value] = onSaveSetting.mock.lastCall;
  expect(key).toBe("activeHours");
  return value;
}

describe("ActiveHours", () => {
  test("shows every day as all day by default, starting on the locale's first day", () => {
    render(<ActiveHours onSaveSetting={jest.fn()} />);
    const chips = screen.getAllByRole("button", { pressed: true });
    expect(chips.map((chip) => chip.getAttribute("title"))).toEqual([
      "options_activeHours_toggleDayLabel:Sunday",
      "options_activeHours_toggleDayLabel:Monday",
      "options_activeHours_toggleDayLabel:Tuesday",
      "options_activeHours_toggleDayLabel:Wednesday",
      "options_activeHours_toggleDayLabel:Thursday",
      "options_activeHours_toggleDayLabel:Friday",
      "options_activeHours_toggleDayLabel:Saturday",
    ]);
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(7);
  });

  test("turning a day off removes its window", () => {
    const onSaveSetting = jest.fn();
    render(<ActiveHours onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getByTitle("options_activeHours_toggleDayLabel:Saturday"));
    expect(lastSaved(onSaveSetting).map((w: { dayOfWeek: number }) => w.dayOfWeek)).toEqual([
      1, 2, 3, 4, 5, 7,
    ]);
  });

  test("turning a day on makes it active all day", () => {
    mockSettings.activeHours = ALWAYS_ACTIVE_HOURS.filter((w) => w.dayOfWeek !== 6);
    const onSaveSetting = jest.fn();
    render(<ActiveHours onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getByTitle("options_activeHours_toggleDayLabel:Saturday"));
    expect(lastSaved(onSaveSetting)).toEqual(ALWAYS_ACTIVE_HOURS);
  });

  test("unchecking All day sets 9 AM to 5 PM", () => {
    const onSaveSetting = jest.fn();
    render(<ActiveHours onSaveSetting={onSaveSetting} />);
    const monday = screen.getByText("Monday").closest("li")!;
    fireEvent.click(within(monday).getByRole("checkbox"));
    expect(lastSaved(onSaveSetting)[0]).toEqual({
      dayOfWeek: 1,
      startMinute: 9 * 60,
      endMinute: 17 * 60,
    });
  });

  test("moving the start past the end pushes the end later", () => {
    mockSettings.activeHours = [{ dayOfWeek: 1, startMinute: 9 * 60, endMinute: 17 * 60 }];
    const onSaveSetting = jest.fn();
    render(<ActiveHours onSaveSetting={onSaveSetting} />);
    fireEvent.change(screen.getByLabelText("options_activeHours_from:Monday"), {
      target: { value: String(23 * 60 + 30) },
    });
    expect(lastSaved(onSaveSetting)).toEqual([
      { dayOfWeek: 1, startMinute: 23 * 60 + 30, endMinute: 24 * 60 },
    ]);
  });

  test("offers only end times after the start", () => {
    mockSettings.activeHours = [{ dayOfWeek: 1, startMinute: 22 * 60, endMinute: 23 * 60 }];
    render(<ActiveHours onSaveSetting={jest.fn()} />);
    const options = within(screen.getByLabelText("options_activeHours_until:Monday")).getAllByRole(
      "option",
    );
    expect(options.map((option) => Number((option as HTMLOptionElement).value))).toEqual([
      22 * 60 + 15,
      22 * 60 + 30,
      22 * 60 + 45,
      23 * 60,
      23 * 60 + 15,
      23 * 60 + 30,
      23 * 60 + 45,
      24 * 60,
    ]);
  });

  test("warns when no day is selected", () => {
    mockSettings.activeHours = [];
    render(<ActiveHours onSaveSetting={jest.fn()} />);
    expect(screen.getByText("options_activeHours_noDays")).toBeTruthy();
  });
});
