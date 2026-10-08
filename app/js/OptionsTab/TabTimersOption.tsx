import { OverlayTrigger, Tooltip } from "react-bootstrap";
import { type TabRule, createTabRule } from "../tabRules";
import Button from "react-bootstrap/Button";
import type { SettingsSchema } from "../settings";
import cx from "classnames";
import { isValidPattern } from "../util";
import useSetting from "../useSetting";
import { useState } from "react";

const SECONDS_PER_HOUR = 60 * 60;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;
// "00d00h00m00s" with up to 3 digits of days
const MAX_DURATION_DIGITS = 9;

export default function TabTimersOption({
  onSaveSetting,
}: {
  onSaveSetting: <K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]) => void;
}) {
  const tabRules = useSetting("tabRules");
  const minutesInactive = useSetting("minutesInactive");
  const secondsInactive = useSetting("secondsInactive");
  const [newPattern, setNewPattern] = useState("");
  const [newSeconds, setNewSeconds] = useState<number | null>(null);
  const fallbackSeconds = minutesInactive * 60 + secondsInactive;

  function updateTabRule(index: number, changes: Partial<TabRule>) {
    onSaveSetting(
      "tabRules",
      tabRules.map((rule, i) => (i === index ? { ...rule, ...changes } : rule)),
    );
  }

  function moveTabRule(index: number, offset: -1 | 1) {
    const nextTabRules = [...tabRules];
    [nextTabRules[index], nextTabRules[index + offset]] = [
      nextTabRules[index + offset],
      nextTabRules[index],
    ];
    onSaveSetting("tabRules", nextTabRules);
  }

  function removeTabRule(index: number) {
    onSaveSetting(
      "tabRules",
      tabRules.filter((_rule, i) => i !== index),
    );
  }

  function addTabRule() {
    if (!isValidPattern(newPattern)) return;
    if (!tabRules.some((rule) => rule.when.url === newPattern))
      onSaveSetting("tabRules", [
        createTabRule(newPattern, (newSeconds ?? fallbackSeconds) * 1000),
        ...tabRules,
      ]);
    setNewPattern("");
    setNewSeconds(null);
  }

  function saveFallbackSeconds(seconds: number) {
    const nextMinutesInactive = Math.floor(seconds / 60);
    const nextSecondsInactive = seconds % 60;
    if (nextMinutesInactive !== minutesInactive)
      onSaveSetting("minutesInactive", nextMinutesInactive);
    if (nextSecondsInactive !== secondsInactive)
      onSaveSetting("secondsInactive", nextSecondsInactive);
  }

  return (
    <>
      <label className="form-label mt-3 mb-0">
        <strong>{chrome.i18n.getMessage("options_option_timeInactive_label")}</strong>
      </label>
      <div className="form-text mt-0 mb-1">
        {chrome.i18n.getMessage("options_option_tabTimers_description")}
      </div>
      <table className="table table-bordered align-middle mb-0 rounded-md">
        <thead>
          <tr>
            <th style={{ width: "50%" }}>
              {chrome.i18n.getMessage("options_option_tabTimers_urlContains")}
            </th>
            <th>
              <OverlayTrigger
                overlay={
                  <Tooltip>
                    {chrome.i18n.getMessage("options_option_tabTimers_durationTooltip")}
                  </Tooltip>
                }
              >
                <span>
                  {chrome.i18n.getMessage("options_option_tabTimers_durationHeader")}{" "}
                  <i className="fas fa-question-circle text-muted" />
                </span>
              </OverlayTrigger>
            </th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <input
                aria-label={chrome.i18n.getMessage("options_option_tabTimers_urlContains")}
                className="form-control"
                type="text"
                value={newPattern}
                onChange={(event) => {
                  setNewPattern(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  addTabRule();
                }}
              />
            </td>
            <td>
              <DurationInput
                totalSeconds={newSeconds ?? fallbackSeconds}
                onCommit={setNewSeconds}
              />
            </td>
            <td>
              <Button
                className="text-nowrap w-100"
                disabled={!isValidPattern(newPattern)}
                size="sm"
                variant="secondary"
                onClick={addTabRule}
              >
                {chrome.i18n.getMessage("options_option_tabTimers_add")}
              </Button>
            </td>
          </tr>
          {tabRules.map((rule, index) => (
            <tr key={rule.id}>
              <td>
                <PatternInput
                  value={rule.when.url}
                  onCommit={(url) => {
                    updateTabRule(index, { when: { url } });
                  }}
                />
              </td>
              <td>
                <DurationInput
                  totalSeconds={Math.round(rule.timeoutMs / 1000)}
                  onCommit={(seconds) => {
                    updateTabRule(index, { timeoutMs: seconds * 1000 });
                  }}
                />
              </td>
              <td>
                <div className="d-flex gap-1">
                  <Button
                    disabled={index === 0}
                    size="sm"
                    title={chrome.i18n.getMessage("options_option_tabTimers_moveUp")}
                    variant="outline-secondary"
                    onClick={() => {
                      moveTabRule(index, -1);
                    }}
                  >
                    <i className="fas fa-arrow-up" />
                  </Button>
                  <Button
                    disabled={index === tabRules.length - 1}
                    size="sm"
                    title={chrome.i18n.getMessage("options_option_tabTimers_moveDown")}
                    variant="outline-secondary"
                    onClick={() => {
                      moveTabRule(index, 1);
                    }}
                  >
                    <i className="fas fa-arrow-down" />
                  </Button>
                  <Button
                    size="sm"
                    title={chrome.i18n.getMessage("options_option_tabTimers_remove")}
                    variant="outline-secondary"
                    onClick={() => {
                      removeTabRule(index);
                    }}
                  >
                    <i className="fas fa-times" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
          <tr>
            <td>{chrome.i18n.getMessage("options_option_tabTimers_allOtherTabs")}</td>
            <td>
              <DurationInput totalSeconds={fallbackSeconds} onCommit={saveFallbackSeconds} />
            </td>
            <td />
          </tr>
        </tbody>
      </table>
    </>
  );
}

function PatternInput({ onCommit, value }: { onCommit: (value: string) => void; value: string }) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft != null && draft !== value && isValidPattern(draft)) onCommit(draft);
    setDraft(null);
  }

  return (
    <input
      aria-label={chrome.i18n.getMessage("options_option_tabTimers_urlContains")}
      className="form-control"
      type="text"
      value={draft ?? value}
      onBlur={commit}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        event.currentTarget.blur();
      }}
    />
  );
}

