import {
  DEFAULT_STALE_AFTER_SECONDS,
  type TabCondition,
  type TabRule,
  type TabRulesConfig,
  createLockRule,
  getElseRule,
} from "../tabRules";
import settings, { type SettingsSchema } from "../settings";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import Button from "react-bootstrap/Button";
import { ButtonGroup } from "react-bootstrap";
import cx from "classnames";
import useDraftInput from "../useDraftInput";
import useSetting from "../useSetting";

type SaveSetting = <K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]) => void;

type ConditionType = TabCondition["type"];

const CONDITION_TYPES: ConditionType[] = ["url", "audible", "groupId"];

interface Draft {
  type: ConditionType;
  value: string;
}

export default function TabRules({ onSaveSetting }: { onSaveSetting: SaveSetting }) {
  const tabRules = useSetting("tabRules");
  const savedRules = useMemo(() => getListedRules(tabRules), [tabRules]);
  const ruleIds = useMemo(() => savedRules.map((rule) => rule.id), [savedRules]);
  const [isAdding, setIsAdding] = useState(false);
  const [newDraft, setNewDraft] = useState<Draft>(EMPTY_DRAFT);

  // `savingFrom` keeps the row in edit mode after Save until storage echoes the new rules back.
  const [editing, setEditing] = useState<{
    draft: Draft;
    id: string;
    savingFrom: TabRule[] | null;
  } | null>(null);

  // Keeps the form on screen after Save until storage echoes the new rules back, so the saved
  // rule can take the form's place without the table collapsing in between.
  const [savingFrom, setSavingFrom] = useState<TabRule[] | null>(null);
  const isFormVisible = isAdding || savingFrom === savedRules;
  const formRef = useRef<HTMLLIElement | null>(null);
  const savedRuleRef = useRef<{ formHeight: number; id: string } | null>(null);

  // While dragging, rows render in `drag.order` so they shift around the ghost of the dragged row.
  const [drag, setDrag] = useState<{ id: string; order: string[] } | null>(null);

  // Holds the dropped order until storage echoes the saved rules back, so rows don't flash back to
  // their old positions in between.
  const [dropped, setDropped] = useState<{ base: TabRule[]; order: string[] } | null>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const removingRef = useRef(new Set<string>());
  const flipRef = useRef<{ fade: Set<string>; tops: Map<string, number> } | null>(null);
  const order = drag?.order ?? (dropped?.base === savedRules ? dropped.order : ruleIds);
  const rulesById = new Map(savedRules.map((rule) => [rule.id, rule]));
  const rules = order.flatMap((id) => rulesById.get(id) ?? []);

  // FLIP animation: rows are measured before a reorder and animated from their old positions once
  // the new order renders.
  useLayoutEffect(() => {
    const flip = flipRef.current;
    if (flip == null) return;
    flipRef.current = null;
    if (prefersReducedMotion()) return;
    for (const [id, oldTop] of flip.tops) {
      const el = rowRefs.current.get(id);
      if (el == null) continue;
      el.getAnimations().forEach((animation) => animation.cancel());
      const dy = oldTop - el.getBoundingClientRect().top;
      if (dy === 0) continue;
      const fade = flip.fade.has(id) ? 0.5 : 1;
      el.animate(
        [
          { opacity: fade, transform: `translateY(${dy}px)` },
          { opacity: 1, transform: "none" },
        ],
        { duration: flip.fade.size > 0 ? 250 : 150, easing: "ease-in-out" },
      );
    }
  }, [JSON.stringify(order)]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const el = rowRefs.current.get(saved.id);
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
  }, [savedRules]);

  function measureRows(fade: string[] = []) {
    const tops = new Map<string, number>();
    for (const [id, el] of rowRefs.current) tops.set(id, el.getBoundingClientRect().top);
    flipRef.current = { fade: new Set(fade), tops };
  }

  function saveRules(nextRules: TabRule[]) {
    const current = settings.get("tabRules");
    const elseRule = getElseRule(current);
    onSaveSetting("tabRules", {
      ...current,
      rules: elseRule == null ? nextRules : [...nextRules, elseRule],
    });
  }

  // The new rule form previews where the rule will land: at the top, ahead of the existing rules.
  const firstRuleIndex = isFormVisible ? 1 : 0;

  const newDraftError = draftError(newDraft, savedRules, null);

  function addRule(event: React.FormEvent<HTMLElement>) {
    event.preventDefault();
    if (!isValidDraft(newDraft) || newDraftError != null || savingFrom === savedRules) return;
    const rule = createLockRule(draftToCondition(newDraft));
    savedRuleRef.current = { formHeight: formRef.current?.offsetHeight ?? 0, id: rule.id };
    setSavingFrom(savedRules);
    setIsAdding(false);
    saveRules([rule, ...getListedRules(settings.get("tabRules"))]);
  }

  function cancelAddRule() {
    setIsAdding(false);
    setNewDraft(EMPTY_DRAFT);
  }

  function isEditingRule(id: string) {
    return editing?.id === id && (editing.savingFrom == null || editing.savingFrom === savedRules);
  }

  const editError = editing != null ? draftError(editing.draft, savedRules, editing.id) : null;

  function saveEdit(event: React.FormEvent<HTMLElement>) {
    event.preventDefault();
    if (editing == null || editing.savingFrom != null) return;
    const rule = rulesById.get(editing.id);
    const condition = draftToCondition(editing.draft);
    if (rule == null || JSON.stringify(rule.when) === JSON.stringify([condition])) {
      setEditing(null);
      return;
    }
    if (!isValidDraft(editing.draft) || editError != null) return;
    setEditing({ ...editing, savingFrom: savedRules });
    saveRules(
      getListedRules(settings.get("tabRules")).map((r) =>
        r.id === editing.id ? { ...r, when: [condition] } : r,
      ),
    );
  }

  async function removeRule(id: string) {
    if (removingRef.current.has(id)) return;
    removingRef.current.add(id);
    const el = rowRefs.current.get(id);
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
    removingRef.current.delete(id);
    saveRules(getListedRules(settings.get("tabRules")).filter((rule) => rule.id !== id));
  }

  function saveOrder(nextOrder: string[]) {
    const byId = new Map(getListedRules(settings.get("tabRules")).map((rule) => [rule.id, rule]));
    saveRules(nextOrder.flatMap((id) => byId.get(id) ?? []));
  }

  function moveRule(from: number, to: number) {
    if (from === to || to < 0 || to >= ruleIds.length) return;
    const next = ruleIds.slice();
    const [id] = next.splice(from, 1);
    next.splice(to, 0, id);
    saveOrder(next);
  }

  function swapRule(from: number, to: number) {
    measureRows([ruleIds[from], ruleIds[to]]);
    moveRule(from, to);
  }

  function handleDragOver(event: React.DragEvent<HTMLElement>) {
    if (drag == null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    // Hit-test against layout positions, which ignore in-flight FLIP transforms, so rows animating
    // under the cursor can't bounce the ghost back and forth.
    const rows = drag.order.map((id) => rowRefs.current.get(id));
    const parent = rows[0]?.offsetParent;
    if (parent == null) return;
    const y = event.clientY - parent.getBoundingClientRect().top - parent.clientTop;
    let target = rows.findIndex((row) => row != null && y < row.offsetTop + row.offsetHeight);
    if (target === -1) target = rows.length - 1;

    const from = drag.order.indexOf(drag.id);
    if (target === from) return;
    const nextOrder = drag.order.slice();
    nextOrder.splice(from, 1);
    nextOrder.splice(target, 0, drag.id);
    measureRows();
    setDrag({ id: drag.id, order: nextOrder });
  }

  function handleDrop(event: React.DragEvent<HTMLElement>) {
    if (drag == null) return;
    event.preventDefault();
    if (drag.order.some((id, i) => id !== ruleIds[i])) {
      setDropped({ base: savedRules, order: drag.order });
      saveOrder(drag.order);
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
            setNewDraft(EMPTY_DRAFT);
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
              className="list-group-item d-flex align-items-start gap-2 bg-primary-subtle"
              ref={formRef}
            >
              <RuleForm
                canSave={isAdding && isValidDraft(newDraft) && newDraftError == null}
                conditionLabel={conditionLabel(0)}
                draft={newDraft}
                error={isAdding ? newDraftError : null}
                id="rule-add"
                isTypeTaken={(type) => isConditionTypeTaken(type, savedRules, null)}
                onCancel={cancelAddRule}
                onChange={setNewDraft}
                onSubmit={addRule}
                readOnly={!isAdding}
              />
            </li>
          )}
          {rules.length === 0 && !isFormVisible ? (
            <li className="list-group-item text-center text-body-secondary">
              {chrome.i18n.getMessage("options_tabRules_empty")}
            </li>
          ) : (
            rules.map((rule, index) => (
              <li
                className={cx("list-group-item d-flex align-items-start gap-2", {
                  "bg-body-tertiary opacity-50": drag?.id === rule.id,
                  "bg-primary-subtle": isEditingRule(rule.id),
                })}
                key={rule.id}
                ref={(el) => {
                  if (el == null) rowRefs.current.delete(rule.id);
                  else rowRefs.current.set(rule.id, el);
                }}
              >
                {isEditingRule(rule.id) && editing != null ? (
                  <RuleForm
                    canSave={
                      editing.savingFrom == null && isValidDraft(editing.draft) && editError == null
                    }
                    conditionLabel={conditionLabel(index + firstRuleIndex)}
                    draft={editing.draft}
                    error={editing.savingFrom == null ? editError : null}
                    id="rule-edit"
                    isTypeTaken={(type) => isConditionTypeTaken(type, savedRules, editing.id)}
                    onCancel={() => {
                      setEditing(null);
                    }}
                    onChange={(draft) => {
                      setEditing({ ...editing, draft });
                    }}
                    onSubmit={saveEdit}
                    readOnly={editing.savingFrom != null}
                  />
                ) : (
                  <>
                    <RuleLine
                      className={cx({ "opacity-50": !rule.enabled })}
                      ifLabel={conditionLabel(index + firstRuleIndex)}
                    >
                      <RuleConditions rule={rule} />
                    </RuleLine>
                    <div className="tab-rule-controls">
                      <ButtonGroup>
                        <Button
                          aria-label={chrome.i18n.getMessage("options_tabRules_edit")}
                          disabled={ruleToDraft(rule) == null}
                          onClick={() => {
                            const draft = ruleToDraft(rule);
                            if (draft != null) setEditing({ draft, id: rule.id, savingFrom: null });
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
                            removeRule(rule.id);
                          }}
                          size="sm"
                          title={chrome.i18n.getMessage("options_tabRules_remove")}
                          variant="outline-secondary"
                        >
                          <i className="fas fa-trash" />
                        </Button>
                      </ButtonGroup>
                    </div>
                    <div className="tab-rule-reorder">
                      <Button
                        aria-label={chrome.i18n.getMessage("options_tabRules_moveUp")}
                        className="text-body-secondary"
                        disabled={index === 0}
                        onClick={() => {
                          swapRule(index, index - 1);
                        }}
                        title={chrome.i18n.getMessage("options_tabRules_moveUp")}
                        variant="link"
                      >
                        <i className="fas fa-chevron-up" />
                      </Button>
                      <span
                        className="text-body-secondary"
                        draggable
                        onDragEnd={handleDragEnd}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setDragImage(
                            event.currentTarget.closest("li") ?? event.currentTarget,
                            0,
                            0,
                          );
                          // Deferred so the browser snapshots the drag image before the row turns into a ghost.
                          setTimeout(() => {
                            setDrag({ id: rule.id, order: ruleIds });
                          });
                        }}
                        style={{ cursor: "grab" }}
                      >
                        <i className="fas fa-grip-vertical" />
                      </span>
                      <Button
                        aria-label={chrome.i18n.getMessage("options_tabRules_moveDown")}
                        className="text-body-secondary"
                        disabled={index === rules.length - 1}
                        onClick={() => {
                          swapRule(index, index + 1);
                        }}
                        title={chrome.i18n.getMessage("options_tabRules_moveDown")}
                        variant="link"
                      >
                        <i className="fas fa-chevron-down" />
                      </Button>
                    </div>
                  </>
                )}
              </li>
            ))
          )}
          <li className="list-group-item d-flex align-items-center gap-2 bg-body-tertiary">
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

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function conditionLabel(position: number) {
  return chrome.i18n.getMessage(position === 0 ? "options_tabRules_if" : "options_tabRules_elseIf");
}

