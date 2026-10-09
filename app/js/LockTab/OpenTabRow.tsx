import "./OpenTabRow.css";
import { Button, OverlayTrigger, Tooltip } from "react-bootstrap";
import type { TabCondition, TabRule } from "../tabRules";
import TabFavicon from "../TabFavicon";
import type { TabLockStatus } from "../tabUtil";
import { UseNowContext } from "./LockTab";
import cx from "classnames";
import settings from "../settings";
import { shouldFreezeActiveTabTimer } from "../tabUtil";
import { useContext } from "react";
import usePauseTimesQuery from "../api/usePauseTimesQuery";
import { useStorageSyncPersistQuery } from "../storage";
import useTabLockStatus from "../useTabLockStatus";

interface OpenTabRowProps {
  isFirstInGroup?: boolean;
  isInLastFocusedWindow?: boolean;
  tab: chrome.tabs.Tab;
  tabGroup?: chrome.tabGroups.TabGroup;
  tabTime: number | undefined;
  tabsWillAutoClose: boolean;
  windowId: number;
  windowLocked: boolean;
  onToggleTab: (
    windowId: number,
    tab: chrome.tabs.Tab,
    selected: boolean,
    multiselect: boolean,
  ) => void;
}

export default function OpenTabRow({
  isFirstInGroup = false,
  isInLastFocusedWindow = false,
  tab,
  tabGroup,
  tabTime: tabTimeProp,
  tabsWillAutoClose,
  windowId,
  windowLocked,
  onToggleTab,
}: OpenTabRowProps) {
  const tabLockStatus = useTabLockStatus(tab);
  const { data: syncPersistData } = useStorageSyncPersistQuery();
  const { data: pauseTimes } = usePauseTimesQuery();
  const now = useContext(UseNowContext);
  const tabTime = tabTimeProp ?? now;
  const paused = syncPersistData?.paused;
  // Only use `pausedAt` while paused because unpausing from another browser does not remove it here
  const pausedAt = paused ? pauseTimes?.pausedAt : null;
  const idleAt = pauseTimes?.idleAt;
  // Timers do not count down while paused or idle, so show them as they were when that began
  const timersPausedAt = pausedAt ?? idleAt;
  const timerNow = timersPausedAt == null ? now : Math.max(timersPausedAt, tabTime);
  const staleAfterMs = settings.stayOpen(tab);
  const cutOff = timerNow - staleAfterMs;
  const timeRemaining = -1 * Math.round((cutOff - tabTime) / 1000);
  const isOverdue = !tabLockStatus.locked && !windowLocked && !paused && timeRemaining < 0;

  function setTabActive() {
    if (tab.id == null) return;
    chrome.tabs.update(tab.id, { active: true });
  }

  let groupColor: string | undefined;
  if (tabGroup != null) {
    groupColor =
      tabGroup.color != null ? `var(--tw-tab-group-color-${tabGroup.color})` : "var(--bs-primary)";
  }

  return (
    <tr className={cx({ "fst-italic": isOverdue, "table-active": tab.active })}>
      <td
        className="ps-2"
        style={{ paddingBottom: "4px", paddingTop: "4px", position: "relative", width: "100%" }}
      >
        {tabGroup != null && (
          <div className="OpenTabRow-group-border" style={{ backgroundColor: groupColor }} />
        )}
        <div className={cx("d-flex align-items-center gap-2", { "ps-1": tabGroup != null })}>
          {isFirstInGroup && (
            <OverlayTrigger
              overlay={
                <Tooltip>
                  {tabGroup?.title || chrome.i18n.getMessage("tabLock_groupIndicator_unnamed")}
                </Tooltip>
              }
            >
              <div
                className="OpenTabRow-group-indicator flex-shrink-0"
                style={{ backgroundColor: groupColor }}
              />
            </OverlayTrigger>
          )}
          <TabFavicon
            alt=""
            height={16}
            pageUrl={tab.url}
            src={tab.favIconUrl}
            style={{ height: "16px", maxWidth: "none" }}
            width={16}
          />
          <div
            className={cx("flex-fill d-flex min-w-0", { "text-muted": isOverdue && !tab.active })}
            role="button"
            style={{ lineHeight: "1.3" }}
            tabIndex={0}
            onClick={setTabActive}
          >
            <div className="flex-fill text-truncate" style={{ width: "1px" }}>
              {tab.title}
              <br />
              <small className={cx({ "text-muted": !tab.active })}>({tab.url})</small>
            </div>
          </div>
        </div>
      </td>
      <td
        className="pe-2"
        style={{
          verticalAlign: "middle",
          whiteSpace: "nowrap",
          width: "1px",
        }}
      >
        <div className="d-flex align-items-center justify-content-end gap-2">
          <TabLockContent
            hasPausedAt={pausedAt != null}
            isBrowserIdle={idleAt != null}
            isTabActive={tab.active}
            staleAfterMs={staleAfterMs}
            timerFrozen={
              tab.active && isInLastFocusedWindow && shouldFreezeActiveTabTimer(timeRemaining)
            }
            tabLockStatus={tabLockStatus}
            tabsWillAutoClose={tabsWillAutoClose}
            timeRemaining={timeRemaining}
            windowLocked={windowLocked}
          />
          <div className="d-flex gap-1">
            <TabVolumeControl tab={tab} />
            <Button
              active={tabLockStatus.locked}
              className="rounded-circle"
              disabled={tabLockStatus.locked && tabLockStatus.reason !== "manual"}
              title={
                tabLockStatus.locked
                  ? chrome.i18n.getMessage("tabLock_unlockTab")
                  : chrome.i18n.getMessage("tabLock_lockTab")
              }
              // @ts-expect-error "xs" not in type and not is not extensible.
              size="xs"
              type="button"
              variant="outline-secondary"
              onClick={(event) => {
                onToggleTab(windowId, tab, !tabLockStatus.locked, event.shiftKey);
              }}
            >
              {tabLockStatus.locked ? (
                <i className="fas fa-lock" />
              ) : (
                <i className="fas fa-unlock" />
              )}
            </Button>
          </div>
        </div>
      </td>
    </tr>
  );
}

