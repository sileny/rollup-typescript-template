import path from 'path';
import ts from 'rollup-plugin-typescript2';
import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';

if (!process.env.TARGET) {
  throw new Error('TARGET package must be specified via --environment flag.');
}

const masterVersion = require('./package.json').version;
const packagesDir = path.resolve(__dirname, 'packages');
const packageDir = path.resolve(packagesDir, process.env.TARGET);
const resolve = p => path.resolve(packageDir, p);
const pkg = require(resolve(`package.json`));
const packageOptions = pkg.buildOptions || {};
const name = path.basename(packageDir);

const outputConfigs = {
  esm: {
    file: resolve(`dist/${ name }.esm.js`),
    format: `es`
  },
  cjs: {
    file: resolve(`dist/${ name }.cjs.js`),
    format: `cjs`
  },
  global: {
    file: resolve(`dist/${ name }.global.js`),
    format: `iife`
  },
};

// 如果指定了formats，则将 `packages/*` 打包出formats格式的文件。用法：`node scripts/build.js --formats cjs`
const inlineFormats = process.env.FORMATS && process.env.FORMATS.split(',');
// 如果没有指定formats，则默认打包成 `cjs` 格式
const packageFormats = inlineFormats || packageOptions.formats || ['cjs'];
const packageConfigs = process.env.PROD_ONLY
  ? []
  : packageFormats.map(format => createConfig(format, outputConfigs[format]));

if (process.env.NODE_ENV === 'production') {
  packageFormats.forEach(format => {
    if (format === 'cjs') {
      packageConfigs.push(createProductionConfig(format));
    }
    if (/^(global|esm)/.test(format)) {
      packageConfigs.push(createMinifiedConfig(format));
    }
  });
}

export default packageConfigs;

function createConfig(format, output, plugins = []) {
  if (!output) {
    console.log(require('chalk').yellow(`invalid format: "${ format }"`));
    process.exit(1);
  }

  const isProductionBuild = process.env.__DEV__ === 'false' || /\.prod\.js$/.test(output.file);
  const isESMBuild = /esm/.test(format);
  const isGlobalBuild = /global/.test(format);
  const isNodeBuild = format === 'cjs';

  // 用法：`node scripts/build.js --sourcemap`
  output.sourcemap = !!process.env.SOURCE_MAP;
  output.externalLiveBindings = false;
  output.exports = 'named';

  if (isGlobalBuild) {
    output.name = packageOptions.name;
  }

  // 终端构建指定types属性。用法：`node scripts/build.js --types`
  const shouldEmitDeclarations = pkg.types && process.env.TYPES != null;

  // `packages/*`下的包之间会存在相互依赖
  // esm、global模式需要打包到各自的包里；cjs不需要打包
  const external = isESMBuild || isGlobalBuild ? [] : [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ];

  const nodePlugins =
    (format === 'cjs' && Object.keys(pkg.devDependencies || {}).length)
      ? [
        commonjs(),
        nodeResolve()
      ]
      : [];

  return {
    input: resolve('src/index.ts'),
    external,
    plugins: [
      ts({
        tsconfig: path.resolve(__dirname, 'tsconfig.json'),
        cacheRoot: path.resolve(__dirname, 'node_modules/.rts2_cache'), // 指定缓存目录
        tsconfigOverride: {
          compilerOptions: {
            target: isNodeBuild ? 'es2019' : 'es5',
            sourceMap: output.sourcemap,
            declaration: shouldEmitDeclarations
          }
        }
      }),
      createReplacePlugin(
        isProductionBuild,
        isESMBuild,
        (isGlobalBuild || isESMBuild),
        isGlobalBuild,
        isNodeBuild
      ),
      ...nodePlugins,
      ...plugins
    ],
    output,
    onwarn: (msg, warn) => {
      if (!/Circular/.test(msg)) {
        warn(msg);
      }
    },
    treeshake: {
      moduleSideEffects: false
    }
  };
}

function createReplacePlugin(
  isProduction,
  isESMBuild,
  isBrowserBuild,
  isGlobalBuild,
  isNodeBuild
) {
  const replacements = {
    __COMMIT__: `"${ process.env.COMMIT }"`,
    __VERSION__: `"${ masterVersion }"`,
    __DEV__: !isProduction,
    // If the build is expected to run directly in the browser (global / esm builds)
    __BROWSER__: isBrowserBuild,
    __GLOBAL__: isGlobalBuild,
    __ESM__: isESMBuild,
    __NODE_JS__: isNodeBuild
  };
  Object.keys(replacements).forEach(key => {
    if (key in process.env) {
      replacements[key] = process.env[key];
    }
  });
  return replace({
    values: replacements,
    preventAssignment: true
  });
}

function createProductionConfig(format) {
  return createConfig(format, {
    file: resolve(`dist/${ name }.${ format }.prod.js`),
    format: outputConfigs[format].format
  });
}

function createMinifiedConfig(format) {
  const { terser } = require('rollup-plugin-terser');
  return createConfig(
    format,
    {
      file: outputConfigs[format].file.replace(/\.js$/, '.prod.js'),
      format: outputConfigs[format].format
    },
    [terser()]
  );
}
