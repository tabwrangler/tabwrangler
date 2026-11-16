import { useId, useState } from "react";
import Button from "react-bootstrap/Button";
import type { ParsedImport } from "../actions/importExportActions";

interface ImportConfirmProps {
  // Closed tabs in this browser now, which replacing them loses.
  closedTabCount: number;
  onCancel: () => void;
  onImport: (options: { replaceClosedTabs: boolean }) => void;
  parsed: ParsedImport;
}

/**
 * Shows what an import file holds before anything is imported. Replacing closed tabs is a separate
 * choice that starts off: a file moved from another browser holds that browser's closed tabs, and
 * importing them would erase the ones here.
 */
export default function ImportConfirm({
  closedTabCount,
  onCancel,
  onImport,
  parsed,
}: ImportConfirmProps) {
  const [replaceClosedTabs, setReplaceClosedTabs] = useState(false);
  const replaceId = useId();
  const hasSettings = parsed.theme != null || Object.keys(parsed.settings).length > 0;
  const fileClosedTabCount = parsed.closedTabs?.savedTabs.length ?? 0;

  return (
    <div className="alert alert-warning">
      <strong>{chrome.i18n.getMessage("options_importExport_confirm_title")}</strong>
      <ul className="mb-2 mt-1 ps-3">
        <li>
          {chrome.i18n.getMessage(
            hasSettings
              ? "options_importExport_confirm_settings"
              : "options_importExport_confirm_noSettings",
          )}
        </li>
        {parsed.skippedSettings.length > 0 && (
          <li>
            {chrome.i18n.getMessage("options_importExport_confirm_skipped", [
              parsed.skippedSettings.join(", "),
            ])}
          </li>
        )}
      </ul>
      {/* Never offered for a file without closed tabs: there would be nothing to replace them with. */}
      {fileClosedTabCount > 0 && (
        <div className="form-check mb-2">
          <input
            checked={replaceClosedTabs}
            className="form-check-input"
            id={replaceId}
            onChange={(event) => {
              setReplaceClosedTabs(event.target.checked);
            }}
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
      <div className="d-flex gap-2">
        <Button
          disabled={!hasSettings && !replaceClosedTabs}
          onClick={() => {
            onImport({ replaceClosedTabs });
          }}
          size="sm"
          type="button"
          variant="primary"
        >
          {chrome.i18n.getMessage("options_importExport_import")}
        </Button>
        <Button onClick={onCancel} size="sm" type="button" variant="secondary">
          {chrome.i18n.getMessage("options_importExport_cancel")}
        </Button>
      </div>
    </div>
  );
}