function TabVolumeControl({ tab }: { tab: chrome.tabs.Tab }) {
  if (!tab.audible) return null;
  const isMuted = tab.mutedInfo?.muted;

  function toggleMuted() {
    if (tab.id == null) return;
    chrome.tabs.update(tab.id, { muted: !isMuted });
  }

  return (
    <Button
      active={isMuted}
      className="rounded-circle"
      disabled={tab.id == null}
      // @ts-expect-error "xs" not in type and not is not extensible.
      size="xs"
      title={
        isMuted
          ? chrome.i18n.getMessage("tabLock_unmuteSite")
          : chrome.i18n.getMessage("tabLock_muteSite")
      }
      variant="outline-secondary"
      onClick={toggleMuted}
    >
      {isMuted ? <i className="fas fa-volume-mute" /> : <i className="fas fa-volume-up" />}
    </Button>
  );
}

function TabLockContent({
  hasPausedAt,
  isBrowserIdle,
  isTabActive,
  staleAfterMs,
  timerFrozen,
  tabLockStatus,
  tabsWillAutoClose,
  timeRemaining,
  windowLocked,
}: {
  hasPausedAt: boolean;
  isBrowserIdle: boolean;
  isTabActive: boolean;
  staleAfterMs: number;
  timerFrozen: boolean;
  tabLockStatus: TabLockStatus;
  tabsWillAutoClose: boolean;
  timeRemaining: number;
  windowLocked: boolean;
}) {
  const { data: syncPersistData } = useStorageSyncPersistQuery();
  const paused = syncPersistData?.paused;

  if (tabLockStatus.locked) {
    let reason: React.ReactNode;
    switch (tabLockStatus.reason) {
      case "manual":
        reason = chrome.i18n.getMessage("tabLock_lockedReason_locked");
        break;
      case "rule":
        reason = <RuleLockedReason rule={tabLockStatus.rule} />;
        break;
      case "window":
        reason = chrome.i18n.getMessage("tabLock_lockedReason_window");
        break;
      default:
        tabLockStatus satisfies never;
    }

    return <span className={isTabActive ? undefined : "text-muted"}>{reason}</span>;
  } else {
    let timeLeftContent;
    if (windowLocked) {
      timeLeftContent = chrome.i18n.getMessage("tabLock_lockedReason_window");
    } else if (timerFrozen) {
      timeLeftContent = (
        <OverlayTrigger
          overlay={<Tooltip>{chrome.i18n.getMessage("tabLock_timerFrozen_tooltip")}</Tooltip>}
        >
          <span>
            <i className="text-primary fas fa-snowflake" />{" "}
            <time className="font-monospace">{formatSecondsToDhms(staleAfterMs / 1000)}</time>
          </span>
        </OverlayTrigger>
      );
    } else if (hasPausedAt) {
      timeLeftContent = <PausedTimeRemaining timeRemaining={timeRemaining} />;
    } else if (paused) {
      // Paused from another browser, so there is no `pausedAt` here to calculate time remaining
      timeLeftContent = chrome.i18n.getMessage("tabLock_lockedReason_paused");
    } else if (isBrowserIdle) {
      timeLeftContent = <IdleTimeRemaining timeRemaining={timeRemaining} />;
    } else if (timeRemaining <= 0 && tabsWillAutoClose) {
      // Countdown finished and tabs are eligible to close — waiting for the background interval.
      timeLeftContent = <time className="font-monospace">{formatSecondsToDhms(0)}</time>;
    } else if (timeRemaining <= 0 && !tabsWillAutoClose) {
      // Countdown finished but minTabs is holding this tab open.
      timeLeftContent = (
        <OverlayTrigger
          overlay={<Tooltip>{chrome.i18n.getMessage("tabLock_overdueTooltip")}</Tooltip>}
        >
          <span>
            <small className="fas fa-hourglass text-warning" />{" "}
            <time className="font-monospace">{formatSecondsToDhms(0)}</time>
          </span>
        </OverlayTrigger>
      );
    } else {
      timeLeftContent = (
        <time className="font-monospace">{formatSecondsToDhms(timeRemaining)}</time>
      );
    }

    return timeLeftContent;
  }
}

