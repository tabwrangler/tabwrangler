/* @flow */

import CorralTab from './js/CorralTab';
import LazyImage from './js/LazyImage';
import OptionsTab from './js/OptionsTab';
import React from 'react';
import ReactDOM from 'react-dom';
import truncateString from './js/truncateString';

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

class OpenTabRow extends React.Component<OpenTabRowProps> {
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

      lockStatusElement = <td className="text-center muted">{reason}</td>;
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

      lockStatusElement = <td className="text-center">{timeLeftContent}</td>;
    }

    return (
      <tr>
        <td className="text-center">
          <input
            checked={tabIsLocked}
            disabled={tab.pinned || tabWhitelistMatch
             || tab.audible && settings.get('filterAudio')}
            onChange={this.handleLockedOnChange}
            type="checkbox"
          />
        </td>
        <td className="text-center">
          <LazyImage
            alt=""
            height={16}
            shouldCheck={true}
            src={tab.favIconUrl}
            style={{height: '16px', maxWidth: 'none'}}
            width={16}
          />
        </td>
        <td>
          <strong className="tabTitle">{truncateString(tab.title, 70)}</strong>
          <br />
          <span className="tabUrl">{truncateString(tab.url, 70)}</span>
        </td>
        {lockStatusElement}
      </tr>
    );
  }
}

interface LockTabState {
  tabs: Array<chrome$Tab>;
}

class LockTab extends React.PureComponent<{}, LockTabState> {
  _timeLeftInterval: ?number;

  constructor() {
    super();
    this.state = {
      tabs: [],
    };
  }

  componentWillMount() {
    this._timeLeftInterval = window.setInterval(this.forceUpdate.bind(this), 1000);

    // TODO: THIS WILL BREAK. This is some async stuff inside a synchronous call. Fix this, move
    // the state into a higher component.
    chrome.tabs.query({}, tabs => { this.setState({tabs}); });
  }

  componentWillUnmount() {
    window.clearInterval(this._timeLeftInterval);
  }

  handleLockTab = (tabId) => {
    tabmanager.lockTab(tabId);
    this.forceUpdate();
  };

  handleUnlockTab = (tabId) => {
    tabmanager.unlockTab(tabId);
    this.forceUpdate();
  };

  render() {
    const lockedIds = settings.get('lockedIds');

    return (
      <div className="tab-pane active">
        <table className="table table-hover">
          <thead>
            <tr>
              <th className="text-center">
                <abbr title={chrome.i18n.getMessage('tabLock_lockLabel')}>
                  <i className="glyphicon glyphicon-lock"></i>
                </abbr>
              </th>
              <th></th>
              <th style={{width: '100%'}}></th>
              <th className="text-center">
                <i
                  className="glyphicon glyphicon-time"
                  title={chrome.i18n.getMessage('tabLock_remainingTimeLabel')}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {this.state.tabs.map(tab =>
              <OpenTabRow
                isLocked={lockedIds.indexOf(tab.id) !== -1}
                key={tab.id}
                onLockTab={this.handleLockTab}
                onUnlockTab={this.handleUnlockTab}
                tab={tab}
              />
            )}
          </tbody>
        </table>
      </div>
    );
  }
}

interface PauseButtonState {
  paused: boolean;
}

class PauseButton extends React.PureComponent<{}, PauseButtonState> {
  constructor() {
    super();
    this.state = {
      paused: settings.get('paused'),
    };
  }

  pause = () => {
    chrome.browserAction.setIcon({path: 'img/icon-paused.png'});
    settings.set('paused', true);
    this.setState({paused: true});
  };

  play = () => {
    chrome.browserAction.setIcon({path: 'img/icon.png'});
    settings.set('paused', false);
    this.setState({paused: false});
  };

  render() {
    const action = this.state.paused
      ? this.play
      : this.pause;

    const content = this.state.paused
      ? (
        <span>
          <i className="glyphicon glyphicon-play"></i> {chrome.i18n.getMessage('extension_resume')}
        </span>
      ) : (
        <span>
          <i className="glyphicon glyphicon-pause"></i> {chrome.i18n.getMessage('extension_pause')}
        </span>
      );

    return (
      <button className="btn btn-default btn-xs" onClick={action}>
        {content}
      </button>
    );
  }
}

interface NavBarProps {
  activeTabId: string;
  onClickTab: (tabId: string) => void;
}

