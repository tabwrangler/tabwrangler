import { useId, useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import type { ParsedImport } from "../actions/importExportActions";

interface ImportConfirmProps {
  // Closed tabs in this browser now, which replacing them loses.
  closedTabCount: number;
  fileName: string;
  onCancel: () => void;
  onImport: (options: { replaceClosedTabs: boolean }) => void;
  parsed: ParsedImport | null;
}

/**
 * Shows what an import file holds before anything is imported. Replacing closed tabs is a separate
 * choice that starts off: a file moved from another browser holds that browser's closed tabs, and
 * importing them would erase the ones here.
 */
export default function ImportConfirm({
  closedTabCount,
  fileName,
  onCancel,
  onImport,
  parsed,
}: ImportConfirmProps) {
  const [replaceClosedTabs, setReplaceClosedTabs] = useState(false);
  const replaceId = useId();
  const hasSettings =
    parsed != null && (parsed.theme != null || Object.keys(parsed.settings).length > 0);
  const fileClosedTabCount = parsed?.closedTabs?.savedTabs.length ?? 0;

  return (
    <Modal
      centered
      onExited={() => setReplaceClosedTabs(false)}
      onHide={onCancel}
      show={parsed != null}
    >
      <Modal.Header closeButton>
        <Modal.Title as="h5">
          {chrome.i18n.getMessage("options_importExport_confirm_title")}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-body-secondary small mb-2">
          <i className="fas fa-file-import me-1" />
          {fileName}
        </p>
        <ul className="ps-3">
          <li>
            {chrome.i18n.getMessage(
              hasSettings
                ? "options_importExport_confirm_settings"
                : "options_importExport_confirm_noSettings",
            )}
          </li>
          {parsed != null && parsed.skippedSettings.length > 0 && (
            <li>
              {chrome.i18n.getMessage("options_importExport_confirm_skipped", [
                parsed.skippedSettings.join(", "),
              ])}
            </li>
          )}
        </ul>
        {fileClosedTabCount > 0 && (
          <div className="form-check">
            <input
              checked={replaceClosedTabs}
              className="form-check-input"
              id={replaceId}
              onChange={(event) => setReplaceClosedTabs(event.target.checked)}
              type="checkbox"
            />
            <label className="form-check-label" htmlFor={replaceId}>
              {chrome.i18n.getMessage("options_importExport_confirm_replaceClosedTabs", [
                closedTabCount.toLocaleString(),
                fileClosedTabCount.toLocaleString(),
              ])}
            </label>
            <div className="form-text">
              {chrome.i18n.getMessage("options_importExport_confirm_replaceClosedTabs_help")}
            </div>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onCancel} type="button" variant="secondary">
          {chrome.i18n.getMessage("options_importExport_cancel")}
        </Button>
        <Button
          disabled={!hasSettings && !replaceClosedTabs}
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
