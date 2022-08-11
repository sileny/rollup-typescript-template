const path = require('path');
const fs = require('fs-extra');
const { getArgv } = require('./utils');

const config = require('./.config');

const pkg = require('../package.json');
const { scopedName = '', packageName = '', url = '', author = '', license = 'MIT' } = getArgv();
const packageDir = path.resolve(__dirname, '../packages/', packageName);
const name = (scopedName ? `@${ scopedName }/` : config?.name ? `@${config.name}/` : '') + packageName;

const __url__ = url ? url : pkg?.homepage?.replace(/#readme$/i, '') || '';
const __author__ = author ? author : pkg.author || '';

const json = {
  'README.md': `# ${ name }`,
  'package.json': `{
  "name": "${ name }",
  "version": "${ pkg.version }",
  "description": "${ name }",
  "main": "index.js",
  "module": "dist/${ packageName }.esm.js",
  "types": "dist/${ packageName }.d.ts",
  "unpkg": "dist/${ packageName }.global.js",
  "jsdelivr": "dist/${ packageName }.global.js",
  "repository": {
    "type": "git",
    "url": "git+${ __url__ }.git",
    "directory": "packages/${ packageName }"
  },
  "keywords": [],
  "author": "${ __author__ }",
  "license": "${ license }",
  "bugs": {
    "url": "${ __url__ }/issues"
  },
  "homepage": "${ __url__ }/tree/master/packages/${ packageName }#readme",
  "files": [
    "index.js",
    "dist"
  ]
}
`,
  'index.js': `'use strict';

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./dist/${ packageName }.cjs.prod.js')
} else {
  module.exports = require('./dist/${ packageName }.cjs.js')
}
`,
  'api-extractor.json': `{
  "extends": "../../api-extractor.json",
  "mainEntryPointFilePath": "./dist/packages/${ packageName }/src/index.d.ts",
  "dtsRollup": {
    "publicTrimmedFilePath": "./dist/${ packageName }.d.ts"
  }
}
`
};

if (fs.existsSync(packageDir)) {
  throw new Error(`${ packageDir } 已经存在`);
} else {
  fs.mkdirsSync(packageDir);
}

Object.keys(json).forEach(key => {
  const content = key.endsWith('.json')
    ? JSON.stringify(JSON.parse(json[key]), null, 2)
    : json[key];
  fs.writeFileSync(path.join(packageDir, key), content);
});
