import { OverlayTrigger, Tooltip } from "react-bootstrap";
import { pauseExtension, unpauseExtension } from "./storage";
import Button from "react-bootstrap/Button";
import { formatActiveHoursChange } from "./activeHours";
import useActiveHoursState from "./useActiveHoursState";
import { useMutation } from "@tanstack/react-query";
import { useStorageSyncPersistQuery } from "./storage";

export default function PauseButton() {
  const { data: storageSyncPersistData } = useStorageSyncPersistQuery();
  const activeHoursState = useActiveHoursState();
  const pausedMutation = useMutation({
    mutationFn: (nextPaused: boolean) => (nextPaused ? pauseExtension() : unpauseExtension()),
  });

  function pause() {
    pausedMutation.mutate(true);
  }

  function play() {
    pausedMutation.mutate(false);
  }

  // Outside active hours the schedule pauses Tab Wrangler, and only editing it resumes early. A
  // manual pause outlasts active hours, so it keeps its own Resume button.
  if (!activeHoursState.active && !storageSyncPersistData?.paused) {
    // A disabled button gets no pointer events, so the wrapper shows the tooltip.
    return (
      <OverlayTrigger
        overlay={
          <Tooltip>
            {activeHoursState.nextChangeAt == null
              ? chrome.i18n.getMessage("activeHours_noActiveHours")
              : chrome.i18n.getMessage(
                  "activeHours_pausedUntil",
                  formatActiveHoursChange(activeHoursState.nextChangeAt, activeHoursState.now),
                )}
          </Tooltip>
        }
        placement="bottom"
      >
        <span className="d-inline-block" tabIndex={0}>
          <Button
            disabled
            size="sm"
            style={{ pointerEvents: "none" }}
            type="button"
            variant="secondary"
          >
            <i className="fas fa-play" /> {chrome.i18n.getMessage("extension_resume")}
          </Button>
        </span>
      </OverlayTrigger>
    );
  }

  return (
    <Button
      disabled={storageSyncPersistData == null}
      onClick={storageSyncPersistData == null || !storageSyncPersistData.paused ? pause : play}
      size="sm"
      type="button"
      variant="secondary"
    >
      {storageSyncPersistData == null || !storageSyncPersistData.paused ? (
        <>
          <i className="fas fa-pause" /> {chrome.i18n.getMessage("extension_pause")}
        </>
      ) : (
        <>
          <i className="fas fa-play" /> {chrome.i18n.getMessage("extension_resume")}
        </>
      )}
    </Button>
  );
}
