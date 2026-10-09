import { exportData, importData } from "../actions/importExportActions";
import settings, { type SettingsSchema } from "../settings";
import { useRef, useState } from "react";
import Button from "react-bootstrap/Button";
import ButtonGroup from "react-bootstrap/ButtonGroup";
import FileSaver from "file-saver";
import { IDLE_PERMISSIONS } from "../constants";
import TabRules from "./TabRules";
import TabWrangleOption from "./TabWrangleOption";
import Toast from "react-bootstrap/Toast";
import { ToastPortal } from "../ToastPortal";
import cx from "classnames";
import { exportFileName } from "../actions/importExportActions";
import { mutateStorageSyncPersist } from "../storage";
import { useDebounceCallback } from "@react-hook/debounce";
import useIdlePermissionQuery from "../api/useIdlePermissionQuery";
import { useMutation } from "@tanstack/react-query";
import useSetting from "../useSetting";
import { useStorageSyncPersistQuery } from "../storage";
import { useUndo } from "../UndoContext";

export default function OptionsTab() {
  const { data: syncPersistData } = useStorageSyncPersistQuery();
  const { reset: resetUndo } = useUndo();

  const fileSelectorRef = useRef<HTMLInputElement | null>(null);
  const importExportAlertTimeoutRef = useRef<number>(null);
  const theme: string = syncPersistData?.theme ?? "system";
  const [errors, setErrors] = useState<Error[]>([]);
  const [importExportAlertVisible, setImportExportAlertVisible] = useState(false);
  const [importExportErrors, setImportExportErrors] = useState<Error[]>([]);
  const [importExportOperationName, setImportExportOperationName] = useState("");
  const saveAlertTimeoutRef = useRef<number>(null);
  const [saveAlertVisible, setSaveAlertVisible] = useState(false);

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
        </form>
        <TabRules onSaveSetting={saveSetting} />
        <form>
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
                    if (event.target.value !== "allWindows" && event.target.value !== "givenWindow")
                      return;
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
          <div className="form-check form-switch mb-1">
            <input
              className="form-check-input"
              defaultChecked={settings.get("debounceOnActivated")}
              id="debounceOnActivated"
              name="debounceOnActivated"
              onChange={handleSettingsChange}
              role="switch"
              type="checkbox"
            />
            <label className="form-check-label" htmlFor="debounceOnActivated">
              {chrome.i18n.getMessage("options_option_debounceOnActivated_label")}
            </label>
          </div>
          <PauseWhenIdleOption onSaveSetting={saveSetting} />
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
              <div className="col-9 form-text text-primary">
                {chrome.i18n.getMessage("options_option_rememberTabs_validNumber")}
              </div>
            </div>
          )}
          {typeof maxTabs === "number" && maxTabs < settings.get("maxTabs") && (
            <div className="row">
              <div className="col-9 form-text text-primary">
                {chrome.i18n.getMessage("options_option_rememberTabs_truncateMsg")}
              </div>
            </div>
          )}
          {typeof maxTabs === "number" && maxTabs > settings.get("maxTabs") && (
            <div className="row">
              <div className="col-9 form-text text-primary">
                {chrome.i18n.getMessage("options_option_rememberTabs_saveToConfirm")}
              </div>
            </div>
          )}
          <div className="form-check form-switch mb-1 mt-2">
            <input
              className="form-check-input"
              defaultChecked={settings.get("purgeClosedTabs")}
              id="purgeClosedTabs"
              name="purgeClosedTabs"
              onChange={handleSettingsChange}
              role="switch"
              type="checkbox"
            />
            <label className="form-check-label" htmlFor="purgeClosedTabs">
              {chrome.i18n.getMessage("options_option_clearOnQuit_label")}
            </label>
          </div>
          <div className="form-check form-switch mb-1">
            <input
              className="form-check-input"
              defaultChecked={settings.get("showBadgeCount")}
              id="showBadgeCount"
              name="showBadgeCount"
              onChange={handleSettingsChange}
              role="switch"
              type="checkbox"
            />
            <label className="form-check-label" htmlFor="showBadgeCount">
              {chrome.i18n.getMessage("options_option_showBadgeCount_label")}
            </label>
          </div>
          <div className="form-check form-switch mb-3">
            <input
              className="form-check-input"
              defaultChecked={settings.get("createContextMenu")}
              id="createContextMenu"
              name="createContextMenu"
              onChange={handleSettingsChange}
              role="switch"
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

        <h5 className="mt-3">{chrome.i18n.getMessage("options_section_importExport")}</h5>
        <div className="row">
          <div className="col-9">{chrome.i18n.getMessage("options_importExport_description")}</div>
        </div>
        <div className="row my-2">
          <div className="col-9 mb-1">
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
          <div className="col-9">
            <div className="alert alert-warning">
              {chrome.i18n.getMessage("options_importExport_importWarning")}
            </div>
          </div>
        </div>
      </div>

      <ToastPortal>
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
          <Toast.Body className="text-light">{chrome.i18n.getMessage("options_saving")}</Toast.Body>
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
      </ToastPortal>
    </>
  );
}

function PauseWhenIdleOption({
  onSaveSetting,
}: {
  onSaveSetting: <K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]) => void;
}) {
  const pauseWhenIdle = useSetting("pauseWhenIdle");
  const { data: hasIdlePermission } = useIdlePermissionQuery();

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.checked) {
      // Must be requested synchronously in the event handler. Firefox rejects permission requests
      // made outside of a user gesture.
      const granted = await chrome.permissions.request(IDLE_PERMISSIONS);
      if (granted) onSaveSetting("pauseWhenIdle", true);
    } else {
      onSaveSetting("pauseWhenIdle", false);
      await chrome.permissions.remove(IDLE_PERMISSIONS);
    }
  }

  return (
    <div className="form-check form-switch mb-1">
      <input
        checked={pauseWhenIdle && hasIdlePermission === true}
        className="form-check-input"
        id="pauseWhenIdle"
        name="pauseWhenIdle"
        onChange={handleChange}
        role="switch"
        type="checkbox"
      />
      <label className="form-check-label" htmlFor="pauseWhenIdle">
        {chrome.i18n.getMessage("options_option_pauseWhenIdle_label")}
      </label>
    </div>
  );
}
