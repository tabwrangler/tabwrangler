import * as React from "react";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import { exportSettings, importSettings, initialiseApp } from "./actions/importExportActions";
import { useStorageSyncPersistQuery, useStorageSyncQuery } from "./storage";
import FileSaver from "file-saver";
import TabWrangleOption from "./TabWrangleOption";
import cx from "classnames";
import { exportFileName } from "./actions/importExportActions";
import { mutateStorageSyncPersist } from "./storage";
import settings from "./settings";
import { useDebounceCallback } from "@react-hook/debounce";
import { useMutation } from "@tanstack/react-query";

function isValidPattern(pattern: string) {
  // some other choices such as '/' also do not make sense; not sure if they should be blocked as
  // well
  return pattern != null && pattern.length > 0 && /\S/.test(pattern);
}

export default function OptionsTab() {
  const { data: syncPersistData } = useStorageSyncPersistQuery();
  const { data: syncData } = useStorageSyncQuery();

  const fileSelectorRef = React.useRef<HTMLInputElement | null>(null);
  const importExportAlertTimeoutRef = React.useRef<number>();
  const theme: string = syncPersistData?.theme ?? "system";
  const whitelist: string[] = settings.get("whitelist") ?? [];
  const targetTitles: string[] = settings.get("targetTitles") ?? [];
  const [errors, setErrors] = React.useState<Error[]>([]);
  const [importExportAlertVisible, setImportExportAlertVisible] = React.useState(false);
  const [importExportErrors, setImportExportErrors] = React.useState<Error[]>([]);
  const [importExportOperationName, setImportExportOperationName] = React.useState("");
  const [newPattern, setNewPattern] = React.useState("");
  const [titlePattern, setTitlePattern] = React.useState("");
  const saveAlertTimeoutRef = React.useRef<number>();
  const [saveAlertVisible, setSaveAlertVisible] = React.useState(false);
  const [showFilterTabGroupsOption, setShowFilterTabGroupsOption] = React.useState(false);

  const persistSettingMutation = useMutation({
    mutationFn: mutateStorageSyncPersist,
  });

  const settingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      chrome.storage.sync.set({ [key]: value }),
  });

  function handleClickRemovePattern(pattern: string) {
    settings.removeTargetUrl(pattern);
  }

  function handleClickRemoveTitle(pattern: string) {
    settings.removeTargetTitle(pattern);
  }

  React.useEffect(() => {
    // determine if we should show the filter tab groups setting
    async function checkForTabGroups() {
      const tabs = await chrome.tabs.query({});

      // this shouldn't happen but we'll bail if there are zero tabs
      if (tabs.length < 1) {
        return;
      }

      if ("groupId" in tabs[0]) {
        setShowFilterTabGroupsOption(true);
      }
    }
    checkForTabGroups();
  }, []);

  let errorAlert;
  let saveAlert;
  if (errors.length === 0) {
    if (saveAlertVisible) {
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
            {errors.map((error, i) => (
              <li key={i}>{error.message}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  let importExportAlert;
  if (importExportErrors.length === 0) {
    if (importExportAlertVisible) {
      importExportAlert = [
        <CSSTransition classNames="alert" key="importExportAlert" timeout={40}>
          <div className="alert-sticky">
            <div className="alert alert-success float-right">{importExportOperationName}</div>
          </div>
        </CSSTransition>,
      ];
    }
  } else {
    importExportAlert = (
      <div className="alert-sticky">
        <div className="alert alert-danger">
          <ul>
            {importExportErrors.map((error, i) => (
              <li key={i}>{error.message}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  async function saveSetting(key: string, value: unknown) {
    if (saveAlertTimeoutRef.current != null) {
      window.clearTimeout(saveAlertTimeoutRef.current);
    }

    try {
      await settings.set(key, value);
    } catch (err) {
      if (err instanceof Error) setErrors([...errors, err]);
      return;
    }

    setErrors([]);
    setSaveAlertVisible(true);
    saveAlertTimeoutRef.current = window.setTimeout(() => {
      setSaveAlertVisible(false);
    }, 40);
  }

  const debouncedHandleSettingsChange = useDebounceCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.type === "checkbox") {
        saveSetting(event.target.id, !!event.target.checked);
      } else if (event.target.type === "radio") {
        saveSetting(event.target.name, event.target.value);
      } else {
        saveSetting(event.target.id, event.target.value);
      }
    },
    150,
  );

  function addUrlPattern(event: React.FormEvent<HTMLElement>) {
    event.preventDefault();

    if (!isValidPattern(newPattern)) {
      return;
    }

    settings.addTargetUrl(newPattern);

    setNewPattern("");
  }

  function addTitlePattern(event: React.FormEvent<HTMLElement>) {
    event.preventDefault();

    if (!isValidPattern(titlePattern)) {
      return;
    }

    settings.addTargetTitle(titlePattern);

    setTitlePattern("");
  }

  function handleSettingsChange(event: React.ChangeEvent<HTMLInputElement>) {
    event.persist();
    debouncedHandleSettingsChange(event);
  }

  function importExportDataWithFeedback<T>(
    operationName: string,
    func: (arg: T) => Promise<unknown>,
    funcArg: T,
    onSuccess?: (blob: string | Blob) => void,
  ) {
    if (importExportAlertTimeoutRef.current != null) {
      window.clearTimeout(importExportAlertTimeoutRef.current);
    }

    setImportExportErrors([]);
    setImportExportAlertVisible(false);
    setImportExportOperationName(operationName);

    (func(funcArg) as Promise<Blob>)
      .then((blob: Blob) => {
        if (onSuccess != null) onSuccess(blob);
        importExportAlertTimeoutRef.current = window.setTimeout(() => {
          setImportExportAlertVisible(false);
        }, 5);
      })
      .catch((err: Error) => {
        setImportExportErrors((currImportExportErrors) => [...currImportExportErrors, err]);
      });
  }

  function handleExportSettings(event: React.MouseEvent<HTMLButtonElement>) {
    importExportDataWithFeedback(
      chrome.i18n.getMessage("options_importExport_exporting") || "",
      exportSettings,
      event,
      (blob) => {
        FileSaver.saveAs(blob, exportFileName(new Date(Date.now())));
      },
    );
  }

  function handleImportSettings(event: React.FormEvent<HTMLInputElement>) {
    importExportDataWithFeedback(
      chrome.i18n.getMessage("options_importExport_importing") || "",
      importSettings,
      event,
    );
  }

  function handleInitialiseApp(event: React.MouseEvent<HTMLButtonElement>) {
    importExportDataWithFeedback(
      chrome.i18n.getMessage("options_initialiseApp_initialising") || "",
      initialiseApp,
      event,
    );
  }

  return (
    <div className="tab-pane active">
      <form>
        <label className="form-label">
          <strong>{chrome.i18n.getMessage("options_option_theme_label")}</strong>
        </label>
        <div>
          <div className="btn-group">
            <button
              className={cx("btn", {
                active: theme == null || theme === "system",
                "btn-secondary": theme == null || theme === "system",
                "btn-outline-secondary": !(theme == null || theme === "system"),
              })}
              onClick={() => {
                persistSettingMutation.mutate({ key: "theme", value: "system" });
              }}
              type="button"
            >
              {chrome.i18n.getMessage("options_option_theme_system")}
            </button>
            <button
              className={cx("btn", {
                active: theme === "light",
                "btn-secondary": theme === "light",
                "btn-outline-secondary": theme !== "light",
              })}
              onClick={() => {
                persistSettingMutation.mutate({ key: "theme", value: "light" });
              }}
              type="button"
            >
              <i className="fas fa-sun me-1" />
              {chrome.i18n.getMessage("options_option_theme_light")}
            </button>
            <button
              className={cx("btn", {
                active: theme === "dark",
                "btn-secondary": theme === "dark",
                "btn-outline-secondary": theme !== "dark",
              })}
              onClick={() => {
                persistSettingMutation.mutate({ key: "theme", value: "dark" });
              }}
              type="button"
            >
              <i className="fas fa-moon me-1" />
              {chrome.i18n.getMessage("options_option_theme_dark")}
            </button>
          </div>
        </div>
        <label className="form-label mt-3">
          <strong>{chrome.i18n.getMessage("options_option_timeInactive_label")}</strong>
        </label>
        <div className="row align-items-center">
          <div className="col-4">
            <div className="input-group">
              <input
                className="form-control"
                defaultValue={settings.get("minutesInactive")}
                id="minutesInactive"
                max="7200"
                min="0"
                name="minutesInactive"
                onChange={handleSettingsChange}
                title={chrome.i18n.getMessage("options_option_timeInactive_minutes")}
                type="number"
              />
              <span className="input-group-text">
                {chrome.i18n.getMessage("options_option_timeInactive_label_minutes")}
              </span>
            </div>
          </div>
          <div className="w-auto p-0 mx-n1">:</div>
          <div className="col-4">
            <div className="input-group">
              <input
                className="form-control"
                defaultValue={settings.get("secondsInactive")}
                id="secondsInactive"
                max="59"
                min="0"
                name="secondsInactive"
                onChange={handleSettingsChange}
                title={chrome.i18n.getMessage("options_option_timeInactive_seconds")}
                type="number"
              />
              <span className="input-group-text">
                {chrome.i18n.getMessage("options_option_timeInactive_label_seconds")}
              </span>
            </div>
          </div>
        </div>
        <label className="form-label mt-3" htmlFor="minTabs">
          <strong>{chrome.i18n.getMessage("options_option_minTabs_label")}</strong>
        </label>
        <div className="row align-items-center">
          <div className="col-8">
            <div className="input-group">
              <input
                className="form-control"
                defaultValue={settings.get("minTabs")}
                id="minTabs"
                min="0"
                name="minTabs"
                onChange={handleSettingsChange}
                title={chrome.i18n.getMessage("options_option_minTabs_tabs")}
                type="number"
              />
              <div className="input-group-text">open tabs</div>
              <select
                className="form-select"
                id="minTabsStrategy"
                name="minTabsStrategy"
                onChange={(event) => {
                  saveSetting("minTabsStrategy", event.target.value);
                }}
                style={{ flex: 3 }}
                value={settings.get("minTabsStrategy")}
              >
                <option value="allWindows">total (across all windows)</option>
                <option value="givenWindow">in a given window</option>
              </select>
            </div>
          </div>
        </div>
        <div className="form-text mb-1">(does not include pinned or locked tabs)</div>
        <div className="form-check mb-1">
          <input
            className="form-check-input"
            defaultChecked={settings.get("debounceOnActivated")}
            id="debounceOnActivated"
            name="debounceOnActivated"
            onChange={handleSettingsChange}
            type="checkbox"
          />
          <label className="form-check-label" htmlFor="debounceOnActivated">
            {chrome.i18n.getMessage("options_option_debounceOnActivated_label")}
          </label>
        </div>
        <div className="form-check mb-1">
          <input
            className="form-check-input"
            defaultChecked={settings.get("filterAudio")}
            id="filterAudio"
            name="filterAudio"
            onChange={handleSettingsChange}
            type="checkbox"
          />
          <label className="form-check-label" htmlFor="filterAudio">
            {chrome.i18n.getMessage("options_option_filterAudio_label")}
          </label>
        </div>
        <div className="form-check">
          <input
            className="form-check-input"
            defaultChecked={settings.get("filterGroupedTabs")}
            disabled={!showFilterTabGroupsOption}
            id="filterGroupedTabs"
            name="filterGroupedTabs"
            onChange={handleSettingsChange}
            type="checkbox"
          />
          <label className="form-check-label" htmlFor="filterGroupedTabs">
            {chrome.i18n.getMessage("options_option_filterGroupedTabs_label")}
          </label>
        </div>
        <label className="form-label mt-3" htmlFor="maxTabs">
          <strong>{chrome.i18n.getMessage("options_option_rememberTabs_label")}</strong>
        </label>
        <div className="row align-items-center">
          <div className="col-3">
            <input
              className="form-control me-1"
              defaultValue={settings.get("maxTabs")}
              id="maxTabs"
              min="0"
              name="maxTabs"
              onChange={handleSettingsChange}
              title={chrome.i18n.getMessage("options_option_rememberTabs_tabs")}
              type="number"
            />
          </div>
          <div className="w-auto p-0">
            {chrome.i18n.getMessage("options_option_rememberTabs_postLabel")}
          </div>
        </div>
        <div className="form-check mb-1 mt-2">
          <input
            className="form-check-input"
            defaultChecked={settings.get("purgeClosedTabs")}
            id="purgeClosedTabs"
            name="purgeClosedTabs"
            onChange={handleSettingsChange}
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
            onChange={handleSettingsChange}
            type="checkbox"
          />
          <label className="form-check-label" htmlFor="showBadgeCount">
            {chrome.i18n.getMessage("options_option_showBadgeCount_label")}
          </label>
        </div>
        <div className="form-check mb-3">
          <input
            className="form-check-input"
            defaultChecked={settings.get("createContextMenu")}
            id="createContextMenu"
            name="createContextMenu"
            onChange={handleSettingsChange}
            type="checkbox"
          />
          <label className="form-check-label" htmlFor="createContextMenu">
            {chrome.i18n.getMessage("options_option_createContextMenu_label")}
          </label>
        </div>
        <TabWrangleOption
          onChange={handleSettingsChange}
          selectedOption={settings.get("wrangleOption")}
        />
      </form>

      <h5 className="mt-3">{chrome.i18n.getMessage("options_section_targetURLs")}</h5>
      <div className="row">
        <div className="col-8">
          <form onSubmit={addUrlPattern}>
            <label className="form-label" htmlFor="wl-add">
              {chrome.i18n.getMessage("options_option_autoLock_label")}
            </label>
            <div className="input-group">
              <input
                className="form-control"
                id="wl-add"
                onChange={(event) => {
                  setNewPattern(event.target.value);
                }}
                type="text"
                value={newPattern}
              />
              <button
                className="btn btn-secondary"
                disabled={!isValidPattern(newPattern)}
                id="addToWL"
                type="submit"
              >
                {chrome.i18n.getMessage("options_option_autoLock_add")}
              </button>
            </div>
            <p className="form-text">{chrome.i18n.getMessage("options_option_autoLock_example")}</p>
          </form>
        </div>
      </div>
      <table className="table table-hover">
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
              <td className="text-center" colSpan={2}>
                {chrome.i18n.getMessage("options_option_autoLock_empty")}
              </td>
            </tr>
          ) : (
            whitelist.map((pattern) => (
              <tr className="align-middle" key={pattern}>
                <td>
                  <code>{pattern}</code>
                </td>
                <td>
                  <button
                    className="btn btn-outline-secondary btn-sm my-n1"
                    onClick={() => {
                      handleClickRemovePattern(pattern);
                    }}
                  >
                    {chrome.i18n.getMessage("options_option_autoLock_remove")}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <h5 className="mt-3">{chrome.i18n.getMessage("options_section_targetTitles")}</h5>
      <div className="row">
        <div className="col-8">
          <form onSubmit={addTitlePattern}>
            <label className="form-label" htmlFor="wl-add">
              {chrome.i18n.getMessage("options_option_targetTitle_label")}
            </label>
            <div className="input-group">
              <input
                className="form-control"
                id="wl-add"
                onChange={(event) => {
                  setTitlePattern(event.target.value);
                }}
                type="text"
                value={titlePattern}
              />
              <button
                className="btn btn-secondary"
                disabled={!isValidPattern(titlePattern)}
                id="addToWL"
                type="submit"
              >
                {chrome.i18n.getMessage("options_option_autoLock_add")}
              </button>
            </div>
            <p className="form-text">{chrome.i18n.getMessage("options_option_targetTitle_example")}</p>
          </form>
        </div>
      </div>
      <table className="table table-hover">
        <thead>
          <tr>
            <th style={{ width: "100%" }}>
              {chrome.i18n.getMessage("options_option_targetTitleHeader")}
            </th>
            <th />
          </tr>
        </thead>
        <tbody>
          {targetTitles.length === 0 ? (
            <tr>
              <td className="text-center" colSpan={2}>
                {chrome.i18n.getMessage("options_option_targetTitles_empty")}
              </td>
            </tr>
          ) : (
            targetTitles.map((pattern) => (
              <tr className="align-middle" key={pattern}>
                <td>
                  <code>{pattern}</code>
                </td>
                <td>
                  <button
                    className="btn btn-outline-secondary btn-sm my-n1"
                    onClick={() => {
                      handleClickRemoveTitle(pattern);
                    }}
                  >
                    {chrome.i18n.getMessage("options_option_targetTitle_remove")}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <h5 className="mt-3">{chrome.i18n.getMessage("options_section_importExport")}</h5>
      <div className="row">
        <div className="col-8">{chrome.i18n.getMessage("options_importExportSettings_description")}</div>
      </div>
      <div className="row my-2">
        <div className="col-8 mb-1">
          <button className="btn btn-secondary" onClick={handleExportSettings}>
            <i className="fas fa-file-export me-1" />
            {chrome.i18n.getMessage("options_importExport_export")}
          </button>{" "}
          <button
            className="btn btn-secondary"
            onClick={() => {
              if (fileSelectorRef.current != null) fileSelectorRef.current.click();
            }}
          >
            <i className="fas fa-file-import me-1" />
            {chrome.i18n.getMessage("options_importExport_import")}
          </button>
          <input
            accept=".json"
            onChange={handleImportSettings}
            ref={(input) => {
              fileSelectorRef.current = input;
            }}
            style={{ display: "none" }}
            type="file"
          />
        </div>
      </div>
      <div className="row">
        <div className="col-8">
          <div className="alert alert-warning">
            {chrome.i18n.getMessage("options_importExportSettings_importWarning")}
          </div>
        </div>
      </div>
      {importExportErrors.length === 0 ? (
        <TransitionGroup appear={false}>{importExportAlert}</TransitionGroup>
      ) : (
        importExportAlert
      )}
      {errors.length === 0 ? (
        <TransitionGroup appear={false}>{saveAlert}</TransitionGroup>
      ) : (
        errorAlert
      )}

      <h5 className="mt-3">{chrome.i18n.getMessage("options_section_initialiseApp")}</h5>
      <div className="row">
        <div className="col-8">{chrome.i18n.getMessage("options_initialiseApp_description")}</div>
      </div>
      <div className="row my-2">
        <div className="col-8 mb-1">
          <button
            className="btn btn-secondary"
            onClick={handleInitialiseApp}>
            <i className="fas fa-file-import me-1" />
            {chrome.i18n.getMessage("options_initialiseApp_initialise")}
          </button>
        </div>
      </div>
      <div className="row">
        <div className="col-8">
          <div className="alert alert-warning">
            {chrome.i18n.getMessage("options_initialiseApp_initialiseWarning")}
          </div>
        </div>
      </div>
      {importExportErrors.length === 0 ? (
        <TransitionGroup appear={false}>{importExportAlert}</TransitionGroup>
      ) : (
        importExportAlert
      )}
      {errors.length === 0 ? (
        <TransitionGroup appear={false}>{saveAlert}</TransitionGroup>
      ) : (
        errorAlert
      )}
    </div>
  );
}
