/* @flow */

import * as React from "react";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import type { Dispatch, ThemeSettingValue } from "./Types";
import FileSaver from "file-saver";
import TabWrangleOption from "./TabWrangleOption";
import { connect } from "react-redux";
import cx from "classnames";
import debounce from "lodash.debounce";
import { exportFileName } from "./actions/importExportActions";
import { setCommands } from "./actions/tempStorageActions";
import { setTheme } from "./actions/settingsActions";

// Unpack TW.
const { settings, store, tabmanager } = chrome.extension.getBackgroundPage().TW;

function isValidPattern(pattern) {
  // some other choices such as '/' also do not make sense; not sure if they should be blocked as
  // well
  return pattern != null && pattern.length > 0 && /\S/.test(pattern);
}

type OptionsTabProps = {
  commands: ?Array<chrome$Command>,
  dispatch: Dispatch,
  theme: ThemeSettingValue,
};

type OptionsTabState = {
  errors: Array<Object>,
  importExportErrors: Array<{ message: string }>,
  importExportAlertVisible: boolean,
  importExportOperationName: string,
  newPattern: string,
  saveAlertVisible: boolean,
  showFilterTabGroupsOption: boolean,
};

class OptionsTab extends React.Component<OptionsTabProps, OptionsTabState> {
  _debouncedHandleSettingsChange: (event: SyntheticInputEvent<HTMLInputElement>) => void;
  _fileselector: ?HTMLInputElement;
  _importExportAlertTimeout: ?number;
  _saveAlertTimeout: ?number;

  constructor() {
    super();
    this.state = {
      errors: [],
      importExportErrors: [],
      importExportAlertVisible: false,
      importExportOperationName: "",
      newPattern: "",
      saveAlertVisible: false,
      showFilterTabGroupsOption: false,
    };
  }

  componentDidMount() {
    // Fetch commands only when opening the `OptionsTab` since this is the only place they're
    // needed.
    chrome.commands.getAll((commands) => {
      store.dispatch(this.props.dispatch(setCommands(commands)));
    });

    const debounced = debounce(this.handleSettingsChange, 150);
    this._debouncedHandleSettingsChange = (event) => {
      // Prevent React's [Event Pool][1] from nulling the event.
      //
      // [1]: https://facebook.github.io/react/docs/events.html#event-pooling
      event.persist();
      debounced(event);
    };

    // this is for determining if we should show the filter tab groups setting
    chrome.tabs.query({}, (tabs) => {
      // this shouldn't happen but we'll just bail if there are zero tabs
      if (tabs.length < 1) {
        return;
      }

      if ("groupId" in tabs[0]) {
        this.setState({
          showFilterTabGroupsOption: true,
        });
      }
    });
  }

  componentWillUnmount() {
    if (this._saveAlertTimeout != null) {
      window.clearTimeout(this._saveAlertTimeout);
    }
  }

  handleClickRemovePattern(pattern: string) {
    const whitelist = settings.get("whitelist");
    whitelist.splice(whitelist.indexOf(pattern), 1);
    this.saveOption("whitelist", whitelist);
    this.forceUpdate();
  }

  handleAddPatternSubmit = (event: SyntheticEvent<HTMLElement>) => {
    event.preventDefault();
    const { newPattern } = this.state;

    if (!isValidPattern(newPattern)) {
      return;
    }

    const whitelist = settings.get("whitelist");

    // Only add the pattern again if it's new, not yet in the whitelist.
    if (whitelist.indexOf(newPattern) === -1) {
      whitelist.push(newPattern);
      this.saveOption("whitelist", whitelist);
    }

    this.setState({ newPattern: "" });
  };

  _handleConfigureCommandsClick = (event: SyntheticMouseEvent<HTMLAnchorElement>) => {
    // `chrome://` URLs are not linkable, but it's possible to create new tabs pointing to Chrome's
    // configuration pages. Calling `tabs.create` will open the tab and close this popup.
    chrome.tabs.create({ url: event.currentTarget.href });

    // Because `chrome://` URLs are not linkable, attempting to follow a link to them results in an
    // error like, "Not allowed to load local resource: chrome://extensions/configureCommands".
    // Prevent the default action to prevent an error.
    event.preventDefault();
  };

  handleNewPatternChange = (event: SyntheticInputEvent<HTMLInputElement>) => {
    this.setState({ newPattern: event.target.value });
  };

