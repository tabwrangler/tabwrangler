import * as React from "react";
import LazyImage from "../LazyImage";
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
  isLocked: boolean;
  onToggleTab: (
    windowId: number,
    tab: chrome.tabs.Tab,
    selected: boolean,
    multiselect: boolean,
  ) => void;
  tab: chrome.tabs.Tab;
  tabTime: number | undefined;
  windowId: number;
};

export default function OpenTabRow({
  isLast,
  isLocked,
  onToggleTab,
  tab,
  tabTime = Date.now(),
  windowId,
}: Props) {
  const { data: syncPersistData } = useStorageSyncPersistQuery();
  const now = React.useContext(UseNowContext);
  const paused = syncPersistData?.paused;
  const tabWhitelistMatch = settings.getWhitelistMatch(tab.url);
  const isInactive = tabTime === -1;

  let lockStatusElement;
  if (isLocked || isInactive) {
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
    if (!isLocked && isInactive) {
      reason = <abbr title={chrome.i18n.getMessage("tabLock_lockedReason_inactive")}>Inactive</abbr>;
    }

    lockStatusElement = (
      <td
        className={cx("text-center muted", { "border-0": isLast }, { "text-muted": isInactive })}
        style={{ verticalAlign: "middle" }}
      >
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
      timeLeftContent = timeLeft < 0 ? "…" : <time>{secondsToHms(timeLeft)}</time>;
    }

    lockStatusElement = (
      <td className={cx("text-center", { "border-0": isLast })} style={{ verticalAlign: "middle" }}>
        {timeLeftContent}
      </td>
    );
  }

  return (
    <tr className={cx({ "table-warning": isLocked })}>
      <td
        className={cx("text-center", { "border-0": isLast })}
        style={{ verticalAlign: "middle", width: "1px" }}
      >
        <input
          checked={isLocked}
          className="mx-1"
          disabled={!settings.isTabManuallyLockable(tab)}
          onClick={(event: React.MouseEvent) => {
            if (!(event.target instanceof HTMLInputElement)) return;
            onToggleTab(windowId, tab, event.target.checked, event.shiftKey);
          }}
          type="checkbox"
          readOnly
        />
      </td>
      <td
        className={cx("text-center", { "border-0": isLast })}
        style={{ verticalAlign: "middle", width: "32px" }}
      >
        <LazyImage
          alt=""
          height={16}
          src={tab.favIconUrl ?? ""}
          style={{ height: "16px", maxWidth: "none" }}
          width={16}
        />
      </td>
      <td
        className={cx({ "border-0": isLast })}
        style={{ paddingBottom: "4px", paddingTop: "4px", width: "75%" }}
      >
        <div className="d-flex" style={{ lineHeight: "1.3" }}>
          <div className="flex-fill text-truncate" style={{ width: "1px" }}>
            <span className={cx({ "text-muted": isInactive })}>{tab.title}</span>
            <br />
            <small className={cx({ "text-muted": !isLocked || isInactive })}>({tab.url})</small>
          </div>
        </div>
      </td>
      {lockStatusElement}
    </tr>
  );
}