function RuleLockedReason({ rule }: { rule: TabRule }) {
  if (rule.when.length > 1) {
    const join = chrome.i18n
      .getMessage(rule.match === "some" ? "options_tabRules_or" : "options_tabRules_and")
      .toLocaleUpperCase();
    return (
      <abbr title={rule.when.map(describeCondition).join(` ${join} `)}>
        {chrome.i18n.getMessage("tabLock_lockedStatus_autolocked")}
      </abbr>
    );
  }

  const [condition] = rule.when;
  switch (rule.when.length === 1 ? condition.type : null) {
    case "audible":
      return (
        <abbr title={chrome.i18n.getMessage("tabLock_lockedReason_audible")}>
          {chrome.i18n.getMessage("tabLock_lockedStatus_autolocked")}
        </abbr>
      );
    case "groupId":
      return chrome.i18n.getMessage("tabLock_lockedReason_group");
    case "pinned":
      return chrome.i18n.getMessage("tabLock_lockedReason_pinned");
    case "url":
      return (
        <abbr
          title={chrome.i18n.getMessage(
            "tabLock_lockedReason_matches",
            condition.type === "url" ? condition.value : "",
          )}
        >
          {chrome.i18n.getMessage("tabLock_lockedStatus_autolocked")}
        </abbr>
      );
    default:
      return chrome.i18n.getMessage("tabLock_lockedStatus_autolocked");
  }
}

function describeCondition(condition: TabCondition): string {
  switch (condition.type) {
    case "url":
      return `${chrome.i18n.getMessage("options_tabRules_condition_urlIncludes")} ${condition.value}`;
    case "audible":
      return chrome.i18n.getMessage("options_tabRules_condition_audible");
    case "groupId":
      return chrome.i18n.getMessage("options_tabRules_condition_grouped");
    case "pinned":
      return chrome.i18n.getMessage("options_tabRules_condition_pinned");
    default:
      condition satisfies never;
      return "";
  }
}

function PausedTimeRemaining({ timeRemaining }: { timeRemaining: number }) {
  return (
    <OverlayTrigger
      overlay={<Tooltip>{chrome.i18n.getMessage("tabLock_timerPaused_tooltip")}</Tooltip>}
    >
      <span>
        <i className="text-warning opacity-50 fas fa-pause" />{" "}
        <time className="font-monospace">{formatSecondsToDhms(Math.max(0, timeRemaining))}</time>
      </span>
    </OverlayTrigger>
  );
}

function IdleTimeRemaining({ timeRemaining }: { timeRemaining: number }) {
  return (
    <OverlayTrigger
      overlay={<Tooltip>{chrome.i18n.getMessage("tabLock_timerIdle_tooltip")}</Tooltip>}
    >
      <span>
        <i className="text-warning opacity-50 fas fa-clock" />{" "}
        <time className="font-monospace">{formatSecondsToDhms(Math.max(0, timeRemaining))}</time>
      </span>
    </OverlayTrigger>
  );
}

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;
function formatSecondsToDhms(seconds: number) {
  const days = Math.floor(seconds / SECONDS_PER_DAY);
  const daysRemainder = seconds % SECONDS_PER_DAY;
  const hours = Math.floor(daysRemainder / SECONDS_PER_HOUR);
  const hoursRemainder = seconds % SECONDS_PER_HOUR;
  const minutes = Math.floor(hoursRemainder / 60);
  const s = Math.floor(hoursRemainder % 60);
  const dDisplay = days > 0 ? `${days}:` : "";
  const hDisplay = days > 0 || hours > 0 ? `${zeropad(hours)}:` : "";
  return `${dDisplay}${hDisplay}${zeropad(minutes)}:${zeropad(s)}`;
}

function zeropad(num: number): string {
  return num < 10 ? `0${num}` : String(num);
}