class NavBar extends React.PureComponent<NavBarProps> {
  handleClickAboutTab = (event: SyntheticMouseEvent<HTMLElement>) => {
    event.preventDefault();
    this.props.onClickTab('about');
  };

  handleClickCorralTab = (event: SyntheticMouseEvent<HTMLElement>) => {
    event.preventDefault();
    this.props.onClickTab('corral');
  };

  handleClickLockTab = (event: SyntheticMouseEvent<HTMLElement>) => {
    event.preventDefault();
    this.props.onClickTab('lock');
  };

  handleClickOptionsTab = (event: SyntheticMouseEvent<HTMLElement>) => {
    event.preventDefault();
    this.props.onClickTab('options');
  };

  render() {
    return (
      <div>
        <div className="pull-right nav-buttons">
          <PauseButton />{' '}
          <a
            className="btn btn-default btn-xs"
            href="https://chrome.google.com/webstore/detail/egnjhciaieeiiohknchakcodbpgjnchh/reviews"
            rel="noopener noreferrer"
            target="_blank">
            <i className="glyphicon glyphicon-star"></i>
            {' '}
            {chrome.i18n.getMessage('extension_review', chrome.i18n.getMessage('extName') || '')}
          </a>
        </div>
        <ul className="nav nav-tabs">
          <li className={this.props.activeTabId === 'corral' ? 'active' : null}>
            <a href="#corral" onClick={this.handleClickCorralTab}>
              {chrome.i18n.getMessage('tabCorral_name')}
            </a>
          </li>
          <li className={this.props.activeTabId === 'lock' ? 'active' : null}>
            <a href="#lock" onClick={this.handleClickLockTab}>
              {chrome.i18n.getMessage('tabLock_name')}
            </a>
          </li>
          <li className={this.props.activeTabId === 'options' ? 'active' : null}>
            <a href="#options" onClick={this.handleClickOptionsTab}>
              {chrome.i18n.getMessage('options_name')}
            </a>
          </li>
          <li className={this.props.activeTabId === 'about' ? 'active' : null}>
            <a href="#about" onClick={this.handleClickAboutTab}>
              {chrome.i18n.getMessage('about_name')}
            </a>
          </li>
        </ul>
      </div>
    );
  }
}

function AboutTab() {
  return (
    <div className="tab-pane active">
      <p>{chrome.i18n.getMessage('extName')} v{chrome.runtime.getManifest().version}</p>
      <ul>
        <li>
          <a
            href="https://github.com/tabwrangler/tabwrangler/releases"
            rel="noopener noreferrer"
            target="_blank">
            {chrome.i18n.getMessage('about_changeLog')}
          </a>
        </li>
        <li>
          <a
            href="https://github.com/tabwrangler/tabwrangler/issues"
            rel="noopener noreferrer"
            target="_blank">
            {chrome.i18n.getMessage('about_support')}
          </a>
        </li>
        <li>
          <a
            href="https://github.com/tabwrangler/tabwrangler"
            rel="noopener noreferrer"
            target="_blank">
            {chrome.i18n.getMessage('about_sourceCode')}
          </a>
        </li>
      </ul>
    </div>
  );
}

interface PopupContentProps {
  commands: ?Array<chrome$Command>;
}

interface PopupContentState {
  activeTabId: string;
}

class PopupContent extends React.PureComponent<PopupContentProps, PopupContentState> {
  constructor(props: PopupContentProps) {
    super(props);
    this.state = {
      activeTabId: 'corral',
    };
  }

  _handleClickTab = (tabId) => {
    this.setState({activeTabId: tabId});
  };

  render() {
    let activeTab;
    switch (this.state.activeTabId) {
    case 'about':
      activeTab = <AboutTab />;
      break;
    case 'corral':
      activeTab = <CorralTab />;
      break;
    case 'lock':
      activeTab = <LockTab />;
      break;
    case 'options':
      activeTab = <OptionsTab commands={this.props.commands} />;
      break;
    }

    return (
      <div>
        <NavBar activeTabId={this.state.activeTabId} onClickTab={this._handleClickTab} />
        <div className="tab-content container">
          {activeTab}
        </div>
      </div>
    );
  }
}

function render(props) {
  const popupElement = document.getElementById('popup');
  if (popupElement == null) return;
  ReactDOM.render(<PopupContent {...props} />, popupElement);
}

render({commands: null});

chrome.commands.getAll(commands => {
  render({commands});
});
