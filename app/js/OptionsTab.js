/* @flow */

import {exportData, importData} from './importExport';
import Button from './Button';
import React from 'react';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import TabWrangleOption from './TabWrangleOption';
import _ from 'lodash';

const TW = chrome.extension.getBackgroundPage().TW;

// Unpack TW.
const {
  settings,
  storageLocal,
  tabmanager,
} = TW;

// Curry import/export function with storageLocal
const _importData = _.partial(importData, storageLocal, tabmanager);
const _exportData = _.partial(exportData, storageLocal);

function isValidPattern(pattern) {
  // some other choices such as '/' also do not make sense
  // not sure if they should be blocked as well
  return pattern != null && pattern.length > 0 && /\S/.test(pattern);
}

interface OptionsTabProps {
  commands: ?Array<chrome$Command>;
}

interface OptionsTabState {
  errors: Array<Object>;
  newPattern: string;
  saveAlertVisible: boolean;
  importExportErrors: Array<Object>;
  importExportAlertVisible: boolean;
  importExportOperationName: string;
}

export default class OptionsTab extends React.Component<OptionsTabProps, OptionsTabState> {
  _debouncedHandleSettingsChange: (event: SyntheticEvent<HTMLElement>) => void;
  _fileselector: ?HTMLInputElement;
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

  handleClickRemovePattern(pattern: string) {
    const whitelist = settings.get('whitelist');
    whitelist.splice(whitelist.indexOf(pattern), 1);
    this.saveOption('whitelist', whitelist);
    this.forceUpdate();
  }

  handleAddPatternSubmit = (event: SyntheticEvent<HTMLElement>) => {
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

  _handleConfigureCommandsClick = (event: SyntheticMouseEvent<HTMLAnchorElement>) => {
    // `chrome://` URLs are not linkable, but it's possible to create new tabs pointing to Chrome's
    // configuration pages. Calling `tabs.create` will open the tab and close this popup.
    chrome.tabs.create({url: event.currentTarget.href});
  };

  handleNewPatternChange = (event: SyntheticInputEvent<HTMLInputElement>) => {
    this.setState({newPattern: event.target.value});
  };

  handleSettingsChange = (event: SyntheticInputEvent<HTMLInputElement>) => {
    if (event.target.type === 'checkbox') {
      this.saveOption(event.target.id, !!event.target.checked);
    } else if (event.target.type === 'radio') {
      this.saveOption(event.target.name, event.target.value);
    } else {
      this.saveOption(event.target.id, event.target.value);
    }
  };

  saveOption(key: string, value: any) {
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

  toPromise = (func: (...args: Array<any>) => Promise<void>) => {
    return function (...args: Array<any>): Promise<void> {
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
  };

  importExportDataWithFeedback = (
    operationName: string,
    func: () => Promise<void>,
    funcArg: ?SyntheticEvent<*>
  ) => {
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
  };

  exportData = () => this.importExportDataWithFeedback('Exporting...', _exportData);
  importData = (event: SyntheticInputEvent<HTMLInputElement>) => {
    return this.importExportDataWithFeedback('Importing...', _importData, event);
  };

  render() {
    const whitelist = settings.get('whitelist');

    let errorAlert;
    let saveAlert;
    if (this.state.errors.length === 0) {
      if (this.state.saveAlertVisible) {
        saveAlert = [
          <div className="alert-sticky" key="alert">
            <div className="alert alert-success pull-right" style={{ display: 'inline-block' }}>
              Saving...
            </div>
          </div>,
        ];
      }
    } else {
      errorAlert = (
        <div className="alert alert-danger alert-sticky">
          <ul className="pull-right" style={{ display: 'inline-block' }}>
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
            <label htmlFor="minTabs">{"Don't"} auto-close if I only have:</label>
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
              Show # of closed tabs in URL bar
            </label>
          </div>
          <div className="checkbox">
            <label>
              <input
                defaultChecked={settings.get('debounceOnActivated')}
                id="debounceOnActivated"
                name="debounceOnActivated"
                onChange={this.handleSettingsChange}
                type="checkbox"
              />
              Reset a tab&apos;s timer only after it is active for 1 second
            </label>
          </div>
          <div className="form-group">
            <TabWrangleOption
              onChange={this.handleSettingsChange}
              selectedOption={settings.get('wrangleOption')}
            />
          </div>
        </form>

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
              onClick={() => { if(this._fileselector != null) this._fileselector.click(); }}>
              Import
            </Button>
            <input
              style={{ display: 'none' }}
              type="file"
              accept=".json"
              onChange={this.importData}
              ref={input => { this._fileselector = input; }}/>
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
              rel="noopener noreferrer"
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
      </div>
    );
  }
}
