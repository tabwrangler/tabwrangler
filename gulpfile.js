/* @flow */
/* eslint-env node */

const CrowdinApi = require('crowdin-api');
const eslint = require('gulp-eslint');
const gulp = require('gulp');
const gutil = require('gulp-util');
const ignore = require('gulp-ignore');
const jest = require('gulp-jest').default;
const rename = require('gulp-rename');
const rimraf = require('rimraf');
const unzip = require('gulp-unzip');
const webpack = require('webpack');
const webpackConfig = require('./webpack.config.js');
const webpackProductionConfig = require('./webpack.production.config.js');

const DIST_DIRECTORY = 'dist';

// Clean all release artifacts
gulp.task('clean', function(done) {
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
gulp.task('l10n:import', function() {
  const crowdinApi = new CrowdinApi({ apiKey: process.env.CROWDIN_API_KEY });
  return crowdinApi.downloadAllTranslations('tab-wrangler').then(allTranslationsZip => {
    return gulp
      .src(allTranslationsZip)
      .pipe(unzip())
      .pipe(
        ignore(function(file) {
          const contents = JSON.parse(file.contents.toString('utf8'));
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
        rename(function(path) {
          switch (path.dirname) {
            case 'es-ES':
              // Crowdin names its base Spanish locale "es-ES", but Chrome only supports the
              // non-suffixed "es" locale. Rename the file so it moves to the right place.
              path.dirname = 'es';
              break;
            default:
              break;
          }

          // Crowdin names its locales with dashes, like "zh-TW", but Chrome expects those same
          // locale names to use underscores, like "zh_TW".
          path.dirname = path.dirname.replace('-', '_');
        })
      )
      .pipe(gulp.dest(`${__dirname}/_locales/`));
  });
});

gulp.task('lint', function() {
  return (
    gulp
      .src(['**/*.js', `!${DIST_DIRECTORY}/**`, '!node_modules/**', '!coverage/**'])
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

gulp.task('test', function() {
  process.env.NODE_ENV = 'test';
  return gulp.src('app/js/__tests__').pipe(
    jest(
      Object.assign(
        {},
        {
          config: {
            transformIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/node_modules/'],
            transform: {
              '^.+\\.jsx?$': 'babel-jest',
            },
            verbose: true,
            automock: false,
          },
        }
      )
    )
  );
});

function webpackLog(stats) {
  gutil.log(
    '[webpack]',
    stats.toString({
      chunks: false, // Limit chunk information output; it's slow and not too useful
      colors: true,
      modules: false,
    })
  );
}

gulp.task('webpack', function(done) {
  return webpack(webpackConfig, function(err, stats) {
    if (err) throw new gutil.PluginError('webpack', err);
    webpackLog(stats);
    done();
  });
});

gulp.task('webpack:production', function(done) {
  return webpack(webpackProductionConfig, function(err, stats) {
    if (err) throw new gutil.PluginError('webpack', err);
    webpackLog(stats);
    done();
  });
});

gulp.task('webpack:watch', function(done) {
  let firstRun = true;
  return webpack(
    webpackConfig.map(function(platformConfig) {
      return Object.assign({}, { watch: true }, platformConfig);
    }),
    function(err, stats) {
      if (err) throw new gutil.PluginError('webpack', err);
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
  'watch',
  gulp.series(
    'clean',
    function lintAndTest(done) {
      // Run lint and test on first execution to get results, but don't prevent Webpack from
      // starting up. This way you need to run `yarn start` at most 1 time to get compilation
      // started.
      gulp.watch('app/**/*.js', { ignoreInitial: false }, gulp.parallel('lint', 'test'));
      gulp.watch('__tests__/**/*.js', gulp.parallel('lint', 'test'));
      done();
    },
    'webpack:watch'
  )
);

gulp.task('release', gulp.series('clean', gulp.parallel('lint', 'test'), 'webpack:production'));
gulp.task('default', gulp.series('lint', 'webpack'));
