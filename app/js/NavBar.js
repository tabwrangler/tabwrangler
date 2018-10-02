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
      <div className="tw-nav__container">
        <ul className="tw-nav">
          <li className={cx({ active: this.props.activeTabId === 'corral' })}>
            <a
              
              href="#corral"
              onClick={this.handleClickCorralTab}>
              <span>
                {chrome.i18n.getMessage('tabCorral_name')}
              </span>
            </a>
            
          </li>
          <li className={cx({ active: this.props.activeTabId === 'lock' })}>
            <a
              
              href="#lock"
              onClick={this.handleClickLockTab}>
              {chrome.i18n.getMessage('tabLock_name')}
            </a>
          </li>
          <li className={cx({ active: this.props.activeTabId === 'options' })}>
            <a
              
              href="#options"
              onClick={this.handleClickOptionsTab}>
              {chrome.i18n.getMessage('options_name')}
            </a>
          </li>
          <li className={cx({ active: this.props.activeTabId === 'about' })}>
            <a
              
              href="#about"
              onClick={this.handleClickAboutTab}>
              {chrome.i18n.getMessage('about_name')}
              
            </a>
          </li>
          <li className="btn-pause">
          <PauseButton />
          </li>
        </ul>
      </div>
    );
  }
}
