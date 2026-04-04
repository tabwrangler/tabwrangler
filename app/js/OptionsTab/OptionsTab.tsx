import { exportData, importData } from "../actions/importExportActions";
import settings, { type SettingsSchema } from "../settings";
import { useEffect, useRef, useState } from "react";
import { useStorageSyncPersistQuery, useStorageSyncQuery } from "../storage";
import Button from "react-bootstrap/Button";
import ButtonGroup from "react-bootstrap/ButtonGroup";
import FileSaver from "file-saver";
import TabWrangleOption from "./TabWrangleOption";
import Toast from "react-bootstrap/Toast";
import ToastContainer from "react-bootstrap/ToastContainer";
import cx from "classnames";
import { exportFileName } from "../actions/importExportActions";
import { mutateStorageSyncPersist } from "../storage";
import { useDebounceCallback } from "@react-hook/debounce";
import { useMutation } from "@tanstack/react-query";
import { useUndo } from "../UndoContext";

function isValidPattern(pattern: string) {
  return pattern != null && pattern.length > 0 && /\S/.test(pattern);
}

export default function OptionsTab() {
  const { data: syncPersistData } = useStorageSyncPersistQuery();
  const { data: syncData } = useStorageSyncQuery();
  const { reset: resetUndo } = useUndo();

  const fileSelectorRef = useRef<HTMLInputElement | null>(null);
  const importExportAlertTimeoutRef = useRef<number>(null);
  const theme: string = syncPersistData?.theme ?? "system";
  const whitelist: string[] = syncData?.whitelist ?? [];
  const [errors, setErrors] = useState<Error[]>([]);
  const [importExportAlertVisible, setImportExportAlertVisible] = useState(false);
  const [importExportErrors, setImportExportErrors] = useState<Error[]>([]);
  const [importExportOperationName, setImportExportOperationName] = useState("");
  const [newPattern, setNewPattern] = useState("");
  const saveAlertTimeoutRef = useRef<number>(null);
  const [saveAlertVisible, setSaveAlertVisible] = useState(false);
  const [showFilterTabGroupsOption, setShowFilterTabGroupsOption] = useState(false);

  const [maxTabs, setMaxTabs] = useState<number | string>(settings.get("maxTabs"));

  function resetMaxTabs() {
    setMaxTabs(settings.get("maxTabs"));
  }

  function saveMaxTabs() {
    saveSetting("maxTabs", maxTabs as number);
  }

  const persistSettingMutation = useMutation({
    mutationFn: mutateStorageSyncPersist,
  });

  const settingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      chrome.storage.sync.set({ [key]: value }),
  });

  function handleClickRemovePattern(pattern: string) {
    const nextWhitelist = whitelist.slice();
    nextWhitelist.splice(whitelist.indexOf(pattern), 1);
    settingMutation.mutate({ key: "whitelist", value: nextWhitelist });
  }

  useEffect(() => {
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

  async function saveSetting<K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]) {
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
    }, 1000);
  }

  const debouncedHandleSettingsChange = useDebounceCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const key = (
        event.target.type === "radio" ? event.target.name : event.target.id
      ) as keyof SettingsSchema;
      const value = event.target.type === "checkbox" ? !!event.target.checked : event.target.value;
      saveSetting(key, value);
    },
    150,
  );

  function addWhitelistPattern(event: React.FormEvent<HTMLElement>) {
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
    onSuccess?: (blob: string | Blob) => void,
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
      },
    );
  }

  function handleImportData(event: React.FormEvent<HTMLInputElement>) {
    importExportDataWithFeedback(
      chrome.i18n.getMessage("options_importExport_importing") || "",
      importData,
      event,

      // Reset the undo/redo context after importing because the set of IDs in the context may clash
      // with the imported ones. For example: user could import IDs already in the context, and then
      // "undo" / "redo" might add or remove multiple tabs at once.
      resetUndo,
    );
  }

  return (
    <>
      <div className="tab-pane active">
        <form>
          <label className="form-label">
            <strong>{chrome.i18n.getMessage("options_option_theme_label")}</strong>
          </label>
          <div>
            <ButtonGroup>
              <Button
                active={theme == null || theme === "system"}
                type="button"
                variant={theme == null || theme === "system" ? "secondary" : "outline-secondary"}
                onClick={() => {
                  persistSettingMutation.mutate({ key: "theme", value: "system" });
                }}
              >
                {chrome.i18n.getMessage("options_option_theme_system")}
              </Button>
              <Button
                active={theme === "light"}
                type="button"
                variant={theme === "light" ? "secondary" : "outline-secondary"}
                onClick={() => {
                  persistSettingMutation.mutate({ key: "theme", value: "light" });
                }}
              >
                <i className="fas fa-sun me-1" />
                {chrome.i18n.getMessage("options_option_theme_light")}
              </Button>
              <Button
                active={theme === "dark"}
                type="button"
                variant={theme === "dark" ? "secondary" : "outline-secondary"}
                onClick={() => {
                  persistSettingMutation.mutate({ key: "theme", value: "dark" });
                }}
              >
                <i className="fas fa-moon me-1" />
                {chrome.i18n.getMessage("options_option_theme_dark")}
              </Button>
            </ButtonGroup>
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
                  <option value="allWindows">
                    {chrome.i18n.getMessage("options_option_minTabs_option_total")}
                  </option>
                  <option value="givenWindow">
                    {chrome.i18n.getMessage("options_option_minTabs_option_givenWindow")}
                  </option>
                </select>
              </div>
            </div>
          </div>
          <div className="form-text mb-1">
            {chrome.i18n.getMessage("options_option_minTabs_postLabel")}
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
                className={cx("form-control me-1", {
                  "border-primary": maxTabs !== settings.get("maxTabs"),
                })}
                id="maxTabs"
                min="0"
                name="maxTabs"
                onChange={(event) => {
                  const parsedValue = parseInt(event.target.value);
                  setMaxTabs(isNaN(parsedValue) ? "" : parsedValue);
                }}
                title={chrome.i18n.getMessage("options_option_rememberTabs_tabs")}
                type="number"
                value={maxTabs}
              />
            </div>
            <div className="w-auto p-0">
              {chrome.i18n.getMessage("options_option_rememberTabs_postLabel")}
            </div>
          </div>
          {typeof maxTabs === "string" && (
            <div className="row">
              <div className="col-8 form-text text-primary">
                {chrome.i18n.getMessage("options_option_rememberTabs_validNumber")}
              </div>
            </div>
          )}
          {typeof maxTabs === "number" && maxTabs < settings.get("maxTabs") && (
            <div className="row">
              <div className="col-8 form-text text-primary">
                {chrome.i18n.getMessage("options_option_rememberTabs_truncateMsg")}
              </div>
            </div>
          )}
          {typeof maxTabs === "number" && maxTabs > settings.get("maxTabs") && (
            <div className="row">
              <div className="col-8 form-text text-primary">
                {chrome.i18n.getMessage("options_option_rememberTabs_saveToConfirm")}
              </div>
            </div>
          )}
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

        <h5 className="mt-3">{chrome.i18n.getMessage("options_section_autoLock")}</h5>
        <div className="row">
          <div className="col-8">
            <form onSubmit={addWhitelistPattern}>
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
                <Button
                  disabled={!isValidPattern(newPattern)}
                  id="addToWL"
                  type="submit"
                  variant="secondary"
                >
                  {chrome.i18n.getMessage("options_option_autoLock_add")}
                </Button>
              </div>
              <p className="form-text">
                {chrome.i18n.getMessage("options_option_autoLock_example")}
              </p>
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
                    <Button
                      className="my-n1"
                      size="sm"
                      variant="outline-secondary"
                      onClick={() => {
                        handleClickRemovePattern(pattern);
                      }}
                    >
                      {chrome.i18n.getMessage("options_option_autoLock_remove")}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <h5 className="mt-3">{chrome.i18n.getMessage("options_section_importExport")}</h5>
        <div className="row">
          <div className="col-8">{chrome.i18n.getMessage("options_importExport_description")}</div>
        </div>
        <div className="row my-2">
          <div className="col-8 mb-1">
            <Button variant="secondary" onClick={handleExportData}>
              <i className="fas fa-file-export me-1" />
              {chrome.i18n.getMessage("options_importExport_export")}
            </Button>{" "}
            <Button
              variant="secondary"
              onClick={() => {
                if (fileSelectorRef.current != null) fileSelectorRef.current.click();
              }}
            >
              <i className="fas fa-file-import me-1" />
              {chrome.i18n.getMessage("options_importExport_import")}
            </Button>
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
        </div>
        <div className="row">
          <div className="col-8">
            <div className="alert alert-warning">
              {chrome.i18n.getMessage("options_importExport_importWarning")}
            </div>
          </div>
        </div>
      </div>

      <ToastContainer className="p-3" containerPosition="fixed" position="bottom-start">
        <Toast bg="danger" show={errors.length > 0}>
          <Toast.Body>
            <strong>{chrome.i18n.getMessage("options_errorSavingSettings")}</strong>
            <ul className="mb-0">
              {errors.map((error, i) => (
                <li key={i}>{error.message}</li>
              ))}
            </ul>
          </Toast.Body>
        </Toast>
        <Toast bg="danger" show={importExportErrors.length > 0}>
          <Toast.Body>
            <strong>{chrome.i18n.getMessage("options_errorImportExport")}</strong>
            <ul className="mb-0">
              {importExportErrors.map((error, i) => (
                <li key={i}>{error.message}</li>
              ))}
            </ul>
          </Toast.Body>
        </Toast>
        <Toast
          autohide
          bg="success"
          delay={2000}
          onClose={() => {
            setImportExportAlertVisible(false);
          }}
          show={importExportAlertVisible}
        >
          <Toast.Body>{importExportOperationName}</Toast.Body>
        </Toast>
        <Toast bg="success" show={saveAlertVisible}>
          <Toast.Body>{chrome.i18n.getMessage("options_saving")}</Toast.Body>
        </Toast>
        <Toast bg="primary" show={maxTabs !== settings.get("maxTabs")}>
          <Toast.Body className="d-flex align-items-center justify-content-between">
            <div className="text-light">{chrome.i18n.getMessage("options_unsavedChanges")}</div>
            <div className="d-flex gap-2">
              <Button variant="outline-light" onClick={resetMaxTabs}>
                {chrome.i18n.getMessage("options_discard")}
              </Button>
              <Button variant="light" disabled={maxTabs === ""} onClick={saveMaxTabs}>
                {chrome.i18n.getMessage("options_save")}
              </Button>
            </div>
          </Toast.Body>
        </Toast>
      </ToastContainer>
    </>
  );
}