/**
 * Single "00d00h00m00s" input. Typed digits shift in from the right like a timer app, so "130" is
 * one minute thirty seconds. Commits on blur or Enter.
 */
function DurationInput({
  onCommit,
  totalSeconds,
}: {
  onCommit: (seconds: number) => void;
  totalSeconds: number;
}) {
  const [draftDigits, setDraftDigits] = useState<string | null>(null);
  const [zeroDurationError, setZeroDurationError] = useState(false);

  function commit() {
    if (draftDigits == null) return;
    const seconds = parseDurationDigits(draftDigits);
    setDraftDigits(null);
    setZeroDurationError(seconds === 0);
    if (seconds !== 0 && seconds !== totalSeconds) onCommit(seconds);
  }

  return (
    <>
      <input
        aria-label={chrome.i18n.getMessage("options_option_tabTimers_durationHeader")}
        className={cx("form-control font-monospace", {
          "is-invalid": zeroDurationError,
        })}
        inputMode="numeric"
        style={{ width: "9rem" }}
        type="text"
        value={formatDurationDigits(draftDigits ?? toDurationDigits(totalSeconds))}
        onBlur={commit}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").replace(/^0+/, "");
          if (digits.length <= MAX_DURATION_DIGITS) setDraftDigits(digits);
        }}
        onFocus={(event) => {
          setDraftDigits(toDurationDigits(totalSeconds));
          event.target.select();
        }}
        onKeyDown={(event) => {
          const { selectionEnd, selectionStart, value } = event.currentTarget;
          if (
            event.key === "Backspace" &&
            selectionStart === value.length &&
            selectionEnd === value.length
          ) {
            event.preventDefault();
            const digits = draftDigits ?? toDurationDigits(totalSeconds);
            setDraftDigits(digits.slice(0, -1).replace(/^0+/, ""));
          } else if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      {zeroDurationError ? (
        <div className="invalid-feedback d-block">
          {chrome.i18n.getMessage("options_option_timeInactive_error_zero")}
        </div>
      ) : null}
    </>
  );
}

function toDurationDigits(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / SECONDS_PER_DAY);
  const hours = Math.floor((totalSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / 60);
  const seconds = totalSeconds % 60;
  return [days, hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join("");
}

function splitDurationDigits(digits: string): [string, string, string, string] {
  const padded = digits.padStart(8, "0");
  return [padded.slice(0, -6), padded.slice(-6, -4), padded.slice(-4, -2), padded.slice(-2)];
}

function formatDurationDigits(digits: string): string {
  const [days, hours, minutes, seconds] = splitDurationDigits(digits);
  return `${days}d${hours}h${minutes}m${seconds}s`;
}

function parseDurationDigits(digits: string): number {
  const [days, hours, minutes, seconds] = splitDurationDigits(digits).map(Number);
  return days * SECONDS_PER_DAY + hours * SECONDS_PER_HOUR + minutes * 60 + seconds;
}
