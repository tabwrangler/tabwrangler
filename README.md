# Tab Wrangler

Helps you focus by auto-closing tabs that you haven't used in a while.

## Features

* *The Corral*: Stores tabs which have been auto-closed so you can re-open as required.
* *Exclude list*: Provide the urls or domain names of the sites you never want auto-closed.
* *Tab Lock*: Pick open tabs to "lock".  Locked tabs will not be auto-closed.
* *Configurable*: Pick how long a tab should be considered ready to close and how many tabs should
  be open at a minimum.
* *Smart*: Doesn't autoclose pinned tabs, doesn't close all your tabs, just enough to make your
  browser usable.

## Installation

1. Install the extension from the Chrome Web Store https://chrome.google.com/extensions/detail/egnjhciaieeiiohknchakcodbpgjnchh

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

Tab Wrangler's settings are preserved when exporting. Their possible values and their usages are
described in the following table:

| Setting               | Default         | Possible Values   | Description |
| --------------------- | --------------- | ----------------- | ----------- |
| `checkInterval`       | `5000`          | `0` < `checkInterval` | How often Tab Wrangler should check for stale tabs to close (in milliseconds) |
| `debounceOnActivated` | `false`         |                   | Whether to wait 1 second before resetting the active tab's timer |
| `filterAudio`         | `false`         |                   | Whether to prevent auto-closing tabs that are playing audio |
| `lockedIds`           | `[]`            |                   | Array of tab IDs that have been explicitly locked by the user |
| `maxTabs`             | `100`           | `0` <= `maxTabs` <= `500` | Maximum number of tabs to keep in the tab list |
| `minTabs`             | `5`             | `0` <= `minTabs`          | Auto-close tabs only if there are more than this number open |
| `minutesInactive`     | `20`            | `0` <= `minutesInactive`          | How much time (+ `secondsInactive`) before a tab is considered "stale" and ready to close |
| `paused`              | `false`         |                   | Whether TabWrangler is paused (shouldn't count down) |
| `purgeClosedTabs`     | `false`         |                   | Whether to empty the closed tab list when the browser closes |
| `secondsInactive`     | `0`             | `0` <= `secondsInactive`          | How much time (+ `minutesInactive`) before a tab is considered "stale" and ready to close |
| `showBadgeCount`      | `true`          |                   | Whether to show the length of the closed tab list as a badge on the URL bar icon |
| `whitelist`           | `['chrome://']` |                   | Array of patterns to check against.  If a tab's URL matches a pattern, the tab is never auto-closed |
| `wrangleOption`       | `'withDupes'`   | `'exactURLMatch'`, `'hostnameAndTitleMatch'`, `'withDupes'` | How to handle duplicate entries in the closed tabs list |

## Credits

### Translators

* 🇩🇪 German translation by [ingorichter](https://github.com/ingorichter)
* 🇰🇷 Korean translation by [simple-is-best](https://github.com/simple-is-best)
* 🇷🇺 Russian translation by [Voknehzyr](https://github.com/Voknehzyr)

See "[Contributing Translations](CONTRIBUTING.md#contributing-translations)" for how you can help
make Tab Wrangler available in more languages.

### Developers

* Modernized and maintained by [ssorallen](https://github.com/ssorallen) in 2017
* Rewritten by [JacobSingh](https://github.com/jacobSingh) in 2012
* Original extension and idea by [jacktasia](https://github.com/jacktasia) in 2010
