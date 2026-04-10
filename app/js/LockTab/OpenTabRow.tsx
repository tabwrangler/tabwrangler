import "./OpenTabRow.css";
import TabFavicon from "../TabFavicon";
import type { TabLockStatus } from "../tabUtil";
import { UseNowContext } from "./LockTab";
import cx from "classnames";
import settings from "../settings";
import { useContext } from "react";
import { useStorageSyncPersistQuery } from "../storage";

interface OpenTabRowProps {
  isFirstInGroup?: boolean;
  tab: chrome.tabs.Tab;
  tabGroup?: chrome.tabGroups.TabGroup;
  tabTime: number | undefined;
  windowHasGroups?: boolean;
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
  tab,
  tabGroup,
  tabTime = Date.now(),
  windowHasGroups = false,
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
    <tr className={cx({ "table-success": tab.active, "fst-italic": isOverdue })}>
      <td className={cx("text-center")} style={{ verticalAlign: "middle", width: "1px" }}>
        <button
          className={cx("btn btn-xs btn-outline-secondary rounded-circle", {
            active: tabLockStatus.locked,
          })}
          disabled={!settings.isTabManuallyLockable(tab)}
          title={
            tabLockStatus.locked
              ? chrome.i18n.getMessage("tabLock_unlockTab")
              : chrome.i18n.getMessage("tabLock_lockTab")
          }
          type="button"
          onClick={(event) => {
            onToggleTab(windowId, tab, !tabLockStatus.locked, event.shiftKey);
          }}
        >
          {tabLockStatus.locked ? <i className="fas fa-lock" /> : <i className="fas fa-unlock" />}
        </button>
      </td>
      <td className="text-center" style={{ verticalAlign: "middle", width: "32px" }}>
        <TabFavicon
          alt=""
          height={16}
          pageUrl={tab.url}
          src={tab.favIconUrl}
          style={{ height: "16px", maxWidth: "none" }}
          width={16}
        />
      </td>
      <td style={{ paddingBottom: "4px", paddingTop: "4px", width: "100%" }}>
        <div
          className={cx("d-flex", { "text-muted": isOverdue && !tab.active })}
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
      </td>
      <td
        style={{
          position: "relative",
          verticalAlign: "middle",
          whiteSpace: "nowrap",
          width: "1px",
        }}
      >
        {windowHasGroups && (
          <div
            className="OpenTabRow-group-border"
            style={
              groupColor == null
                ? undefined
                : {
                    backgroundColor: groupColor,
                  }
            }
          />
        )}
        <div className="d-flex align-items-center justify-content-end gap-2 pe-2">
          <TabLockContent
            isTabActive={tab.active}
            tabLockStatus={tabLockStatus}
            timeRemaining={timeRemaining}
            windowLocked={windowLocked}
          />
          {isFirstInGroup && (
            <div
              className="OpenTabRow-group-indicator"
              style={{
                backgroundColor: groupColor,
              }}
              title={tabGroup?.title}
            />
          )}
        </div>
      </td>
    </tr>
  );
}

function TabLockContent({
  isTabActive,
  tabLockStatus,
  timeRemaining,
  windowLocked,
}: {
  isTabActive: boolean;
  tabLockStatus: TabLockStatus;
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
    } else if (timeRemaining <= 0) {
      // `timeLeft` went negative — the countdown continued and is waiting for the interval to close
      // this tab. It's also possible `minTabs` stopped the countdown and this will stay overdue
      // until another tab is opened to jump-start it again.
      timeLeftContent = <time style={isTabActive ? undefined : { opacity: 0.4 }}>⋯</time>;
    } else {
      timeLeftContent = <time>{formatSecondsToDhms(timeRemaining)}</time>;
    }

    return <span>{timeLeftContent}</span>;
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
