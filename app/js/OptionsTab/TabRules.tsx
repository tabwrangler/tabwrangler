import Button from "react-bootstrap/Button";
import { type SettingsSchema } from "../settings";
import cx from "classnames";
import useDraftInput from "../useDraftInput";
import useSetting from "../useSetting";
import { useState } from "react";

type SaveSetting = <K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]) => void;

export default function TabRules({ onSaveSetting }: { onSaveSetting: SaveSetting }) {
  const whitelist = useSetting("whitelist");
  const [newPattern, setNewPattern] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  function addRule(event: React.FormEvent<HTMLElement>) {
    event.preventDefault();
    if (!isValidPattern(newPattern)) return;
    if (!whitelist.includes(newPattern)) onSaveSetting("whitelist", [newPattern, ...whitelist]);
    setNewPattern("");
  }

  function removeRule(index: number) {
    onSaveSetting(
      "whitelist",
      whitelist.filter((_, i) => i !== index),
    );
  }

  function moveRule(from: number, to: number) {
    if (from === to || to < 0 || to >= whitelist.length) return;
    const next = whitelist.slice();
    const [pattern] = next.splice(from, 1);
    next.splice(to, 0, pattern);
    onSaveSetting("whitelist", next);
  }

  function endDrag() {
    setDragIndex(null);
    setDropIndex(null);
  }

  return (
    <>
      <h5 className="mt-3">{chrome.i18n.getMessage("options_section_tabRules")}</h5>
      <div className="row">
        <div className="col-9">{chrome.i18n.getMessage("options_tabRules_description")}</div>
      </div>
      <div className="card mt-2">
        <ul className="list-group list-group-flush">
          <li className="list-group-item">
            <form onSubmit={addRule}>
              <RuleClause label={chrome.i18n.getMessage("options_tabRules_if")}>
                <label className="text-nowrap" htmlFor="wl-add">
                  {chrome.i18n.getMessage("options_tabRules_condition_urlContains")}
                </label>
                <input
                  className="form-control form-control-sm"
                  id="wl-add"
                  onChange={(event) => {
                    setNewPattern(event.target.value);
                  }}
                  type="text"
                  value={newPattern}
                />
              </RuleClause>
              <RuleClause label={chrome.i18n.getMessage("options_tabRules_then")}>
                <span className="flex-grow-1">
                  <i className="fas fa-lock me-1" />
                  {chrome.i18n.getMessage("options_tabRules_action_lock")}
                </span>
                <Button
                  disabled={!isValidPattern(newPattern)}
                  id="addToWL"
                  size="sm"
                  type="submit"
                  variant="secondary"
                >
                  <i className="fas fa-plus me-1" />
                  {chrome.i18n.getMessage("options_tabRules_addRule")}
                </Button>
              </RuleClause>
              <div className="form-text mb-0">
                {chrome.i18n.getMessage("options_option_autoLock_example")}
              </div>
            </form>
          </li>
          {whitelist.length === 0 ? (
            <li className="list-group-item text-center text-body-secondary">
              {chrome.i18n.getMessage("options_tabRules_empty")}
            </li>
          ) : (
            whitelist.map((pattern, index) => (
              <li
                className={cx("list-group-item d-flex align-items-center gap-2", {
                  "border-primary border-2": dropIndex === index && dragIndex !== index,
                  "border-top": dropIndex === index && dragIndex != null && dragIndex > index,
                  "border-bottom": dropIndex === index && dragIndex != null && dragIndex < index,
                  "opacity-50": dragIndex === index,
                })}
                key={pattern}
                onDragOver={(event) => {
                  if (dragIndex == null) return;
                  event.preventDefault();
                  setDropIndex(index);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragIndex != null) moveRule(dragIndex, index);
                  endDrag();
                }}
              >
                <span
                  className="text-body-secondary"
                  draggable
                  onDragEnd={endDrag}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setDragImage(
                      event.currentTarget.parentElement ?? event.currentTarget,
                      0,
                      0,
                    );
                    setDragIndex(index);
                  }}
                  style={{ cursor: "grab" }}
                >
                  <i className="fas fa-grip-vertical" />
                </span>
                <div className="flex-grow-1">
                  <RuleClause label={chrome.i18n.getMessage("options_tabRules_if")}>
                    <span>
                      {chrome.i18n.getMessage("options_tabRules_condition_urlContains")}{" "}
                      <code>{pattern}</code>
                    </span>
                  </RuleClause>
                  <RuleClause label={chrome.i18n.getMessage("options_tabRules_then")}>
                    <span>
                      <i className="fas fa-lock me-1" />
                      {chrome.i18n.getMessage("options_tabRules_action_lock")}
                    </span>
                  </RuleClause>
                </div>
                <div className="btn-group-vertical">
                  <Button
                    aria-label={chrome.i18n.getMessage("options_tabRules_moveUp")}
                    className="btn-xs"
                    disabled={index === 0}
                    onClick={() => {
                      moveRule(index, index - 1);
                    }}
                    title={chrome.i18n.getMessage("options_tabRules_moveUp")}
                    variant="outline-secondary"
                  >
                    <i className="fas fa-chevron-up" />
                  </Button>
                  <Button
                    aria-label={chrome.i18n.getMessage("options_tabRules_moveDown")}
                    className="btn-xs"
                    disabled={index === whitelist.length - 1}
                    onClick={() => {
                      moveRule(index, index + 1);
                    }}
                    title={chrome.i18n.getMessage("options_tabRules_moveDown")}
                    variant="outline-secondary"
                  >
                    <i className="fas fa-chevron-down" />
                  </Button>
                </div>
                <Button
                  aria-label={chrome.i18n.getMessage("options_tabRules_remove")}
                  onClick={() => {
                    removeRule(index);
                  }}
                  size="sm"
                  title={chrome.i18n.getMessage("options_tabRules_remove")}
                  variant="outline-secondary"
                >
                  <i className="fas fa-trash" />
                </Button>
              </li>
            ))
          )}
          <li className="list-group-item bg-body-tertiary">
            <RuleClause label={chrome.i18n.getMessage("options_tabRules_otherwise")}>
              <span className="text-nowrap">
                <i className="fas fa-times-circle me-1" />
                {chrome.i18n.getMessage("options_tabRules_action_closeAfter")}
              </span>
            </RuleClause>
            <InactiveTimeOption onSaveSetting={onSaveSetting} />
          </li>
        </ul>
      </div>
    </>
  );
}

