import * as React from "react";
import { mutateStorageSyncPersist } from "./mutations";
import { useMutation } from "@tanstack/react-query";
import { useStorageSyncPersistQuery } from "./hooks";

export default function PauseButton() {
  const { data: settingsData } = useStorageSyncPersistQuery();
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
      className="btn btn-outline-dark btn-sm"
      disabled={settingsData == null}
      onClick={settingsData == null || !settingsData.paused ? pause : play}
      type="button"
    >
      {settingsData == null || !settingsData.paused ? (
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
