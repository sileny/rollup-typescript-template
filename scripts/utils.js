const fs = require('fs');
const chalk = require('chalk');
const execa = require('execa');
const path = require('path');

const targets = fs.readdirSync('packages').filter((f) => {
  if (!fs.statSync(`packages/${ f }`).isDirectory()) {
    return false;
  }

  const pkg = require(`../packages/${ f }/package.json`);
  return !(pkg.private && !pkg.buildOptions);
});

exports.targets = targets;

exports.fuzzyMatchTarget = (partialTargets, includeAllMatching) => {
  const matched = [];
  partialTargets.forEach((partialTarget) => {
    for (const target of targets) {
      if (target.match(partialTarget)) {
        matched.push(target);
        if (!includeAllMatching) {
          break;
        }
      }
    }
  });
  if (matched.length) {
    return matched;
  } else {
    console.log();
    console.error(`  ${ chalk.bgRed.white(' ERROR ') } ${ chalk.red(`Target ${ chalk.underline(partialTargets) } not found!`) }`);
    console.log();

    process.exit(1);
  }
};

exports.getArgv = () => require('mri')(process.argv.slice(2));

// 运行全局命令
exports.run = (bin, args, opts = {}) => execa(bin, args, { stdio: 'inherit', ...opts });

exports.getPkgRoot = (pkg) => path.resolve(__dirname, '../packages/' + pkg);

exports.step = (msg) => console.log(chalk.cyan(msg));
