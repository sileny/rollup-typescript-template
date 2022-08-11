const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const semver = require('semver');
const { prompt } = require('enquirer');

const config = require('./.config');
const currentVersion = require('../package.json').version;
const { getArgv, getPkgRoot, step, run } = require("./utils");

const args = getArgv();

// npm run build --pre=prepatch|preminor|premajor|prerelease
const pre = args.pre || (semver.prerelease(currentVersion) && semver.prerelease(currentVersion)[0]);

const skipBuild = args.skipBuild;
const packages = fs.readdirSync(path.resolve(__dirname, '../packages'))
  .filter(p => !p.endsWith('.ts') && !p.startsWith('.'));

const skippedPackages = [];

const versionIncrements = [
  'patch',
  'minor',
  'major',
  ...(pre ? ['prepatch', 'preminor', 'premajor', 'prerelease'] : [])
];

const inc = i => semver.inc(currentVersion, i, pre);

async function main() {
  let targetVersion = args._[0];

  if (!targetVersion) {
    // no explicit version, offer suggestions
    const { release } = await prompt({
      type: 'select',
      name: 'release',
      message: 'Select release type',
      choices: versionIncrements.map(i => `${ i } (${ inc(i) })`).concat(['custom'])
    });

    if (release === 'custom') {
      targetVersion = (
        await prompt({
          type: 'input',
          name: 'version',
          message: 'Input custom version',
          initial: currentVersion
        })
      ).version;
    } else {
      targetVersion = release.match(/\((.*)\)/)[1];
    }
  }

  if (!semver.valid(targetVersion)) {
    throw new Error(`invalid target version: ${ targetVersion }`);
  }

  const { yes } = await prompt({
    type: 'confirm',
    name: 'yes',
    message: `Releasing v${ targetVersion }. Confirm?`
  });

  if (!yes) {
    return;
  }

  // update all package versions and inter-dependencies
  step('\nUpdating cross dependencies...');
  updateVersions(targetVersion);

  // build all packages with types
  step('\nBuilding all packages...');
  if (!skipBuild) {
    await run('pnpm', ['run', 'build', '--release']);
  } else {
    console.log(`(skipped)`);
  }

  // generate changelog
  step('\nGenerating changelog...');
  await run(`pnpm`, ['run', 'changelog']);

  // update pnpm-lock.yaml
  step('\nUpdating lockfile...');
  await run(`pnpm`, ['install', '--prefer-offline']);

  const { stdout } = await run('git', ['diff'], { stdio: 'pipe' });
  if (stdout) {
    step('\nCommitting changes...');
    await run('git', ['add', '-A']);
    await run('git', ['commit', '-m', `release: v${ targetVersion }`]);
  } else {
    console.log('No changes to commit.');
  }

  // publish packages
  step('\nPublishing packages...');
  for (const pkg of packages) {
    await publishPackage(pkg, targetVersion, run);
  }

  // push to GitHub
  step('\nPushing to GitHub...');
  await run('git', ['tag', `v${ targetVersion }`]);
  await run('git', ['push', 'origin', `refs/tags/v${ targetVersion }`]);
  await run('git', ['push']);

  if (skippedPackages.length) {
    console.log(
      chalk.yellow(
        `The following packages are skipped and NOT published:\n- ${ skippedPackages.join(
          '\n- '
        ) }`
      )
    );
  }
  console.log();
}

function updateVersions(version) {
  // 1. update root package.json
  updatePackage(path.resolve(__dirname, '..'), version);
  // 2. update all packages
  packages.forEach(p => updatePackage(getPkgRoot(p), version));
}

function updatePackage(pkgRoot, version) {
  const pkgPath = path.resolve(pkgRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  pkg.version = version;
  updateDeps(pkg, 'dependencies', version);
  updateDeps(pkg, 'peerDependencies', version);
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

function updateDeps(pkg, depType, version) {
  const deps = pkg[depType];
  if (!deps) return;
  Object.keys(deps).forEach(dep => {
    if (
      dep === config.name ||
      (dep.startsWith(`@${config.name}`) && packages.includes(dep.replace(new RegExp(`^@${config.name}/`), '')))
    ) {
      console.log(
        chalk.yellow(`${ pkg.name } -> ${ depType } -> ${ dep }@${ version }`)
      );
      deps[dep] = version;
    }
  });
}

async function publishPackage(pkgName, version, run) {
  if (skippedPackages.includes(pkgName)) {
    return;
  }
  const pkgRoot = getPkgRoot(pkgName);
  const pkgPath = path.resolve(pkgRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

  if (pkg.private) {
    return;
  }

  // 如果需要发布，可以遵循以下发布规则
  let releaseTag = null;
  if (args.tag) {
    releaseTag = args.tag;
  } else if (version.includes('alpha')) {
    // 内部测试版本，bug可能比较多，用法：node scripts/build.js core --tag=alpha
    releaseTag = 'alpha';
  } else if (version.includes('beta')) {
    releaseTag = 'beta';
  } else if (version.includes('rc')) {
    releaseTag = 'rc';
  }

  step(`Publishing ${ pkgName }...`);
  try {
    await run(
      'npm',
      [
        'publish',
        '--new-version',
        version,
        ...(releaseTag ? ['--tag', releaseTag] : []),
        '--access',
        'public'
      ],
      {
        cwd: pkgRoot,
        stdio: 'pipe'
      }
    );
    console.log(chalk.green(`Successfully published ${ pkgName }@${ version }`));
  } catch (e) {
    if (e.stderr.match(/previously published/)) {
      console.log(chalk.red(`Skipping already published: ${ pkgName }`));
    } else {
      throw e;
    }
  }
}

main().catch(err => {
  updateVersions(currentVersion);
  console.error(err);
});