function RuleClause({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="d-flex align-items-center gap-2 my-1">
      <span
        className="badge text-bg-secondary text-uppercase flex-shrink-0"
        style={{ minWidth: "3rem" }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function InactiveTimeOption({ onSaveSetting }: { onSaveSetting: SaveSetting }) {
  const minutesInactive = useSetting("minutesInactive");
  const secondsInactive = useSetting("secondsInactive");
  const [zeroDurationError, setZeroDurationError] = useState(false);

  const daysInactive = Math.floor(minutesInactive / (24 * 60));
  const hoursInactive = Math.floor((minutesInactive % (24 * 60)) / 60);
  const minutesInactiveUI = minutesInactive % 60;

  function handleMinutesInactiveChange(days: number, hours: number, minutes: number): boolean {
    const total = days * 24 * 60 + hours * 60 + minutes;
    if (total === 0 && secondsInactive === 0) {
      setZeroDurationError(true);
      return false;
    }
    setZeroDurationError(false);
    onSaveSetting("minutesInactive", total);
    return true;
  }

  function handleSecondsInactiveChange(seconds: number): boolean {
    if (seconds === 0 && minutesInactive === 0) {
      setZeroDurationError(true);
      return false;
    }
    setZeroDurationError(false);
    onSaveSetting("secondsInactive", seconds);
    return true;
  }

  const daysDraft = useDraftInput(daysInactive, (days) =>
    handleMinutesInactiveChange(days, hoursInactive, minutesInactiveUI),
  );

  const hoursDraft = useDraftInput(hoursInactive, (hours) =>
    handleMinutesInactiveChange(daysInactive, hours, minutesInactiveUI),
  );

  const minutesDraft = useDraftInput(minutesInactiveUI, (minutes) =>
    handleMinutesInactiveChange(daysInactive, hoursInactive, minutes),
  );

  const secondsDraft = useDraftInput(secondsInactive, (seconds) =>
    handleSecondsInactiveChange(Math.min(59, seconds)),
  );

  function formatInactiveDuration(
    days: number,
    hours: number,
    minutes: number,
    seconds: number,
  ): string {
    const parts: string[] = [];
    if (days > 0)
      parts.push(
        chrome.i18n.getMessage(
          days === 1
            ? "options_option_timeInactive_duration_day"
            : "options_option_timeInactive_duration_days",
          [String(days)],
        ),
      );
    if (hours > 0)
      parts.push(
        chrome.i18n.getMessage(
          hours === 1
            ? "options_option_timeInactive_duration_hour"
            : "options_option_timeInactive_duration_hours",
          [String(hours)],
        ),
      );
    if (minutes > 0)
      parts.push(
        chrome.i18n.getMessage(
          minutes === 1
            ? "options_option_timeInactive_duration_minute"
            : "options_option_timeInactive_duration_minutes",
          [String(minutes)],
        ),
      );
    if (seconds > 0)
      parts.push(
        chrome.i18n.getMessage(
          seconds === 1
            ? "options_option_timeInactive_duration_second"
            : "options_option_timeInactive_duration_seconds",
          [String(seconds)],
        ),
      );
    return parts.length > 0
      ? parts.join(", ")
      : chrome.i18n.getMessage("options_option_timeInactive_duration_seconds", ["0"]);
  }

  return (
    <div style={{ marginLeft: "calc(3rem + 0.5rem)" }}>
      <div className="input-group input-group-sm w-75">
        <input className="form-control" min="0" type="number" {...daysDraft} />
        <abbr className="input-group-text">
          {chrome.i18n.getMessage("options_option_timeInactive_abbr_days")}
        </abbr>
        <input className="form-control" min="0" type="number" {...hoursDraft} />
        <abbr className="input-group-text">
          {chrome.i18n.getMessage("options_option_timeInactive_abbr_hours")}
        </abbr>
        <input className="form-control" min="0" type="number" {...minutesDraft} />
        <abbr className="input-group-text">
          {chrome.i18n.getMessage("options_option_timeInactive_abbr_minutes")}
        </abbr>
        <input className="form-control" min="0" type="number" {...secondsDraft} />
        <abbr className="input-group-text">
          {chrome.i18n.getMessage("options_option_timeInactive_abbr_seconds")}
        </abbr>
      </div>
      {zeroDurationError ? (
        <div className="form-text text-danger">
          {chrome.i18n.getMessage("options_option_timeInactive_error_zero")}
        </div>
      ) : null}
      <div className="form-text">
        {formatInactiveDuration(daysInactive, hoursInactive, minutesInactiveUI, secondsInactive)}
      </div>
    </div>
  );
}

function isValidPattern(pattern: string) {
  return pattern != null && pattern.length > 0 && /\S/.test(pattern);
}
