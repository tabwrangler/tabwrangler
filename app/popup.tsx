import "./css/popup.scss";
import "@fortawesome/fontawesome-free/css/fontawesome.min.css";
import "./css/fontawesome-free-solid-woff-only.css";
import "react-virtualized/styles.css";
import { PersistGate } from "redux-persist/integration/react";
import Popup from "./js/Popup";
import { Provider } from "react-redux";
import React from "react";
import ReactDOM from "react-dom";
import configureStore from "./js/configureStore";
import { connect } from "react-redux";

const popupElement = document.getElementById("popup");

if (popupElement != null) {
  const backgroundPage = chrome.extension.getBackgroundPage();

  if (backgroundPage == null) {
    throw new Error("Reopen the page or popup. Background page does not exist.");
  }

  const { persistor, store } = configureStore();
  const ConnectedPopup = connect()(Popup);

  ReactDOM.render(
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ConnectedPopup />
      </PersistGate>
    </Provider>,
    popupElement
  );

  // The popup fires `pagehide` when the popup is going away. Make sure to unmount the component so
  // it can unsubscribe from the Store events.
  const unmountPopup = function unmountPopup() {
    ReactDOM.unmountComponentAtNode(popupElement);
    window.removeEventListener("pagehide", unmountPopup);
  };

  window.addEventListener("pagehide", unmountPopup);
}
