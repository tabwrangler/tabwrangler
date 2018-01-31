/* @flow */

import CorralTab from './js/CorralTab';
import LockTab from './js/LockTab';
import OptionsTab from './js/OptionsTab';
import React from 'react';
import ReactDOM from 'react-dom';

const TW = chrome.extension.getBackgroundPage().TW;

// Unpack TW.
const {
  settings,
} = TW;

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
