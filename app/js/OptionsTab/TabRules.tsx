import {
  DEFAULT_STALE_AFTER_SECONDS,
  type RuleOutcome,
  type TabCondition,
  type TabRule,
  type TabRulesConfig,
  generateRuleId,
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

const CONDITION_TYPES: ConditionType[] = ["url", "pinned", "audible", "groupId"];

interface ConditionDraft {
  type: ConditionType;
  value: string;
}

interface Draft {
  conditions: ConditionDraft[];
  match: "every" | "some";
  then: RuleOutcome;
}

interface DraftErrors {
  conditions: (string | null)[];
  rule: string | null;
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

  const newDraftErrors = draftErrors(newDraft, savedRules, null);

  function addRule(event: React.FormEvent<HTMLElement>) {
    event.preventDefault();
    if (!isValidDraft(newDraft) || hasErrors(newDraftErrors) || savingFrom === savedRules) return;
    const rule: TabRule = {
      enabled: true,
      id: generateRuleId(),
      ...draftToFields(newDraft),
    };
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

  const editErrors = editing != null ? draftErrors(editing.draft, savedRules, editing.id) : null;

  function saveEdit(event: React.FormEvent<HTMLElement>) {
    event.preventDefault();
    if (editing == null || editing.savingFrom != null) return;
    const rule = rulesById.get(editing.id);
    const fields = draftToFields(editing.draft);
    if (
      rule == null ||
      JSON.stringify({ match: rule.match, then: rule.then, when: rule.when }) ===
        JSON.stringify(fields)
    ) {
      setEditing(null);
      return;
    }
    if (!isValidDraft(editing.draft) || (editErrors != null && hasErrors(editErrors))) return;
    setEditing({ ...editing, savingFrom: savedRules });
    saveRules(
      getListedRules(settings.get("tabRules")).map((r) =>
        r.id === editing.id ? { enabled: r.enabled, id: r.id, ...fields } : r,
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
                canSave={isAdding && isValidDraft(newDraft) && !hasErrors(newDraftErrors)}
                conditionLabel={conditionLabel(0)}
                draft={newDraft}
                errors={isAdding ? newDraftErrors : null}
                id="rule-add"
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
                      editing.savingFrom == null &&
                      isValidDraft(editing.draft) &&
                      editErrors != null &&
                      !hasErrors(editErrors)
                    }
                    conditionLabel={conditionLabel(index + firstRuleIndex)}
                    draft={editing.draft}
                    errors={editing.savingFrom == null ? editErrors : null}
                    id="rule-edit"
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
                      then={<RuleOutcomeText outcome={rule.then} />}
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
  pinned: "options_tabRules_condition_pinned",
  url: "options_tabRules_condition_urlIncludes",
};

function conditionTypeLabel(type: ConditionType) {
  return chrome.i18n.getMessage(CONDITION_TYPE_MESSAGES[type]);
}

function RuleConditions({ rule }: { rule: TabRule }) {
  return (
    <div className="tab-rule-shrink">
      {rule.when.map((condition, index) => (
        <div className="tab-rule-line gap-2" key={index}>
          {index > 0 && <RuleJoin match={rule.match} />}
          <ConditionText condition={condition} />
        </div>
      ))}
    </div>
  );
}

function RuleJoin({ match }: { match: TabRule["match"] }) {
  return (
    <span className="badge rounded-pill badge-outline text-secondary-emphasis tab-rule-join-badge">
      {chrome.i18n.getMessage(match === "some" ? "options_tabRules_or" : "options_tabRules_and")}
    </span>
  );
}

function ConditionText({ condition }: { condition: TabCondition }) {
  switch (condition.type) {
    case "url":
      return (
        <span className="text-nowrap tab-rule-shrink">
          {conditionTypeLabel("url")} <code className="tab-rule-value">{condition.value}</code>
        </span>
      );
    case "audible":
      return (
        <span className="text-nowrap">
          <i className="fas fa-volume-up me-1" />
          {conditionTypeLabel("audible")}
        </span>
      );
    case "groupId":
      return <span className="text-nowrap">{conditionTypeLabel("groupId")}</span>;
    case "pinned":
      return (
        <span className="text-nowrap">
          <i className="fas fa-thumbtack me-1" />
          {conditionTypeLabel("pinned")}
        </span>
      );
    default:
      condition satisfies never;
      return null;
  }
}

// Shared by the new rule form and inline editing so both match a rule row's layout exactly.
function RuleForm({
  canSave,
  conditionLabel,
  draft,
  errors,
  id,
  onCancel,
  onChange,
  onSubmit,
  readOnly,
}: {
  canSave: boolean;
  conditionLabel: string;
  draft: Draft;
  errors: DraftErrors | null;
  id: string;
  onCancel: () => void;
  onChange: (draft: Draft) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  readOnly: boolean;
}) {
  function updateCondition(index: number, condition: ConditionDraft) {
    onChange({
      ...draft,
      conditions: draft.conditions.map((c, i) => (i === index ? condition : c)),
    });
  }

  return (
    <form
      className="flex-grow-1 d-flex align-items-start gap-2"
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
      onSubmit={onSubmit}
    >
      <RuleLine
        editable
        ifLabel={conditionLabel}
        then={
          <div className="d-flex flex-column gap-2">
            <select
              aria-label={chrome.i18n.getMessage("options_tabRules_action")}
              className="form-select form-select-sm w-auto align-self-start"
              disabled={readOnly}
              onChange={(event) => {
                onChange({
                  ...draft,
                  then:
                    event.target.value === "stale"
                      ? { action: "stale", afterSeconds: DEFAULT_STALE_AFTER_SECONDS }
                      : { action: "lock" },
                });
              }}
              value={draft.then.action}
            >
              <option value="lock">{chrome.i18n.getMessage("options_tabRules_action_lock")}</option>
              <option value="stale">
                {chrome.i18n.getMessage("options_tabRules_action_stale")}
              </option>
            </select>
            {draft.then.action === "stale" && (
              <DurationInput
                onChange={(afterSeconds) => {
                  onChange({ ...draft, then: { action: "stale", afterSeconds } });
                }}
                seconds={draft.then.afterSeconds}
              />
            )}
          </div>
        }
      >
        <div className="tab-rule-conditions">
          {draft.conditions.map((condition, index) => {
            const error = errors?.conditions[index] ?? null;
            const inputId = `${id}-${index}`;
            return (
              <div className="d-flex align-items-start gap-2" key={index}>
                {index > 0 && (
                  <select
                    aria-label={chrome.i18n.getMessage("options_tabRules_match")}
                    className="form-select form-select-sm w-auto tab-rule-join"
                    disabled={readOnly}
                    onChange={(event) => {
                      onChange({ ...draft, match: event.target.value as Draft["match"] });
                    }}
                    value={draft.match}
                  >
                    <option value="every">{chrome.i18n.getMessage("options_tabRules_and")}</option>
                    <option value="some">{chrome.i18n.getMessage("options_tabRules_or")}</option>
                  </select>
                )}
                <select
                  aria-label={chrome.i18n.getMessage("options_tabRules_condition")}
                  autoFocus={index === 0 && condition.type !== "url"}
                  className="form-select form-select-sm w-auto"
                  disabled={readOnly}
                  onChange={(event) => {
                    updateCondition(index, {
                      ...condition,
                      type: event.target.value as ConditionType,
                    });
                  }}
                  value={condition.type}
                >
                  {CONDITION_TYPES.map((type) => (
                    <option
                      // Audio and tab group conditions have nothing to configure, so repeating one
                      // in a rule changes nothing.
                      disabled={
                        type !== "url" &&
                        type !== condition.type &&
                        draft.conditions.some((other) => other.type === type)
                      }
                      key={type}
                      value={type}
                    >
                      {conditionTypeLabel(type)}
                    </option>
                  ))}
                </select>
                <div className="tab-rule-input">
                  {condition.type === "url" && (
                    <>
                      <input
                        aria-describedby={error != null ? `${inputId}-error` : undefined}
                        aria-invalid={error != null}
                        aria-label={conditionTypeLabel("url")}
                        autoFocus
                        className={cx("form-control form-control-sm", {
                          "is-invalid": error != null,
                        })}
                        id={inputId}
                        onChange={(event) => {
                          updateCondition(index, { ...condition, value: event.target.value });
                        }}
                        readOnly={readOnly}
                        type="text"
                        value={condition.value}
                      />
                      {error != null && (
                        <div className="form-text text-danger mt-1" id={`${inputId}-error`}>
                          {error}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {draft.conditions.length > 1 && (
                  <Button
                    aria-label={chrome.i18n.getMessage("options_tabRules_removeCondition")}
                    className="text-body-secondary"
                    disabled={readOnly}
                    onClick={() => {
                      onChange({
                        ...draft,
                        conditions: draft.conditions.filter((_, i) => i !== index),
                      });
                    }}
                    size="sm"
                    title={chrome.i18n.getMessage("options_tabRules_removeCondition")}
                    type="button"
                    variant="outline-secondary"
                  >
                    <i className="fas fa-times" />
                  </Button>
                )}
              </div>
            );
          })}
          <div>
            <Button
              disabled={readOnly}
              onClick={() => {
                onChange({ ...draft, conditions: [...draft.conditions, EMPTY_CONDITION] });
              }}
              size="sm"
              type="button"
              variant="link"
            >
              <i className="fas fa-plus me-1" />
              {chrome.i18n.getMessage("options_tabRules_addCondition")}
            </Button>
          </div>
          {errors?.rule != null && <div className="form-text text-danger mt-0">{errors.rule}</div>}
        </div>
      </RuleLine>
      <div className="tab-rule-controls">
        <Button onClick={onCancel} size="sm" type="button" variant="secondary">
          {chrome.i18n.getMessage("options_tabRules_cancel")}
        </Button>
        <Button disabled={!canSave} size="sm" type="submit" variant="primary">
          {chrome.i18n.getMessage("options_save")}
        </Button>
      </div>
    </form>
  );
}

function RuleLine({
  children,
  className,
  editable = false,
  ifLabel,
  then,
}: {
  children: React.ReactNode;
  className?: string;
  // Forms stack "Then" under "If", since either can grow to several lines of controls.
  editable?: boolean;
  ifLabel: string;
  then: React.ReactNode;
}) {
  return (
    <div
      className={cx(
        "d-flex column-gap-3 row-gap-1 flex-grow-1 tab-rule-shrink",
        // Forms stretch each clause to the full width so their controls stay put as values change.
        editable ? "flex-column" : "flex-wrap align-items-start",
        className,
      )}
    >
      <RuleClause alignStart className="tab-rule-if" label={ifLabel}>
        {children}
      </RuleClause>
      <RuleClause
        alignStart={editable}
        className="tab-rule-then"
        label={chrome.i18n.getMessage("options_tabRules_then")}
      >
        {then}
      </RuleClause>
    </div>
  );
}

function RuleOutcomeText({ outcome }: { outcome: RuleOutcome }) {
  switch (outcome.action) {
    case "lock":
      return (
        <span className="text-nowrap">
          <i className="fas fa-lock me-1" />
          {chrome.i18n.getMessage("options_tabRules_action_lock")}
        </span>
      );
    case "stale":
      return (
        <span className="text-nowrap">
          {chrome.i18n.getMessage("options_tabRules_action_staleAfter", [
            formatDuration(outcome.afterSeconds),
          ])}
        </span>
      );
    default:
      outcome satisfies never;
      return null;
  }
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
        <span className="badge rounded-pill text-bg-secondary text-uppercase tab-rule-badge">
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

  return <DurationInput onChange={saveAfterSeconds} seconds={afterSeconds} />;
}

// Days, hours, minutes and seconds inputs for a duration greater than zero.
function DurationInput({
  onChange,
  seconds: totalSeconds,
}: {
  onChange: (seconds: number) => void;
  seconds: number;
}) {
  const [zeroDurationError, setZeroDurationError] = useState(false);
  const { days, hours, minutes, seconds } = splitDuration(totalSeconds);

  function commit(next: { days: number; hours: number; minutes: number; seconds: number }) {
    const nextSeconds = ((next.days * 24 + next.hours) * 60 + next.minutes) * 60 + next.seconds;
    if (nextSeconds === 0) {
      setZeroDurationError(true);
      return false;
    }
    setZeroDurationError(false);
    onChange(nextSeconds);
    return true;
  }

  const daysDraft = useDraftInput(days, (value) =>
    commit({ days: value, hours, minutes, seconds }),
  );
  const hoursDraft = useDraftInput(hours, (value) =>
    commit({ days, hours: value, minutes, seconds }),
  );
  const minutesDraft = useDraftInput(minutes, (value) =>
    commit({ days, hours, minutes: value, seconds }),
  );
  const secondsDraft = useDraftInput(seconds, (value) =>
    commit({ days, hours, minutes, seconds: Math.min(59, value) }),
  );

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
      <div className="form-text">{formatDuration(totalSeconds)}</div>
    </div>
  );
}

function splitDuration(totalSeconds: number) {
  const totalMinutes = Math.floor(totalSeconds / 60);
  return {
    days: Math.floor(totalMinutes / (24 * 60)),
    hours: Math.floor((totalMinutes % (24 * 60)) / 60),
    minutes: totalMinutes % 60,
    seconds: totalSeconds % 60,
  };
}

function formatDuration(totalSeconds: number): string {
  const { days, hours, minutes, seconds } = splitDuration(totalSeconds);
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

const EMPTY_CONDITION: ConditionDraft = { type: "url", value: "" };
const EMPTY_DRAFT: Draft = {
  conditions: [EMPTY_CONDITION],
  match: "every",
  then: { action: "lock" },
};

// Every rule except the final "Else" rule, which shows as its own fixed row.
function getListedRules(tabRules: TabRulesConfig): TabRule[] {
  return getElseRule(tabRules) == null ? tabRules.rules : tabRules.rules.slice(0, -1);
}

function conditionToDraft(condition: TabCondition): ConditionDraft | null {
  if (condition.type === "url" && condition.op === "includes")
    return { type: "url", value: condition.value };
  if (condition.type === "audible") return { type: "audible", value: "" };
  if (condition.type === "groupId" && condition.op === "some")
    return { type: "groupId", value: "" };
  if (condition.type === "pinned") return { type: "pinned", value: "" };
  return null;
}

function draftToCondition(draft: ConditionDraft): TabCondition {
  if (draft.type === "audible") return { type: "audible" };
  if (draft.type === "groupId") return { type: "groupId", op: "some" };
  if (draft.type === "pinned") return { type: "pinned" };
  return { type: "url", op: "includes", value: draft.value };
}

// The parts of a rule the form edits.
function draftToFields(draft: Draft): Pick<TabRule, "match" | "then" | "when"> {
  return { match: draft.match, then: draft.then, when: draft.conditions.map(draftToCondition) };
}

// Only rules whose conditions the form can express are editable.
function ruleToDraft(rule: TabRule): Draft | null {
  const conditions = rule.when.flatMap((condition) => conditionToDraft(condition) ?? []);
  if (conditions.length === 0 || conditions.length !== rule.when.length) return null;
  return { conditions, match: rule.match, then: rule.then };
}

// Identifies what a rule matches regardless of condition order, to catch duplicate rules.
function matchKey({ match, when }: Pick<TabRule, "match" | "when">): string {
  const conditions = when.map((condition) => JSON.stringify(condition)).sort();
  return JSON.stringify([conditions.length > 1 ? match : "every", conditions]);
}

// Tab URLs never contain whitespace (spaces are encoded as %20), so a pattern with any can't match.
function isValidDraft(draft: Draft) {
  return draft.conditions.every(
    (condition) =>
      condition.type !== "url" || (condition.value.length > 0 && !/\s/.test(condition.value)),
  );
}

function draftErrors(draft: Draft, rules: TabRule[], exceptId: string | null): DraftErrors {
  const conditions = draft.conditions.map((condition, index) => {
    if (condition.type !== "url") return null;
    if (/\s/.test(condition.value)) return chrome.i18n.getMessage("options_tabRules_whitespace");
    const repeated = draft.conditions
      .slice(0, index)
      .some((other) => other.type === "url" && other.value === condition.value);
    if (repeated && condition.value !== "")
      return chrome.i18n.getMessage("options_tabRules_duplicateCondition");
    return null;
  });
  const key = matchKey(draftToFields(draft));
  const duplicate = rules.some((rule) => rule.id !== exceptId && matchKey(rule) === key);
  return {
    conditions,
    rule: duplicate ? chrome.i18n.getMessage("options_tabRules_duplicateRule") : null,
  };
}

function hasErrors(errors: DraftErrors) {
  return errors.rule != null || errors.conditions.some((error) => error != null);
}
