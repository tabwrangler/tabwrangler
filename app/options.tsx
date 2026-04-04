import "./css/popup.scss";
import "@fortawesome/fontawesome-free/css/fontawesome.min.css";
import "./css/fontawesome-free-solid-woff-only.css";
import "react-virtualized/styles.css";
import App from "./js/App";
import OptionsPage from "./js/OptionsPage";
import { createRoot } from "react-dom/client";

const rootElement = document.getElementById("root");
if (rootElement == null)
  throw new Error("Could not find #root element. Re-open the options page to try again.");

const root = createRoot(rootElement);
root.render(
  <App>
    <OptionsPage />
  </App>,
);
