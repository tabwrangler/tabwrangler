/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-env node */

const PluginError = require("plugin-error");
const eslint = require("gulp-eslint");
const gulp = require("gulp");
const log = require("fancy-log");
const rimraf = require("rimraf");
const webpack = require("webpack");
const webpackConfig = require("./webpack.config.js");
const webpackProductionConfig = require("./webpack.production.config.js");

const DIST_DIRECTORY = "dist";

// Clean all release artifacts
gulp.task("clean", function (done) {
  rimraf(`${__dirname}/${DIST_DIRECTORY}`, done);
});

gulp.task("lint", function () {
  return (
    gulp
      .src(["**/*.js", `!${DIST_DIRECTORY}/**`, "!node_modules/**", "!coverage/**"])
      // eslint() attaches the lint output to the "eslint" property
      // of the file object so it can be used by other modules.
      .pipe(eslint())
      // eslint.format() outputs the lint results to the console.
      // Alternatively use eslint.formatEach() (see Docs).
      .pipe(eslint.format())
      // To have the process exit with an error code (1) on
      // lint error, return the stream and pipe to failAfterError last.
      .pipe(eslint.failAfterError())
  );
});

function webpackLog(stats) {
  log(
    "[webpack]",
    stats.toString({
      chunks: false, // Limit chunk information output; it's slow and not too useful
      colors: true,
      modules: false,
    })
  );
}

gulp.task("webpack", function (done) {
  return webpack(webpackConfig, function (err, stats) {
    if (err) throw new PluginError("webpack", err);
    webpackLog(stats);
    done();
  });
});

gulp.task("webpack:production", function (done) {
  return webpack(webpackProductionConfig, function (err, stats) {
    if (err) throw new PluginError("webpack", err);
    webpackLog(stats);
    done();
  });
});

gulp.task("webpack:watch", function (done) {
  let firstRun = true;
  return webpack(
    webpackConfig.map(function (platformConfig) {
      return Object.assign({}, { watch: true }, platformConfig);
    }),
    function (err, stats) {
      if (err) throw new PluginError("webpack", err);
      webpackLog(stats);

      // Call Gulp's `done` callback only once per watch. Calling it more than once is an error.
      if (firstRun) {
        firstRun = false;
        done();
      }
    }
  );
});

// Watch and re-compile / re-lint when in development.
gulp.task(
  "watch",
  gulp.series(
    "clean",
    function lint(done) {
      // Run lint on first execution to get results, but don't prevent Webpack from starting up.
      // This way you need to run `npm run start` at most 1 time to get compilation started.
      gulp.watch("app/**/*.js", { ignoreInitial: false }, gulp.series("lint"));
      done();
    },
    "webpack:watch"
  )
);

gulp.task("default", gulp.series("clean", "lint", "webpack:production"));
