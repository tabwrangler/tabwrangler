## Developing

### Chrome

1.  Clone the repository

        git clone https://github.com/tabwrangler/tabwrangler

2.  Install all dependencies

        npm install

3.  Build, output, and watch the contents to `dist/chrome/`

        npm run start

4.  Open the Extensions page in Chrome via _Window > Extensions_
5.  Check the "Developer mode" checkbox in upper right
6.  Click the "Load unpacked extension..." button and select the `dist/chrome/` directory created in
    step 3.

### Firefox

1.  Clone the repository

        git clone https://github.com/tabwrangler/tabwrangler

2.  Install all dependencies

        npm install

3.  Build, output, and watch the contents to `dist/firefox/`

        npm run start

4.  Open the Add-ons page in Firefox via _Tools > Add-ons_
5.  Open the cog wheel dropdown and select _Debug Add-ons_
6.  Click the "Load Temporary Add-on" button and select the `dist/firefox/manifest.json` file created
    in step 3.

### Building for Release

1.  Create a .zip to upload to the Chrome Store and Firefox AMO with the `build` task

        npm run build

The version comes from `git describe`. A commit tagged `vX.Y.Z` builds as `X.Y.Z`, and the tag must
match the `version` in package.json. Other commits build as `X.Y.Z.N`, where `N` is the number of
commits since the last tag, with a display name like `X.Y.Z-N-g<hash>`.

## Contributing Translations

Contribute on [Tab Wrangler's Crowdin Project][3], and your translations will be automatically
added to the project.

Note: For further details on Chrome extension i18n, check out the Chrome extension documentation
on [i18n messages][0].

Making Tab Wrangler available in languages other than English is possible due to generous
contributors. If you'd like to contribute, please create a Crowdin account and add translations
to the [Crowdin Project][3].

[0]: https://developer.chrome.com/apps/i18n-messages
[1]: https://developer.chrome.com/webstore/i18n?csw=1#localeTable
[3]: https://crowdin.com/project/tab-wrangler
