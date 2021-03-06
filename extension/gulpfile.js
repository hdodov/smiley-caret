var browserify = require("browserify");
var gulp = require("gulp");
var tap = require("gulp-tap");
var buffer = require("gulp-buffer");
var uglify = require("gulp-uglify");
var sourcemaps = require("gulp-sourcemaps");

gulp.task('js', function () {
    return gulp.src('main/js/src/*.js')
        .pipe(tap(function (file) {
            file.contents = browserify(file.path, {debug: true}).bundle();
        }))

        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(uglify())
        .pipe(sourcemaps.write("./"))

        .pipe(gulp.dest('main/js'))
});

gulp.watch('main/js/src/**/*', ['js']);
gulp.task('default', ['js']);