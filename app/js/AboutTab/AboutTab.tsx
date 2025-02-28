import * as React from "react";

export default function AboutTab() {
  return (
    <div className="tab-pane active">
      <p>
        <a href={EXTENSION_URL} rel="noopener noreferrer" target="_blank">
          {chrome.i18n.getMessage("extName")}
        </a>{" "}
        v{chrome.runtime.getManifest().version}
      </p>
      <ul>
        <li>
          <a
            href="https://github.com/tabwrangler/tabwrangler/releases"
            rel="noopener noreferrer"
            target="_blank"
          >
            {chrome.i18n.getMessage("about_changeLog")}
          </a>
        </li>
        <li>
          <a
            href="https://github.com/tabwrangler/tabwrangler/issues"
            rel="noopener noreferrer"
            target="_blank"
          >
            {chrome.i18n.getMessage("about_support")}
          </a>
        </li>
        <li>
          <a
            href="https://github.com/tabwrangler/tabwrangler"
            rel="noopener noreferrer"
            target="_blank"
          >
            {chrome.i18n.getMessage("about_sourceCode")}
          </a>
        </li>
      </ul>
    </div>
  );
}
