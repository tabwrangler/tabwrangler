import "./OpenTabRow.css";
import { Button, OverlayTrigger, Tooltip } from "react-bootstrap";
import TabFavicon from "../TabFavicon";
import type { TabLockStatus } from "../tabUtil";
import { UseNowContext } from "./LockTab";
import cx from "classnames";
import settings from "../settings";
import { shouldFreezeActiveTabTimer } from "../tabUtil";
import { useContext } from "react";
import { useStorageSyncPersistQuery } from "../storage";

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
  tabTime = Date.now(),
  tabsWillAutoClose,
  windowId,
  windowLocked,
  onToggleTab,
}: OpenTabRowProps) {
  const tabLockStatus = settings.getTabLockStatus(tab);
  const { data: syncPersistData } = useStorageSyncPersistQuery();
  const now = useContext(UseNowContext);
  const paused = syncPersistData?.paused;
  const cutOff = now - settings.stayOpen();
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
            isTabActive={tab.active}
            timerFrozen={
              tab.active && isInLastFocusedWindow && shouldFreezeActiveTabTimer(timeRemaining)
            }
            tabLockStatus={tabLockStatus}
            tabsWillAutoClose={tabsWillAutoClose}
            timeRemaining={timeRemaining}
            windowLocked={windowLocked}
          />
          <TabVolumeControl tab={tab} />
          <Button
            active={tabLockStatus.locked}
            className="rounded-circle"
            disabled={!settings.isTabManuallyLockable(tab)}
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
            {tabLockStatus.locked ? <i className="fas fa-lock" /> : <i className="fas fa-unlock" />}
          </Button>
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
  isTabActive,
  timerFrozen,
  tabLockStatus,
  tabsWillAutoClose,
  timeRemaining,
  windowLocked,
}: {
  isTabActive: boolean;
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
      case "audible":
        reason = (
          <abbr title={chrome.i18n.getMessage("tabLock_lockedReason_audible")}>
            {chrome.i18n.getMessage("tabLock_lockedStatus_autolocked")}
          </abbr>
        );
        break;
      case "grouped":
        reason = chrome.i18n.getMessage("tabLock_lockedReason_group");
        break;
      case "manual":
        reason = chrome.i18n.getMessage("tabLock_lockedReason_locked");
        break;
      case "pinned":
        reason = chrome.i18n.getMessage("tabLock_lockedReason_pinned");
        break;
      case "whitelist":
        reason = (
          <abbr
            title={chrome.i18n.getMessage(
              "tabLock_lockedReason_matches",
              tabLockStatus.whitelistMatch,
            )}
          >
            {chrome.i18n.getMessage("tabLock_lockedStatus_autolocked")}
          </abbr>
        );
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
    } else if (paused) {
      timeLeftContent = chrome.i18n.getMessage("tabLock_lockedReason_paused");
    } else if (timerFrozen) {
      timeLeftContent = (
        <OverlayTrigger
          overlay={<Tooltip>{chrome.i18n.getMessage("tabLock_timerFrozen_tooltip")}</Tooltip>}
        >
          <span>
            <i className="text-primary fas fa-snowflake" />{" "}
            <time className="font-monospace">
              {formatSecondsToDhms(settings.stayOpen() / 1000)}
            </time>
          </span>
        </OverlayTrigger>
      );
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
