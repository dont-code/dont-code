#!/usr/bin/env node
/**
 * Prepare and build ng-xtend app shells against npm-published libraries.
 *
 * `prepare` resolves a dist-tag to exact npm versions, rewrites the workspace
 * dependencies of the apps to those versions, and marks the local library
 * projects as decoupled in rush.json. `build` then compiles only the app
 * shells (host + plugins), never the libraries.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const NPM_PACKAGES = [
  'xt-type',
  'xt-store',
  'xt-components',
  'dc-workflow',
  'xt-plugin-default',
  'xt-plugin-workflow'
];

const APPS = [
  { dir: 'apps/xt-host', project: 'host', output: 'host' },
  { dir: 'plugins/xt-default', project: 'default-plugin', output: 'default-plugin' },
  { dir: 'plugins/xt-intl', project: 'intl-plugin', output: 'intl-plugin' },
  { dir: 'plugins/xt-web', project: 'web-plugin', output: 'web-plugin' },
  { dir: 'plugins/xt-finance', project: 'finance-plugin', output: 'finance-plugin' },
  { dir: 'plugins/xt-agenda', project: 'agenda-plugin', output: 'agenda-plugin' },
  { dir: 'plugins/xt-editor', project: 'editor-plugin', output: 'editor-plugin' },
  { dir: 'plugins/xt-workflow', project: 'workflow-plugin', output: 'workflow-plugin' }
];

function parseArgs(argv) {
  const args = { ngXtend: process.cwd(), tag: 'latest', mode: undefined, buildConfig: undefined, versionsOut: undefined };
  const keys = new Map([
    ['--ng-xtend', 'ngXtend'],
    ['--tag', 'tag'],
    ['--mode', 'mode'],
    ['--build-config', 'buildConfig'],
    ['--versions-out', 'versionsOut']
  ]);
  for (let i = 0; i < argv.length; i += 1) {
    const key = keys.get(argv[i]);
    if (!key) throw new Error(`Unknown argument: ${argv[i]}`);
    const value = argv[++i];
    if (!value) throw new Error(`Missing value for ${argv[i]}`);
    args[key] = value;
  }
  if (!['prepare', 'build'].includes(args.mode)) throw new Error('--mode must be prepare or build');
  if (!['latest', 'next'].includes(args.tag)) throw new Error('--tag must be latest or next');
  args.ngXtend = path.resolve(args.ngXtend);
  args.buildConfig = args.buildConfig || (args.tag === 'next' ? 'next' : 'production');
  args.versionsOut = args.versionsOut
    ? path.resolve(args.versionsOut)
    : path.join(args.ngXtend, '.release-npm-versions.json');
  return args;
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with status ${result.status}`);
}

function parseNpmValue(packageName, output) {
  const parsed = JSON.parse(output.trim());
  const value = Array.isArray(parsed) ? parsed[parsed.length - 1] : parsed;
  if (typeof value !== 'string' || !value) {
    throw new Error(`Unexpected npm metadata for ${packageName}: ${output.trim()}`);
  }
  return value;
}

function resolveNpmVersion(packageName, tag) {
  const result = spawnSync('npm', ['view', `${packageName}@${tag}`, 'version', '--json'], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Cannot resolve ${packageName}@${tag} from npm`);
  return parseNpmValue(packageName, result.stdout);
}

function resolveNpmDependency(packageName, version, dependencyName) {
  const result = spawnSync('npm', ['view', `${packageName}@${version}`, `dependencies.${dependencyName}`, '--json'], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Cannot resolve ${dependencyName} for ${packageName}@${version}`);
  return parseNpmValue(`${packageName}.dependencies.${dependencyName}`, result.stdout);
}

async function prepare(args) {
  const versions = {};
  for (const packageName of NPM_PACKAGES) {
    versions[packageName] = resolveNpmVersion(packageName, args.tag);
    console.log(`${packageName}@${args.tag} -> ${versions[packageName]}`);
  }

  // xt-type imports eta/core. pnpm does not hoist transitive dependencies into
  // an app's node_modules, so declare it explicitly for the app-shell builds.
  const etaRange = resolveNpmDependency('xt-type', versions['xt-type'], 'eta');
  console.log(`xt-type@${versions['xt-type']} needs eta@${etaRange}`);

  for (const app of APPS) {
    const file = path.join(args.ngXtend, app.dir, 'package.json');
    const pkg = JSON.parse(await fs.readFile(file, 'utf8'));
    for (const section of ['dependencies', 'devDependencies']) {
      for (const [name, declared] of Object.entries(pkg[section] ?? {})) {
        if (versions[name] && String(declared).startsWith('workspace:')) {
          pkg[section][name] = versions[name];
        }
      }
    }
    pkg.dependencies = { ...(pkg.dependencies ?? {}), eta: etaRange };
    await fs.writeFile(file, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  }

  const rushFile = path.join(args.ngXtend, 'rush.json');
  let rush = await fs.readFile(rushFile, 'utf8');
  const decoupled = JSON.stringify(NPM_PACKAGES);
  for (const app of APPS) {
    const needle = `"projectFolder": "${app.dir}",`;
    const withDecoupled = `${needle}\n      "decoupledLocalDependencies": ${decoupled},`;
    if (!rush.includes(needle)) throw new Error(`Rush project not found for ${app.dir}`);
    if (!rush.includes(withDecoupled)) rush = rush.replace(needle, withDecoupled);
  }
  await fs.writeFile(rushFile, rush, 'utf8');

  await fs.mkdir(path.dirname(args.versionsOut), { recursive: true });
  await fs.writeFile(args.versionsOut, `${JSON.stringify({
    tag: args.tag,
    versions,
    additionalDependencies: { eta: etaRange }
  }, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${args.versionsOut}`);
}

async function build(args) {
  const info = JSON.parse(await fs.readFile(args.versionsOut, 'utf8'));
  console.log(`Building app shells with npm libraries from dist-tag ${info.tag}`);
  for (const app of APPS) {
    const cwd = path.join(args.ngXtend, app.dir);
    const ng = path.join(cwd, 'node_modules', '.bin', 'ng');
    await fs.access(ng);
    run(ng, [
      'build', app.project,
      `--configuration=${args.buildConfig}`,
      `--output-path=../../dist/latest/${app.output}`,
      '--base-href=/'
    ], { cwd });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === 'prepare') await prepare(args);
  else await build(args);
}

main().catch((error) => {
  console.error(`prepare-ng-xtend-binaries: ${error.message}`);
  process.exit(1);
});
