/* eslint-env node */

const archiver = require('archiver');
const eslint = require('gulp-eslint');
const fs = require('fs');
const gulp = require('gulp');
const gutil = require('gulp-util');
const jest = require('gulp-jest').default;
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

// Copy any files that don't require pre-processing.
gulp.task('cp', function() {
  const cpApp = gulp.src([
    'app/css/**',
    'app/img/**',
    'app/lib/**',
    'app/*.html',
  ], {base: 'app'})
    .pipe(gulp.dest(DIST_DIRECTORY));

  const cpRoot = gulp.src([
    'app/manifest.json',
    'MIT-LICENSE.txt',
    'README.md',
  ])
    .pipe(gulp.dest(DIST_DIRECTORY));

  return [cpApp, cpRoot];
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

gulp.task('test', function () {
  process.env.NODE_ENV = 'test';

  return gulp.src('app/js/__tests__').pipe(jest(Object.assign({}, {
    config: {
      'transformIgnorePatterns': [
        '<rootDir>/dist/', '<rootDir>/node_modules/',
      ],
      'transform': {
        '^.+\\.jsx?$': 'babel-jest',
      },
      'verbose': true,
      'automock': false,
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
  watch('app/**/!(*.js)', function() {
    gulp.start('cp');
  });
  watch('app/**/*.js', function() {
    gulp.start('lint');
    gulp.start('test');
  });
  watch('__tests__/**/*.js', function() {
    gulp.start('lint');
    gulp.start('test');
  });
  gulp.start(['cp', 'lint', 'webpack:watch']);
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

  // append files from a directory
  archive.directory(`${DIST_DIRECTORY}/`);

  // finalize the archive (ie we are done appending files but streams have to finish yet)
  archive.finalize();
});

gulp.task('release', function(done) {
  runSequence('clean', 'cp', 'lint', 'test', 'webpack:production', 'archive', function() {
    done();
  });
});

gulp.task('default', function(done) {
  runSequence('cp', 'lint', 'webpack', done);
});
