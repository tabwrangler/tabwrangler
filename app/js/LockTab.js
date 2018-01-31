/* @flow */

import OpenTabRow from './OpenTabRow';
import React from 'react';

const TW = chrome.extension.getBackgroundPage().TW;

// Unpack TW.
const {
  settings,
  tabmanager,
} = TW;

interface State {
  tabs: Array<chrome$Tab>;
}

export default class LockTab extends React.PureComponent<{}, State> {
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

  handleLockTab = (tabId: number) => {
    tabmanager.lockTab(tabId);
    this.forceUpdate();
  };

  handleUnlockTab = (tabId: number) => {
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
