import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

async function mutatePaused(nextPaused: boolean) {
  const settingsData = await chrome.storage.sync.get({ "persist:settings": {} });
  return chrome.storage.sync.set({
    "persist:settings": { ...settingsData, paused: nextPaused },
  });
}

export default function PauseButton() {
  const { data: settingsData } = useQuery({
    queryFn: async () => {
      // `settings` was managed by redux-persit, which prefixed the data with "persist:"
      const data = await chrome.storage.sync.get({ "persist:settings": {} });
      return data["persist:settings"];
    },
    queryKey: ["settingsDataQuery"],
  });

  const queryClient = useQueryClient();
  React.useEffect(() => {
    function handleChanged(
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: chrome.storage.AreaName
    ) {
      if (areaName === "sync" && ["persist:settings"].some((key) => key in changes))
        queryClient.invalidateQueries({ queryKey: ["settingsDataQuery"] });
    }
    chrome.storage.onChanged.addListener(handleChanged);
    return () => chrome.storage.onChanged.removeListener(handleChanged);
  }, [queryClient]);

  const pausedMutation = useMutation({
    mutationFn: mutatePaused,
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
