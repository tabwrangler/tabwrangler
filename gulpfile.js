/* eslint-env node */

const archiver = require('archiver');
const batch = require('gulp-batch');
const eslint = require('gulp-eslint');
const fs = require('fs');
const gulp = require('gulp');
const gutil = require('gulp-util');
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

// Copy all files except for *.js ones
gulp.task('cp', function() {
  return gulp.src([
      'app/**/!(*.js)',
      'MIT-LICENSE.txt',
      'README.md',
    ])
    .pipe(gulp.dest(DIST_DIRECTORY));
});

// Copy the entire lib/ directory; it's vendor, 3rd party stuff
gulp.task('cp-lib', function() {
  return gulp.src('app/lib/**')
    .pipe(gulp.dest(`${DIST_DIRECTORY}/lib`));
});

gulp.task('lint', function() {
  return gulp.src(['**/*.js', `!${DIST_DIRECTORY}/**`, '!node_modules/**'])
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

function webpackLog(stats) {
  gutil.log('[webpack]', stats.toString({
    chunks: false, // Limit chunk information output; it's slow and not too useful
    colors: true,
  }));
}

gulp.task('webpack', function(done) {
  return webpack(
    Object.assign({}, {minimize: true, optimize: true}, webpackConfig),
    function(err, stats) {
      if (err) throw new gutil.PluginError('webpack', err);
      webpackLog(stats);
      done();
    }
  );
});

gulp.task('webpack:production', function(done) {
  return webpack(
    Object.assign({}, {minimize: true, optimize: true}, webpackProductionConfig),
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

// Batch every 250ms since switching between code and browser takes at least that long, save a few
// saves.
const WATCH_OPTIONS = {timeout: 250};

// Watch and re-compile / re-lint when in development.
gulp.task('watch', function(done) {
  watch('app/**/!(*.js)', batch(WATCH_OPTIONS, function(events, done) {
    gulp.start('cp', done);
  }));
  watch('app/**/*.js', batch(WATCH_OPTIONS, function(events, done) {
    gulp.start('lint', done);
  }));
  gulp.start(['cp', 'cp-lib', 'lint', 'webpack:watch']);
});

gulp.task('release', function(done) {
  runSequence('clean', 'webpack:production', function() {
    // create a file to stream archive data to.
    const output = fs.createWriteStream(`${__dirname}/tabwrangler-${packageJson.version}.zip`);
    const archive = archiver('zip', {
        store: true, // Sets the compression method to STORE.
    });

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

    // append files from a directory
    archive.directory(`${DIST_DIRECTORY}/`);

    // finalize the archive (ie we are done appending files but streams have to finish yet)
    archive.finalize();
  });
});

gulp.task('default', function(done) {
  runSequence('cp', 'cp-lib', 'lint', 'webpack', done);
});
