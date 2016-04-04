var mozjpeg = require('imagemin-mozjpeg');
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jshint: {
        options: {
            curly: true,
            eqeqeq: true,
            latedef: true,
            newcap: true,
            noarg: true,
            sub: true,
            undef: true,
            eqnull: true,
            browser: true,
            multistr:true,
            shadow:true,
            laxbreak:true,
            node:true,
            globals: {
                jQuery: true,
                $: true,
                console: true
            }
        },
        'bdtekServer': {
            src: [ 'server.js' ]
        }
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
      },
      dist: {
            files: {
                    'client/js/bdtek-<%= pkg.version %>.min.js':'src/js/bdtek-<%= pkg.version %>.js',
            }
      }
    },
    cssmin: {
      target: {
        files: [{
          expand: true,
          cwd: 'src/css',
          src: ['jquery.bdtek.css'],
          dest: 'client/css'
        }]
      }
    },
    imagemin: {                          // Task
        dynamic: {                         // Another target
            files: [{
            expand: true,                  // Enable dynamic expansion
            cwd: 'src/img',                   // Src matches are relative to this path
            src: ['**/*.{png,jpg,gif}'],   // Actual patterns to match
            dest: 'client/img'                  // Destination path prefix
            }]
        }
    },
    copy: {
        main: {
            files: [
                    { expand:true, cwd: 'src/', src:['index.html'],dest:'client/' },
                    { expand:true, cwd: 'src/', src:['conf.js'],dest:'client/' },
                    { expand:true, cwd: 'src/lib/', src:['**'],dest:'client/lib/' }
            ]
        }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-imagemin');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  //grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-copy');

  // Default task(s).
  grunt.registerTask('default', ['jshint','uglify','cssmin','imagemin','copy']);

};
