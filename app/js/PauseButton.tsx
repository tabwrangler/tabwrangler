import * as React from "react";
import { mutateStorageSyncPersist } from "./storage";
import { useMutation } from "@tanstack/react-query";
import { useStorageSyncPersistQuery } from "./storage";

export default function PauseButton() {
  const { data: storageSyncPersistData } = useStorageSyncPersistQuery();
  const pausedMutation = useMutation({
    mutationFn: (nextPaused: boolean) =>
      mutateStorageSyncPersist({ key: "paused", value: nextPaused }),
  });

  function pause() {
    pausedMutation.mutate(true);
  }

  function play() {
    pausedMutation.mutate(false);
  }

  return (
    <button
      className="btn btn-secondary btn-sm"
      disabled={storageSyncPersistData == null}
      onClick={storageSyncPersistData == null || !storageSyncPersistData.paused ? pause : play}
      type="button"
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
    </button>
  );
}
