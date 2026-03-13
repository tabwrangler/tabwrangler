import "./css/popup.scss";
import "@fortawesome/fontawesome-free/css/fontawesome.min.css";
import "./css/fontawesome-free-solid-woff-only.css";
import "react-virtualized/styles.css";
import App from "./js/App";
import React from "react";
import { createRoot } from "react-dom/client";

const rootElement = document.getElementById("root");
if (rootElement == null)
  throw new Error("Could not find #root element. Re-open the popup to try again.");

const root = createRoot(rootElement);
root.render(<App isOptionsPage={false} />);

// The popup fires `pagehide` when the popup is going away. Make sure to unmount the component so
// it can unsubscribe from the Store events.
const unmountPopup = function unmountPopup() {
  root.unmount();
  window.removeEventListener("pagehide", unmountPopup);
};

window.addEventListener("pagehide", unmountPopup);
