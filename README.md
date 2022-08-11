# rollup-typescript-template
A monorepo template that integrates packaged build tools such as rollup, esbuild, and pnpm, and is suitable for typescript development.一个集成了rollup、esbuild、pnpm等打包构建工具，适用于typescript开发的monorepo模板。

## 初始化设定

需要两步设置
- `scripts/.config.js`里的`name`指定为作用域包名，比如，`@angular`就指定为`angular`
- `tsconfig.json`里的`@scoped-package-name`替换为自己定义的包名

## create
创建一个package

有以下几个参数
- `--scopedName`，指定包的作用域
- `--packageName`，指定包名
- `--url`，指定github仓库地址，默认从项目根目录的`package.json`截取取`homepage`
- `--author`，指定作者，默认读取项目根目录的`package.json`的`author`
- `--license`，指定协议

简单的例子，
```
"scripts": {
  "create": "node scripts/create.js --packageName zzz"
}
```

完整的实例，
```
node scripts/create.js --scopedName scoped --packageName zzz --url https://github.com/youer-username/your-repo --author me --license MIT
```
或者
```
"scripts": {
  "create": "node scripts/create.js --scopedName scoped --packageName zzz --url https://github.com/youer-username/your-repo --author me --license MIT"
}
```

## build
打包资源

## dev
开发环境

## release
发布包
