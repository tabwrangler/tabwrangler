## Developing

1. Clone the repository

        $ git clone https://github.com/tabwrangler/tabwrangler
2. Install all dependencies (install [Yarn][2] first if you don't yet have it)

        $ yarn install
3. Build, output, and watch the contents to `dist/`

        $ yarn run watch
4. Open the Extensions page in Chrome via *Window > Extensions*
5. Check the "Developer mode" checkbox in upper right
6. Click the "Load unpacked extension..." button and select the `dist/` directory created in step 3.

### Building for Release

1. Create a .zip to upload to the Chrome Store with the `release` task

        $ yarn run release

## Contributing Translations

1. Follow the instructions for [Developing](#developing) the Tab Wrangler extension
2. Find or create the appropriate "messages.json" file
    - For a new locale, create a new directory in the "\_locales" directory with the locale code.
      Ensure the new locale is one of the [locales supported by Chrome][1]. Copy
      "\_locales/en/messages.json" to the new directory and begin editing.
    - For an existing locale, edit the "messages.json" file in the appropriate locale's directory
3. Edit each `"message"` field in the file with your translation
    - Optional: You may also translate the `"description"` so the next person to view the
      translations has a better description. This is not required.
4. Build and install the extension locally to ensure the translations work as expected.

Note: For further details on Chrome extension i18n, check out the Chrome extension documentation
on [i18n messages][0].

Making Tab Wrangler available in languages other than English is possible due to generous
contributors. If you'd like to contribute and be mentioned in the
"[Translators](README.md#translators)" section of the [README](README.md), please follow the
instructions above and create a pull request with your updates.

[0]: https://developer.chrome.com/apps/i18n-messages
[1]: https://developer.chrome.com/webstore/i18n?csw=1#localeTable
[2]: https://yarnpkg.com/lang/en/docs/install/
