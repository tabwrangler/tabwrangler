/* @flow */

import PauseButton from './PauseButton';
import React from 'react';

export type NavBarTabID = 'about' | 'corral' | 'lock' | 'options';

type Props = {
  activeTabId: NavBarTabID;
  onClickTab: (tabId: NavBarTabID) => void;
};

export default class NavBar extends React.PureComponent<Props> {
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
