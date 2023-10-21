import * as React from "react";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import { exportData, importData } from "./actions/importExportActions";
import { mutatePersistSetting, mutateSetting } from "./mutations";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useStorageSyncPersistQuery, useStorageSyncQuery } from "./hooks";
import FileSaver from "file-saver";
import TabWrangleOption from "./TabWrangleOption";
import cx from "classnames";
import { exportFileName } from "./actions/importExportActions";
import settings from "./settings";
import { useDebounceCallback } from "@react-hook/debounce";

function isValidPattern(pattern: string) {
  // some other choices such as '/' also do not make sense; not sure if they should be blocked as
  // well
  return pattern != null && pattern.length > 0 && /\S/.test(pattern);
}

export default function OptionsTab() {
  const { data: syncPersistData } = useStorageSyncPersistQuery();
  const { data: syncData } = useStorageSyncQuery();

  const queryClient = useQueryClient();
  React.useEffect(() => {
    function handleChanged(
      _changes: { [key: string]: chrome.storage.StorageChange },
      areaName: chrome.storage.AreaName
    ) {
      if (areaName === "sync") queryClient.invalidateQueries({ queryKey: ["settingsQuery"] });
    }
    chrome.storage.onChanged.addListener(handleChanged);
    return () => {
      chrome.storage.onChanged.removeListener(handleChanged);
    };
  });

  const fileSelectorRef = React.useRef<HTMLInputElement | null>(null);
  const importExportAlertTimeoutRef = React.useRef<number>();
  const theme: string = syncPersistData?.theme ?? "system";
  const whitelist: string[] = syncData?.whitelist ?? [];
  const [errors, setErrors] = React.useState<Error[]>([]);
  const [importExportAlertVisible, setImportExportAlertVisible] = React.useState(false);
  const [importExportErrors, setImportExportErrors] = React.useState<Error[]>([]);
  const [importExportOperationName, setImportExportOperationName] = React.useState("");
  const [newPattern, setNewPattern] = React.useState("");
  const saveAlertTimeoutRef = React.useRef<number>();
  const [saveAlertVisible, setSaveAlertVisible] = React.useState(false);
  const [showFilterTabGroupsOption, setShowFilterTabGroupsOption] = React.useState(false);

  const persistSettingMutation = useMutation({
    mutationFn: mutatePersistSetting,
  });

  const settingMutation = useMutation({
    mutationFn: mutateSetting,
  });

  function handleClickRemovePattern(pattern: string) {
    const nextWhitelist = whitelist.slice();
    nextWhitelist.splice(whitelist.indexOf(pattern), 1);
    settingMutation.mutate({ key: "whitelist", value: nextWhitelist });
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
        <CSSTransition classNames="alert" key="importExportAlert" timeout={400}>
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

  async function saveOption(key: string, value: unknown) {
    if (saveAlertTimeoutRef.current != null) {
      window.clearTimeout(saveAlertTimeoutRef.current);
    }

    try {
      await mutateSetting({ key, value });
      setErrors([]);
      setSaveAlertVisible(true);
      saveAlertTimeoutRef.current = window.setTimeout(() => {
        setSaveAlertVisible(false);
      }, 400);
    } catch (err) {
      if (err instanceof Error) setErrors([...errors, err]);
    }
  }

  const debouncedHandleSettingsChange = useDebounceCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.type === "checkbox") {
        saveOption(event.target.id, !!event.target.checked);
      } else if (event.target.type === "radio") {
        saveOption(event.target.name, event.target.value);
      } else {
        saveOption(event.target.id, event.target.value);
      }
    },
    150
  );

  function handleAddPatternSubmit(event: React.FormEvent<HTMLElement>) {
    event.preventDefault();

    if (!isValidPattern(newPattern)) {
      return;
    }

    // Only add the pattern again if it's new, not yet in the whitelist.
    if (whitelist.indexOf(newPattern) === -1) {
      settingMutation.mutate({ key: "whitelist", value: [...whitelist, newPattern] });
    }

    setNewPattern("");
  }

  function handleSettingsChange(event: React.ChangeEvent<HTMLInputElement>) {
    event.persist();
    debouncedHandleSettingsChange(event);
  }

  function importExportDataWithFeedback<T>(
    operationName: string,
    func: (arg: T) => Promise<unknown>,
    funcArg: T,
    onSuccess?: (blob: string | Blob) => void
  ) {
    if (importExportAlertTimeoutRef.current != null) {
      window.clearTimeout(importExportAlertTimeoutRef.current);
    }

    setImportExportErrors([]);
    setImportExportAlertVisible(true);
    setImportExportOperationName(operationName);

    (func(funcArg) as Promise<Blob>)
      .then((blob: Blob) => {
        if (onSuccess != null) onSuccess(blob);
        importExportAlertTimeoutRef.current = window.setTimeout(() => {
          setImportExportAlertVisible(false);
        }, 400);
      })
      .catch((err: Error) => {
        setImportExportErrors((currImportExportErrors) => [...currImportExportErrors, err]);
      });
  }

  function handleExportData(event: React.MouseEvent<HTMLButtonElement>) {
    importExportDataWithFeedback(
      chrome.i18n.getMessage("options_importExport_exporting") || "",
      exportData,
      event,
      (blob) => {
        FileSaver.saveAs(blob, exportFileName(new Date(Date.now())));
      }
    );
  }

  function handleImportData(event: React.FormEvent<HTMLInputElement>) {
    importExportDataWithFeedback(
      chrome.i18n.getMessage("options_importExport_importing") || "",
      importData,
      event
    );
  }

  return (
    <div className="tab-pane active">
      <h4>{chrome.i18n.getMessage("options_section_settings")}</h4>
      <form>
        <div className="mb-2">
          <div>
            <strong>{chrome.i18n.getMessage("options_option_theme_label")}</strong>
          </div>
          <div className="mb-2">
            <div className="btn-group">
              <button
                className={cx("btn btn-outline-dark", { active: theme === "system" })}
                onClick={() => {
                  persistSettingMutation.mutate({ key: "theme", value: "system" });
                }}
                type="button"
              >
                {chrome.i18n.getMessage("options_option_theme_system")}
              </button>
              <button
                className={cx("btn btn-outline-dark", { active: theme === "light" })}
                onClick={() => {
                  persistSettingMutation.mutate({ key: "theme", value: "light" });
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
                className={cx("btn btn-outline-dark", { active: theme === "dark" })}
                onClick={() => {
                  persistSettingMutation.mutate({ key: "theme", value: "dark" });
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
              onChange={handleSettingsChange}
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
              onChange={handleSettingsChange}
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
              onChange={handleSettingsChange}
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
              onChange={handleSettingsChange}
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
        <div className={cx("form-check", showFilterTabGroupsOption ? "mb-1" : "mb-2")}>
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
        {showFilterTabGroupsOption && (
          <div className="form-check mb-2">
            <input
              className="form-check-input"
              defaultChecked={settings.get("filterGroupedTabs")}
              id="filterGroupedTabs"
              name="filterGroupedTabs"
              onChange={handleSettingsChange}
              type="checkbox"
            />
            <label className="form-check-label" htmlFor="filterGroupedTabs">
              {chrome.i18n.getMessage("options_option_filterGroupedTabs_label")}
            </label>
          </div>
        )}
        <TabWrangleOption
          onChange={handleSettingsChange}
          selectedOption={settings.get("wrangleOption")}
        />
      </form>

      <h4 className="mt-3">{chrome.i18n.getMessage("options_section_autoLock")}</h4>
      <div className="row">
        <div className="col-8">
          <form onSubmit={handleAddPatternSubmit} style={{ marginBottom: "20px" }}>
            <label htmlFor="wl-add">
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
              <span className="input-group-append">
                <button
                  className="btn btn-outline-dark"
                  disabled={!isValidPattern(newPattern)}
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
              <td className="text-center" colSpan={2}>
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
                    onClick={() => {
                      handleClickRemovePattern(pattern);
                    }}
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
          <button className="btn btn-outline-dark btn-sm" onClick={handleExportData}>
            <i className="fas fa-file-export mr-1" />
            {chrome.i18n.getMessage("options_importExport_export")}
          </button>{" "}
          <button
            className="btn btn-outline-dark btn-sm"
            onClick={() => {
              if (fileSelectorRef.current != null) fileSelectorRef.current.click();
            }}
          >
            <i className="fas fa-file-import mr-1" />
            {chrome.i18n.getMessage("options_importExport_import")}
          </button>
          <input
            accept=".json"
            onChange={handleImportData}
            ref={(input) => {
              fileSelectorRef.current = input;
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
