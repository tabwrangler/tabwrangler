import settings, { type SettingsSchema } from "../settings";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Button from "react-bootstrap/Button";
import { ButtonGroup } from "react-bootstrap";
import cx from "classnames";
import useDraftInput from "../useDraftInput";
import useSetting from "../useSetting";

type SaveSetting = <K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]) => void;

export default function TabRules({ onSaveSetting }: { onSaveSetting: SaveSetting }) {
  const whitelist = useSetting("whitelist");
  const [isAdding, setIsAdding] = useState(false);
  const [newPattern, setNewPattern] = useState("");

  // `savingFrom` keeps the row in edit mode after Save until storage echoes the new whitelist back.
  const [editing, setEditing] = useState<{
    pattern: string;
    savingFrom: string[] | null;
    value: string;
  } | null>(null);

  // Keeps the form on screen after Save until storage echoes the new whitelist back, so the saved
  // rule can take the form's place without the table collapsing in between.
  const [savingFrom, setSavingFrom] = useState<string[] | null>(null);
  const isFormVisible = isAdding || savingFrom === whitelist;
  const formRef = useRef<HTMLLIElement | null>(null);
  const savedRuleRef = useRef<{ formHeight: number; pattern: string } | null>(null);

  // While dragging, rows render in `drag.order` so they shift around the ghost of the dragged row.
  const [drag, setDrag] = useState<{ order: string[]; pattern: string } | null>(null);

  // Holds the dropped order until storage echoes the saved whitelist back, so rows don't flash
  // back to their old positions in between.
  const [dropped, setDropped] = useState<{ base: string[]; order: string[] } | null>(null);
  const [supportsTabGroups, setSupportsTabGroups] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const removingRef = useRef(new Set<string>());
  const flipRef = useRef<{ fade: Set<string>; tops: Map<string, number> } | null>(null);
  const rules = drag?.order ?? (dropped?.base === whitelist ? dropped.order : whitelist);

  // FLIP animation: rows are measured before a reorder and animated from their old positions once
  // the new order renders.
  useLayoutEffect(() => {
    const flip = flipRef.current;
    if (flip == null) return;
    flipRef.current = null;
    if (prefersReducedMotion()) return;
    for (const [pattern, oldTop] of flip.tops) {
      const el = rowRefs.current.get(pattern);
      if (el == null) continue;
      el.getAnimations().forEach((animation) => animation.cancel());
      const dy = oldTop - el.getBoundingClientRect().top;
      if (dy === 0) continue;
      const fade = flip.fade.has(pattern) ? 0.5 : 1;
      el.animate(
        [
          { opacity: fade, transform: `translateY(${dy}px)` },
          { opacity: 1, transform: "none" },
        ],
        { duration: flip.fade.size > 0 ? 250 : 150, easing: "ease-in-out" },
      );
    }
  }, [JSON.stringify(rules)]); // eslint-disable-line react-hooks/exhaustive-deps

  // Grows the form open from the top of the table.
  useLayoutEffect(() => {
    const el = formRef.current;
    if (!isAdding || el == null || prefersReducedMotion()) return;
    const { paddingBottom, paddingTop } = getComputedStyle(el);
    el.animate(
      [
        { height: "0px", opacity: 0, overflow: "hidden", paddingBottom: "0px", paddingTop: "0px" },
        {
          height: `${el.offsetHeight}px`,
          opacity: 1,
          overflow: "hidden",
          paddingBottom,
          paddingTop,
        },
      ],
      { duration: 200, easing: "ease-out" },
    );
  }, [isAdding]);

  // Morphs the form into the saved rule: the new row starts at the form's height and primary
  // background, then settles into a regular row.
  useLayoutEffect(() => {
    const saved = savedRuleRef.current;
    if (saved == null) return;
    const el = rowRefs.current.get(saved.pattern);
    if (el == null) return;
    savedRuleRef.current = null;
    if (prefersReducedMotion()) return;
    const primaryBg = getComputedStyle(el).getPropertyValue("--bs-primary-bg-subtle");
    el.animate(
      [
        { backgroundColor: primaryBg, height: `${saved.formHeight}px`, overflow: "hidden" },
        { height: `${el.offsetHeight}px`, overflow: "hidden" },
      ],
      { duration: 400, easing: "ease-out" },
    );
  }, [whitelist]);

  useEffect(() => {
    async function checkForTabGroups() {
      const tabs = await chrome.tabs.query({});
      if (tabs.length > 0 && "groupId" in tabs[0]) setSupportsTabGroups(true);
    }
    checkForTabGroups();
  }, []);

  function measureRows(fade: string[] = []) {
    const tops = new Map<string, number>();
    for (const [pattern, el] of rowRefs.current) tops.set(pattern, el.getBoundingClientRect().top);
    flipRef.current = { fade: new Set(fade), tops };
  }

  // The new rule form previews where the rule will land: at the top, ahead of the existing rules.
  const firstRuleIndex = isFormVisible ? 1 : 0;

  const isDuplicatePattern = whitelist.includes(newPattern);

  function addRule(event: React.FormEvent<HTMLElement>) {
    event.preventDefault();
    if (!isValidPattern(newPattern) || isDuplicatePattern || savingFrom === whitelist) return;
    savedRuleRef.current = { formHeight: formRef.current?.offsetHeight ?? 0, pattern: newPattern };
    setSavingFrom(whitelist);
    setIsAdding(false);
    onSaveSetting("whitelist", [newPattern, ...whitelist]);
  }

  function cancelAddRule() {
    setIsAdding(false);
    setNewPattern("");
  }

  function isEditingRule(pattern: string) {
    return (
      editing?.pattern === pattern &&
      (editing.savingFrom == null || editing.savingFrom === whitelist)
    );
  }

  const isDuplicateEdit =
    editing != null && editing.value !== editing.pattern && whitelist.includes(editing.value);

  function saveEdit(event: React.FormEvent<HTMLElement>) {
    event.preventDefault();
    if (editing == null || editing.savingFrom != null) return;
    if (editing.value === editing.pattern) {
      setEditing(null);
      return;
    }
    if (!isValidPattern(editing.value) || isDuplicateEdit) return;
    setEditing({ ...editing, savingFrom: whitelist });
    onSaveSetting(
      "whitelist",
      settings.get("whitelist").map((p) => (p === editing.pattern ? editing.value : p)),
    );
  }

  async function removeRule(pattern: string) {
    if (removingRef.current.has(pattern)) return;
    removingRef.current.add(pattern);
    const el = rowRefs.current.get(pattern);
    if (el != null && !prefersReducedMotion()) {
      const { paddingBottom, paddingTop } = getComputedStyle(el);
      // Holds the collapsed state ("forwards") until storage echoes the change and the row unmounts.
      await el.animate(
        [
          {
            height: `${el.offsetHeight}px`,
            opacity: 1,
            overflow: "hidden",
            paddingBottom,
            paddingTop,
          },
          {
            height: "0px",
            opacity: 0,
            overflow: "hidden",
            paddingBottom: "0px",
            paddingTop: "0px",
          },
        ],
        { duration: 200, easing: "ease-in", fill: "forwards" },
      ).finished;
    }
    removingRef.current.delete(pattern);
    onSaveSetting(
      "whitelist",
      settings.get("whitelist").filter((p) => p !== pattern),
    );
  }

  function moveRule(from: number, to: number) {
    if (from === to || to < 0 || to >= whitelist.length) return;
    const next = whitelist.slice();
    const [pattern] = next.splice(from, 1);
    next.splice(to, 0, pattern);
    onSaveSetting("whitelist", next);
  }

  function swapRule(from: number, to: number) {
    measureRows([whitelist[from], whitelist[to]]);
    moveRule(from, to);
  }

  function handleDragOver(event: React.DragEvent<HTMLElement>) {
    if (drag == null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    // Hit-test against layout positions, which ignore in-flight FLIP transforms, so rows animating
    // under the cursor can't bounce the ghost back and forth.
    const rows = drag.order.map((pattern) => rowRefs.current.get(pattern));
    const parent = rows[0]?.offsetParent;
    if (parent == null) return;
    const y = event.clientY - parent.getBoundingClientRect().top - parent.clientTop;
    let target = rows.findIndex((row) => row != null && y < row.offsetTop + row.offsetHeight);
    if (target === -1) target = rows.length - 1;

    const from = drag.order.indexOf(drag.pattern);
    if (target === from) return;
    const order = drag.order.slice();
    order.splice(from, 1);
    order.splice(target, 0, drag.pattern);
    measureRows();
    setDrag({ order, pattern: drag.pattern });
  }

  function handleDrop(event: React.DragEvent<HTMLElement>) {
    if (drag == null) return;
    event.preventDefault();
    if (drag.order.some((pattern, i) => pattern !== whitelist[i])) {
      setDropped({ base: whitelist, order: drag.order });
      onSaveSetting("whitelist", drag.order);
    }
    setDrag(null);
  }

  function handleDragEnd() {
    measureRows();
    setDrag(null);
  }

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mt-3">
        <h5 className="mb-0">{chrome.i18n.getMessage("options_section_tabRules")}</h5>
        <Button
          disabled={isFormVisible}
          onClick={() => {
            setNewPattern("");
            setIsAdding(true);
          }}
          size="sm"
          variant="secondary"
        >
          <i className="fas fa-plus me-1" />
          {chrome.i18n.getMessage("options_tabRules_addRule")}
        </Button>
      </div>
      <div className="row form-text">
        <div className="col-9">{chrome.i18n.getMessage("options_tabRules_description")}</div>
      </div>
      <div className="card mt-2">
        <ul className="list-group list-group-flush" onDragOver={handleDragOver} onDrop={handleDrop}>
          {isFormVisible && (
            <li
              className="list-group-item d-flex align-items-center gap-2 bg-primary-subtle"
              ref={formRef}
            >
              <RuleForm
                canSave={isAdding && isValidPattern(newPattern) && !isDuplicatePattern}
                conditionLabel={conditionLabel(0)}
                id="wl-add"
                isDuplicate={isDuplicatePattern && isAdding}
                onCancel={cancelAddRule}
                onChange={setNewPattern}
                onSubmit={addRule}
                readOnly={!isAdding}
                value={newPattern}
              />
            </li>
          )}
          {rules.length === 0 && !isFormVisible ? (
            <li className="list-group-item text-center text-body-secondary">
              {chrome.i18n.getMessage("options_tabRules_empty")}
            </li>
          ) : (
            rules.map((pattern, index) => (
              <li
                className={cx("list-group-item d-flex align-items-center gap-2", {
                  "bg-body-tertiary opacity-50": drag?.pattern === pattern,
                  "bg-primary-subtle": isEditingRule(pattern),
                })}
                key={pattern}
                ref={(el) => {
                  if (el == null) rowRefs.current.delete(pattern);
                  else rowRefs.current.set(pattern, el);
                }}
              >
                {isEditingRule(pattern) && editing != null ? (
                  <RuleForm
                    canSave={
                      editing.savingFrom == null &&
                      isValidPattern(editing.value) &&
                      !isDuplicateEdit
                    }
                    conditionLabel={conditionLabel(index + firstRuleIndex)}
                    id="wl-edit"
                    isDuplicate={isDuplicateEdit && editing.savingFrom == null}
                    onCancel={() => {
                      setEditing(null);
                    }}
                    onChange={(value) => {
                      setEditing({ ...editing, value });
                    }}
                    onSubmit={saveEdit}
                    readOnly={editing.savingFrom != null}
                    value={editing.value}
                  />
                ) : (
                  <>
                    <span
                      className="text-body-secondary"
                      draggable
                      onDragEnd={handleDragEnd}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setDragImage(
                          event.currentTarget.parentElement ?? event.currentTarget,
                          0,
                          0,
                        );
                        // Deferred so the browser snapshots the drag image before the row turns into a ghost.
                        setTimeout(() => {
                          setDrag({ order: whitelist, pattern });
                        });
                      }}
                      style={{ cursor: "grab" }}
                    >
                      <i className="fas fa-grip-vertical" />
                    </span>
                    <RuleLine ifLabel={conditionLabel(index + firstRuleIndex)}>
                      <span className="text-truncate" title={pattern}>
                        {chrome.i18n.getMessage("options_tabRules_condition_urlContains")}{" "}
                        <code>{pattern}</code>
                      </span>
                    </RuleLine>
                    <div className="tab-rule-controls">
                      <ButtonGroup size="sm">
                        <Button
                          aria-label={chrome.i18n.getMessage("options_tabRules_moveUp")}
                          disabled={index === 0}
                          onClick={() => {
                            swapRule(index, index - 1);
                          }}
                          title={chrome.i18n.getMessage("options_tabRules_moveUp")}
                          variant="outline-secondary"
                        >
                          <i className="fas fa-chevron-up" />
                        </Button>
                        <Button
                          aria-label={chrome.i18n.getMessage("options_tabRules_moveDown")}
                          disabled={index === rules.length - 1}
                          onClick={() => {
                            swapRule(index, index + 1);
                          }}
                          title={chrome.i18n.getMessage("options_tabRules_moveDown")}
                          variant="outline-secondary"
                        >
                          <i className="fas fa-chevron-down" />
                        </Button>
                      </ButtonGroup>
                      <ButtonGroup>
                        <Button
                          aria-label={chrome.i18n.getMessage("options_tabRules_edit")}
                          onClick={() => {
                            setEditing({ pattern, savingFrom: null, value: pattern });
                          }}
                          size="sm"
                          title={chrome.i18n.getMessage("options_tabRules_edit")}
                          variant="outline-secondary"
                        >
                          <i className="fas fa-pen" />
                        </Button>
                        <Button
                          aria-label={chrome.i18n.getMessage("options_tabRules_remove")}
                          onClick={() => {
                            removeRule(pattern);
                          }}
                          size="sm"
                          title={chrome.i18n.getMessage("options_tabRules_remove")}
                          variant="outline-secondary"
                        >
                          <i className="fas fa-trash" />
                        </Button>
                      </ButtonGroup>
                    </div>
                  </>
                )}
              </li>
            ))
          )}
          <FixedRule
            icon="fa-volume-up"
            ifLabel={conditionLabel(rules.length + firstRuleIndex)}
            label={chrome.i18n.getMessage("options_tabRules_condition_audible")}
            onSaveSetting={onSaveSetting}
            settingKey="filterAudio"
          />
          <FixedRule
            disabled={!supportsTabGroups}
            ifLabel={conditionLabel(rules.length + firstRuleIndex + 1)}
            label={chrome.i18n.getMessage("options_tabRules_condition_grouped")}
            onSaveSetting={onSaveSetting}
            settingKey="filterGroupedTabs"
          />
          <li className="list-group-item d-flex align-items-center gap-2 bg-body-tertiary">
            <span className="text-body-secondary opacity-25">
              <i className="fas fa-grip-vertical" />
            </span>
            <div className="d-flex flex-column gap-1 flex-grow-1">
              <RuleClause label={chrome.i18n.getMessage("options_tabRules_else")}>
                <span>{chrome.i18n.getMessage("options_tabRules_action_closeAfter")}:</span>
              </RuleClause>
              <InactiveTimeOption onSaveSetting={onSaveSetting} />
            </div>
          </li>
        </ul>
      </div>
    </>
  );
}

