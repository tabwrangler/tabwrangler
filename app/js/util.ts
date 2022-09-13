// Unpack TabWrangler from the extension's background page.
export function getTW() {
  const backgroundPage = chrome.extension.getBackgroundPage();
  if (backgroundPage == null)
    throw new Error("Re-open the popup. (Background page does not exist.)");
  return backgroundPage.TW;
}
