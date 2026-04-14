[![Crowdin](https://d322cqt584bo4o.cloudfront.net/tab-wrangler/localized.svg)](https://crowdin.com/project/tab-wrangler)

<div align="center">
  <img src="./app/img/icon.png">
  <h1>
    Tab Wrangler
  </h1>
</div>

A Chrome & Firefox extension that automatically closes tabs you haven't used in a while so you can
focus on the tabs that matter

- [Installation](#installation)
- [Features](#features)
- [Usage](#usage)
  - [Tab Corral](#tab-corral)
  - [Tab Lock](#tab-lock)
  - [Options Tab](#options-tab)
    - [All Saved Settings](#all-saved-settings)
    - [Back up & Restore](#back-up--restore)
- [Privacy Policy](#privacy-policy)
  - [Explanation of Requested Permissions](#explanation-of-requested-permissions)
- [Contributing](#contributing)
  - [Translation](#translation)
  - [Development](#development)

## Installation

- Tab Wrangler for Chrome:
  https://chromewebstore.google.com/detail/tab-wrangler/egnjhciaieeiiohknchakcodbpgjnchh
- Tab Wrangler for Firefox: https://addons.mozilla.org/en-US/firefox/addon/tabwrangler/

## Features

- _Automatic tab closing_: Tabs you haven't visited in a while (1 hour by default) are
  automatically closed, keeping your browser fast and uncluttered.
- _The Tab Corral_: Every tab Tab Wrangler closes is saved to the Tab Corral — a searchable,
  sortable list inside the extension. You can browse closed tabs by title or URL and restore any
  of them with a single click.
- _Full session restore_: Tabs marked with a 🌿 icon in the Corral can be restored with their full
  browsing history and scroll position intact, so the back button still works after you reopen them.
  (Limited to the most recent 25 closed tabs by the browser.)
- _Tab Lock_: Lock individual tabs to prevent them from being auto-closed. You can also lock entire
  browser windows at once. Locked tabs stay open no matter how long they've been inactive.
- _Exclude list_: Add a website address or domain to the exclude list and Tab Wrangler will never
  close tabs from that site. For example, adding `mail.google.com` keeps your Gmail tab open
  indefinitely.
- _Audio & Tab Group protection_: Optionally keep tabs that are playing audio, or tabs that belong
  to a tab group, from being auto-closed.
- _Minimum open tabs_: Set a floor — Tab Wrangler won't close any tabs if you have fewer than this
  number open, either per window or across all windows combined.
- _Right-click menu_: Right-click on any webpage to instantly send that tab to the Corral, lock the
  tab, or lock all tabs from that domain — without opening the extension popup.
- _Pause and resume_: Temporarily stop all auto-closing with one click, then resume when you're
  ready.
- _Pinned and active tabs are always safe_: The tab you're looking at right now and any pinned tabs
  are never auto-closed.
- _Synced settings_: Your Tab Wrangler preferences sync automatically across all browsers where
  you're signed in.

## Usage

Click the Tab Wrangler icon next to the address bar to open the popup. It has three tabs:

### Tab Corral

The Tab Corral is your saved list of every tab Tab Wrangler has automatically closed.

- **Restore a tab**: Click any row to reopen that tab. Tabs marked with a 🌿 icon will restore with
  their full browsing history (back/forward buttons) and scroll position.
- **Search**: Use the search box to filter tabs by title or URL.
- **Sort**: Sort the list by close time, page title, domain name, or time the tab was open.
- **Remove**: Delete individual saved tabs from the list, or clear the entire Tab Corral at once.
- **Statistics**: The header shows how many tabs Tab Wrangler has closed in total.

### Tab Lock

The Tab Lock view shows all of your currently open tabs and lets you control which ones Tab
Wrangler is allowed to close.

- **Countdown timer**: Each tab shows the time remaining before Tab Wrangler will close it. Once
  the timer reaches zero Tab Wrangler will close the tab as soon as it can. Focusing a tab resets
  its timer.
- **Lock a tab**: Click the lock icon on any tab row to lock that tab. Locked tabs show a reason
  (e.g. "Locked", "Pinned", "Grouped") instead of a countdown.
- **Lock a window**: Use the lock button in a window's header to lock all current and future tabs in
  that window.
- **Minimum tabs indicator**: The badge in each window header (or at the top of the list) shows
  how many tabs are open versus your configured minimum. A yellow badge means Tab Wrangler is
  holding off on closing tabs because the minimum hasn't been reached yet.
- **Pause**: The extension can be paused from the popup header, stopping all countdowns and
  auto-closing until you resume it.
- **Sort**: Sort open tabs by time remaining, tab order, or title.

### Options Tab

The Options tab lets you configure how Tab Wrangler behaves.

- **Inactive time**: How long a tab must be untouched before Tab Wrangler will close it. Set this
  in days, hours, minutes, and seconds.
- **Minimum tabs**: The minimum number of tabs that must be open before Tab Wrangler starts closing
  anything. Choose whether this minimum applies to each window individually or to all windows
  combined.
- **Exclude list**: Add website addresses or domains that should never be auto-closed.
- **Tabs playing audio**: Choose whether to protect tabs that are playing audio from being closed.
- **Tab Groups**: Choose whether to protect tabs inside a tab group from being closed.
- **Closed tabs storage**: Set the maximum number of closed tabs to keep in the Corral, and choose
  whether the list is cleared when you close your browser.
- **Duplicate tabs**: Control how Tab Wrangler handles saving a tab whose URL is already in the
  Corral.
- **Appearance**: Choose between light, dark, or system-matched theme for Tab Wrangler.
- **Icon badge**: Optionally show a count of saved tabs on the extension icon.
- **Keyboard shortcuts**: Configure keyboard shortcuts for common Tab Wrangler actions.
- **Import / Export**: Back up your saved tabs list and settings to a file, or restore from a
  previous backup.

#### All Saved Settings

Tab Wrangler's settings are saved and synced by your browser, like [Chrome sync][0] for example, to
all of your logged in browser sessions if you have sync enabled. Their possible values and their
usages are described in the following table:

<!-- prettier-ignore-start -->
<!-- Maintain vertical table layout with unlimited-length lines, ignore auto-formatting -->
| Setting               | Default                   | Possible Values                                                  | Description                                                                                            |
| --------------------- | ------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `corralTabSortOrder`  | `null`                    | `null, 'alpha', 'reverseAlpha', 'chrono', 'reverseChrono', 'domain', 'reverseDomain'` | Saved sort order for closed tabs. When `null`, defaults to `'reverseChrono'`      |
| `createContextMenu`   | `true`                    | `false`, `true`                                                  | When `true`, create a context menu for accessing Tab Wrangler functionality on click                   |
| `debounceOnActivated` | `true`                    |                                                                  | Whether to wait 1 second before resetting the active tab's timer                                       |
| `filterAudio`         | `false`                   |                                                                  | Whether to prevent auto-closing tabs that are playing audio                                            |
| `filterGroupedTabs`   | `false`                   |                                                                  | Whether to prevent auto-closing tabs that are members of a tab group. Requires browser support for the standard `chrome.tabGroups` API (Chrome, Edge, Brave). **Vivaldi's Tab Stacks are not supported** because Vivaldi does not implement the standard tab groups API; use the whitelist or Tab Lock as a workaround. |
| `lockedIds`           | `[]`                      |                                                                  | Array of tab IDs that have been explicitly locked by the user                                          |
| `lockTabSortOrder`    | `null`                    | `null, 'chrono', 'reverseChrono', 'tabOrder', 'reverseTabOrder'` | Saved sort order for open tabs. When `null`, defaults to `'tabOrder'`                                  |
| `maxTabs`             | `1000`                    | `0` <= `maxTabs` <= `1,000+`                                     | Maximum number of wrangled tabs to store - exact number determined by browser storage quota            |
| `minTabs`             | `20`                      | `0` <= `minTabs`                                                 | Auto-close tabs only if there are more than this number open                                           |
| `minutesInactive`     | `60`                      | `0` <= `minutesInactive`                                         | How much time (+ `secondsInactive`) before a tab is considered "stale" and ready to close              |
| `paused`              | `false`                   |                                                                  | Whether TabWrangler is paused (shouldn't count down)                                                   |
| `purgeClosedTabs`     | `false`                   |                                                                  | Whether to empty the closed tab list when the browser closes                                           |
| `secondsInactive`     | `0`                       | `0` <= `secondsInactive`                                         | How much time (+ `minutesInactive`) before a tab is considered "stale" and ready to close              |
| `showBadgeCount`      | `false`                   |                                                                  | Whether to show the length of the closed tab list as a badge on the URL bar icon                       |
| `theme`               | `'system'`                | `'dark'`, `'light'`, `'system'`                                  | The color theme to use for Tab Wrangler's popup                                                        |
| `whitelist`           | `['about:', 'chrome://']` |                                                                  | Array of patterns to check against.  If a tab's URL matches a pattern, the tab is never auto-closed    |
| `wrangleOption`       | `'withDupes'`             | `'exactURLMatch'`, `'hostnameAndTitleMatch'`, `'withDupes'`      | How to handle duplicate entries in the closed tabs list                                                |
<!-- prettier-ignore-end -->

##### `maxTabs`

The upper bound of `maxTabs` is determined by the [browser's storage quota][8] and can vary. Tab
Wrangler will display an error message if the setting is adjusted above what is allowed by the
browser.

#### Back up & Restore

You can back up your list of closed tabs as well as the number of tabs Tab Wrangler has closed by
using the import/export functionality in the Settings tab.

##### Back up / Export

1. Open Tab Wrangler
2. Switch to the _Settings_ tab
3. Scroll to _Import / Export_
4. Click _Export_

##### Restore / Import

If you previously backed up / exported your list of tabs, follow these steps to restore the list in
Tab Wrangler. **Note: this will overwrite Tab Wrangler's tabs list;** ensure you are not overwriting
tabs that you wanted to save.

1. Open Tab Wrangler
2. Switch to the _Settings_ tab
3. Scroll to _Import / Export_
4. Click _Import_
5. Select the file created during back up, it will be named similarly to
   "TabWranglerExport-6-18-2017.json"

##### Back up file format

The "Back up / Export" button creates a JSON file with saved tabs and other usage data. The JSON
file has the following format:

```ts
/**
 * The `chrome.tabs.Tab` type comes from `@types/chrome`
 * @see https://github.com/DefinitelyTyped/DefinitelyTyped/blob/d693ab3ced5aa2b8d86838f721006b16414bb21e/types/chrome/index.d.ts#L9406
 */
type TabWranglerExportFormat = {
  savedTabs: Array<chrome.tabs.Tab>,
  totalTabsRemoved: number,
  totalTabsUnwrangled: number,
  totalTabsWrangled: number
};
```

## Privacy Policy

Tab Wrangler does not transmit any data about you or your usage of Tab Wrangler. There is no
tracking, there are no analytics, and there are no advertisements.

Tab Wrangler **does not have** nor does it request the ability to read information on the web
pages that you visit. Tab Wrangler is able to read the title and current location (the URL) of
your tabs but not the content inside those tabs.

### Explanation of Requested Permissions

Tab Wrangler's requested permissions are listed in its
[manifest.json](app/manifest.template.json#L29-L35) under the `"permissions"` key.

- [`"alarms"`][7]: Allows creating alarms to periodically check Tab Wrangler's background script
  that checks for stale tabs is running and healthy.
- [`"contextMenus"`][3]: Allows a "Tab Wrangler" menu item when you right click on a webpage that
  lets you send the tab to the Tab Corral, lock that tab, or lock all tabs on that domain.
- [`"favicons"`][9]: (_Chrome only_) Allows access to local favicon images of current and past tabs.
  This prevents having to make a network request to fetch a tab's favicon, improving privacy and
  offline capability.
- [`"sessions"`][4]: Allows reading and restoring the full history of tabs including enabling the
  back/forward buttons and your scroll position on those pages.
- [`"storage"`][5]: Allows syncing your Tab Wrangler settings with your browser account and enables
  saving your closed tabs to your local computer. _Note: closed tabs are not synced because the
  "sync" storage area has only a small amount of storage._
- [`"tabGroups"`][10]: Allows creating tab groups and reading their details, like their color, to
  show matching tab group colors in Tab Wrangler's own interface.
- [`"tabs"`][6]: Allows reading the title and location of any current tabs as well as closing those
  tabs and opening new tabs. This permission **does not** enable Tab Wrangler to read information on
  web pages that you visit.

## Contributing

### Translation

[Tab Wrangler's Crowdin Project][1]: the place to contribute and view translations

Tab Wrangler is available in other languages thanks to generous translation help. Any help
translating Tab Wrangler is greatly appreciated and can be done via Crowdin. Contributors
include the following:

🇨🇳 Chinese (Simplified) by [yfdyh000](https://crowdin.com/profile/yfdyh000),
🇹🇼 Chinese (Traditional) by [ingrid123](https://crowdin.com/profile/ingrid123) and [xbddc.ho](https://crowdin.com/profile/xbddc.ho),
🇫🇷 French by [orpheuslummis](https://crowdin.com/profile/orpheuslummis) and [bkazez](https://crowdin.com/profile/bkazez),
🇩🇪 German by [johannesfischer](https://crowdin.com/profile/johannesfischer),
🇭🇺 Hungarian by [kottalovag](https://crowdin.com/profile/kottalovag),
🇮🇩 Indonesian by [azhe403](https://crowdin.com/profile/azhe403),
🇰🇷 Korean by [x_nuk](https://crowdin.com/profile/x_nuk),
🇱🇻 Latvian by [coool](https://crowdin.com/profile/coool),
🇵🇱 Polish by [imjusttony](https://crowdin.com/profile/imjusttony),
🇧🇷 Portuguese, Brazilian by [RavenaStar](https://crowdin.com/profile/RavenaStar),
🇷🇺 Russian by [sdir01](https://crowdin.com/profile/sdir01) and [coool](https://crowdin.com/profile/coool),
🇪🇸 Spanish by [julianjaramillo](https://crowdin.com/profile/julianjaramillo),
Tamil by [dineshr](https://crowdin.com/profile/dineshr),
🇺🇦 Ukrainian by [DepsCian](https://crowdin.com/profile/depscian)

### Development

Pull requests for bug fixes and features are more than welcome. Please check out the
["Developing" section][2] of the CONTRIBUTING doc to see how to get started. Once your code is
working and tested, submit a pull request to this primary project and we'll get going.

- Modernized and maintained by [ssorallen](https://github.com/ssorallen) since 2017
- Rewritten by [JacobSingh](https://github.com/jacobSingh) in 2012
- Original extension and idea by [jacktasia](https://github.com/jacktasia) in 2010

[0]: https://chrome.google.com/sync
[1]: https://crowdin.com/project/tab-wrangler
[2]: CONTRIBUTING.md#developing
[3]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/user_interface/Context_menu_items
[4]: https://developer.chrome.com/extensions/sessions
[5]: https://developer.chrome.com/extensions/storage
[6]: https://developer.chrome.com/extensions/tabs
[manifest.json]: https://github.com/tabwrangler/tabwrangler/blob/main/app/manifest.json
[7]: https://developer.chrome.com/docs/extensions/reference/alarms/
[8]: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
[9]: https://developer.chrome.com/docs/extensions/how-to/ui/favicons
[10]: https://developer.chrome.com/docs/extensions/reference/api/tabGroups
