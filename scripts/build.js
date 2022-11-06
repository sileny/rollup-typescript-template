/*
```
# 打包指定包
npm run build xhr

# 指定打包的模式、生成`.d.ts`
npm run build xhr --formats cjs -t
```
*/

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const execa = require('execa');
const { gzipSync } = require('zlib');
const { getArgv, targets: allTargets, fuzzyMatchTarget } = require('./utils');

const args = getArgv();

const targets = args._;
// 一共三种：esm、cjs、global
const formats = args.formats || args.f;
const devOnly = args.devOnly || args.d;
const prodOnly = !devOnly && (args.prodOnly || args.p);
const sourceMap = args.sourcemap || args.s;
// 发布到npm
const isRelease = args.release;
// 构建`.d.ts`
const buildTypes = args.t || args.types || isRelease;
// 构建所有模式
const buildAllMatching = args.all || args.a;
const commit = execa.sync('git', ['rev-parse', 'HEAD']).stdout.slice(0, 7);

run();

async function run() {
  if (!targets.length) {
    await buildAll(allTargets);
    checkAllSizes(allTargets);
  } else {
    await buildAll(fuzzyMatchTarget(targets, buildAllMatching));
    checkAllSizes(fuzzyMatchTarget(targets, buildAllMatching));
  }
}

async function buildAll(targets) {
  await runParallel(require('os').cpus().length, targets, build);
}

async function runParallel(maxConcurrency, source, iteratorFn) {
  const ret = [];
  const executing = [];
  for (const item of source) {
    const p = Promise.resolve().then(() => iteratorFn(item, source));
    ret.push(p);

    if (maxConcurrency <= source.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= maxConcurrency) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

async function build(target) {
  const pkgDir = path.resolve(`packages/${ target }`);
  const pkg = require(`${ pkgDir }/package.json`);

  // if this is a full build (no specific targets), ignore private packages
  if ((isRelease || !targets.length) && pkg.private) {
    return;
  }

  // if building a specific format, do not remove dist.
  if (!formats) {
    await fs.remove(`${ pkgDir }/dist`);
  }

  const env = (devOnly ? 'development' : 'production');

  // 执行打包命令，调用`roll.config.js`
  await execa(
    'rollup',
    [
      '-c',
      '--environment',
      [
        `NODE_ENV:${ env }`,
        `COMMIT:${ commit }`,
        `TARGET:${ target }`,
        formats ? `FORMATS:${ formats }` : ``,
        buildTypes ? `TYPES:true` : ``,
        prodOnly ? `PROD_ONLY:true` : ``,
        sourceMap ? `SOURCE_MAP:true` : ``
      ]
        .filter(Boolean)
        .join(',')
    ],
    { stdio: 'inherit' }
  );

  // 如果需要生成`.d.ts`，而且，包配置指定了`types`属性
  // `npm run build core --types` 或者`node scripts/build.js core --types`
  if (buildTypes && pkg.types) {
    console.log();
    console.log(
      chalk.bold(chalk.yellow(`Rolling up type definitions for ${ target }...`))
    );

    // build types
    const { Extractor, ExtractorConfig } = require('@microsoft/api-extractor');

    const extractorConfigPath = path.resolve(pkgDir, `api-extractor.json`);
    const extractorConfig = ExtractorConfig.loadFileAndPrepare(extractorConfigPath);
    const extractorResult = Extractor.invoke(extractorConfig, {
      localBuild: true,
      showVerboseMessages: true
    });

    if (extractorResult.succeeded) {
      console.log(chalk.bold(chalk.green(`API Extractor completed successfully.`)));
    } else {
      console.error(
        `API Extractor completed with ${ extractorResult.errorCount } errors` +
        ` and ${ extractorResult.warningCount } warnings`
      );
      process.exitCode = 1;
    }

    // 移除掉按需加载的以外的不需要的`.d.ts`文件，比如，需要打包`core`，则其余的都给删掉
    await fs.remove(`${ pkgDir }/dist/packages`);
  }
}

function checkAllSizes(targets) {
  if (devOnly) {
    return;
  }
  console.log();
  for (const target of targets) {
    checkSize(target);
  }
  console.log();
}

function checkSize(target) {
  const pkgDir = path.resolve(`packages/${ target }`);
  checkFileSize(`${ pkgDir }/dist/${ target }.prod.js`);
}

function checkFileSize(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const file = fs.readFileSync(filePath);
  const minSize = (file.length / 1024).toFixed(2) + 'kb';
  const gzipped = gzipSync(file);
  const gzippedSize = (gzipped.length / 1024).toFixed(2) + 'kb';
  console.log(
    `${ chalk.gray(
      chalk.bold(path.basename(filePath))
    ) } min:${ minSize } / gzip:${ gzippedSize }`
  );
}
