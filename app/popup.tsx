import "./css/popup.scss";
import "@fortawesome/fontawesome-free/css/fontawesome.min.css";
import "./css/fontawesome-free-solid-woff-only.css";
import "react-virtualized/styles.css";
import { Store, applyMiddleware } from "@eduardoac-skimlinks/webext-redux";
import Popup from "./js/Popup";
import { Provider } from "react-redux";
import React from "react";
import ReactDOM from "react-dom";
import settings from "./js/settings";
import thunk from "redux-thunk";

async function render() {
  const popupElement = document.getElementById("popup");

  if (popupElement != null) {
    // Initialize "proxy" store and apply Thunk middleware in order to dispatch thunk-style actions.
    // See https://github.com/tshaddix/webext-redux
    let store = new Store();
    const middleware = [thunk];
    store = applyMiddleware(store, ...middleware);
    await store.ready();

    // Await settings that are loaded from async browser storage before rendering.
    await settings.init();

    ReactDOM.render(
      <Provider store={store}>
        <Popup />
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
}

render();
