import TabManager from "./tabmanager";
import settings from "./settings";

function getDomain(url: string): string | null {
  const match = url.match(/[^:]+:\/\/([^/]+)\//);
  return match == null ? null : match[1];
}

/**
 * Creates and updates context menus and page action menus.
 */
export default class Menus {
  lockDomainId: number | string | null;
  lockTabId: number | string | null;
  tabManager: TabManager;

  constructor(tabManager: TabManager) {
    this.tabManager = tabManager;

    const lockTab: chrome.contextMenus.CreateProperties = {
      type: "checkbox",
      title: chrome.i18n.getMessage("contextMenu_lockTab") || "",
      onclick: this.lockTab,
    };

    const lockDomain: chrome.contextMenus.CreateProperties = {
      type: "checkbox",
      title: chrome.i18n.getMessage("contextMenu_lockDomain") || "",
      onclick: this.lockDomain,
    };

    const corralTab: chrome.contextMenus.CreateProperties = {
      type: "normal",
      title: chrome.i18n.getMessage("contextMenu_corralTab") || "",
      onclick: this.corralTab,
    };

    this.lockTabId = chrome.contextMenus.create(lockTab);
    this.lockDomainId = chrome.contextMenus.create(lockDomain);
    chrome.contextMenus.create(corralTab);
  }

  lockTab(_onClickData: unknown, selectedTab: chrome.tabs.Tab) {
    if (selectedTab.id == null) return;
    settings.lockTab(selectedTab.id);
  }

  lockDomain(_onClickData: unknown, selectedTab: chrome.tabs.Tab) {
    // Tabs don't necessarily have URLs. In those cases there is no domain to lock.
    if (selectedTab.url == null) return;

    // If the URL doesn't match our bulletproof regexp for discovering the domain, do nothing
    // because we have no domain to lock.
    const domain = getDomain(selectedTab.url);
    if (domain == null) return;

    const whitelist = settings.get<Array<string>>("whitelist");
    whitelist.push(domain);
    settings.set("whitelist", whitelist);
  }

  corralTab(_onClickData: unknown, selectedTab: chrome.tabs.Tab) {
    this.tabManager.wrangleTabs([selectedTab]);
  }

  updateContextMenus(tabId: number) {
    chrome.tabs.get(tabId, (tab) => {
      // Sets the title again for each page.
      if (this.lockDomainId != null)
        try {
          if (tab.url == null) return;
          const currentDomain = getDomain(tab.url);
          if (currentDomain == null) return;
          chrome.contextMenus.update(Number(this.lockDomainId), {
            title: chrome.i18n.getMessage("contextMenu_lockSpecificDomain", currentDomain) || "",
          });
        } catch (e) {
          console.log(tab, "Error in updating menu");
          throw e;
        }

      if (this.lockTabId != null)
        chrome.contextMenus.update(Number(this.lockTabId), {
          checked: settings.isTabLocked(tab),
        });
    });
  }
}
