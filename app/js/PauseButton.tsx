import { pauseExtension, unpauseExtension } from "./storage";
import Button from "react-bootstrap/Button";
import { useMutation } from "@tanstack/react-query";
import { useStorageSyncPersistQuery } from "./storage";

export default function PauseButton() {
  const { data: storageSyncPersistData } = useStorageSyncPersistQuery();
  const pausedMutation = useMutation({
    mutationFn: (nextPaused: boolean) => (nextPaused ? pauseExtension() : unpauseExtension()),
  });

  function pause() {
    pausedMutation.mutate(true);
  }

  function play() {
    pausedMutation.mutate(false);
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