function FixedRule({
  disabled = false,
  icon,
  ifLabel,
  label,
  onSaveSetting,
  settingKey,
}: {
  disabled?: boolean;
  icon?: string;
  ifLabel: string;
  label: string;
  onSaveSetting: SaveSetting;
  settingKey: "filterAudio" | "filterGroupedTabs";
}) {
  const enabled = useSetting(settingKey);
  return (
    <li className="list-group-item d-flex align-items-center gap-2 bg-body-tertiary">
      <span className="text-body-secondary opacity-25">
        <i className="fas fa-grip-vertical" />
      </span>
      <RuleLine className={cx({ "opacity-50": !enabled || disabled })} ifLabel={ifLabel}>
        <span className="text-truncate" id={`${settingKey}-condition`}>
          {icon != null && <i className={`fas ${icon} me-1`} />}
          {label}
        </span>
      </RuleLine>
      <div className="tab-rule-controls">
        <div className="form-check form-switch form-check-reverse mb-0">
          <input
            aria-describedby={`${settingKey}-condition`}
            checked={enabled}
            className="form-check-input"
            disabled={disabled}
            id={settingKey}
            onChange={(event) => {
              onSaveSetting(settingKey, event.target.checked);
            }}
            role="switch"
            type="checkbox"
          />
          <label className="form-check-label fs-6" htmlFor={settingKey}>
            {chrome.i18n.getMessage("options_tabRules_enabled")}
          </label>
        </div>
      </div>
    </li>
  );
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function conditionLabel(position: number) {
  return chrome.i18n.getMessage(position === 0 ? "options_tabRules_if" : "options_tabRules_elseIf");
}

// Shared by the new rule form and inline editing so both match a rule row's layout exactly.
function RuleForm({
  canSave,
  conditionLabel,
  id,
  isDuplicate,
  onCancel,
  onChange,
  onSubmit,
  readOnly,
  value,
}: {
  canSave: boolean;
  conditionLabel: string;
  id: string;
  isDuplicate: boolean;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  readOnly: boolean;
  value: string;
}) {
  return (
    <>
      <span className="opacity-25 text-body-secondary">
        <i className="fas fa-grip-vertical" />
      </span>
      <form
        className="flex-grow-1 d-flex align-items-center gap-2"
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
        onSubmit={onSubmit}
      >
        <div className="d-flex flex-column gap-1 flex-grow-1 overflow-hidden">
          <RuleLine ifLabel={conditionLabel} truncate={false}>
            <label className="text-nowrap" htmlFor={id}>
              {chrome.i18n.getMessage("options_tabRules_condition_urlContains")}
            </label>
            <input
              autoFocus
              className={cx("form-control form-control-sm", { "is-invalid": isDuplicate })}
              id={id}
              onChange={(event) => {
                onChange(event.target.value);
              }}
              readOnly={readOnly}
              type="text"
              value={value}
            />
          </RuleLine>
          {isDuplicate && (
            <div className="form-text text-danger mt-0" style={{ marginLeft: "4.5rem" }}>
              {chrome.i18n.getMessage("options_tabRules_duplicate")}
            </div>
          )}
        </div>
        <div className="tab-rule-controls">
          <Button onClick={onCancel} size="sm" variant="outline-secondary">
            {chrome.i18n.getMessage("options_tabRules_cancel")}
          </Button>
          <Button disabled={!canSave} size="sm" type="submit" variant="primary">
            {chrome.i18n.getMessage("options_save")}
          </Button>
        </div>
      </form>
    </>
  );
}

// One rule on a single line: the "If" condition takes the remaining width and "Then" sits in a
// minimum-width column, so actions line up across rows in English. Longer translations widen the
// column instead of overlapping, and "Then" wraps under "If" when the line can't fit both.
function RuleLine({
  children,
  className,
  ifLabel,
  truncate = true,
}: {
  children: React.ReactNode;
  className?: string;
  ifLabel: string;
  // Text conditions truncate; form controls keep their minimum width so a tight line wraps instead.
  truncate?: boolean;
}) {
  return (
    <div
      className={cx(
        "d-flex flex-wrap align-items-center column-gap-3 row-gap-1 flex-grow-1 overflow-hidden",
        className,
      )}
    >
      <RuleClause className={cx("tab-rule-if", { "overflow-hidden": truncate })} label={ifLabel}>
        {children}
      </RuleClause>
      <RuleClause className="tab-rule-then" label={chrome.i18n.getMessage("options_tabRules_then")}>
        <span className="text-nowrap">
          <i className="fas fa-lock me-1" />
          {chrome.i18n.getMessage("options_tabRules_action_lock")}
        </span>
      </RuleClause>
    </div>
  );
}

function RuleClause({
  children,
  className,
  label,
}: {
  children?: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div className={cx("tab-rule-clause d-flex align-items-center gap-2", className)}>
      <span
        className="badge text-bg-secondary text-uppercase flex-shrink-0"
        style={{ minWidth: "4rem" }}
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
    <div>
      <div className="input-group w-75">
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
      {zeroDurationError && (
        <div className="form-text text-danger">
          {chrome.i18n.getMessage("options_option_timeInactive_error_zero")}
        </div>
      )}
      <div className="form-text">
        {formatInactiveDuration(daysInactive, hoursInactive, minutesInactiveUI, secondsInactive)}
      </div>
    </div>
  );
}

function isValidPattern(pattern: string) {
  return pattern != null && pattern.length > 0 && /\S/.test(pattern);
}
