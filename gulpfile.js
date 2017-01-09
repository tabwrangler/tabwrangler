const babel = require('gulp-babel');
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

// Compile app JS with babel
gulp.task('js', function() {
  const presets = ['es2015', 'react'];

  gulp.src('app/*.js')
    .pipe(babel({
      presets: presets,
    }))
    .pipe(gulp.dest('dist'));

  gulp.src('app/js/*.js')
    .pipe(babel({
      presets: presets,
    }))
    .pipe(gulp.dest('dist/js'));
});

// Watch and re-compile when in development. Changes are batched every 500ms since switching between
// code and browser takes at least that long, save a few saves.
gulp.task('watch', function() {
  watch([
    'app/*.js',
    'app/js/*.js',
  ], batch({timeout: 500}, function(events, done) {
    gulp.start('js', done);
  }));
});

gulp.task('default', ['cp', 'cp-lib', 'js']);
