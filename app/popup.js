/* @flow */
/* global chrome */

import _ from 'underscore';
import LazyImage from './js/LazyImage';
import React from 'react';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import ReactDOM from 'react-dom';
import {StickyContainer, Sticky} from 'react-sticky';
import timeago from 'timeago.js';

const TW = chrome.extension.getBackgroundPage().TW;

// Unpack TW.
const {
  settings,
  storageLocal,
  tabmanager,
} = TW;

function secondsToMinutes(seconds) {
  let s = seconds % 60;
  s = s >= 10 ? String(s) : `0${String(s)}`;
  return `${String(Math.floor(seconds / 60))}:${s}`;
}

function truncateString(str, length) {
  return str == null || str.length <= (length + 3) ? str : `${str.substring(0, length)}...`;
}

class OpenTabRow extends React.Component {
  props: {
    isLocked: boolean,
    onLockTab: (tabId: number) => void,
    onUnlockTab: (tabId: number) => void,
    tab: chrome$Tab,
  };

  handleLockedOnChange = (event) => {
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
            disabled={tab.pinned || tabWhitelistMatch}
            onChange={this.handleLockedOnChange}
            type="checkbox"
          />
        </td>
        <td className="text-center">
          <LazyImage
            alt=""
            height={16}
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

class LockTab extends React.PureComponent {
  state: {
    tabs: Array<chrome$Tab>,
  };

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
        <table className="table table-hover table-striped">
          <thead>
            <tr>
              <th className="text-center">
                <abbr title="Check a tab's box to lock the tab (prevent it from auto-closing).">
                  <i className="glyphicon glyphicon-lock"></i>
                </abbr>
              </th>
              <th></th>
              <th style={{width: '100%'}}>Tab</th>
              <th className="text-center">
                <i className="glyphicon glyphicon-time" title="Closing in..."></i>
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
  props: {
    commands: ?Array<chrome$Command>,
  };

  state: {
    errors: Array<Object>,
    newPattern: string,
    saveAlertVisible: boolean,
  };

  _debouncedHandleSettingsChange: (event: SyntheticEvent) => void;
  _saveAlertTimeout: ?number;

  constructor() {
    super();
    this.state = {
      errors: [],
      newPattern: '',
      saveAlertVisible: false,
    };

    const debounced = _.debounce(this.handleSettingsChange, 150);
    this._debouncedHandleSettingsChange = event => {
      // Prevent React's [Event Pool][1] from nulling the event.
      //
      // [1]: https://facebook.github.io/react/docs/events.html#event-pooling
      event.persist();
      debounced(event);
    };
  }

  componentWillUnmount() {
    if (this._saveAlertTimeout != null) {
      window.clearTimeout(this._saveAlertTimeout);
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

  _handleConfigureCommandsClick = event => {
    // `chrome://` URLs are not linkable, but it's possible to create new tabs pointing to Chrome's
    // configuration pages. Calling `tabs.create` will open the tab and close this popup.
    chrome.tabs.create({url: event.target.href});
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
    if (this._saveAlertTimeout != null) {
      window.clearTimeout(this._saveAlertTimeout);
    }

    try {
      settings.set(key, value);
      this.setState({
        errors: [],
        saveAlertVisible: true,
      });
      this._saveAlertTimeout = window.setTimeout(() => {
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
        <div className="alert alert-danger">
          <ul>
            {this.state.errors.map((error, i) =>
              <li key={i}>{error.message}</li>
            )}
          </ul>
        </div>
      );
    }

    return (
      <div className="tab-pane active">
        <h4 className="page-header" style={{marginTop: 0}}>Settings</h4>
        <form className="form-inline">
          <div className="form-group">
            <label htmlFor="minutesInactive">Close inactive tabs after:</label>
            <div className="row">
              <div className="col-xs-2">
                <input
                  className="form-control"
                  defaultValue={settings.get('minutesInactive')}
                  id="minutesInactive"
                  max="7200"
                  min="1"
                  name="minutesInactive"
                  onChange={this._debouncedHandleSettingsChange}
                  title="Must be a number greater than 0 and less than 7200"
                  type="number"
                />
              </div>
              <div className="col-xs-10">
                <p className="form-control-static">minutes</p>
              </div>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="minTabs">Don't auto-close if I only have:</label>
            <div className="row">
              <div className="col-xs-2">
                <input
                  className="form-control"
                  defaultValue={settings.get('minTabs')}
                  id="minTabs"
                  min="0"
                  name="minTabs"
                  onChange={this._debouncedHandleSettingsChange}
                  title="Must be a number greater than or equal to 0"
                  type="number"
                />
              </div>
              <div className="col-xs-10">
                <p className="form-control-static">
                  tabs open (does not include pinned or locked tabs).
                </p>
              </div>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="maxTabs">Remember up to:</label>
            <div className="row">
              <div className="col-xs-2">
                <input
                  className="form-control"
                  defaultValue={settings.get('maxTabs')}
                  id="maxTabs"
                  min="0"
                  name="maxTabs"
                  onChange={this._debouncedHandleSettingsChange}
                  title="Must be a number greater than or equal to 0"
                  type="number"
                />
              </div>
              <div className="col-xs-10">
                <p className="form-control-static">closed tabs.</p>
              </div>
            </div>
          </div>
          <div className="checkbox">
            <label>
              <input
                defaultChecked={settings.get('purgeClosedTabs')}
                id="purgeClosedTabs"
                name="purgeClosedTabs"
                onChange={this.handleSettingsChange}
                type="checkbox"
              />
              Clear closed tabs list on quit
            </label>
          </div>
          <div className="checkbox">
            <label>
              <input
                defaultChecked={settings.get('showBadgeCount')}
                id="showBadgeCount"
                name="showBadgeCount"
                onChange={this.handleSettingsChange}
                type="checkbox"
              />
              Show # of closed tabs in url bar
            </label>
          </div>
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

        <h4 className="page-header">Auto-Lock</h4>
        <div className="row">
          <div className="col-xs-8">
            <form
              onSubmit={this.handleAddPatternSubmit}
              style={{marginBottom: '20px'}}>
              <label htmlFor="wl-add">Auto-lock tabs with URLs containing:</label>
              <div className="input-group">
                <input
                  className="form-control"
                  id="wl-add"
                  onChange={this.handleNewPatternChange}
                  type="text"
                  value={this.state.newPattern}
                />
                <span className="input-group-btn">
                  <button
                    className="btn btn-default"
                    disabled={!isValidPattern(this.state.newPattern)}
                    id="addToWL"
                    type="submit">
                    Add
                  </button>
                </span>
              </div>
              <p className="help-block">
                <strong>Example:</strong> <i>cnn</i> would match every page on <i>cnn.com</i> and
                any URL with <i>cnn</i> anywhere in it.
              </p>
            </form>
          </div>
        </div>

        <table className="table table-hover table-striped">
          <thead>
            <tr>
              <th style={{width: '100%'}}>URL String</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {whitelist.length === 0 ?
              <tr>
                <td className="text-center" colSpan="2">
                  No auto-locking strings yet. Use the form above to add some to the whitelist.
                </td>
              </tr> :
              whitelist.map(pattern =>
                <tr key={pattern}>
                  <td>{pattern}</td>
                  <td>
                    <button
                      className="btn btn-default btn-xs"
                      onClick={this.handleClickRemovePattern.bind(this, pattern)}
                      style={{marginBottom: '-4px', marginTop: '-4px'}}>
                      Remove
                    </button>
                  </td>
                </tr>
              )
            }
          </tbody>
        </table>

        <h4 className="page-header">
          Keyboard Shortcuts
          <small style={{marginLeft: '10px'}}>
            <a
              href="chrome://extensions/configureCommands"
              onClick={this._handleConfigureCommandsClick}
              target="_blank">
              Configure these shortcuts
            </a>
          </small>
        </h4>
        {this.props.commands == null ?
          null :
          this.props.commands.map(command => {
            // This is a default command for any extension with a browser action. It can't be
            // listened for.
            //
            // See https://developer.chrome.com/extensions/commands#usage
            if (command.name === '_execute_browser_action') return null;
            return (
              <p>
                {command.shortcut == null || command.shortcut.length === 0 ?
                  <em>No shortcut set</em> :
                  <kbd>{command.shortcut}</kbd>}: {command.description}
              </p>
            );
          })
        }
      </div>
    );
  }
}

class ClosedTabRow extends React.PureComponent {
  props: {
    isSelected: boolean,
    onOpenTab: (tab: chrome$Tab) => void,
    onToggleTab: (tab: chrome$Tab, selected: boolean, multiselect: boolean) => void,
    tab: chrome$Tab,
  };

  _handleClickAnchor = (event) => {
    const {tab} = this.props;
    event.preventDefault();
    this.props.onOpenTab(tab);
  };

  _handleClickCheckbox = (event) => {
    if (this.props.tab.id == null) return;
    this.props.onToggleTab(this.props.tab, event.target.checked, event.shiftKey);
  };

  _handleClickTd = (event) => {
    if (event.target.nodeName === 'input' || this.props.tab.id == null) return;
    this.props.onToggleTab(this.props.tab, !this.props.isSelected, event.shiftKey);
  };

  render() {
    const {isSelected, tab} = this.props;
    const timeagoInstance = timeago();

    return (
      <tr className={isSelected ? 'bg-warning' : null}>
        <td onClick={this._handleClickTd} style={{width: '1px'}}>
          <input
            checked={isSelected}
            className="checkbox--td"
            onClick={this._handleClickCheckbox}
            type="checkbox"
          />
        </td>
        <td className="faviconCol">
          {tab.favIconUrl == null
            ? <span style={{display: 'inline-block', height: '16px'}}>
                -
              </span>
            : <LazyImage
                alt=""
                className="favicon"
                height={16}
                src={tab.favIconUrl}
                width={16}
              />
          }
        </td>
        <td>
          <a target="_blank" href={tab.url} onClick={this._handleClickAnchor}>
            {truncateString(tab.title, 70)}
          </a>
        </td>
        {/* $FlowFixMe: `closedAt` is an expando property added by Tab Wrangler to chrome$Tab */}
        <td title={new Date(tab.closedAt).toLocaleString()}>
          {/* $FlowFixMe: `closedAt` is an expando property added by Tab Wrangler to chrome$Tab */}
          {timeagoInstance.format(tab.closedAt)}
        </td>
      </tr>
    );
  }
}

class CorralTab extends React.Component {
  state: {
    closedTabs: Array<chrome$Tab>,
    filter: string,
    lastSelectedTab: ?chrome$Tab,
    selectedTabs: Set<chrome$Tab>,
  };

  _searchRefFocusTimeout: ?number;
  _searchRef: ?HTMLElement;

  constructor() {
    super();
    this.state = {
      closedTabs: [],
      filter: '',
      lastSelectedTab: null,
      selectedTabs: new Set(),
    };
  }

  componentDidMount() {
    // Focus the search input so it's simple to type immediately. This must be done after the popup
    // is available, which is roughly 150ms after the popup is opened (determined empirically). Use
    // 250ms to ensure this always works.
    this._searchRefFocusTimeout = setTimeout(() => {
      if (this._searchRef != null) this._searchRef.focus();
    }, 350);

    // TODO: This is assumed to be synchronous. If it becomes async, this state needs to be
    // hoisted so this component does not need to track whether it's mounted.
    tabmanager.searchTabs(this.setClosedTabs);
  }

  componentWillUnmount() {
    clearTimeout(this._searchRefFocusTimeout);
  }

  _handleRemoveSelectedTabs = () => {
    const tabs = this.state.closedTabs.filter(tab => this.state.selectedTabs.has(tab));
    tabs.forEach(tab => { tabmanager.closedTabs.removeTab(tab.id); });
    tabmanager.searchTabs(this.setClosedTabs, [tabmanager.filters.keyword('')]);
    this.setState({
      filter: '',
      selectedTabs: new Set(),
    });
  };

  _handleToggleTab = (tab, isSelected, multiselect) => {
    // If this is a multiselect (done by holding the Shift key and clicking), see if the last
    // selected tab is still visible and, if it is, toggle all tabs between it and this new clicked
    // tab.
    if (multiselect && this.state.lastSelectedTab != null) {
      const lastSelectedTabIndex = this.state.closedTabs.indexOf(this.state.lastSelectedTab);
      if (lastSelectedTabIndex >= 0) {
        const tabIndex = this.state.closedTabs.indexOf(tab);
        for (
          let i = Math.min(lastSelectedTabIndex, tabIndex);
          i <= Math.max(lastSelectedTabIndex, tabIndex);
          i++
        ) {
          if (isSelected) {
            this.state.selectedTabs.add(this.state.closedTabs[i]);
          } else {
            this.state.selectedTabs.delete(this.state.closedTabs[i]);
          }
        }
        this.setState({lastSelectedTab: tab});
        return;
      }
    }

    if (isSelected) {
      this.state.selectedTabs.add(tab);
    } else {
      this.state.selectedTabs.delete(tab);
    }
    this.setState({lastSelectedTab: tab});
  };

  _handleRestoreSelectedTabs = () => {
    const tabs = this.state.closedTabs.filter(tab => this.state.selectedTabs.has(tab));
    tabmanager.closedTabs.unwrangleTabs(tabs);
    tabmanager.searchTabs(this.setClosedTabs, [tabmanager.filters.keyword('')]);
    this.setState({
      filter: '',
      selectedTabs: new Set(),
    });
  };

  openTab = (tab) => {
    tabmanager.closedTabs.unwrangleTabs([tab]);
    tabmanager.searchTabs(this.setClosedTabs, [tabmanager.filters.keyword(this.state.filter)]);
    this.state.selectedTabs.delete(tab);
    this.forceUpdate();
  };

  setClosedTabs = (closedTabs) => {
    this.setState({closedTabs});
  };

  setFilter = (event) => {
    const filter = event.target.value;
    this.setState({filter});
    tabmanager.searchTabs(this.setClosedTabs, [tabmanager.filters.keyword(filter)]);
  };

  _toggleAllTabs = () => {
    let selectedTabs;
    if (this.state.closedTabs.every(tab => this.state.selectedTabs.has(tab))) {
      selectedTabs = this.state.selectedTabs;
      this.state.closedTabs.forEach(tab => this.state.selectedTabs.delete(tab));
    } else {
      selectedTabs = new Set(this.state.closedTabs);
    }

    this.setState({
      lastSelectedTab: null,
      selectedTabs,
    });
  };

  render() {
    let allTabsSelected;
    const tableRows = [];
    if (this.state.closedTabs.length === 0) {
      allTabsSelected = false;
      tableRows.push(
        <tr>
          <td className="text-center" colSpan="3">
            No closed tabs yet. When Tab Wrangler closes tabs, they will appear here. Go leave your
            tabs open!
          </td>
        </tr>
      );
    } else {
      allTabsSelected = true;
      this.state.closedTabs.forEach(tab => {
        const tabId = tab.id;
        if (tabId == null) return;
        allTabsSelected = allTabsSelected && this.state.selectedTabs.has(tab);

        tableRows.push(
          <ClosedTabRow
            isSelected={this.state.selectedTabs.has(tab)}
            key={tabId}
            onOpenTab={this.openTab}
            onToggleTab={this._handleToggleTab}
            tab={tab}
          />
        );
      });
    }

    const totalTabsRemoved = storageLocal.get('totalTabsRemoved');
    const percentClosed = totalTabsRemoved === 0
      ? 0
      : Math.trunc(storageLocal.get('totalTabsWrangled') / storageLocal.get('totalTabsRemoved') * 100);

    return (
      <div className="tab-pane active">
        <div className="row">
          <form className="form-search col-xs-6">
            <div className="form-group" style={{marginBottom: 0}}>
              <input
                className="form-control"
                name="search"
                onChange={this.setFilter}
                placeholder="Search tabs..."
                ref={_searchRef => { this._searchRef = _searchRef; }}
                type="search"
                value={this.state.filter}
              />
            </div>
          </form>
          <div className="col-xs-6" style={{lineHeight: '30px', textAlign: 'right'}}>
            <small style={{color: '#999'}}>tabs wrangled</small>{' '}
            {storageLocal.get('totalTabsWrangled')} or{' '}
            <abbr title="tabs closed by Tab Wrangler / all tabs closed">{percentClosed}%</abbr>
          </div>
        </div>

        <StickyContainer>
          <Sticky>
            {({style}) => (
              <div style={Object.assign({}, style, {
                background: 'white',
                borderBottom: '1px solid #ddd',
                paddingBottom: '10px',
                paddingTop: '10px',
                zIndex: 100})}>
                <button
                  className="btn btn-default btn-sm btn-chunky"
                  onClick={this._toggleAllTabs}
                  title={allTabsSelected ? 'Deselect all tabs' : 'Select all tabs'}>
                  <input
                    checked={allTabsSelected}
                    style={{ margin: 0 }}
                    type="checkbox"
                  />
                </button>

                {this.state.closedTabs.some(tab => this.state.selectedTabs.has(tab)) ?
                  <div className="btn-group" style={{ marginLeft: '10px' }}>
                    <button
                      className="btn btn-default btn-sm btn-chunky"
                      onClick={this._handleRemoveSelectedTabs}
                      title="Remove selected tabs">
                      <span className="sr-only">Remove selected tabs</span>
                      <span className="glyphicon glyphicon-trash" aria-hidden="true"></span>
                    </button>
                    <button
                      className="btn btn-default btn-sm btn-chunky"
                      disabled={this.state.closedTabs.length > 15}
                      onClick={this._handleRestoreSelectedTabs}
                      title="Restore selected tabs">
                      <span className="sr-only">Restore selected tabs</span>
                      <span className="glyphicon glyphicon-new-window" aria-hidden="true"></span>
                    </button>
                  </div> :
                  null
                }
              </div>
            )}
          </Sticky>

          <table id="corralTable" className="table table-hover">
            <tbody>
              {tableRows}
            </tbody>
          </table>
        </StickyContainer>
      </div>
    );
  }
}

class PauseButton extends React.PureComponent {
  state: {
    paused: boolean,
  };

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
      ? <span><i className="glyphicon glyphicon-play"></i> Resume</span>
      : <span><i className="glyphicon glyphicon-pause"></i> Pause</span>;

    return (
      <button className="btn btn-default btn-xs" onClick={action}>
        {content}
      </button>
    );
  }
}

class NavBar extends React.PureComponent {
  props: {
    activeTabId: string,
    onClickTab: (tabId: string) => void,
  };

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
            className="btn btn-default btn-xs"
            href="https://chrome.google.com/webstore/detail/egnjhciaieeiiohknchakcodbpgjnchh/reviews"
            target="_blank">
            <i className="glyphicon glyphicon-star"></i> Review Tab Wrangler
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
      <p>TabWrangler v{chrome.runtime.getManifest().version}</p>
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
  props: {
    commands: ?Array<chrome$Command>,
  };

  state: {
    activeTabId: string,
  };

  constructor(props) {
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
  ReactDOM.render(
    <PopupContent {...props} />,
    document.getElementById('popup')
  );
}

render({commands: null});

chrome.commands.getAll(commands => {
  render({commands});
});
