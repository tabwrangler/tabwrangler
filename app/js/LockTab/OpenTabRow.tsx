import TabFavicon from "../TabFavicon";
import type { TabLockStatus } from "../tabUtil";
import { UseNowContext } from "./LockTab";
import cx from "classnames";
import settings from "../settings";
import { useContext } from "react";
import { useStorageSyncPersistQuery } from "../storage";

interface OpenTabRowProps {
  isLast: boolean;
  tab: chrome.tabs.Tab;
  tabTime: number | undefined;
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
  isLast,
  tab,
  tabTime = Date.now(),
  windowId,
  windowLocked,
  onToggleTab,
}: OpenTabRowProps) {
  const tabLockStatus = settings.getTabLockStatus(tab);

  function setTabActive() {
    if (tab.id == null) return;
    chrome.tabs.update(tab.id, { active: true });
  }

  return (
    <tr className={tab.active ? "table-success" : undefined}>
      <td
        className={cx("text-center", { "border-0": isLast })}
        style={{ verticalAlign: "middle", width: "1px" }}
      >
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
      <td
        className={cx("text-center", { "border-0": isLast })}
        style={{ verticalAlign: "middle", width: "32px" }}
      >
        <TabFavicon
          alt=""
          height={16}
          pageUrl={tab.url}
          src={tab.favIconUrl}
          style={{ height: "16px", maxWidth: "none" }}
          width={16}
        />
      </td>
      <td
        className={cx({ "border-0": isLast })}
        style={{ paddingBottom: "4px", paddingTop: "4px", width: "75%" }}
      >
        <div
          className="d-flex"
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
      <TabLockStatus
        isLast={isLast}
        tabLockStatus={tabLockStatus}
        tabTime={tabTime}
        windowLocked={windowLocked}
      />
    </tr>
  );
}

function TabLockStatus({
  isLast,
  tabLockStatus,
  tabTime,
  windowLocked,
}: {
  isLast: boolean;
  tabLockStatus: TabLockStatus;
  tabTime: number;
  windowLocked: boolean;
}) {
  const { data: syncPersistData } = useStorageSyncPersistQuery();
  const now = useContext(UseNowContext);
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

    return (
      <td
        className={cx("text-center muted", { "border-0": isLast })}
        style={{ verticalAlign: "middle" }}
      >
        {reason}
      </td>
    );
  } else {
    let timeLeftContent;
    if (windowLocked) {
      timeLeftContent = chrome.i18n.getMessage("tabLock_lockedReason_window");
    } else if (paused) {
      timeLeftContent = chrome.i18n.getMessage("tabLock_lockedReason_paused");
    } else {
      const cutOff = now - settings.stayOpen();
      const timeLeft = -1 * Math.round((cutOff - tabTime) / 1000);
      // If `timeLeft` is less than 0, the countdown likely continued and is waiting for the
      // interval to clean up this tab. It's also possible the number of tabs is not below
      // `minTabs`, which has stopped the countdown and locked this at a negative `timeLeft` until
      // another tab is opened to jump start the countdown again.
      timeLeftContent = timeLeft < 0 ? "…" : <time>{formatSecondsToDhms(timeLeft)}</time>;
    }

    return (
      <td className={cx("text-center", { "border-0": isLast })} style={{ verticalAlign: "middle" }}>
        {timeLeftContent}
      </td>
    );
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
