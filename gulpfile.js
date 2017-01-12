const batch = require('gulp-batch');
const gulp = require('gulp');
const watch = require('gulp-watch');

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

// Batch every 500ms since switching between code and browser takes at least that long, save a few
// saves.
const WATCH_OPTIONS = {timeout: 500};

// Watch and re-compile when in development.
gulp.task('watch', function() {
  watch('app/**/!(*.js)', batch(WATCH_OPTIONS, function(events, done) {
    gulp.start('cp', done);
  }));

  gulp.start('default');
});

gulp.task('default', ['cp', 'cp-lib']);
