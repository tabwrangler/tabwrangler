import {
  ACTIVE_HOURS_STEP_MINUTES,
  type ActiveWindow,
  type DayOfWeek,
  MINUTES_PER_DAY,
  formatActiveHoursChange,
  formatDayOfWeek,
  formatMinuteOfDay,
  getDaysOfWeekInLocaleOrder,
  isAllDay,
  isAlwaysActive,
  setActiveWindow,
} from "../activeHours";
import { type SettingsSchema } from "../settings";
import cx from "classnames";
import useActiveHoursState from "../useActiveHoursState";
import { useId } from "react";
import useSetting from "../useSetting";

type SaveSetting = <K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]) => void;

const ALL_DAY = { startMinute: 0, endMinute: MINUTES_PER_DAY };
const DEFAULT_HOURS = { startMinute: 9 * 60, endMinute: 17 * 60 };
const DEFAULT_HOURS_LENGTH_MINUTES = 60;

const STEP_MINUTES = Array.from(
  { length: MINUTES_PER_DAY / ACTIVE_HOURS_STEP_MINUTES + 1 },
  (_, i) => i * ACTIVE_HOURS_STEP_MINUTES,
);

export default function ActiveHours({ onSaveSetting }: { onSaveSetting: SaveSetting }) {
  const activeHours = useSetting("activeHours");
  const daysOfWeek = getDaysOfWeekInLocaleOrder();

  function saveWindow(dayOfWeek: DayOfWeek, activeWindow: Omit<ActiveWindow, "dayOfWeek"> | null) {
    onSaveSetting("activeHours", setActiveWindow(activeHours, dayOfWeek, activeWindow));
  }

  return (
    <>
      <h5 className="mt-3 mb-0">{chrome.i18n.getMessage("options_section_activeHours")}</h5>
      <div className="row form-text">
        <div className="col-9">{chrome.i18n.getMessage("options_activeHours_description")}</div>
      </div>
      <div className="d-flex gap-2 mt-2">
        {daysOfWeek.map((dayOfWeek) => {
          const pressed = activeHours.some((w) => w.dayOfWeek === dayOfWeek);
          const title = chrome.i18n.getMessage(
            "options_activeHours_toggleDayLabel",
            formatDayOfWeek(dayOfWeek, "long"),
          );
          return (
            <button
              aria-label={title}
              aria-pressed={pressed}
              className={cx("btn btn-sm rounded-circle p-0", {
                "btn-outline-secondary": !pressed,
                "btn-secondary": pressed,
              })}
              key={dayOfWeek}
              onClick={() => saveWindow(dayOfWeek, pressed ? null : ALL_DAY)}
              style={{ height: "2rem", width: "2rem" }}
              title={title}
              type="button"
            >
              {formatDayOfWeek(dayOfWeek, "narrow")}
            </button>
          );
        })}
      </div>
      {activeHours.length === 0 ? (
        <div className="row mt-2">
          <div className="col-9">
            <div className="alert alert-warning mb-0">
              {chrome.i18n.getMessage("options_activeHours_noDays")}
            </div>
          </div>
        </div>
      ) : (
        <div className="row mt-2">
          <div className="col-9">
            <div className="card">
              <ul className="list-group list-group-flush">
                {daysOfWeek.map((dayOfWeek) => {
                  const activeWindow = activeHours.find((w) => w.dayOfWeek === dayOfWeek);
                  return activeWindow == null ? null : (
                    <ActiveWindowRow
                      activeWindow={activeWindow}
                      key={dayOfWeek}
                      onChange={(nextWindow) => saveWindow(dayOfWeek, nextWindow)}
                    />
                  );
                })}
              </ul>
            </div>
            {!isAlwaysActive(activeHours) && <ActiveHoursStatus />}
          </div>
        </div>
      )}
    </>
  );
}

function ActiveWindowRow({
  activeWindow,
  onChange,
}: {
  activeWindow: ActiveWindow;
  onChange: (activeWindow: Omit<ActiveWindow, "dayOfWeek">) => void;
}) {
  const id = useId();
  const allDay = isAllDay(activeWindow);
  const dayName = formatDayOfWeek(activeWindow.dayOfWeek, "long");

  return (
    <li className="list-group-item d-flex align-items-center gap-2">
      <span className="flex-fill">{dayName}</span>
      <select
        aria-label={chrome.i18n.getMessage("options_activeHours_from", dayName)}
        className="form-select form-select-sm w-auto"
        disabled={allDay}
        name={`activeHours-${activeWindow.dayOfWeek}-start`}
        onChange={(event) => {
          const startMinute = Number(event.target.value);
          onChange({
            startMinute,
            endMinute:
              activeWindow.endMinute > startMinute
                ? activeWindow.endMinute
                : Math.min(startMinute + DEFAULT_HOURS_LENGTH_MINUTES, MINUTES_PER_DAY),
          });
        }}
        value={activeWindow.startMinute}
      >
        {STEP_MINUTES.slice(0, -1).map((minute) => (
          <option key={minute} value={minute}>
            {formatMinuteOfDay(minute)}
          </option>
        ))}
      </select>
      <span className={allDay ? "text-muted" : undefined} style={{ whiteSpace: "nowrap" }}>
        {chrome.i18n.getMessage("options_activeHours_to")}
      </span>
      <select
        aria-label={chrome.i18n.getMessage("options_activeHours_until", dayName)}
        className="form-select form-select-sm w-auto"
        disabled={allDay}
        name={`activeHours-${activeWindow.dayOfWeek}-end`}
        onChange={(event) =>
          onChange({ startMinute: activeWindow.startMinute, endMinute: Number(event.target.value) })
        }
        value={activeWindow.endMinute}
      >
        {STEP_MINUTES.filter((minute) => minute > activeWindow.startMinute).map((minute) => (
          <option key={minute} value={minute}>
            {minute === MINUTES_PER_DAY
              ? chrome.i18n.getMessage("options_activeHours_midnight")
              : formatMinuteOfDay(minute)}
          </option>
        ))}
      </select>
      <div className="form-check mb-0 ms-2">
        <input
          checked={allDay}
          className="form-check-input"
          id={id}
          onChange={(event) => onChange(event.target.checked ? ALL_DAY : DEFAULT_HOURS)}
          type="checkbox"
        />
        <label className="form-check-label text-nowrap" htmlFor={id}>
          {chrome.i18n.getMessage("options_activeHours_allDay")}
        </label>
      </div>
    </li>
  );
}

function ActiveHoursStatus() {
  const { active, nextChangeAt, now } = useActiveHoursState();
  if (nextChangeAt == null) return null;
  return (
    <div className="form-text">
      {chrome.i18n.getMessage(
        active ? "activeHours_runningUntil" : "activeHours_pausedUntil",
        formatActiveHoursChange(nextChangeAt, now),
      )}
    </div>
  );
}
