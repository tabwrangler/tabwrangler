/* @flow */

import LazyImage from './LazyImage';
import React from 'react';

const TW = chrome.extension.getBackgroundPage().TW;

// Unpack TW.
const {
  settings,
  tabmanager,
} = TW;

function secondsToMinutes(seconds) {
  let s = seconds % 60;
  s = s >= 10 ? String(s) : `0${String(s)}`;
  return `${String(Math.floor(seconds / 60))}:${s}`;
}

interface OpenTabRowProps {
  isLocked: boolean;
  onLockTab: (tabId: number) => void;
  onUnlockTab: (tabId: number) => void;
  tab: chrome$Tab;
}

export default class OpenTabRow extends React.Component<OpenTabRowProps> {
  handleLockedOnChange = (event: SyntheticInputEvent<HTMLInputElement>) => {
    const {tab} = this.props;
    if (tab.id == null) return;

    if (event.target.checked) {
      this.props.onLockTab(tab.id);
    } else {
      this.props.onUnlockTab(tab.id);
    }
  };

  render() {
    const {tab} = this.props;
    const tabWhitelistMatch = tabmanager.getWhitelistMatch(tab.url);
    const tabIsLocked = tab.pinned || tabWhitelistMatch || this.props.isLocked
     || tab.audible && settings.get('filterAudio');

    let lockStatusElement;
    if (tabIsLocked) {
      let reason;
      if (tab.pinned) {
        reason = chrome.i18n.getMessage('tabLock_lockedReason_pinned');
      } else if (settings.get('filterAudio') && tab.audible) {
        reason = (
          <abbr title={chrome.i18n.getMessage('tabLock_lockedReason_audible')}>
            Locked
          </abbr>
        );
      } else if (tabWhitelistMatch) {
        reason = (
          <abbr title={chrome.i18n.getMessage('tabLock_lockedReason_matches', tabWhitelistMatch)}>
            Auto-Locked
          </abbr>
        );
      } else {
        reason = chrome.i18n.getMessage('tabLock_lockedReason_locked');
      }

      lockStatusElement = (
        <td className="text-center muted" style={{verticalAlign: 'middle'}}>{reason}</td>
      );
    } else {
      let timeLeftContent;
      if (settings.get('paused')) {
        timeLeftContent = chrome.i18n.getMessage('tabLock_lockedReason_paused');
      } else {
        const lastModified = tabmanager.tabTimes[tab.id];
        const cutOff = new Date().getTime() - settings.get('stayOpen');
        const timeLeft = -1 * Math.round((cutOff - lastModified) / 1000);
        // If `timeLeft` is less than 0, the countdown likely continued and is waiting for the
        // interval to clean up this tab. It's also possible the number of tabs is not below
        // `minTabs`, which has stopped the countdown and locked this at a negative `timeLeft` until
        // another tab is opened to jump start the countdown again.
        timeLeftContent = timeLeft < 0 ? '...' : secondsToMinutes(timeLeft);
      }

      lockStatusElement = (
        <td className="text-center" style={{verticalAlign: 'middle'}}>{timeLeftContent}</td>
      );
    }

    return (
      <tr>
        <td className="text-center" style={{verticalAlign: 'middle', width: '1px'}}>
          <input
            checked={tabIsLocked}
            disabled={tab.pinned || tabWhitelistMatch
             || tab.audible && settings.get('filterAudio')}
            onChange={this.handleLockedOnChange}
            type="checkbox"
          />
        </td>
        <td className="text-center" style={{verticalAlign: 'middle', width: '32px'}}>
          <LazyImage
            alt=""
            height={16}
            src={tab.favIconUrl}
            style={{height: '16px', maxWidth: 'none'}}
            width={16}
          />
        </td>
        <td style={{paddingBottom: '4px', paddingTop: '4px', width: '75%'}}>
          <div style={{display: 'flex'}}>
            <div
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                width: '1px',
              }}>
              {tab.title}
              <br />
              <small className="text-muted">({tab.url})</small>
            </div>
          </div>
        </td>
        {lockStatusElement}
      </tr>
    );
  }
}
