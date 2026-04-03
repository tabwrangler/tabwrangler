import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LazyImageProvider } from "./LazyImage/LazyImage";
import React from "react";
import settings from "./settings";

const queryClient = new QueryClient();

export default function App({ children }: { children: React.ReactNode }) {
  const [isDelayed, setIsDelayed] = React.useState(false);
  const [isSettingsInit, setIsSettingsInit] = React.useState(false);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setIsDelayed(true);
    }, 2500);
    return () => {
      clearTimeout(timeout);
    };
  }, []);

  React.useEffect(() => {
    async function initSettings() {
      // Await settings that are loaded from async browser storage before rendering.
      console.debug("[App]: awaiting settings.init");
      await settings.init();
      console.debug("[App]: settings ready!");
      setIsSettingsInit(true);
    }
    initSettings();
  }, []);

  const isReady = isSettingsInit;
  if (!isReady && !isDelayed) {
    // Render nothing initially, this happens every time the popup is opened. Start with nothing so
    // there is no flash of unneeded UI if the popup is going to render correctly.
    return <></>;
  } else if (!isReady) {
    // If there is a delay in initializing the connection to the background script, give the user
    // the ability to refresh the runtime and restart that background script. This is for the
    // rare case of https://crbug.com/1316588 not restarting the background script.
    return (
      <div style={{ margin: "0.75em 1em" }}>
        <div style={{ marginBottom: "0.75em" }}>Loading…</div>
        <button
          onClick={() => {
            chrome.runtime.sendMessage("reload");
          }}
        >
          Reload 🔄
        </button>
      </div>
    );
  } else {
    return (
      <QueryClientProvider client={queryClient}>
        <LazyImageProvider>{children}</LazyImageProvider>
      </QueryClientProvider>
    );
  }
}
