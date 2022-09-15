import settings from "./settings";
import tabmanager from "./tabmanager";

function getDomain(url: string): string | null {
  const match = url.match(/[^:]+:\/\/([^/]+)\//);
  return match == null ? null : match[1];
}

/**
 * Creates and updates context menus and page action menus.
 */
const Menus = {
  lockDomainId: null as number | string | null,
  lockTabId: null as number | string | null,
  lockWindowId: null as number | string | null,

  pageSpecificActions: {
    lockTab(onClickData: chrome.contextMenus.OnClickData, selectedTab: chrome.tabs.Tab) {
      if (selectedTab.id == null) return;
      tabmanager.lockTab(!!onClickData.checked, selectedTab.id);
    },

    lockDomain(onClickData: chrome.contextMenus.OnClickData, selectedTab: chrome.tabs.Tab) {
      // Chrome tabs don't necessarily have URLs. In those cases there is no domain to lock.
      if (selectedTab.url == null) return;

      // If the URL doesn't match our bulletproof regexp for discovering the domain, do nothing
      // because we have no domain to lock.
      const domain = getDomain(selectedTab.url);
      if (domain == null) return;

      const whitelist = settings.get<Array<string>>("whitelist");
      whitelist.push(domain);
      settings.set("whitelist", whitelist);
    },
    
    lockWindow(onClickData: chrome.contextMenus.OnClickData, selectedTab: chrome.tabs.Tab) {
      if (selectedTab.id == null) return;
      tabmanager.lockWindow(!!onClickData.checked, selectedTab.windowId);
    },

    corralTab(_onClickData: unknown, selectedTab: chrome.tabs.Tab) {
      tabmanager.closedTabs.wrangleTabs([selectedTab]);
    },
  },

  createContextMenus() {
    const lockTab: chrome.contextMenus.CreateProperties = {
      type: "checkbox",
      title: chrome.i18n.getMessage("contextMenu_lockTab") || "",
      onclick: this.pageSpecificActions["lockTab"],
    };

    const lockDomain: chrome.contextMenus.CreateProperties = {
      type: "checkbox",
      title: chrome.i18n.getMessage("contextMenu_lockDomain") || "",
      onclick: this.pageSpecificActions["lockDomain"],
    };
    
    const lockWindow: chrome.contextMenus.CreateProperties = {
      type: "checkbox",
      title: chrome.i18n.getMessage("contextMenu_lockWindow") || "",
      onclick: this.pageSpecificActions["lockWindow"],
    };

    const corralTab: chrome.contextMenus.CreateProperties = {
      type: "normal",
      title: chrome.i18n.getMessage("contextMenu_corralTab") || "",
      onclick: this.pageSpecificActions["corralTab"],
    };

    this.lockTabId = chrome.contextMenus.create(lockTab);
    this.lockDomainId = chrome.contextMenus.create(lockDomain);
    this.lockWindowId = chrome.contextMenus.create(lockWindow);
    chrome.contextMenus.create(corralTab);
  },

  updateContextMenus(tabId: number) {
    // Little bit of a kludge, would be nice to be DRY here but this was simpler.
    // Sets the title again for each page.
    const { lockDomainId } = this;
    if (lockDomainId != null)
      chrome.tabs.get(tabId, function (tab) {
        try {
          if (tab.url == null) return;
          const currentDomain = getDomain(tab.url);
          if (currentDomain == null) return;
          chrome.contextMenus.update(Number(lockDomainId), {
            title: chrome.i18n.getMessage("contextMenu_lockSpecificDomain", currentDomain) || "",
          });
        } catch (e) {
          console.log(tab, "Error in updating menu");
          throw e;
        }
      });

    if (this.lockTabId != null) {
      chrome.contextMenus.update(Number(this.lockTabId), { checked: tabmanager.isLockedTab(tabId) });
      chrome.contextMenus.update(Number(this.lockWindowId), { checked: tabmanager.isLockedWindow(tabId) });
    }
  },
};

export default Menus;
