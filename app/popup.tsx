import "./css/popup.scss";
import "@fortawesome/fontawesome-free/css/fontawesome.min.css";
import "./css/fontawesome-free-solid-woff-only.css";
import "react-virtualized/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Store, applyMiddleware } from "@eduardoac-skimlinks/webext-redux";
import Popup from "./js/Popup";
import { Provider } from "react-redux";
import React from "react";
import ReactDOM from "react-dom";
import settings from "./js/settings";
import thunk from "redux-thunk";

const queryClient = new QueryClient();

function PopupWrapper() {
  const [store, setStore] = React.useState<Store>();
  const [isDelayed, setIsDelayed] = React.useState(false);
  const [isStoreReady, setIsStoreReady] = React.useState(false);
  const [isSettingsInit, setIsSettingsInit] = React.useState(false);

  React.useEffect(() => {
    // Initialize "proxy" store and apply Thunk middleware in order to dispatch thunk-style actions.
    // See https://github.com/tshaddix/webext-redux
    let newStore = new Store();
    const middleware = [thunk];
    newStore = applyMiddleware(newStore, ...middleware);
    setStore(newStore);
  }, []);

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
      console.info("[PopupWrapper]: awaiting settings.init");
      await settings.init();
      console.info("[PopupWrapper]: settings ready!");
      setIsSettingsInit(true);
    }
    initSettings();
  }, []);

  React.useEffect(() => {
    setIsStoreReady(false);
    async function readyStore() {
      if (store == null) {
        console.info("[PopupWrapper]: store undefined, noop");
        return;
      }
      console.info("[PopupWrapper]: awaiting store readiness");
      await store.ready();
      console.info("[PopupWrapper]: store ready!");
      setIsStoreReady(true);
    }
    readyStore();
  }, [store]);

  const isReady = store != null && isStoreReady && isSettingsInit;
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
    // When everything is initialized as expected, render normally.
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <Popup />
        </QueryClientProvider>
      </Provider>
    );
  }
}

const popupElement = document.getElementById("popup");
if (popupElement == null)
  throw new Error("Could not find #popup element. Re-open the popup to try again.");

ReactDOM.render(<PopupWrapper />, popupElement);

// The popup fires `pagehide` when the popup is going away. Make sure to unmount the component so
// it can unsubscribe from the Store events.
const unmountPopup = function unmountPopup() {
  ReactDOM.unmountComponentAtNode(popupElement);
  window.removeEventListener("pagehide", unmountPopup);
};

window.addEventListener("pagehide", unmountPopup);
