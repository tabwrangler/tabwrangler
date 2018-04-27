/* eslint-env node */

const archiver = require('archiver');
const eslint = require('gulp-eslint');
const fs = require('fs');
const gulp = require('gulp');
const gutil = require('gulp-util');
const jest = require('gulp-jest').default;
const jsonTransform = require('gulp-json-transform');
const lodash = require('lodash');
const rimraf = require('rimraf');
const runSequence = require('run-sequence');
const watch = require('gulp-watch');
const webpack = require('webpack');

const packageJson = require('./package.json');
const webpackConfig = require('./webpack.config.js');
const webpackProductionConfig = require('./webpack.production.config.js');

const DIST_DIRECTORY = 'dist';

// Clean all release artifacts
gulp.task('clean', function(done) {
  rimraf(`${__dirname}/${DIST_DIRECTORY}`, done);
});

gulp.task('lint', function() {
  return gulp.src(['**/*.js', `!${DIST_DIRECTORY}/**`, '!node_modules/**', '!coverage/**'])
    // eslint() attaches the lint output to the "eslint" property
    // of the file object so it can be used by other modules.
    .pipe(eslint())
    // eslint.format() outputs the lint results to the console.
    // Alternatively use eslint.formatEach() (see Docs).
    .pipe(eslint.format())
    // To have the process exit with an error code (1) on
    // lint error, return the stream and pipe to failAfterError last.
    .pipe(eslint.failAfterError());
});

gulp.task('locales', function() {
  return gulp.src('_locales/**/*.json', {base: '.'})
    .pipe(jsonTransform(function(messages) {
      return Object.keys(messages).reduce(function(result, messageId) {
        // Omit the 'description' because it is only useful during development for translators.
        // Those bytes do not need to be shipped to users.
        result[messageId] = lodash.omit(messages[messageId], 'description');
        return result;
      }, {});
    }))
    .pipe(gulp.dest(DIST_DIRECTORY));
});

gulp.task('test', function () {
  process.env.NODE_ENV = 'test';

  return gulp.src('app/js/__tests__').pipe(jest(Object.assign({}, {
    config: {
      transformIgnorePatterns: [
        '<rootDir>/dist/', '<rootDir>/node_modules/',
      ],
      transform: {
        '^.+\\.jsx?$': 'babel-jest',
      },
      verbose: true,
      automock: false,
    },
  })));
});

function webpackLog(stats) {
  gutil.log('[webpack]', stats.toString({
    chunks: false, // Limit chunk information output; it's slow and not too useful
    colors: true,
    modules: false,
  }));
}

gulp.task('webpack', function(done) {
  return webpack(
    webpackConfig,
    function(err, stats) {
      if (err) throw new gutil.PluginError('webpack', err);
      webpackLog(stats);
      done();
    }
  );
});

gulp.task('webpack:production', function(done) {
  return webpack(
    webpackProductionConfig,
    function(err, stats) {
      if (err) throw new gutil.PluginError('webpack', err);
      webpackLog(stats);
      done();
    }
  );
});

gulp.task('webpack:watch', function(done) {
  let firstRun = true;
  return webpack(Object.assign({}, {watch: true}, webpackConfig), function(err, stats) {
    if (err) throw new gutil.PluginError('webpack', err);
    webpackLog(stats);

    // Call Gulp's `done` callback only once per watch. Calling it more than once is an error.
    if (firstRun) {
      firstRun = false;
      done();
    }
  });
});

// Watch and re-compile / re-lint when in development.
// eslint-disable-next-line no-unused-vars
gulp.task('watch', function(done) {
  watch('_locales/**/*', function() {
    gulp.start('locales');
  });
  watch('app/**/*.js', function() {
    gulp.start('lint');
    gulp.start('test');
  });
  watch('__tests__/**/*.js', function() {
    gulp.start('lint');
    gulp.start('test');
  });
  gulp.start(['lint', 'locales', 'test', 'webpack:watch']);
});

gulp.task('archive', function(done) {
  // create a file to stream archive data to.
  const output = fs.createWriteStream(`${__dirname}/tabwrangler-${packageJson.version}.zip`);
  const archive = archiver('zip');

  // listen for all archive data to be written
  output.on('close', function() {
    console.log(`${archive.pointer()} total bytes`);
    console.log('archiver has been finalized and the output file descriptor has closed.');
    done();
  });

  // good practice to catch this error explicitly
  archive.on('error', function(err) {
    throw err;
  });

  // pipe archive data to the file
  archive.pipe(output);

  // append files from the distribution directory, putting files all at the root
  archive.directory(`${DIST_DIRECTORY}/`, false);

  // finalize the archive (ie we are done appending files but streams have to finish yet)
  archive.finalize();
});

gulp.task('release', function(done) {
  runSequence(
    'clean',
    'locales',
    'lint',
    'test',
    'webpack:production',
    'archive',
    function() {
      done();
    }
  );
});

gulp.task('default', function(done) {
  runSequence('locales', 'lint', 'webpack', done);
});
