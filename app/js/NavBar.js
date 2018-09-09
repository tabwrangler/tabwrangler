/* @flow */

import PauseButton from './PauseButton';
import React from 'react';
import cx from 'classnames';

export type NavBarTabID = 'about' | 'corral' | 'lock' | 'options';

type Props = {
  activeTabId: NavBarTabID,
  onClickTab: (tabId: NavBarTabID) => void,
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
        <div className="float-right nav-buttons">
          <PauseButton />
        </div>
        <ul className="nav nav-tabs">
          <li className="nav-item">
            <a
              className={cx('nav-link', { active: this.props.activeTabId === 'corral' })}
              href="#corral"
              onClick={this.handleClickCorralTab}>
              {chrome.i18n.getMessage('tabCorral_name')}
            </a>
          </li>
          <li className="nav-item">
            <a
              className={cx('nav-link', { active: this.props.activeTabId === 'lock' })}
              href="#lock"
              onClick={this.handleClickLockTab}>
              {chrome.i18n.getMessage('tabLock_name')}
            </a>
          </li>
          <li className="nav-item">
            <a
              className={cx('nav-link', { active: this.props.activeTabId === 'options' })}
              href="#options"
              onClick={this.handleClickOptionsTab}>
              {chrome.i18n.getMessage('options_name')}
            </a>
          </li>
          <li className="nav-item">
            <a
              className={cx('nav-link', { active: this.props.activeTabId === 'about' })}
              href="#about"
              onClick={this.handleClickAboutTab}>
              {chrome.i18n.getMessage('about_name')}
            </a>
          </li>
        </ul>
      </div>
    );
  }
}
