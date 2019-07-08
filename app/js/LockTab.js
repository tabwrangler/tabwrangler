/* @flow */

import OpenTabRow from './OpenTabRow';
import React from 'react';
import { isManuallyLockable } from './tab';

const TW = chrome.extension.getBackgroundPage().TW;

// Unpack TW.
const { tabmanager } = TW;

interface State {
  tabs: Array<chrome$Tab>;
}

export default class LockTab extends React.PureComponent<{}, State> {
  _lastSelectedTab: ?chrome$Tab;
  _timeLeftInterval: ?number;

  constructor() {
    super();
    this.state = {
      tabs: [],
    };
  }

  componentDidMount() {
    this._timeLeftInterval = window.setInterval(this.forceUpdate.bind(this), 1000);

    // TODO: THIS WILL BREAK. This is some async stuff inside a synchronous call. Fix this, move
    // the state into a higher component.
    chrome.tabs.query({}, tabs => {
      this.setState({ tabs });
    });
  }

  componentWillUnmount() {
    window.clearInterval(this._timeLeftInterval);
  }

  handleToggleTab = (tab: chrome$Tab, selected: boolean, multiselect: boolean) => {
    let tabsToToggle = [tab];
    if (multiselect && this._lastSelectedTab != null) {
      const lastSelectedTabIndex = this.state.tabs.indexOf(this._lastSelectedTab);
      if (lastSelectedTabIndex >= 0) {
        const tabIndex = this.state.tabs.indexOf(tab);
        tabsToToggle = this.state.tabs.slice(
          Math.min(tabIndex, lastSelectedTabIndex),
          Math.max(tabIndex, lastSelectedTabIndex) + 1
        );
      }
    }

    // Toggle only the tabs that are manually lockable.
    tabsToToggle.filter(tab => isManuallyLockable(tab)).forEach(tab => {
      if (selected) tabmanager.lockTab(tab.id);
      else tabmanager.unlockTab(tab.id);
    });

    this._lastSelectedTab = tab;
    this.forceUpdate();
  };

  render() {
    return (
      <div className="tab-pane active">
        <table className="table table-hover table-sm table-th-unbordered">
          <thead>
            <tr>
              <th className="text-center">
                <abbr title={chrome.i18n.getMessage('tabLock_lockLabel')}>
                  <i className="fas fa-lock" />
                </abbr>
              </th>
              <th />
              <th style={{ width: '75%' }} />
              <th className="text-center">
                <abbr title={chrome.i18n.getMessage('tabLock_remainingTimeLabel')}>
                  <i className="fas fa-stopwatch" />
                </abbr>
              </th>
            </tr>
          </thead>
          <tbody>
            {this.state.tabs.map(tab => (
              <OpenTabRow key={tab.id} onToggleTab={this.handleToggleTab} tab={tab} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}
