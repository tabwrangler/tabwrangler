# Tab Wrangler

Auto-closes tabs which you haven't used in awhile.

## Features:

* *The Corral*: Stores tabs which have been auto-closed so you can re-open as required.
* *Exclude list*: Provide the urls or domain names of the sites you never want auto-closed.
* *Tab Lock*: Pick open tabs to "lock".  Locked tabs will not be auto-closed.
* *Configurable*: Pick how long a tab should be considered ready to close and how many tabs should
  be open at a minimum.
* *Smart*: Doesn't autoclose pinned tabs, doesn't close all your tabs,
  just enough to make your browser usable.

## Usage / Installation

* Install the extension
* Click on the icon next to the URL bar.
* Tab Corral
  * Stores tabs which have been auto-closed.
* Tab Lock
  * Selectively lock tabs which you want to stay open
* Options
  * Whitelist certain URLs to never be closed.
  * Set the # of minutes to wait before closing an inactive tab.
  * Set the ideal # of tabs to have in your browser.

## Developing

1. Install all dependencies

        npm install
2. Build, output, and watch the contents to `dist/`

        gulp watch
3. Open the Extensions page in Chrome via *Window > Extensions*
4. Click "Load unpacked extension..." and select the `dist/` directory created in Step 2

### Building for Release

1. Create a .zip to upload to the Chrome Store with the `release` task

        gulp release

## Todo:

* Pause the auto-close behavior if the browser has been idle

## Creds:

Original extension and idea by [jacktasia](https://github.com/jacktasia/tabwrangler) in 2010.
Rewriten by [JacobSingh](https://github.com/jacobSingh) in 2012.
