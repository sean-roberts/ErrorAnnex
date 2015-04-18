
var gulp = require('gulp'),
    
    plugins = require('gulp-load-plugins')(),
    
    del = require('del'),
    
    package = require('./package.json'),

    header = '/**\n\t@author Sean Roberts\n\tErrorAnnex v' + package.version + '\n*/\n';


/**
WORKFLOWS
**/
gulp.task('default', function(){});

gulp.task('package', ['move', 'js', 'manifest', 'zip', 'clean']);


/**
SEQUENCE TASKS
**/
gulp.task('move', function(){
    return gulp.src('./chrome/**/*')
        .pipe(gulp.dest('./temp'));
});

gulp.task('js', ['move'], function(cb){
    
    return gulp.src(['./temp/**/*.js', '!./temp/**/*.min.js'])
        .pipe(plugins.uglify())
        .pipe(plugins.header(header))
        .pipe(gulp.dest('./temp/'));
});

gulp.task('manifest', ['move'], function(){

    return gulp.src('./temp/manifest.json')

        // Please take notice here, we are using the version
        // dicated in the package.json to build
        .pipe(plugins.jsonEditor({
            version: package.version
        }))
        .pipe(gulp.dest('./temp'));
});

gulp.task('zip', ['move', 'js', 'manifest'], function(){
    return gulp.src('./temp/**/*')
        .pipe(plugins.zip('ErrorAnnex.' + package.version + '.zip'))
        .pipe(gulp.dest('./'));

    // del(['./temp']);
});

gulp.task('clean', ['move', 'js', 'manifest', 'zip'], function(cb){
    return del(['./temp'], cb);
});