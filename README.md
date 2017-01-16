# gulp-cocoscreator-rev
>对CocosCreator构建后的资源进行版本化（md5）处理。

## Install
```
npm install gulp-cocoscreator-rev --save-dev
```

## Example
### `gulpfile.js`
```js
const cocosRev = require('gulp-cocoscreator-rev');

gulp.task('rev-cocoscreator', cocosRev({
    src: './build/web-mobile',
    dest: './dist/cdn',
    settingsDest: './src/js/settings.js'
}));
```

### options

Type: `Object`

#### options.src
Type: `String`
Required: `true`

使用CocosCreator构建之后生成的文件夹，通常其下还有`res`和`src`两个文件夹。

#### options.dest
Type: `String`
Required: `true`

将图片等资源文件和json进行md5之后归档到新的路径。

#### options.settingsDest
Type: `String`
Required: `true`

生成的新的`settings.js`文件存放路径，因为该文件记录了版本化后的资源名，所以也会一起修改。
