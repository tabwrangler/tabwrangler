# Tab Wrangler

Auto-closes tabs which you haven't used in awhile.

## Features

* *The Corral*: Stores tabs which have been auto-closed so you can re-open as required.
* *Exclude list*: Provide the urls or domain names of the sites you never want auto-closed.
* *Tab Lock*: Pick open tabs to "lock".  Locked tabs will not be auto-closed.
* *Configurable*: Pick how long a tab should be considered ready to close and how many tabs should
  be open at a minimum.
* *Smart*: Doesn't autoclose pinned tabs, doesn't close all your tabs,
  just enough to make your browser usable.

## Usage / Installation

1. Install the extension from the Chrome Web Store https://chrome.google.com/extensions/detail/egnjhciaieeiiohknchakcodbpgjnchh
2. Click on the icon next to the URL bar
    * Tab Corral
      * Stores tabs which have been auto-closed.
    * Tab Lock
      * Selectively lock tabs which you want to stay open
    * Options
      * Whitelist certain URLs to never be closed.
      * Set the # of minutes to wait before closing an inactive tab.
      * Set the ideal # of tabs to have in your browser.
      * Configure keyboard shortcuts

### Back up & Restore

It is possible to back up your list of closed tabs as well as the number of tabs Tab Wrangler has
closed by using the import/export functionality in the Settings tab.

#### Back up / Export

1. Open Tab Wrangler
2. Switch to the *Settings* tab
3. Scroll to *Import / Export*
4. Click *Export*

#### Restore / Import

If you previously backed up your tabs by backing up / exporting them, follow these steps to restore
the list in Tab Wrangler. Note: this will overwrite Tab Wrangler's tabs list; ensure you are not
overwriting tabs that you wanted to save.

1. Open Tab Wrangler
2. Switch to the *Settings* tab
3. Scroll to *Import / Export*
4. Click *Import*
5. Select the file created during back up, it will be named similarly to
   "TabWranglerExport-6-18-2017.json"

## Developing

1. Install all dependencies

        $ yarn install
2. Build, output, and watch the contents to `dist/`

        $ yarn run watch
3. Open the Extensions page in Chrome via *Window > Extensions*
4. Click "Load unpacked extension..." and select the `dist/` directory created in Step 2

### Building for Release

1. Create a .zip to upload to the Chrome Store with the `release` task

        $ yarn run release

## Credits

* Modernized by [ssorallen](https://github.com/ssorallen) in 2017.
* Rewritten by [JacobSingh](https://github.com/jacobSingh) in 2012.
* Original extension and idea by [jacktasia](https://github.com/jacktasia) in 2010.
