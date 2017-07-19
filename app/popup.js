/* @flow */

import _ from 'underscore';
import CorralTab from './js/CorralTab';
import LazyImage from './js/LazyImage';
import React from 'react';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import ReactDOM from 'react-dom';
import Button from './js/Button';
import {importData, exportData} from './js/importExport';
import truncateString from './js/truncateString';

const TW = chrome.extension.getBackgroundPage().TW;

// Unpack TW.
const {
  settings,
  storageLocal,
  tabmanager,
} = TW;

// curry import/export function with storageLocal
const _importData = _.partial(importData, storageLocal, tabmanager);
const _exportData = _.partial(exportData, storageLocal);

function secondsToMinutes(seconds) {
  let s = seconds % 60;
  s = s >= 10 ? String(s) : `0${String(s)}`;
  return `${String(Math.floor(seconds / 60))}:${s}`;
}

class OpenTabRow extends React.Component {
  props: {
    isLocked: boolean,
    onLockTab: (tabId: number) => void,
    onUnlockTab: (tabId: number) => void,
    tab: chrome$Tab,
  };

  handleLockedOnChange = (event: SyntheticInputEvent) => {
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
    importExportErrors: Array<Object>,
    importExportAlertVisible: boolean,
    importExportOperationName: string,
  };

  _debouncedHandleSettingsChange: (event: SyntheticEvent) => void;
  _fileselector: HTMLInputElement;
  _importExportAlertTimeout: ?number;
  _saveAlertTimeout: ?number;

  constructor() {
    super();
    this.state = {
      errors: [],
      newPattern: '',
      saveAlertVisible: false,
      importExportErrors: [],
      importExportAlertVisible: false,
      importExportOperationName: '',
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

  handleAddPatternSubmit = (event: SyntheticEvent) => {
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

  toPromise = (func) => {
    return function (...args) {
      return new Promise((resolve, reject) => {
        const res = func.apply(null, args);

        try {
          return res.then(resolve, reject);
        } catch (err) {
          if (err instanceof TypeError) {
            resolve(res);
          } else {
            reject(err);
          }
        }

        return Promise.resolve();
      });
    };
  }

  importExportDataWithFeedback = (operationName, func, funcArg) => {
    if (this._importExportAlertTimeout != null) {
      window.clearTimeout(this._importExportAlertTimeout);
    }

    this.setState({
      importExportErrors: [],
      importExportAlertVisible: true,
      importExportOperationName: operationName,
    });

    const result = this.toPromise(func)(funcArg);

    result.then(() => {
      this._importExportAlertTimeout = window.setTimeout(() => {
        this.setState({importExportAlertVisible: false});
      }, 400);
    }).catch((err) => {
      this.state.importExportErrors.push(err);
      this.forceUpdate();
    });
  }

  exportData = () => this.importExportDataWithFeedback('Exporting...', _exportData);
  importData = (event) => this.importExportDataWithFeedback('Importing...', _importData, event);

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

    let importExportAlert;

    if (this.state.importExportErrors.length === 0) {
      if (this.state.importExportAlertVisible) {
        importExportAlert = [
          <div className="alert alert-success" key="importExportAlert">
            {this.state.importExportOperationName}
          </div>,
        ];
      }
    } else {
      importExportAlert = (
        <div className="alert alert-danger">
          <ul>
            {this.state.importExportErrors.map((error, i) =>
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
            <div>
              <input
                className="form-control form-control--time"
                defaultValue={settings.get('minutesInactive')}
                id="minutesInactive"
                max="7200"
                min="0"
                name="minutesInactive"
                onChange={this._debouncedHandleSettingsChange}
                title="Must be a number greater than 0 and less than 7200"
                type="number"
              />
              <span> : </span>
              <input
                className="form-control form-control--time m-r"
                defaultValue={settings.get('secondsInactive')}
                id="secondsInactive"
                max="59"
                min="0"
                name="secondsInactive"
                onChange={this._debouncedHandleSettingsChange}
                title="Must be a number greater than 0 and less than 60"
                type="number"
              />
              <span className="form-control-static">minutes : seconds</span>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="minTabs">Don't auto-close if I only have:</label>
            <div>
              <input
                className="form-control form-control--time m-r"
                defaultValue={settings.get('minTabs')}
                id="minTabs"
                min="0"
                name="minTabs"
                onChange={this._debouncedHandleSettingsChange}
                title="Must be a number greater than or equal to 0"
                type="number"
              />
              <span className="form-control-static">
                tabs open (does not include pinned or locked tabs).
              </span>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="maxTabs">Remember up to:</label>
            <div>
              <input
                className="form-control form-control--time m-r"
                defaultValue={settings.get('maxTabs')}
                id="maxTabs"
                min="0"
                name="maxTabs"
                onChange={this._debouncedHandleSettingsChange}
                title="Must be a number greater than or equal to 0"
                type="number"
              />
              <span className="form-control-static">closed tabs.</span>
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

        <h4 className="page-header">Import / Export</h4>
        <div className="row">
          <div className="col-xs-8">
            <Button
              className="btn btn-default btn-xs"
              glyph="export"
              onClick={this.exportData}>
              Export
            </Button>
            {' '}
            <Button
              className="btn btn-default btn-xs"
              glyph="import"
              onClick={() => {this._fileselector.click();}}>
              Import
            </Button>
            <input
              style={{ display: 'none' }}
              type="file"
              accept=".json"
              onChange={this.importData}
              ref={(input: HTMLInputElement) => {this._fileselector = input;}}/>
          </div>
          <div className="col-xs-8">
            <p className="help-block">
              Export all information about wrangled tabs. This is a convenient way to restore
               an old state after reinstalling the extension.
            </p>
            <p className="help-block">
              <strong>Warning:</strong> Importing data will overwrite all existing data.
               There is no way back (unless you have a backup).
            </p>
          </div>
        </div>
        {(this.state.importExportErrors.length === 0)
        ? (
          <ReactCSSTransitionGroup
            transitionEnter={false}
            transitionLeaveTimeout={400}
            transitionName="alert">
            {importExportAlert}
          </ReactCSSTransitionGroup>
        )
        : importExportAlert}

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
              <p key={command.shortcut}>
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

  handleClickAboutTab = (event: SyntheticMouseEvent) => {
    event.preventDefault();
    this.props.onClickTab('about');
  };

  handleClickCorralTab = (event: SyntheticMouseEvent) => {
    event.preventDefault();
    this.props.onClickTab('corral');
  };

  handleClickLockTab = (event: SyntheticMouseEvent) => {
    event.preventDefault();
    this.props.onClickTab('lock');
  };

  handleClickOptionsTab = (event: SyntheticMouseEvent) => {
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

type PopupContentProps = {
  commands: ?Array<chrome$Command>,
};

class PopupContent extends React.PureComponent {
  props: PopupContentProps;

  state: {
    activeTabId: string,
  };

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
  ReactDOM.render(
    <PopupContent {...props} />,
    document.getElementById('popup')
  );
}

render({commands: null});

chrome.commands.getAll(commands => {
  render({commands});
});