  handleSettingsChange = (event: SyntheticInputEvent<HTMLInputElement>) => {
    if (event.target.type === "checkbox") {
      this.saveOption(event.target.id, !!event.target.checked);
    } else if (event.target.type === "radio") {
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
        this.setState({ saveAlertVisible: false });
      }, 400);
    } catch (err) {
      this.state.errors.push(err);
      this.forceUpdate();
    }
  }

  setTheme(nextTheme) {
    this.props.dispatch(setTheme(nextTheme));
  }

  importExportDataWithFeedback(operationName, func, funcArg, onSuccess) {
    if (this._importExportAlertTimeout != null) {
      window.clearTimeout(this._importExportAlertTimeout);
    }

    this.setState({
      importExportErrors: [],
      importExportAlertVisible: true,
      importExportOperationName: operationName,
    });

    this.props
      .dispatch(func(funcArg))
      .then((blob) => {
        if (onSuccess != null) onSuccess(blob);
        this._importExportAlertTimeout = window.setTimeout(() => {
          this.setState({ importExportAlertVisible: false });
        }, 400);
      })
      .catch((err) => {
        this.state.importExportErrors.push(err);
        this.forceUpdate();
      });
  }

  exportData = (event: SyntheticMouseEvent<HTMLButtonElement>) => {
    this.importExportDataWithFeedback(
      chrome.i18n.getMessage("options_importExport_exporting") || "",
      tabmanager.exportData,
      event,
      (blob) => {
        FileSaver.saveAs(blob, exportFileName(new Date(Date.now())));
      }
    );
  };

  importData = (event: SyntheticInputEvent<HTMLInputElement>) => {
    this.importExportDataWithFeedback(
      chrome.i18n.getMessage("options_importExport_importing") || "",
      tabmanager.importData,
      event
    );
  };

  render() {
    const whitelist = settings.get("whitelist");

    let errorAlert;
    let saveAlert;
    if (this.state.errors.length === 0) {
      if (this.state.saveAlertVisible) {
        saveAlert = [
          <CSSTransition classNames="alert" key="alert" timeout={400}>
            <div className="alert-sticky" key="alert">
              <div className="alert alert-success float-right">
                {chrome.i18n.getMessage("options_saving")}
              </div>
            </div>
          </CSSTransition>,
        ];
      }
    } else {
      errorAlert = (
        <div className="alert-sticky">
          <div className="alert alert-danger float-right">
            <ul className="mb-0">
              {this.state.errors.map((error, i) => (
                <li key={i}>{error.message}</li>
              ))}
            </ul>
          </div>
        </div>
      );
    }

    let importExportAlert;
    if (this.state.importExportErrors.length === 0) {
      if (this.state.importExportAlertVisible) {
        importExportAlert = [
          <CSSTransition classNames="alert" key="importExportAlert" timeout={400}>
            <div className="alert alert-success">{this.state.importExportOperationName}</div>
          </CSSTransition>,
        ];
      }
    } else {
      importExportAlert = (
        <div className="alert alert-danger">
          <ul>
            {this.state.importExportErrors.map((error, i) => (
              <li key={i}>{error.message}</li>
            ))}
          </ul>
        </div>
      );
    }

    return (
      <div className="tab-pane active">
        <h4>{chrome.i18n.getMessage("options_section_settings")}</h4>
        <form>
          <div className="mb-2">
            <div>
              <label htmlFor="theme">
                <strong>{chrome.i18n.getMessage("options_option_theme_label")}</strong>
              </label>
            </div>
            <div className="mb-2">
              <div className="btn-group">
                <button
                  className={cx("btn btn-outline-dark", { active: this.props.theme === "system" })}
                  onClick={() => {
                    this.setTheme("system");
                  }}
                  type="button"
                >
                  {chrome.i18n.getMessage("options_option_theme_system")}
                </button>
                <button
                  className={cx("btn btn-outline-dark", { active: this.props.theme === "light" })}
                  onClick={() => {
                    this.setTheme("light");
                  }}
                  type="button"
                >
                  <i
                    className="fas fa-sun mr-1"
                    style={{ fontSize: "11px", position: "relative", top: "-1px" }}
                  />
                  {chrome.i18n.getMessage("options_option_theme_light")}
                </button>
                <button
                  className={cx("btn btn-outline-dark", { active: this.props.theme === "dark" })}
                  onClick={() => {
                    this.setTheme("dark");
                  }}
                  type="button"
                >
                  <i
                    className="fas fa-moon mr-1"
                    style={{ fontSize: "11px", position: "relative", top: "-1px" }}
                  />
                  {chrome.i18n.getMessage("options_option_theme_dark")}
                </button>
              </div>
            </div>
            <div>
              <label className="mr-1" htmlFor="minutesInactive">
                <strong>{chrome.i18n.getMessage("options_option_timeInactive_label")}</strong>
              </label>
            </div>
            <div className="form-inline">
              <input
                className="form-control form-control--time"
                defaultValue={settings.get("minutesInactive")}
                id="minutesInactive"
                max="7200"
                min="0"
                name="minutesInactive"
                onChange={this._debouncedHandleSettingsChange}
                title={chrome.i18n.getMessage("options_option_timeInactive_minutes")}
                type="number"
              />
              <span className="mx-1"> : </span>
              <input
                className="form-control form-control--time"
                defaultValue={settings.get("secondsInactive")}
                id="secondsInactive"
                max="59"
                min="0"
                name="secondsInactive"
                onChange={this._debouncedHandleSettingsChange}
                title={chrome.i18n.getMessage("options_option_timeInactive_seconds")}
                type="number"
              />
              <span className="form-control-static ml-1">
                {chrome.i18n.getMessage("options_option_timeInactive_postLabel")}
              </span>
            </div>
          </div>
          <div className="mb-2">
            <div>
              <label htmlFor="minTabs">
                <strong>{chrome.i18n.getMessage("options_option_minTabs_label")}</strong>
              </label>
            </div>
            <div className="form-inline">
              <input
                className="form-control form-control--time mr-1"
                defaultValue={settings.get("minTabs")}
                id="minTabs"
                min="0"
                name="minTabs"
                onChange={this._debouncedHandleSettingsChange}
                title={chrome.i18n.getMessage("options_option_minTabs_tabs")}
                type="number"
              />
              <span className="form-control-static">
                {chrome.i18n.getMessage("options_option_minTabs_postLabel")}
              </span>
            </div>
          </div>
          <div className="mb-2">
            <div>
              <label htmlFor="maxTabs">
                <strong>{chrome.i18n.getMessage("options_option_rememberTabs_label")}</strong>
              </label>
            </div>
            <div className="form-inline">
              <input
                className="form-control form-control--time mr-1"
                defaultValue={settings.get("maxTabs")}
                id="maxTabs"
                min="0"
                name="maxTabs"
                onChange={this._debouncedHandleSettingsChange}
                title={chrome.i18n.getMessage("options_option_rememberTabs_tabs")}
                type="number"
              />
              <span className="form-control-static">
                {chrome.i18n.getMessage("options_option_rememberTabs_postLabel")}
              </span>
            </div>
          </div>
          <div className="form-check mb-1">
            <input
              className="form-check-input"
              defaultChecked={settings.get("purgeClosedTabs")}
              id="purgeClosedTabs"
              name="purgeClosedTabs"
              onChange={this.handleSettingsChange}
              type="checkbox"
            />
            <label className="form-check-label" htmlFor="purgeClosedTabs">
              {chrome.i18n.getMessage("options_option_clearOnQuit_label")}
            </label>
          </div>
          <div className="form-check mb-1">
            <input
              className="form-check-input"
              defaultChecked={settings.get("showBadgeCount")}
              id="showBadgeCount"
              name="showBadgeCount"
              onChange={this.handleSettingsChange}
              type="checkbox"
            />
            <label className="form-check-label" htmlFor="showBadgeCount">
              {chrome.i18n.getMessage("options_option_showBadgeCount_label")}
            </label>
          </div>
          <div className="form-check mb-1">
            <input
              className="form-check-input"
              defaultChecked={settings.get("debounceOnActivated")}
              id="debounceOnActivated"
              name="debounceOnActivated"
              onChange={this.handleSettingsChange}
              type="checkbox"
            />
            <label className="form-check-label" htmlFor="debounceOnActivated">
              {chrome.i18n.getMessage("options_option_debounceOnActivated_label")}
            </label>
          </div>
          <div className="form-check mb-2">
            <input
              className="form-check-input"
              defaultChecked={settings.get("filterAudio")}
              id="filterAudio"
              name="filterAudio"
              onChange={this.handleSettingsChange}
              type="checkbox"
            />
            <label className="form-check-label" htmlFor="filterAudio">
              {chrome.i18n.getMessage("options_option_filterAudio_label")}
            </label>
          </div>
          {this.state.showFilterTabGroupsOption && (
            <div className="form-check mb-2">
              <input
                className="form-check-input"
                defaultChecked={settings.get("filterGroupedTabs")}
                id="filterGroupedTabs"
                name="filterGroupedTabs"
                onChange={this.handleSettingsChange}
                type="checkbox"
              />
              <label className="form-check-label" htmlFor="filterGroupedTabs">
                {chrome.i18n.getMessage("options_option_filterGroupedTabs_label")}
              </label>
            </div>
          )}
          <TabWrangleOption
            onChange={this.handleSettingsChange}
            selectedOption={settings.get("wrangleOption")}
          />
        </form>

        <h4 className="mt-3">{chrome.i18n.getMessage("options_section_autoLock")}</h4>
        <div className="row">
          <div className="col-8">
            <form onSubmit={this.handleAddPatternSubmit} style={{ marginBottom: "20px" }}>
              <div className="form-check mb-1">
                <input
                  className="form-check-input"
                  defaultChecked={settings.get("invertWhitelist")}
                  id="invertWhitelist"
                  name="invertWhitelist"
                  onChange={this.handleSettingsChange}
                  type="checkbox"
                />
                <label className="form-check-label" htmlFor="invertWhitelist">
                  {chrome.i18n.getMessage("options_option_invertWhitelist_label")}
                </label>
              </div>
              <label htmlFor="wl-add">
                {chrome.i18n.getMessage("options_option_autoLock_label")}
              </label>
              <div className="input-group">
                <input
                  className="form-control"
                  id="wl-add"
                  onChange={this.handleNewPatternChange}
                  type="text"
                  value={this.state.newPattern}
                />
                <span className="input-group-append">
                  <button
                    className="btn btn-outline-dark"
                    disabled={!isValidPattern(this.state.newPattern)}
                    id="addToWL"
                    type="submit"
                  >
                    {chrome.i18n.getMessage("options_option_autoLock_add")}
                  </button>
                </span>
              </div>
              <p className="form-text text-muted">
                {chrome.i18n.getMessage("options_option_autoLock_example")}
              </p>
            </form>
          </div>
        </div>
        <table className="table table-hover table-sm">
          <thead>
            <tr>
              <th style={{ width: "100%" }}>
                {chrome.i18n.getMessage("options_option_autoLock_urlHeader")}
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {whitelist.length === 0 ? (
              <tr>
                <td className="text-center" colSpan="2">
                  {chrome.i18n.getMessage("options_option_autoLock_empty")}
                </td>
              </tr>
            ) : (
              whitelist.map((pattern) => (
                <tr key={pattern}>
                  <td>
                    <code>{pattern}</code>
                  </td>
                  <td>
                    <button
                      className="btn btn-link btn-sm"
                      onClick={this.handleClickRemovePattern.bind(this, pattern)}
                      style={{ marginBottom: "-4px", marginTop: "-4px" }}
                    >
                      {chrome.i18n.getMessage("options_option_autoLock_remove")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <h4 className="mt-3">{chrome.i18n.getMessage("options_section_importExport")}</h4>
        <div className="row">
          <div className="col-8 mb-1">
            <button className="btn btn-outline-dark btn-sm" onClick={this.exportData}>
              <i className="fas fa-file-export mr-1" />
              {chrome.i18n.getMessage("options_importExport_export")}
            </button>{" "}
            <button
              className="btn btn-outline-dark btn-sm"
              onClick={() => {
                if (this._fileselector != null) this._fileselector.click();
              }}
            >
              <i className="fas fa-file-import mr-1" />
              {chrome.i18n.getMessage("options_importExport_import")}
            </button>
            <input
              accept=".json"
              onChange={this.importData}
              ref={(input) => {
                this._fileselector = input;
              }}
              style={{ display: "none" }}
              type="file"
            />
          </div>
          <div className="col-8">
            <p className="form-text text-muted">
              {chrome.i18n.getMessage("options_importExport_description")}
            </p>
            <p className="alert alert-warning">
              {chrome.i18n.getMessage("options_importExport_importWarning")}
            </p>
          </div>
        </div>
        {this.state.importExportErrors.length === 0 ? (
          <TransitionGroup appear={false}>{importExportAlert}</TransitionGroup>
        ) : (
          importExportAlert
        )}

        <h4 className="mt-3 mb-0">{chrome.i18n.getMessage("options_section_keyboardShortcuts")}</h4>
        <p>
          <a
            href="chrome://extensions/configureCommands"
            onClick={this._handleConfigureCommandsClick}
            rel="noopener noreferrer"
            target="_blank"
          >
            {chrome.i18n.getMessage("options_keyboardShortcuts_configure")}
          </a>
        </p>
        <ul>
          {this.props.commands == null
            ? null
            : this.props.commands.map((command) => {
                // This is a default command for any extension with a browser action. It can't be
                // listened for.
                //
                // See https://developer.chrome.com/extensions/commands#usage
                if (command.name === "_execute_browser_action") return null;
                return (
                  <li key={command.shortcut}>
                    {command.shortcut == null || command.shortcut.length === 0 ? (
                      <em>{chrome.i18n.getMessage("options_keyboardShortcuts_notSet")}</em>
                    ) : (
                      <kbd>{command.shortcut}</kbd>
                    )}
                    : {command.description}
                  </li>
                );
              })}
        </ul>

        {this.state.errors.length === 0 ? (
          <TransitionGroup appear={false}>{saveAlert}</TransitionGroup>
        ) : (
          errorAlert
        )}
      </div>
    );
  }
}

export default (connect((state) => ({
  commands: state.tempStorage.commands,
  theme: state.settings.theme,
}))(OptionsTab): React.AbstractComponent<{}>);
