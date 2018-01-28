var gulp = require("gulp");
var iife = require("gulp-iife");
var sass = require("gulp-sass");
var uglify = require("gulp-uglify");
var concat = require("gulp-concat");

function sourceTask(name, watchPath, mainFunc) {
    var watching = false;

    gulp.task(name, function () {
        mainFunc();

        if (!watching) {
            gulp.watch(watchPath, [name]);
            watching = true;
        }
    });
}

function sourceTaskJs(name, dir, fn, output) {
    sourceTask(name, dir + '**/*.js', function () {
        gulp.src(fn(dir))
            .pipe(concat(output))
            .pipe(iife({
                useStrict: true
            }))
            //.pipe(uglify())
            .pipe(gulp.dest('js/'));
    });
}

function sourceTaskScss(name, dir) {
    sourceTask(name, dir, function () {
        gulp.src(dir)
            .pipe(sass({
                outputStyle: "nested"
            }))
            .pipe(gulp.dest('css/'));
    });
}

sourceTaskJs('shortcodes:js', 'src/js/shortcodes/', function (source) {
    return [
        'data/shortcodes.js',
        'src/js/shortcodes/main.js'
    ];
}, 'shortcodes.js');

sourceTaskJs('main:js', 'src/js/content_script/', function (source) {
    return [
        source + '_config.js',
        source + '_init.js',
        source + 'utils.js',
        source + 'dropdown.js',
        source + 'focus-watcher.js',
        source + 'element-watcher.js',
        source + 'string-buffer.js',
        source + 'matcher.js',
        source + 'main.js',
        source + 'state.js'
    ];
}, 'script.js');

sourceTaskScss('main:scss', 'src/scss/*.scss');

// OPTIONS
gulp.task('options-scss', function () {
    gulp.src([
        'options/scss/main.scss'
    ])
        .pipe(sass({
            outputStyle: "nested"
        }).on('error', function (error) {
            console.warn(error.messageFormatted);
        }))
        .pipe(gulp.dest('options/css/'));
});

gulp.watch('options/scss/**/*.scss', ['options-scss']);

gulp.task("default", [
    "shortcodes:js",
    "main:js",
    "main:scss",
    "options-scss"
]);