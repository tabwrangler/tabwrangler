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
      onclick: this.lockTab.bind(this),
      title: chrome.i18n.getMessage("contextMenu_lockTab"),
      type: "checkbox",
    };

    const lockDomain: chrome.contextMenus.CreateProperties = {
      onclick: this.lockDomain.bind(this),
      title: chrome.i18n.getMessage("contextMenu_lockDomain"),
      type: "checkbox",
    };

    chrome.contextMenus.create({
      onclick: this.corralTab.bind(this),
      title: chrome.i18n.getMessage("contextMenu_corralTab"),
      type: "normal",
    });
    chrome.contextMenus.create({ type: "separator" });
    this.lockTabId = chrome.contextMenus.create(lockTab);
    this.lockDomainId = chrome.contextMenus.create(lockDomain);
  }

  lockTab(_onClickData: chrome.contextMenus.OnClickData, selectedTab: chrome.tabs.Tab) {
    if (selectedTab.id == null) return;
    settings.lockTab(selectedTab.id);
  }

  lockDomain({ wasChecked }: chrome.contextMenus.OnClickData, selectedTab: chrome.tabs.Tab) {
    // Tabs don't necessarily have URLs. In those cases there is no domain to lock.
    if (selectedTab.url == null) return;

    // If the URL doesn't match our regexp for discovering the domain, do nothing because we have no
    // domain to lock.
    const domain = getDomain(selectedTab.url);
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

          const whitelist = settings.get<Array<string>>("whitelist");
          chrome.contextMenus.update(Number(this.lockDomainId), {
            checked: whitelist.includes(currentDomain),
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
