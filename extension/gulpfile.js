var gulp = require("gulp");
var iife = require("gulp-iife");
var sass = require("gulp-sass");
var tap = require("gulp-tap");
var browserify = require("browserify");
var uglify = require("gulp-uglify");
var concat = require("gulp-concat");

gulp.task('js', function () {
    return gulp.src('js/*.js')
        .pipe(tap(function (file) {
            file.contents = browserify(file.path, {debug: true}).bundle();
        }))

        .pipe(gulp.dest('test'))
});

gulp.watch('js/**/*', ['js']);
gulp.task('default', ['js']);