import { useId, useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";

interface ExportConfirmProps {
  closedTabCount: number;
  onCancel: () => void;
  onExport: (options: { includeClosedTabs: boolean }) => void;
  show: boolean;
}

export default function ExportConfirm({
  closedTabCount,
  onCancel,
  onExport,
  show,
}: ExportConfirmProps) {
  const [includeClosedTabs, setIncludeClosedTabs] = useState(true);
  const includeId = useId();

  return (
    <Modal centered onHide={onCancel} show={show}>
      <Modal.Header closeButton>
        <Modal.Title as="h5">
          {chrome.i18n.getMessage("options_importExport_exportConfirm_title")}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>{chrome.i18n.getMessage("options_importExport_exportConfirm_settings")}</p>
        <div className="form-check mb-0">
          <input
            checked={includeClosedTabs}
            className="form-check-input"
            id={includeId}
            onChange={(event) => setIncludeClosedTabs(event.target.checked)}
            type="checkbox"
          />
          <label className="form-check-label" htmlFor={includeId}>
            {chrome.i18n.getMessage("options_importExport_exportConfirm_closedTabs")}
          </label>
          <div className="form-text mt-0">
            {chrome.i18n.getMessage("options_importExport_exportConfirm_closedTabs_help", [
              closedTabCount.toLocaleString(),
            ])}
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onCancel} type="button" variant="secondary">
          {chrome.i18n.getMessage("options_importExport_cancel")}
        </Button>
        <Button onClick={() => onExport({ includeClosedTabs })} type="button" variant="primary">
          {chrome.i18n.getMessage("options_importExport_export")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
