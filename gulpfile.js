const batch = require('gulp-batch');
const gulp = require('gulp');
const gutil = require('gulp-util');
const watch = require('gulp-watch');
const webpack = require('webpack');

const webpackConfig = require('./webpack.config.js');

// Copy all files except for *.js ones
gulp.task('cp', function() {
  gulp.src([
      'app/**/!(*.js)',
      'MIT-LICENSE.txt',
      'README.md',
    ])
    .pipe(gulp.dest('dist'));
});

// Copy the entire lib/ directory; it's vendor, 3rd party stuff
gulp.task('cp-lib', function() {
  gulp.src('app/lib/**')
    .pipe(gulp.dest('dist/lib'));
});

gulp.task('webpack', function(done) {
  webpack(webpackConfig).run(function(err, stats) {
    if (err) throw new gutil.PluginError("webpack", err);
    gutil.log("[webpack]", stats.toString({colors: true}));
    done();
  });
});

gulp.task('webpack:watch', function(done) {
  let firstRun = true;
  webpack(Object.assign({}, {watch: true}, webpackConfig), function(err, stats) {
    if (err) throw new gutil.PluginError('webpack', err);
    gutil.log('[webpack]', stats.toString({
      chunks: false, // Limit chunk information output; it's slow and not too useful
      colors: true
    }));

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

// Watch and re-compile when in development.
gulp.task('watch', function() {
  watch('app/**/!(*.js)', batch(WATCH_OPTIONS, function(events, done) {
    gulp.start('cp', done);
  }));
  gulp.start(['cp', 'cp-lib', 'webpack:watch']);
});

gulp.task('default', ['cp', 'cp-lib', 'webpack']);
