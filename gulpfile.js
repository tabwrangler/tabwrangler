/* eslint-env node */

const CrowdinApi = require("crowdin-api");
const gulp = require("gulp");
const ignore = require("gulp-ignore");
const rename = require("gulp-rename");
const rimraf = require("rimraf");
const unzip = require("gulp-unzip");

const DIST_DIRECTORY = "dist";

// Clean all release artifacts
gulp.task("clean", function (done) {
  rimraf(`${__dirname}/${DIST_DIRECTORY}`, done);
});

// Import all translations from the [Crowdin Tab Wrangler project][0]. Languages with no
// translations are excluded from the import because they will use the default language's file. This
// Prevents having a bunch of empty directories inside './_locales' that would only be confusing.
//
// * The `CROWDIN_API_KEY` env variable must be set with project's API key. Contact a maintainer of
//   Tab Wrangler if you want to run this locally and get access to the API key.
//
// [0]: https://crowdin.com/project/tab-wrangler
gulp.task("l10n:import", function () {
  const crowdinApi = new CrowdinApi({
    apiKey: process.env.CROWDIN_API_KEY,
    projectName: "tab-wrangler",
  });

  return crowdinApi.downloadAllTranslations().then((allTranslationsZip) => {
    return gulp
      .src(allTranslationsZip)
      .pipe(unzip())
      .pipe(
        ignore(function (file) {
          const contents = JSON.parse(file.contents.toString("utf8"));
          if (contents != null) {
            // Files with translations contain Objects, files with no translations contain Arrays.
            // `Object.keys(array)` returns an empty Array, so empty files will be excluded.
            const keys = Object.keys(contents);
            if (keys.length > 0) {
              return false;
            }
          }
          return true;
        })
      )
      .pipe(
        rename(function (path) {
          switch (path.dirname) {
            case "es-ES":
              // Crowdin names its base Spanish locale "es-ES", but Chrome only supports the
              // non-suffixed "es" locale. Rename the file so it moves to the right place.
              path.dirname = "es";
              break;
            default:
              break;
          }

          // Crowdin names its locales with dashes, like "zh-TW", but Chrome expects those same
          // locale names to use underscores, like "zh_TW".
          path.dirname = path.dirname.replace("-", "_");
        })
      )
      .pipe(gulp.dest(`${__dirname}/_locales/`));
  });
});

gulp.task("default", gulp.series("lint", "webpack"));
