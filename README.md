 [![Crowdin](https://d322cqt584bo4o.cloudfront.net/tab-wrangler/localized.svg)](https://crowdin.com/project/tab-wrangler)

<h1 align="center">
 Tab Wrangler
</h1>

A Chrome & Firefox extension that automatically closes tabs you haven't used in a while so you can
focus on the tabs that matter

* [Installation](#installation)
* [Features](#features)
* [Usage](#usage)
  * [Backup & Restore](#back-up--restore)
  * [Settings](#settings)
* [Privacy Policy](#privacy-policy)
  * [Explanation of Requested Permissions](#explanation-of-requested-permissions)
* [Contributing](#contributing)
  * [Translation](#translation)
  * [Development](#development)

## Installation

* Tab Wrangler for Chrome:
  https://chrome.google.com/extensions/detail/egnjhciaieeiiohknchakcodbpgjnchh
* Tab Wrangler for Firefox: https://addons.mozilla.org/en-US/firefox/addon/tabwrangler/

## Features

* *The Corral*: Stores tabs which have been auto-closed so you can re-open as required.
* *Exclude list*: Provide the urls or domain names of the sites you never want auto-closed.
* *Tab Lock*: Pick open tabs to "lock".  Locked tabs will not be auto-closed.
* *Configurable*: Pick how long a tab should be considered ready to close and how many tabs should
  be open at a minimum.
* *Smart*: Doesn't autoclose pinned tabs, doesn't close all your tabs, just enough to make your
  browser usable.

## Usage

1. Click on the icon next to the URL bar
    * Tab Corral
      * Stores tabs which have been auto-closed. Restoring tabs with green leaf icons on their right
        sides will have their full history and scroll positions saved. (Full history restore is
        limited by the browser to the last 25 closed tabs.)
    * Tab Lock
      * Selectively lock tabs which you want to stay open.
      * See the time remaining before each tab will be checked for auto-closing.
    * Options
      * Whitelist certain URLs to never be closed.
      * Set the amount of time to wait before closing inactive tabs.
      * Set the ideal number of tabs to have in your browser.
      * Configure keyboard shortcuts.

### Back up & Restore

You can back up your list of closed tabs as well as the number of tabs Tab Wrangler has closed by
using the import/export functionality in the Settings tab.

#### Back up / Export

1. Open Tab Wrangler
2. Switch to the *Settings* tab
3. Scroll to *Import / Export*
4. Click *Export*

#### Restore / Import

If you previously backed up / exported your list of tabs, follow these steps to restore the list in
Tab Wrangler. **Note: this will overwrite Tab Wrangler's tabs list;** ensure you are not overwriting
tabs that you wanted to save.

1. Open Tab Wrangler
2. Switch to the *Settings* tab
3. Scroll to *Import / Export*
4. Click *Import*
5. Select the file created during back up, it will be named similarly to
   "TabWranglerExport-6-18-2017.json"

### Settings

Tab Wrangler's settings are saved and synced by your browser, like [Chrome sync][0] for example, to
all of your logged in browser sessions if you have sync enabled. Their possible values and their
usages are described in the following table:

| Setting               | Default                   | Possible Values                                             | Description                                                                                            |
| --------------------- | ------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `checkInterval`       | `5000`                    | `0` < `checkInterval`                                       | How often Tab Wrangler should check for stale tabs to close (in milliseconds)                          |
| `corralTabSortOrder`  | `null`                    | `null, 'alpha', 'reverseAlpha', 'chrono', 'reverseChrono', 'domain', 'reverseDomain'` | Saved sort order for closed tabs. When `null`, defaults to `'reverseChrono'` |
| `debounceOnActivated` | `false`                   |                                                             | Whether to wait 1 second before resetting the active tab's timer                                       |
| `filterAudio`         | `false`                   |                                                             | Whether to prevent auto-closing tabs that are playing audio                                            |
| `lockedIds`           | `[]`                      |                                                             | Array of tab IDs that have been explicitly locked by the user                                          |
| `lockTabSortOrder`    | `null`                    | `null, 'chrono', 'reverseChrono', 'tabOrder', 'reverseTabOrder'` | Saved sort order for open tabs. When `null`, defaults to `'tabOrder'`                             |
| `maxTabs`             | `100`                     | `0` <= `maxTabs` <= `1000`                                  | Maximum number of tabs to keep in the tab list                                                         |
| `minTabs`             | `5`                       | `0` <= `minTabs`                                            | Auto-close tabs only if there are more than this number open                                           |
| `minutesInactive`     | `20`                      | `0` <= `minutesInactive`                                    | How much time (+ `secondsInactive`) before a tab is considered "stale" and ready to close              |
| `paused`              | `false`                   |                                                             | Whether TabWrangler is paused (shouldn't count down)                                                   |
| `purgeClosedTabs`     | `false`                   |                                                             | Whether to empty the closed tab list when the browser closes                                           |
| `secondsInactive`     | `0`                       | `0` <= `secondsInactive`                                    | How much time (+ `minutesInactive`) before a tab is considered "stale" and ready to close              |
| `showBadgeCount`      | `false`                   |                                                             | Whether to show the length of the closed tab list as a badge on the URL bar icon                       |
| `theme`               | `'system'`                | `'dark'`, `'light'`, `'system'`                             | The color theme to use for Tab Wrangler's popup                                                        |
| `whitelist`           | `['about:', 'chrome://']` |                                                             | Array of patterns to check against.  If a tab's URL matches a pattern, the tab is never auto-closed    |
| `wrangleOption`       | `'withDupes'`             | `'exactURLMatch'`, `'hostnameAndTitleMatch'`, `'withDupes'` | How to handle duplicate entries in the closed tabs list                                                |

## Privacy Policy

Tab Wrangler does not transmit any data about you or your usage of Tab Wrangler. There is no
tracking, there are no analytics, and there are no advertisements.

Tab Wrangler **does not have** nor does it request the ability to read information on the web
pages that you visit. Tab Wrangler is able to read the title and current location (the URL) of
your tabs but not the content inside those tabs.

### Explanation of Requested Permissions

Tab Wrangler's requested permissions are listed in its [manifest.json][manifest.json] under the
`"permissions"` key.

* [`"contextMenus"`][3] Enables a "Tab Wrangler" menu item when you right click on a webpage that
  lets you send the tab to the Tab Corral, lock that tab, or lock all tabs on that domain.
* [`"sessions"`][4] Enables Tab Wrangler to read and restore the full history of a tab including
  enabling the back/forward buttons and your scroll position on the page.
* [`"storage"`][5]: Enables Tab Wrangler to sync your Tab Wrangler settings with your browser
  account and enables saving your closed tabs to your local computer. *Note: closed tabs are not
  synced because the "sync" storage area has only a small amount of storage.*
* [`"tabs"`][6]: Enables Tab Wrangler to read the title and location of any current tabs as well
  as close those tabs and open new tabs. This permission **does not** enable Tab Wrangler to
  read information on web pages that you visit.

## Contributing

### Translation

[Tab Wrangler's Crowdin Project][1]: the place to contribute and view translations

Tab Wrangler is available in other languages thanks to generous translation help. Any help
translating Tab Wrangler is greatly appreciated and can be done via Crowdin.

* 🇫🇷 French translation by [orpheuslummis](https://orpheuslummis.info)
* 🇩🇪 German translation by [ingorichter](https://github.com/ingorichter)
* 🇰🇷 Korean translation by [simple-is-best](https://github.com/simple-is-best)
* 🇷🇺 Russian translation by [Voknehzyr](https://github.com/Voknehzyr)

### Development

Pull requests for bug fixes and features are more than welcome. Please check out the
["Developing" section][2] of the CONTRIBUTING doc to see how to get started. Once your code is
working and tested, submit a pull request to this primary project and we'll get going.

* Modernized and maintained by [ssorallen](https://github.com/ssorallen) in 2017
* Rewritten by [JacobSingh](https://github.com/jacobSingh) in 2012
* Original extension and idea by [jacktasia](https://github.com/jacktasia) in 2010

[0]: https://chrome.google.com/sync
[1]: https://crowdin.com/project/tab-wrangler
[2]: CONTRIBUTING.md#developing
[3]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/user_interface/Context_menu_items
[4]: https://developer.chrome.com/extensions/sessions
[5]: https://developer.chrome.com/extensions/storage
[6]: https://developer.chrome.com/extensions/tabs
[manifest.json]: https://github.com/tabwrangler/tabwrangler/blob/master/app/manifest.json