const CONDITION_TYPE_MESSAGES: Record<ConditionType, string> = {
  audible: "options_tabRules_condition_audible",
  groupId: "options_tabRules_condition_grouped",
  url: "options_tabRules_condition_urlContains",
};

function conditionTypeLabel(type: ConditionType) {
  return chrome.i18n.getMessage(CONDITION_TYPE_MESSAGES[type]);
}

function RuleConditions({ rule }: { rule: TabRule }) {
  const [condition] = rule.when;
  if (rule.when.length !== 1) return null;
  switch (condition.type) {
    case "url":
      return (
        <span className="text-truncate" title={condition.value}>
          {conditionTypeLabel("url")} <code>{condition.value}</code>
        </span>
      );
    case "audible":
      return (
        <span className="text-truncate">
          <i className="fas fa-volume-up me-1" />
          {conditionTypeLabel("audible")}
        </span>
      );
    case "groupId":
      return <span className="text-truncate">{conditionTypeLabel("groupId")}</span>;
    default:
      return null;
  }
}

// Shared by the new rule form and inline editing so both match a rule row's layout exactly.
function RuleForm({
  canSave,
  conditionLabel,
  draft,
  error,
  id,
  isTypeTaken,
  onCancel,
  onChange,
  onSubmit,
  readOnly,
}: {
  canSave: boolean;
  conditionLabel: string;
  draft: Draft;
  error: string | null;
  id: string;
  isTypeTaken: (type: ConditionType) => boolean;
  onCancel: () => void;
  onChange: (draft: Draft) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  readOnly: boolean;
}) {
  return (
    <>
      <form
        className="flex-grow-1 d-flex align-items-start gap-2"
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
        onSubmit={onSubmit}
      >
        <RuleLine editable ifLabel={conditionLabel}>
          <select
            aria-label={chrome.i18n.getMessage("options_tabRules_condition")}
            autoFocus={draft.type !== "url"}
            className="form-select form-select-sm w-auto"
            disabled={readOnly}
            id={`${id}-type`}
            onChange={(event) => {
              onChange({ ...draft, type: event.target.value as ConditionType });
            }}
            value={draft.type}
          >
            {CONDITION_TYPES.map((type) => (
              <option disabled={isTypeTaken(type)} key={type} value={type}>
                {conditionTypeLabel(type)}
              </option>
            ))}
          </select>
          <div className="tab-rule-input">
            {draft.type === "url" && (
              <>
                <input
                  aria-describedby={error != null ? `${id}-error` : undefined}
                  aria-invalid={error != null}
                  aria-label={conditionTypeLabel("url")}
                  autoFocus
                  className={cx("form-control form-control-sm", { "is-invalid": error != null })}
                  id={id}
                  onChange={(event) => {
                    onChange({ ...draft, value: event.target.value });
                  }}
                  readOnly={readOnly}
                  type="text"
                  value={draft.value}
                />
                {error != null && (
                  <div className="form-text text-danger mt-1" id={`${id}-error`}>
                    {error}
                  </div>
                )}
              </>
            )}
          </div>
        </RuleLine>
        <div className="tab-rule-controls">
          <Button onClick={onCancel} size="sm" variant="secondary">
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

function RuleLine({
  children,
  className,
  editable = false,
  ifLabel,
}: {
  children: React.ReactNode;
  className?: string;
  // Forms keep their controls' minimum width, so a tight line wraps instead of truncating, and
  // top-align their clauses so a validation message under an input doesn't shift the rest.
  editable?: boolean;
  ifLabel: string;
}) {
  return (
    <div
      className={cx(
        "d-flex flex-wrap align-items-start column-gap-3 row-gap-1 flex-grow-1 tab-rule-shrink",
        className,
      )}
    >
      <RuleClause
        alignStart={editable}
        className={cx("tab-rule-if", { "tab-rule-shrink": !editable })}
        label={ifLabel}
      >
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
  alignStart = false,
  children,
  className,
  label,
}: {
  alignStart?: boolean;
  children?: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div
      className={cx(
        "tab-rule-clause d-flex gap-2",
        alignStart ? "align-items-start" : "align-items-center",
        className,
      )}
    >
      <span className="tab-rule-line flex-shrink-0">
        <span className="badge text-bg-secondary text-uppercase" style={{ minWidth: "4rem" }}>
          {label}
        </span>
      </span>
      {children}
    </div>
  );
}

function InactiveTimeOption({ onSaveSetting }: { onSaveSetting: SaveSetting }) {
  const elseRule = getElseRule(useSetting("tabRules"));
  const afterSeconds =
    elseRule?.then.action === "stale" ? elseRule.then.afterSeconds : DEFAULT_STALE_AFTER_SECONDS;
  const minutesInactive = Math.floor(afterSeconds / 60);
  const secondsInactive = afterSeconds % 60;
  const [zeroDurationError, setZeroDurationError] = useState(false);

  function saveAfterSeconds(nextAfterSeconds: number) {
    const current = settings.get("tabRules");
    const currentElseRule = getElseRule(current);
    onSaveSetting("tabRules", {
      ...current,
      rules: current.rules.map((rule) =>
        rule === currentElseRule
          ? { ...rule, then: { action: "stale", afterSeconds: nextAfterSeconds } }
          : rule,
      ),
    });
  }

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
    saveAfterSeconds(total * 60 + secondsInactive);
    return true;
  }

  function handleSecondsInactiveChange(seconds: number): boolean {
    if (seconds === 0 && minutesInactive === 0) {
      setZeroDurationError(true);
      return false;
    }
    setZeroDurationError(false);
    saveAfterSeconds(minutesInactive * 60 + seconds);
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

const EMPTY_DRAFT: Draft = { type: "url", value: "" };

// Every rule except the final "Else" rule, which shows as its own fixed row.
function getListedRules(tabRules: TabRulesConfig): TabRule[] {
  return getElseRule(tabRules) == null ? tabRules.rules : tabRules.rules.slice(0, -1);
}

function draftToCondition(draft: Draft): TabCondition {
  if (draft.type === "audible") return { type: "audible" };
  if (draft.type === "groupId") return { type: "groupId", op: "some" };
  return { type: "url", op: "contains", value: draft.value };
}

// Only single-condition rules the form can express are editable.
function ruleToDraft(rule: TabRule): Draft | null {
  if (rule.when.length !== 1) return null;
  const [condition] = rule.when;
  if (condition.type === "url" && condition.op === "contains")
    return { type: "url", value: condition.value };
  if (condition.type === "audible") return { type: "audible", value: "" };
  if (condition.type === "groupId" && condition.op === "some")
    return { type: "groupId", value: "" };
  return null;
}

// Audio and tab group rules have nothing to configure, so a second one could never match.
function isConditionTypeTaken(type: ConditionType, rules: TabRule[], exceptId: string | null) {
  return (
    type !== "url" && rules.some((rule) => rule.id !== exceptId && ruleToDraft(rule)?.type === type)
  );
}

// Tab URLs never contain whitespace (spaces are encoded as %20), so a pattern with any can't match.
function isValidDraft(draft: Draft) {
  return draft.type !== "url" || (draft.value.length > 0 && !/\s/.test(draft.value));
}

function draftError(draft: Draft, rules: TabRule[], exceptId: string | null): string | null {
  if (draft.type !== "url") return null;
  if (/\s/.test(draft.value)) return chrome.i18n.getMessage("options_tabRules_whitespace");
  const duplicate = rules.some((rule) => {
    const other = rule.id === exceptId ? null : ruleToDraft(rule);
    return other?.type === "url" && other.value === draft.value;
  });
  if (duplicate) return chrome.i18n.getMessage("options_tabRules_duplicate");
  return null;
}
