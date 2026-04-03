import * as React from "react";
import TabFavicon from "../TabFavicon";
import { UseNowContext } from "./LockTab";
import cx from "classnames";
import settings from "../settings";
import { useStorageSyncPersistQuery } from "../storage";

function zeropad(num: number): string {
  return num < 10 ? `0${num}` : String(num);
}

function secondsToHms(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const s = Math.floor((seconds % 3600) % 60);
  const hDisplay = hours > 0 ? `${zeropad(hours)}:` : "";
  return `${hDisplay}${zeropad(minutes)}:${zeropad(s)}`;
}

type Props = {
  isLast: boolean;
  onToggleTab: (
    windowId: number,
    tab: chrome.tabs.Tab,
    selected: boolean,
    multiselect: boolean,
  ) => void;
  tab: chrome.tabs.Tab;
  tabTime: number | undefined;
  windowId: number;
  windowLocked: boolean;
};

export default function OpenTabRow({
  isLast,
  onToggleTab,
  tab,
  tabTime = Date.now(),
  windowId,
  windowLocked,
}: Props) {
  const { data: syncPersistData } = useStorageSyncPersistQuery();
  const now = React.useContext(UseNowContext);
  const paused = syncPersistData?.paused;
  const status = settings.getTabLockStatus(tab);

  let lockStatusElement: React.ReactNode;
  if (status.locked) {
    let reason: React.ReactNode;
    switch (status.reason) {
      case "audible":
        reason = (
          <abbr title={chrome.i18n.getMessage("tabLock_lockedReason_audible")}>
            {chrome.i18n.getMessage("tabLock_lockedStatus_locked")}
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
            title={chrome.i18n.getMessage("tabLock_lockedReason_matches", status.whitelistMatch)}
          >
            {chrome.i18n.getMessage("tabLock_lockedStatus_autolocked")}
          </abbr>
        );
        break;
      case "window":
        reason = chrome.i18n.getMessage("tabLock_lockedReason_window");
        break;
      default:
        status satisfies never;
    }

    lockStatusElement = (
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
      timeLeftContent = timeLeft < 0 ? "…" : <time>{secondsToHms(timeLeft)}</time>;
    }

    lockStatusElement = (
      <td className={cx("text-center", { "border-0": isLast })} style={{ verticalAlign: "middle" }}>
        {timeLeftContent}
      </td>
    );
  }

  return (
    <tr>
      <td
        className={cx("text-center", { "border-0": isLast })}
        style={{ verticalAlign: "middle", width: "1px" }}
      >
        <button
          className={cx("btn btn-xs btn-outline-secondary rounded-circle", {
            active: status.locked,
          })}
          disabled={!settings.isTabManuallyLockable(tab)}
          onClick={(event) => {
            onToggleTab(windowId, tab, !status.locked, event.shiftKey);
          }}
        >
          {status.locked ? <i className="fas fa-lock" /> : <i className="fas fa-unlock" />}
        </button>
      </td>
      <td
        className={cx("text-center", { "border-0": isLast })}
        style={{ verticalAlign: "middle", width: "32px" }}
      >
        <TabFavicon
          alt=""
          height={16}
          favIconUrl={tab.favIconUrl}
          style={{ height: "16px", maxWidth: "none" }}
          url={tab.url}
          width={16}
        />
      </td>
      <td
        className={cx({ "border-0": isLast })}
        style={{ paddingBottom: "4px", paddingTop: "4px", width: "75%" }}
      >
        <div className="d-flex" style={{ lineHeight: "1.3" }}>
          <div className="flex-fill text-truncate" style={{ width: "1px" }}>
            {tab.title}
            <br />
            <small className={cx({ "text-muted": !status.locked })}>({tab.url})</small>
          </div>
        </div>
      </td>
      {lockStatusElement}
    </tr>
  );
}
