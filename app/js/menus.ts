import TabManager from "./tabmanager";
import settings from "./settings";

function getDomain(url: string): string | null {
  const match = url.match(/[^:]+:\/\/([^/]+)\//);
  return match == null ? null : match[1];
}

export default class Menus {
  tabManager: TabManager | undefined;

  // Note: intended to be called only once, which is why this function is static. Context menus
  // should be once when the extension is installed.
  static install() {
    chrome.contextMenus.create({
      id: "corralTab",
      title: chrome.i18n.getMessage("contextMenu_corralTab"),
      type: "normal",
    });
    chrome.contextMenus.create({ id: "separator", type: "separator" });
    chrome.contextMenus.create({
      id: "lockTab",
      title: chrome.i18n.getMessage("contextMenu_lockTab"),
      type: "checkbox",
    });
    chrome.contextMenus.create({
      id: "lockDomain",
      title: chrome.i18n.getMessage("contextMenu_lockDomain"),
      type: "checkbox",
    });
  }

  constructor() {
    chrome.contextMenus.onClicked.addListener(this.onClicked.bind(this));
  }

  corralTab(_onClickData: unknown, tab?: chrome.tabs.Tab | undefined) {
    if (this.tabManager == null || tab == null) return;
    this.tabManager.wrangleTabs([tab]);
  }

  lockTab(_onClickData: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab | undefined) {
    if (tab?.id == null) return;
    settings.lockTab(tab.id);
  }

  lockDomain({ wasChecked }: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab | undefined) {
    // Tabs don't necessarily have URLs. In those cases there is no domain to lock.
    if (tab?.url == null) return;

    // If the URL doesn't match our regexp for discovering the domain, do nothing because we have no
    // domain to lock.
    const domain = getDomain(tab.url);
    if (domain == null) return;

    const whitelist = settings.get<Array<string>>("whitelist");
    if (wasChecked) {
      settings.set(
        "whitelist",
        whitelist.filter((d) => d !== domain)
      );
    } else {
      settings.set("whitelist", [...whitelist, domain]);
    }
  }

  onClicked(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab | undefined) {
    switch (info.menuItemId) {
      case "corralTab":
        this.corralTab(info, tab);
        break;
      case "lockDomain":
        this.lockDomain(info, tab);
        break;
      case "lockTab":
        this.lockTab(info, tab);
        break;
      default:
        // No-op, no known item was clicked so there is nothing to do.
        break;
    }
  }

  setTabManager(tabManager: TabManager) {
    this.tabManager = tabManager;
  }

  updateContextMenus(tabId: number) {
    chrome.tabs.get(tabId, (tab) => {
      // Sets the title again for each page.
      if (tab.url == null) return;
      const currentDomain = getDomain(tab.url);
      if (currentDomain == null) return;

      const whitelist = settings.get<Array<string>>("whitelist");
      chrome.contextMenus.update("lockDomain", {
        checked: whitelist.includes(currentDomain),
        title: chrome.i18n.getMessage("contextMenu_lockSpecificDomain", currentDomain) || "",
      });

      chrome.contextMenus.update("lockTab", {
        checked: settings.isTabLocked(tab),
      });
    });
  }
}
