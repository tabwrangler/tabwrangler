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
import settings from "./js/settings";

const popupElement = document.getElementById("popup");

if (popupElement != null) {
  const { persistor, store } = configureStore();
  settings.init();

  ReactDOM.render(
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <Popup />
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
