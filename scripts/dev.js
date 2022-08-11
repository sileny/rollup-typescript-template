const { build } = require('esbuild');
const { resolve, relative } = require('path');
const { getArgv } = require('./utils');
const config = require('./.config');

const args = getArgv();

const target = args._[0] || config.name;
const format = args.formats || args.f || 'global';
const pkg = require(resolve(__dirname, `../packages/${ target }/package.json`));

const isNodeBuild = format === 'cjs';

console.log('----------target', target);
console.log('----------format', format);

// resolve output
const outputFormat = format.startsWith('global')
  ? 'iife'
  : isNodeBuild
    ? 'cjs'
    : 'esm';

// 浏览器环境下需要打包依赖，node环境下可以直接引用资源，不需要打包
const external = isNodeBuild
  ? [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ]
  : undefined;

const outfile = resolve(__dirname, `../packages/${ target }/dist/${ target }.${ format }.js`);
const relativeOutfile = relative(process.cwd(), outfile);

console.log(pkg.buildOptions);

build({
  entryPoints: [resolve(__dirname, `../packages/${ target }/src/index.ts`)],
  outfile,
  bundle: true,
  external,
  sourcemap: true,
  format: outputFormat,
  globalName: pkg.buildOptions?.name,
  platform: isNodeBuild ? 'node' : 'browser',
  define: {
    __COMMIT__: `"dev"`,
    __VERSION__: `"${ pkg.version }"`,
    __DEV__: `true`,
    __BROWSER__: String(!isNodeBuild),
    __GLOBAL__: String(format === 'global'),
    __ESM__: String(format.includes('esm')),
    __NODE_JS__: String(isNodeBuild)
  },
  watch: {
    onRebuild(error) {
      if (!error) console.log(`rebuilt: ${ relativeOutfile }`);
    }
  }
}).then(() => {
  console.log(`watching: ${ relativeOutfile }`);
});
