'use strict';

/* global chrome */

import _ from 'underscore';
import LazyImage from './js/LazyImage';
import React from 'react';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import ReactDOM from 'react-dom';
import timeago from 'timeago.js';

const TW = chrome.extension.getBackgroundPage().TW;

// Unpack TW.
const {
  settings,
  tabmanager,
} = TW;

function secondsToMinutes(seconds) {
  let s = seconds % 60;
  s = s >= 10 ? String(s) : '0' + String(s);
  return String(Math.floor(seconds / 60)) + ':' + s;
}

function truncateString(str, length) {
  if (str.length > (length + 3) ) {
    return str.substring(0, length) + '...';
  }
  return str;
}

class OpenTabRow extends React.Component {
  handleLockedOnChange = (event) => {
    const {tab} = this.props;
    if (event.target.checked) {
      this.props.onLockTab(tab.id);
    } else {
      this.props.onUnlockTab(tab.id)
    }
  };

  render() {
    const {tab} = this.props;
    const tabWhitelistMatch = tabmanager.getWhitelistMatch(tab.url);
    const tabIsLocked = tab.pinned || tabWhitelistMatch || this.props.isLocked;

    let lockStatusElement;
    if (tabIsLocked) {
      let reason;
      if (tab.pinned) {
        reason = 'Pinned';
      } else if (tabWhitelistMatch) {
        reason = <abbr title={`Matches '${tabWhitelistMatch}'`}>Auto-Locked</abbr>;
      } else {
        reason = 'Locked';
      }

      lockStatusElement = <td className="text-center muted">{reason}</td>;
    } else {
      let timeLeftContent;
      if (settings.get('paused')) {
        timeLeftContent = 'Paused';
      } else {
        const lastModified = tabmanager.tabTimes[tab.id];
        const cutOff = new Date().getTime() - settings.get('stayOpen');
        const timeLeft = -1 * (Math.round((cutOff - lastModified) / 1000)).toString();
        timeLeftContent = secondsToMinutes(timeLeft);
      }

      lockStatusElement = <td className="text-center">{timeLeftContent}</td>;
    }

    return (
      <tr>
        <td className="text-center">
          <input
            checked={tabIsLocked}
            disabled={tab.pinned || tabWhitelistMatch}
            onChange={this.handleLockedOnChange}
            type="checkbox"
          />
        </td>
        <td className="text-center">
          <LazyImage
            alt=""
            height="16"
            src={tab.favIconUrl}
            style={{height: '16px', maxWidth: 'none'}}
            width="16"
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

class LockTab extends React.PureComponent {
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
    chrome.tabs.query({}, tabs => { this.setState({tabs}); })
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
        <div className="alert alert-info">Click the checkbox to lock the tab (prevent it from auto-closing).</div>
        <table id="activeTabs" className="table table-condensed table-striped table-bordered">
          <thead>
            <tr>
              <th className="text-center">
                <i className="icon icon-lock" title="Lock/Unlock"></i>
              </th>
              <th></th>
              <th style={{width: '100%'}}>Tab</th>
              <th className="text-center">
                <i className="icon icon-time" title="Closing in..."></i>
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

function isValidPattern(pattern) {
  // some other choices such as '/' also do not make sense
  // not sure if they should be blocked as well
  return pattern != null && pattern.length > 0 && /\S/.test(pattern);
}

class OptionsTab extends React.Component {
  constructor() {
    super();
    this.state = {
      errors: [],
      newPattern: '',
      saveAlertVisible: false,
    };

    const debounced = _.debounce(this.handleSettingsChange, 150);
    this.debouncedHandleSettingsChange = event => {
      // Prevent React's [Event Pool][1] from nulling the event.
      //
      // [1]: https://facebook.github.io/react/docs/events.html#event-pooling
      event.persist();
      debounced(event);
    };
  }

  componentWillUnmount() {
    if (this.saveAlertTimeout != null) {
      window.clearTimeout(this.saveAlertTimeout);
    }
  }

  handleClickRemovePattern(pattern) {
    const whitelist = settings.get('whitelist');
    whitelist.splice(whitelist.indexOf(pattern), 1);
    this.saveOption('whitelist', whitelist);
    this.forceUpdate();
  }

  handleAddPatternSubmit = (event) => {
    event.preventDefault();
    const {newPattern} = this.state;

    if (!isValidPattern(newPattern)) {
      return;
    }

    const whitelist = settings.get('whitelist');

    // Only add the pattern again if it's new, not yet in the whitelist.
    if (whitelist.indexOf(newPattern) === -1) {
      whitelist.push(newPattern);
      this.saveOption('whitelist', whitelist);
    }

    this.setState({newPattern: ''});
  };

  handleNewPatternChange = (event) => {
    this.setState({newPattern: event.target.value});
  };

  handleSettingsChange = (event) => {
    if (event.target.type === 'checkbox') {
      this.saveOption(event.target.id, !!event.target.checked);
    } else {
      this.saveOption(event.target.id, event.target.value);
    }
  };

  saveOption(key, value) {
    if (this.saveAlertTimeout != null) {
      window.clearTimeout(this.saveAlertTimeout);
    }

    try {
      settings.set(key, value);
      this.setState({
        errors: [],
        saveAlertVisible: true,
      });
      this.saveAlertTimeout = window.setTimeout(() => {
        this.setState({saveAlertVisible: false});
      }, 400);
    }
    catch (err) {
      this.state.errors.push(err);
      this.forceUpdate();
    }
  }

  render() {
    const whitelist = settings.get('whitelist');

    let errorAlert;
    let saveAlert;
    if (this.state.errors.length === 0) {
      if (this.state.saveAlertVisible) {
        saveAlert = [<div className="alert alert-success" key="alert">Saving...</div>];
      }
    } else {
      errorAlert = (
        <div className="alert alert-error">
          <ul style={{'margin-bottom': 0}}>
            {this.state.errors.map((error, i) =>
              <li key={i}>{error.message}</li>
            )}
          </ul>
        </div>
      );
    }

    return (
      <div className="tab-pane active">
        <form>
          <fieldset>
            <legend>Settings</legend>
            <p>
              <label htmlFor="minutesInactive">Close inactive tabs after:</label>
              <input
                className="span1"
                defaultValue={settings.get('minutesInactive')}
                id="minutesInactive"
                max="7200"
                min="1"
                name="minutesInactive"
                onChange={this.debouncedHandleSettingsChange}
                title="Must be a number greater than 0 and less than 7200"
                type="number"
              /> minutes.
            </p>
            <p>
              <label htmlFor="minTabs">Don't auto-close if I only have</label>
              <input
                className="span1"
                defaultValue={settings.get('minTabs')}
                id="minTabs"
                min="0"
                name="minTabs"
                onChange={this.debouncedHandleSettingsChange}
                title="Must be a number greater than or equal to 0"
                type="number"
              /> tabs open (does not include pinned or locked tabs).
            </p>
            <p>
              <label htmlFor="maxTabs">Remember up to</label>
              <input
                className="span1"
                defaultValue={settings.get('maxTabs')}
                id="maxTabs"
                min="0"
                name="maxTabs"
                onChange={this.debouncedHandleSettingsChange}
                title="Must be a number greater than or equal to 0"
                type="number"
              /> closed tabs.
            </p>
            <p>
              <label className="checkbox">Clear closed tabs list on quit
                <input
                  defaultChecked={settings.get('purgeClosedTabs')}
                  id="purgeClosedTabs"
                  name="purgeClosedTabs"
                  onChange={this.handleSettingsChange}
                  type="checkbox"
                />
              </label>
            </p>
            <p>
              <label className="checkbox">Show # of closed tabs in url bar
                <input
                  defaultChecked={settings.get('showBadgeCount')}
                  id="showBadgeCount"
                  name="showBadgeCount"
                  onChange={this.handleSettingsChange}
                  type="checkbox"
                />
              </label>
            </p>
          </fieldset>
        </form>

        {(this.state.errors.length === 0)
          ? (
            <ReactCSSTransitionGroup
              transitionEnter={false}
              transitionLeaveTimeout={400}
              transitionName="alert">
              {saveAlert}
            </ReactCSSTransitionGroup>
          )
          : errorAlert}

        <form onSubmit={this.handleAddPatternSubmit}>
          <fieldset>
            <legend>Auto-Lock</legend>
            <label htmlFor="wl-add">tabs with urls "like":</label>
            <div className="input-append">
              <input
                id="wl-add"
                onChange={this.handleNewPatternChange}
                type="text"
                value={this.state.newPattern}
              />
              <button
                className="btn"
                disabled={!isValidPattern(this.state.newPattern)}
                id="addToWL"
                type="submit">
                Add
              </button>
            </div>

            <table
              className="table table-bordered table-condensed table-striped"
              id="whitelist"
              style={{marginTop: '20px'}}>
              <thead>
                <tr>
                  <th style={{width: '100%'}}>URL Pattern</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {whitelist.map(pattern =>
                  <tr key={pattern}>
                    <td>{pattern}</td>
                    <td>
                      <button
                        className="btn btn-mini deleteLink"
                        onClick={this.handleClickRemovePattern.bind(this, pattern)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <span className="help-block">
              Example: <i>cnn</i> would match every page on cnn.com and any URL with cnn anywhere in url.
            </span>
          </fieldset>
        </form>
      </div>
    );
  }
}

class ClosedTabGroupHeader extends React.PureComponent {
  handleClickRestoreAll = () => {
    this.props.onRestoreAll(this.props.title);
  };

  render() {
    return (
      <tr className="info">
        <td colSpan="3" className="timeGroupRow">
          <button
            className="btn btn-mini pull-right"
            onClick={this.handleClickRestoreAll}>
            Restore all
          </button>
          closed {this.props.title}
        </td>
      </tr>
    );
  }
}

class ClosedTabRow extends React.PureComponent {
  constructor() {
    super();
    this.state = {
      active: false,
    };
  }

  handleMouseEnter = () => {
    this.setState({active: true});
  };

  handleMouseLeave = () => {
    this.setState({active: false});
  };

  openTab = (event) => {
    const {tab} = this.props;
    event.preventDefault();
    this.props.onOpenTab(tab);
  };

  removeTabFromList = () => {
    this.props.onRemoveTabFromList(this.props.tab.id);
  };

  render() {
    const {tab} = this.props;

    let favicon;
    if (this.state.active) {
      favicon = (
        <i
          className="btn-remove icon-remove"
          onClick={this.removeTabFromList}
          title="Remove tab from list"
        />
      );
    } else {
      favicon = (tab.favIconUrl == null)
        ? '-'
        : <LazyImage alt="" className="favicon" height="16" src={tab.favIconUrl} width="16" />;
    }

    const timeagoInstance = timeago();
    return (
      <tr onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}>
        <td className="faviconCol">{favicon}</td>
        <td>
          <a target="_blank" href={tab.url} onClick={this.openTab}>
            {truncateString(tab.title, 70)}
          </a>
        </td>
        <td>{timeagoInstance.format(tab.closedAt)}</td>
      </tr>
    );
  }
}

class CorralTab extends React.Component {
  constructor() {
    super();
    this.state = {
      closedTabGroups: [],
      filter: '',
    };
  }

  componentDidMount() {
    // Focus the search input so it's simple to type immediately. This must be done after the popup
    // is available, which is roughly 150ms after the popup is opened (determined empirically). Use
    // 250ms to ensure this always works.
    this._searchRefFocusTimeout = setTimeout(() => {
      this._searchRef.focus();
    }, 350);

    // TODO: This is assumed to be synchronous. If it becomes async, this state needs to be
    // hoisted so this component does not need to track whether it's mounted.
    tabmanager.searchTabs(this.setClosedTabs);
  }

  componentWillUnmount() {
    clearTimeout(this._searchRefFocusTimeout);
  }

  clearList = () => {
    this.state.closedTabGroups.forEach(closedTabGroup => {
      closedTabGroup.tabs.forEach(tab => {
        tabmanager.closedTabs.removeTab(tab.id);
      });
    });
    tabmanager.updateClosedCount();
    this.setState({
      closedTabGroups: [],
    });
  };

  handleRemoveTabFromList = (tabId) => {
    tabmanager.closedTabs.removeTab(tabId);
    tabmanager.searchTabs(this.setClosedTabs, [tabmanager.filters.keyword(this.state.filter)]);
    this.forceUpdate();
  };

  handleRestoreAllFromGroup = (groupTitle) => {
    const group = _.findWhere(this.state.closedTabGroups, {title: groupTitle});
    tabmanager.closedTabs.unwrangleTabs(group.tabs);
    tabmanager.searchTabs(this.setClosedTabs, [tabmanager.filters.keyword(this.state.filter)]);
    this.forceUpdate();
  };

  openTab = (tab) => {
    tabmanager.closedTabs.unwrangleTabs([tab]);
    tabmanager.searchTabs(this.setClosedTabs, [tabmanager.filters.keyword(this.state.filter)]);
    this.forceUpdate();
  };

  setClosedTabs = (closedTabs) => {
    const now = new Date().getTime();
    const separations = []
    separations.push([now - (1000 * 60 * 30), 'in the last 1/2 hour']);
    separations.push([now - (1000 * 60 * 60), 'in the last hour']);
    separations.push([now - (1000 * 60 * 60 * 2),'in the last 2 hours']);
    separations.push([now - (1000 * 60 * 60 * 24),'in the last day']);
    separations.push([0, 'more than a day ago']);

    function getGroup(time) {
      let limit, text;
      for (let i = 0; i < separations.length; i++) {
        limit = separations[i][0];
        text = separations[i][1];
        if (limit < time) {
          return text;
        }
      }
    }

    const closedTabGroups = [];
    let currentGroup;
    for (let i = 0; i < closedTabs.length; i++) {
      const tab = closedTabs[i];
      const timeGroup = getGroup(tab.closedAt);

      if (timeGroup !== currentGroup) {
        currentGroup = _.findWhere(closedTabGroups, {title: timeGroup});

        if (currentGroup == null) {
          currentGroup = {
            tabs: [],
            title: timeGroup,
          };
          closedTabGroups.push(currentGroup);
        }
      }

      currentGroup.tabs.push(tab)
    }

    this.setState({closedTabGroups});
  };

  setFilter = (event) => {
    const filter = event.target.value;
    this.setState({filter});
    tabmanager.searchTabs(this.setClosedTabs, [tabmanager.filters.keyword(filter)]);
  };

  render() {
    const tableRows = [];
    this.state.closedTabGroups.forEach(closedTabGroup => {
      tableRows.push(
        <ClosedTabGroupHeader
          key={`ctgh-${closedTabGroup.title}`}
          onRestoreAll={this.handleRestoreAllFromGroup}
          title={closedTabGroup.title}
        />
      );

      closedTabGroup.tabs.forEach(tab => {
        tableRows.push(
          <ClosedTabRow
            key={`ctr-${tab.id}`}
            onOpenTab={this.openTab}
            onRemoveTabFromList={this.handleRemoveTabFromList}
            tab={tab}
          />
        );
      });
    });

    const messageElement = this.state.closedTabGroups.length === 0
      ? (
        <div id="autocloseMessage" className="alert alert-info">
          If tabs are closed automatically, they will be stored here
        </div>
      )
      : (
        <button
          className="btn btn-small"
          onClick={this.clearList}
          style={{marginBottom: '20px'}}>
          Clear list
        </button>
      );

    const totalTabsRemoved = settings.get('totalTabsRemoved');
    const percentClosed = totalTabsRemoved === 0
      ? 0
      : Math.trunc(settings.get('totalTabsWrangled') / settings.get('totalTabsRemoved') * 100);

    return (
      <div className="tab-pane active">
        <div className="row-fluid">
          <form className="form-search span6">
            <input
              className="search-query input-xlarge"
              name="search"
              onChange={this.setFilter}
              placeholder="search"
              ref={_searchRef => { this._searchRef = _searchRef; }}
              type="search"
              value={this.state.filter}
            />
          </form>
          <div className="span6" style={{lineHeight: '30px', textAlign: 'right'}}>
            <small style={{color: '#999'}}>tabs wrangled</small>{' '}
            {settings.get('totalTabsWrangled')} or{' '}
            <abbr title="tabs closed by Tab Wrangler / all tabs closed">{percentClosed}%</abbr>
          </div>
        </div>

        <table id="corralTable" className="table-condensed table-striped table table-bordered">
          <thead>
            <tr>
              <th className="faviconCol"><i className="icon-remove"></i></th>
              <th>Title</th>
              <th>Closed</th>
            </tr>
          </thead>
          <tbody>
            {tableRows}
          </tbody>
        </table>

        {messageElement}
      </div>
    );
  }
}

class PauseButton extends React.PureComponent {
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
      ? <span><i className="icon-play"></i> Resume</span>
      : <span><i className="icon-pause"></i> Pause</span>;

    return (
      <button className="btn btn-mini" onClick={action}>
        {content}
      </button>
    );
  }
}

class NavBar extends React.PureComponent {
  handleClickAboutTab = (event) => {
    event.preventDefault();
    this.props.onClickTab('about');
  };

  handleClickCorralTab = (event) => {
    event.preventDefault();
    this.props.onClickTab('corral');
  };

  handleClickLockTab = (event) => {
    event.preventDefault();
    this.props.onClickTab('lock');
  };

  handleClickOptionsTab = (event) => {
    event.preventDefault();
    this.props.onClickTab('options');
  };

  render() {
    return (
      <div>
        <div className="pull-right nav-buttons">
          <PauseButton />{' '}
          <a
            className="btn btn-mini"
            href="https://chrome.google.com/webstore/detail/egnjhciaieeiiohknchakcodbpgjnchh/reviews"
            target="_blank">
            <i className="icon-star"></i> Review Tab Wrangler
          </a>
        </div>
        <ul className="nav nav-tabs">
          <li className={this.props.activeTabId === 'corral' ? 'active' : null}>
            <a href="#corral" onClick={this.handleClickCorralTab}>Tab Corral</a>
          </li>
          <li className={this.props.activeTabId === 'lock' ? 'active' : null}>
            <a href="#lock" onClick={this.handleClickLockTab}>Tab Lock</a>
          </li>
          <li className={this.props.activeTabId === 'options' ? 'active' : null}>
            <a href="#options" onClick={this.handleClickOptionsTab}>Options</a>
          </li>
          <li className={this.props.activeTabId === 'about' ? 'active' : null}>
            <a href="#about" onClick={this.handleClickAboutTab}>About</a>
          </li>
        </ul>
      </div>
    );
  }
}

function AboutTab() {
  return (
    <div className="tab-pane active">
      <p>TabWrangler v{chrome.app.getDetails().version}</p>
      <ul>
        <li>
          <a href="https://github.com/jacobSingh/tabwrangler/releases" target="_blank">
            Change Log
          </a>
        </li>
        <li>
          <a href="https://github.com/jacobSingh/tabwrangler/issues" target="_blank">
            Support
          </a>
        </li>
        <li>
          <a href="https://github.com/jacobSingh/tabwrangler" target="_blank">
            Source Code (MIT)
          </a>
        </li>
      </ul>
    </div>
  );
}

class PopupContent extends React.PureComponent {
  constructor() {
    super();
    this.state = {
      activeTabId: 'corral',
    };
  }

  handleClickTab = (tabId) => {
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
        activeTab = <OptionsTab />;
        break;
    }

    return (
      <div>
        <NavBar activeTabId={this.state.activeTabId} onClickTab={this.handleClickTab} />
        <div className="tab-content container-fluid">
          {activeTab}
        </div>
      </div>
    );
  }
}

ReactDOM.render(
  <PopupContent />,
  document.getElementById('popup')
);
