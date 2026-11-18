import { useId, useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import type { ParsedImport } from "../actions/importExportActions";
import cx from "classnames";

interface ImportConfirmProps {
  // Closed tabs in this browser now, which replacing them loses.
  closedTabCount: number;
  // Why the most recently chosen file cannot be imported. `parsed` is then an earlier file's.
  error: Error | null;
  fileName: string;
  onCancel: () => void;
  onChooseFile: () => void;
  onExited: () => void;
  onImport: (options: { replaceClosedTabs: boolean }) => void;
  parsed: ParsedImport;
  show: boolean;
}

/**
 * Shows what an import file holds before anything is imported. Replacing closed tabs is a separate
 * choice that starts off: a file moved from another browser holds that browser's closed tabs, and
 * importing them would erase the ones here.
 */
export default function ImportConfirm({
  closedTabCount,
  error,
  fileName,
  onCancel,
  onChooseFile,
  onExited,
  onImport,
  parsed,
  show,
}: ImportConfirmProps) {
  // Ties the choice to the file it was made for, so choosing another file starts it off again.
  const [replaceClosedTabsFor, setReplaceClosedTabsFor] = useState<ParsedImport | null>(null);
  const replaceClosedTabs = replaceClosedTabsFor === parsed;
  const replaceId = useId();
  const hasSettings = parsed.theme != null || Object.keys(parsed.settings).length > 0;
  const fileClosedTabCount = parsed.closedTabs?.savedTabs.length ?? 0;

  return (
    <Modal centered onExited={onExited} onHide={onCancel} show={show}>
      <Modal.Header closeButton>
        <Modal.Title as="h5">
          {chrome.i18n.getMessage("options_importExport_confirm_title")}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div
          className={cx("import-file d-flex align-items-center gap-2 p-2 mb-3", {
            "border-danger": error != null,
          })}
        >
          <span className="flex-grow-1 text-body-secondary text-truncate small">
            <i className="fas fa-file-import me-1" />
            {fileName}
          </span>
          <Button
            className="flex-shrink-0"
            onClick={onChooseFile}
            size="sm"
            variant="outline-secondary"
          >
            {chrome.i18n.getMessage("options_importExport_confirm_chooseFile")}
          </Button>
        </div>
        {error != null ? (
          <p className="text-danger-emphasis mb-0">{error.message}</p>
        ) : (
          <>
            <p className={parsed.skippedSettings.length > 0 ? "mb-2" : undefined}>
              {chrome.i18n.getMessage(
                hasSettings
                  ? "options_importExport_confirm_settings"
                  : "options_importExport_confirm_noSettings",
              )}
            </p>
            {parsed.skippedSettings.length > 0 && (
              <p className="text-body-secondary small">
                {chrome.i18n.getMessage("options_importExport_confirm_skipped", [
                  parsed.skippedSettings.join(", "),
                ])}
              </p>
            )}
            <div className="form-check mb-0">
              <input
                checked={replaceClosedTabs}
                className="form-check-input"
                id={replaceId}
                onChange={(event) => setReplaceClosedTabsFor(event.target.checked ? parsed : null)}
                type="checkbox"
              />
              <label className="form-check-label" htmlFor={replaceId}>
                {chrome.i18n.getMessage("options_importExport_confirm_replaceClosedTabs")}
              </label>
              <div className="form-text mt-0">
                {chrome.i18n.getMessage("options_importExport_confirm_replaceClosedTabs_help", [
                  closedTabCount.toLocaleString(),
                  fileClosedTabCount.toLocaleString(),
                ])}
              </div>
            </div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onCancel} type="button" variant="secondary">
          {chrome.i18n.getMessage("options_importExport_cancel")}
        </Button>
        <Button
          disabled={error != null || (!hasSettings && !replaceClosedTabs)}
          onClick={() => onImport({ replaceClosedTabs })}
          type="button"
          variant="primary"
        >
          {chrome.i18n.getMessage("options_importExport_import")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
