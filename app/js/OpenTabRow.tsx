import * as React from "react";
import { useStorageLocalPersistQuery, useStorageSyncPersistQuery } from "./hooks";
import LazyImage from "./LazyImage";
import { UseNowContext } from "./LockTab";
import cx from "classnames";
import settings from "./settings";

function secondsToMinutes(seconds: number) {
  const minutes = seconds % 60;
  const minutesString = minutes >= 10 ? String(minutes) : `0${String(minutes)}`;
  return `${String(Math.floor(seconds / 60))}:${minutesString}`;
}

type Props = {
  isLocked: boolean;
  onToggleTab: (tab: chrome.tabs.Tab, selected: boolean, multiselect: boolean) => void;
  tab: chrome.tabs.Tab;
};

export default function OpenTabRow({ isLocked, onToggleTab, tab }: Props) {
  const { data: syncPersistData } = useStorageSyncPersistQuery();
  const { data: localPersistData } = useStorageLocalPersistQuery();
  const now = React.useContext(UseNowContext);
  const paused = syncPersistData?.paused;
  const tabTime =
    tab.id == null || localPersistData == null ? Date.now() : localPersistData.tabTimes[tab.id];

  console.log("tabTime", tabTime);
  console.log("now", now);
  function handleLockedOnClick(event: React.MouseEvent) {
    // Dynamically check target is an input element.
    if (!(event.target instanceof HTMLInputElement)) return;
    onToggleTab(tab, event.target.checked, event.shiftKey);
  }

  const tabWhitelistMatch = settings.getWhitelistMatch(tab.url);

  let lockStatusElement;
  if (isLocked) {
    let reason;
    if (tab.pinned) {
      reason = chrome.i18n.getMessage("tabLock_lockedReason_pinned");
    } else if (settings.get("filterAudio") && tab.audible) {
      reason = <abbr title={chrome.i18n.getMessage("tabLock_lockedReason_audible")}>Locked</abbr>;
    } else if (settings.get("filterGroupedTabs") && "groupId" in tab && tab.groupId > 0) {
      reason = chrome.i18n.getMessage("tabLock_lockedReason_group");
    } else if (tabWhitelistMatch) {
      reason = (
        <abbr title={chrome.i18n.getMessage("tabLock_lockedReason_matches", tabWhitelistMatch)}>
          Auto-Locked
        </abbr>
      );
    } else {
      reason = chrome.i18n.getMessage("tabLock_lockedReason_locked");
    }

    console.log("LOCKED");
    lockStatusElement = (
      <td className="text-center muted" style={{ verticalAlign: "middle" }}>
        {reason}
      </td>
    );
  } else {
    let timeLeftContent;
    if (paused) {
      timeLeftContent = chrome.i18n.getMessage("tabLock_lockedReason_paused");
    } else {
      const cutOff = now - settings.get<number>("stayOpen");
      const timeLeft = -1 * Math.round((cutOff - tabTime) / 1000);
      // If `timeLeft` is less than 0, the countdown likely continued and is waiting for the
      // interval to clean up this tab. It's also possible the number of tabs is not below
      // `minTabs`, which has stopped the countdown and locked this at a negative `timeLeft` until
      // another tab is opened to jump start the countdown again.
      timeLeftContent = timeLeft < 0 ? "…" : secondsToMinutes(timeLeft);
    }

    console.log("NOT LOCKED", timeLeftContent);
    lockStatusElement = (
      <td className="text-center" style={{ verticalAlign: "middle" }}>
        {timeLeftContent}
      </td>
    );
  }

  return (
    <tr className={cx({ "table-warning": isLocked })}>
      <td className="text-center" style={{ verticalAlign: "middle", width: "1px" }}>
        <input
          checked={isLocked}
          className="mx-1"
          disabled={!settings.isTabManuallyLockable(tab)}
          onClick={handleLockedOnClick}
          type="checkbox"
          readOnly
        />
      </td>
      <td className="text-center" style={{ verticalAlign: "middle", width: "32px" }}>
        <LazyImage
          alt=""
          height={16}
          src={tab.favIconUrl ?? ""}
          style={{ height: "16px", maxWidth: "none" }}
          width={16}
        />
      </td>
      <td style={{ paddingBottom: "4px", paddingTop: "4px", width: "75%" }}>
        <div className="d-flex" style={{ lineHeight: "1.3" }}>
          <div className="flex-fill text-truncate" style={{ width: "1px" }}>
            {tab.title}
            <br />
            <small className={cx({ "text-muted": !isLocked })}>({tab.url})</small>
          </div>
        </div>
      </td>
      {lockStatusElement}
    </tr>
  );
}
