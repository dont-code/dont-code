#!/usr/bin/env node
/**
 * Assemble the deployment-agnostic dont-code release bundle.
 *
 * Inputs are already-built artefacts. This script never contacts a deployment
 * target and never reads deployment secrets. It copies, neutralises and
 * checksums the artefacts into:
 *
 *   <output-dir>/dont-code-<version>/
 *
 * No domain, Mongo URI, API key or nginx configuration is allowed to survive.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const PLUGINS = [
  { id: 'default-plugin', packagePath: 'plugins/xt-default/package.json' },
  { id: 'intl-plugin', packagePath: 'plugins/xt-intl/package.json' },
  { id: 'web-plugin', packagePath: 'plugins/xt-web/package.json' },
  { id: 'finance-plugin', packagePath: 'plugins/xt-finance/package.json' },
  { id: 'agenda-plugin', packagePath: 'plugins/xt-agenda/package.json' },
  { id: 'editor-plugin', packagePath: 'plugins/xt-editor/package.json' },
  { id: 'workflow-plugin', packagePath: 'plugins/xt-workflow/package.json' }
];

// Longest / most specific first. Replacements keep the bundle deployment-neutral.
const TEXT_REPLACEMENTS = [
  ['https://dont-code.net/apps/latest/', '/apps/'],
  ['http://dont-code.net/apps/latest/', '/apps/'],
  ['https://dont-code.net/apps/next/', '/apps/'],
  ['http://dont-code.net/apps/next/', '/apps/'],
  ['https://test.dont-code.net/apps/latest/', '/apps/'],
  ['https://test.dont-code.net/apps/next/', '/apps/'],
  ['https://dont-code.net/dashboard/', '/'],
  ['https://dont-code.net/assets/', '/assets/'],
  ['https://dont-code.net/project-schema-mistral.json', '/assets/schema/project-schema-mistral.json'],
  ['https://dont-code.net/schemas/v1/repository-schema.json', ''],
  ['https://test.dont-code.net/demo/documents', ''],
  ['https://test.dont-code.net/demo/project', ''],
  ['https://test.dont-code.net/demo/data', ''],
  ['https://test.dont-code.net/data', ''],
  ['https://test.dont-code.net/documents', ''],
  ['https://test.dont-code.net/next/', '/apps/'],
  ['wss://test.dont-code.net', ''],
  ['ws://test.dont-code.net', ''],
  ['https://collinfr.net/dont-code/documents', ''],
  ['https://collinfr.net/dont-code/data', ''],
  ['https://collinfr.net/dont-code/project', ''],
  ['http://collinfr.net/dont-code/documents', ''],
  ['http://localhost:8084/documents', ''],
  ['https://ng-xtend.dev', ''],
  ['https://dont-code.net', ''],
  ['http://dont-code.net', ''],
  ['https://collinfr.net', ''],
  ['http://collinfr.net', ''],
  ['https://test.dont-code.net', ''],
  ['http://test.dont-code.net', '']
];

const FORBIDDEN_TEXT = [
  [/dont-code\.net/i, 'public hostname'],
  [/collinfr\.net/i, 'public hostname'],
  [/ng-xtend\.dev/i, 'public hostname'],
  [/localhost:(?:420\d|8084)\b/i, 'local development URL'],
  [/mongodb(?:\+srv)?:\/\//i, 'Mongo URI'],
  [/(?:api[_-]?key|secret|password)\s*[:=]\s*["'][^"'\s]+["']/i, 'credential literal']
];

const TEXT_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.json', '.html', '.htm', '.css', '.txt',
  '.svg', '.xml', '.yaml', '.yml', '.md', '.properties'
]);

function parseArgs(argv) {
  const args = {
    version: undefined,
    repo: process.cwd(),
    ngXtend: undefined,
    ngXtendDist: undefined,
    dashboardDist: undefined,
    projectJar: undefined,
    dataJar: undefined,
    projectPom: undefined,
    dataPom: undefined,
    projectServicesVersion: undefined,
    dataServicesVersion: undefined,
    ngXtendVersions: undefined,
    cli: undefined,
    outputDir: undefined,
    tarball: undefined
  };
  const keys = new Map([
    ['--version', 'version'],
    ['--repo', 'repo'],
    ['--ng-xtend', 'ngXtend'],
    ['--ng-xtend-dist', 'ngXtendDist'],
    ['--dashboard-dist', 'dashboardDist'],
    ['--project-jar', 'projectJar'],
    ['--data-jar', 'dataJar'],
    ['--project-pom', 'projectPom'],
    ['--data-pom', 'dataPom'],
    ['--project-services-version', 'projectServicesVersion'],
    ['--data-services-version', 'dataServicesVersion'],
    ['--ng-xtend-versions', 'ngXtendVersions'],
    ['--cli', 'cli'],
    ['--output-dir', 'outputDir'],
    ['--tarball', 'tarball']
  ]);
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      console.log('Usage: assemble-bundle.mjs --version <version> [options]');
      process.exit(0);
    }
    const key = keys.get(token);
    if (!key) throw new Error(`Unknown argument: ${token}`);
    const value = argv[++i];
    if (!value) throw new Error(`Missing value for ${token}`);
    args[key] = value;
  }
  if (!args.version) throw new Error('--version is required');
  const repo = path.resolve(args.repo);
  args.repo = repo;
  args.ngXtend = path.resolve(args.ngXtend ?? path.join(repo, '..', 'ng-xtend'));
  args.ngXtendDist = path.resolve(args.ngXtendDist ?? path.join(args.ngXtend, 'dist', 'latest'));
  args.dashboardDist = path.resolve(args.dashboardDist ?? path.join(repo, 'apps', 'dashboard', 'dist', 'dashboard', 'browser'));
  args.projectJar = path.resolve(args.projectJar ?? path.join(repo, '..', 'project-services', 'target', 'project-services-runner.jar'));
  args.dataJar = path.resolve(args.dataJar ?? path.join(repo, '..', 'data-services', 'target', 'data-services-runner.jar'));
  args.projectPom = path.resolve(args.projectPom ?? path.join(repo, '..', 'project-services', 'pom.xml'));
  args.dataPom = path.resolve(args.dataPom ?? path.join(repo, '..', 'data-services', 'pom.xml'));
  args.cli = path.resolve(args.cli ?? path.join(repo, 'scripts', 'release', 'dont-code'));
  args.outputDir = path.resolve(args.outputDir ?? path.join(repo, 'dist', 'release'));
  args.tarball = args.tarball ? path.resolve(args.tarball) : undefined;
  return args;
}

function safeVersion(version) {
  const safe = version.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!safe) throw new Error(`Invalid release version: ${version}`);
  return safe;
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function requireFile(target, label) {
  const stat = await fs.stat(target).catch(() => null);
  if (!stat?.isFile()) throw new Error(`Missing ${label}: ${target}`);
}

async function requireDir(target, label) {
  const stat = await fs.stat(target).catch(() => null);
  if (!stat?.isDirectory()) throw new Error(`Missing ${label}: ${target}`);
}

async function copyTree(source, destination, { exclude = new Set(), dropSourceMaps = true } = {}) {
  await fs.mkdir(destination, { recursive: true });
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    if (exclude.has(entry.name)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyTree(from, to, { exclude, dropSourceMaps });
    } else if (entry.isFile()) {
      if (dropSourceMaps && entry.name.endsWith('.map')) continue;
      await fs.copyFile(from, to);
    }
  }
}

async function findBuildDir(distRoot, name) {
  const nested = path.join(distRoot, name, 'browser');
  if (await exists(nested)) return nested;
  const flat = path.join(distRoot, name);
  if (await exists(flat)) return flat;
  throw new Error(`Missing build output for ${name} under ${distRoot}`);
}

async function readJson(target) {
  return JSON.parse(await fs.readFile(target, 'utf8'));
}

async function writeJson(target, value) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function pomVersion(contents, artifactId) {
  const match = contents.match(/<artifactId>\s*[^<]*<\/artifactId>\s*<version>\s*([^<\s]+)\s*<\/version>/);
  if (match) return match[1];
  // Fall back to the first project version when the artifact id is not adjacent.
  const generic = contents.match(/<version>\s*([^<\s]+)\s*<\/version>/);
  if (!generic) throw new Error(`Cannot read version from ${artifactId} pom`);
  return generic[1];
}

function exactDeclaredVersions(packages) {
  const result = {};
  for (const pkg of packages) {
    const declared = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    for (const [name, version] of Object.entries(declared)) {
      if (/^\d/.test(version)) result[name] = version;
    }
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

function sourceInfo(name, repository, refEnv, shaEnv, fallbackRef = 'main') {
  return {
    repository,
    ref: process.env[refEnv] || fallbackRef,
    sha: process.env[shaEnv] || 'unknown'
  };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with status ${result.status}`);
  return result;
}

async function isTextFile(target) {
  const ext = path.extname(target).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return true;
  if (target.endsWith(`${path.sep}bin${path.sep}dont-code`) || target.endsWith(`${path.sep}VERSION`)) return true;
  const handle = await fs.open(target, 'r');
  try {
    const buffer = Buffer.alloc(4096);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return !buffer.subarray(0, bytesRead).includes(0);
  } finally {
    await handle.close();
  }
}

async function scrubTextFiles(root) {
  const pending = [root];
  let scrubbed = 0;
  while (pending.length) {
    const current = pending.pop();
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(target);
      } else if (entry.isFile() && await isTextFile(target)) {
        const original = await fs.readFile(target, 'utf8');
        let updated = original;
        for (const [from, to] of TEXT_REPLACEMENTS) updated = updated.split(from).join(to);
        if (updated !== original) {
          await fs.writeFile(target, updated, 'utf8');
          scrubbed += 1;
        }
      }
    }
  }
  return scrubbed;
}

function assertNoForbiddenText(contents, label) {
  for (const [pattern, description] of FORBIDDEN_TEXT) {
    if (pattern.test(contents)) throw new Error(`${label} still contains a ${description}`);
  }
}

async function assertBundleClean(root) {
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      const relative = path.relative(root, target);
      if (entry.isDirectory()) {
        pending.push(target);
      } else if (entry.isFile() && await isTextFile(target)) {
        assertNoForbiddenText(await fs.readFile(target, 'utf8'), relative);
      }
    }
  }
}

async function rewriteBaseHrefs(targets) {
  const rewritten = [];
  for (const { file, baseHref, label } of targets) {
    if (!await exists(file)) throw new Error(`Missing index.html for ${label}: ${file}`);
    const original = await fs.readFile(file, 'utf8');
    if (!/<base\s+href=/i.test(original)) throw new Error(`No <base href> found in ${file}`);
    const updated = original.replace(/<base\s+href="[^"]*">/i, `<base href="${baseHref}">`);
    await fs.writeFile(file, updated, 'utf8');
    rewritten.push(`${label}: ${baseHref}`);
  }
  return rewritten;
}

async function neutralizeJar(jarPath) {
  const extract = spawnSync('unzip', ['-p', jarPath, 'application.properties'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (extract.error) throw extract.error;
  if (extract.status !== 0) throw new Error(`Cannot read application.properties from ${jarPath}`);

  const neutralized = extract.stdout.split(/\r?\n/).filter((line) => !/^\s*%scalewaytest\./.test(line)).map((line) => {
    if (/^\s*quarkus\.mongodb\..*connection-string\s*=/.test(line)) return line.replace(/=.*$/, '= ');
    if (/^\s*document-external-url\s*=/.test(line)) return line.replace(/=.*$/, '= ');
    return line;
  }).join('\n');
  assertNoForbiddenText(neutralized, `${path.basename(jarPath)}:application.properties`);

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dont-code-jar-'));
  try {
    const propertiesFile = path.join(workDir, 'application.properties');
    await fs.writeFile(propertiesFile, neutralized, 'utf8');
    const dosEpoch = new Date('1980-01-01T00:00:00Z');
    await fs.utimes(propertiesFile, dosEpoch, dosEpoch);
    run('zip', ['-q', '-X', jarPath, 'application.properties'], { cwd: workDir });
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

async function sha256File(target) {
  const hash = crypto.createHash('sha256');
  hash.update(await fs.readFile(target));
  return hash.digest('hex');
}

async function listFiles(root) {
  const files = [];
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile()) files.push(target);
    }
  }
  return files.sort();
}

async function writeChecksums(root) {
  const lines = [];
  for (const file of await listFiles(root)) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    if (relative === 'SHA256SUMS') continue;
    lines.push(`${await sha256File(file)}  ${relative}`);
  }
  await fs.writeFile(path.join(root, 'SHA256SUMS'), `${lines.join('\n')}\n`, 'utf8');
  return lines.length;
}

async function createTarball(bundleDir, tarball) {
  await fs.mkdir(path.dirname(tarball), { recursive: true });
  run('tar', [
    '--sort=name',
    '--mtime=@0',
    '--owner=0',
    '--group=0',
    '--numeric-owner',
    '-czf', tarball,
    '-C', path.dirname(bundleDir), path.basename(bundleDir)
  ], { env: { ...process.env, SOURCE_DATE_EPOCH: '0' } });
  const checksum = await sha256File(tarball);
  await fs.writeFile(`${tarball}.sha256`, `${checksum}  ${path.basename(tarball)}\n`, 'utf8');
  return checksum;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const version = safeVersion(args.version);
  const bundleName = `dont-code-${version}`;
  const bundleDir = path.join(args.outputDir, bundleName);

  await requireDir(args.dashboardDist, 'dashboard build output');
  await requireDir(args.ngXtendDist, 'ng-xtend build output');
  await requireFile(args.projectJar, 'project-services jar');
  await requireFile(args.dataJar, 'data-services jar');
  await requireFile(args.cli, 'bin/dont-code template');

  await fs.rm(bundleDir, { recursive: true, force: true });
  await fs.mkdir(bundleDir, { recursive: true });

  const webRoot = path.join(bundleDir, 'web');
  await copyTree(args.dashboardDist, path.join(webRoot, 'dashboard'), {
    exclude: new Set(['repo', 'prerendered-routes.json'])
  });
  const dashboardIndex = path.join(webRoot, 'dashboard', 'index.html');
  const dashboardCsrIndex = path.join(webRoot, 'dashboard', 'index.csr.html');
  if (await exists(dashboardCsrIndex)) {
    await fs.rename(dashboardCsrIndex, dashboardIndex);
  } else if (!await exists(dashboardIndex)) {
    throw new Error(`Dashboard build has no index.html or index.csr.html: ${args.dashboardDist}`);
  }

  const hostSource = await findBuildDir(args.ngXtendDist, 'host');
  await copyTree(hostSource, path.join(webRoot, 'apps', 'host'));
  for (const plugin of PLUGINS) {
    const source = await findBuildDir(args.ngXtendDist, plugin.id);
    await copyTree(source, path.join(webRoot, 'apps', plugin.id));
  }

  const servicesDir = path.join(bundleDir, 'services');
  await fs.mkdir(servicesDir, { recursive: true });
  await fs.copyFile(args.projectJar, path.join(servicesDir, 'project-services.jar'));
  await fs.copyFile(args.dataJar, path.join(servicesDir, 'data-services.jar'));
  await neutralizeJar(path.join(servicesDir, 'project-services.jar'));
  await neutralizeJar(path.join(servicesDir, 'data-services.jar'));

  const binDir = path.join(bundleDir, 'bin');
  await fs.mkdir(binDir, { recursive: true });
  await fs.copyFile(args.cli, path.join(binDir, 'dont-code'));
  await fs.chmod(path.join(binDir, 'dont-code'), 0o755);

  await fs.writeFile(path.join(bundleDir, 'VERSION'), `${version}\n`, 'utf8');
  await fs.rm(path.join(webRoot, 'dashboard', 'assets', 'config'), { recursive: true, force: true });
  await fs.rm(path.join(webRoot, 'apps', 'host', 'assets', 'config'), { recursive: true, force: true });
  await writeJson(path.join(webRoot, 'dashboard', 'assets', 'config', 'default.json'), {
    name: 'Dont-code',
    description: 'Repository configured at install time.',
    projectApiUrl: '',
    generateApiUrl: '',
    applicationHostUrl: ''
  });
  await writeJson(path.join(webRoot, 'apps', 'host', 'assets', 'config', 'default.json'), {
    name: 'Dont-code',
    description: 'Repository configured at install time.',
    projectApiUrl: '',
    storeApiUrl: '',
    documentApiUrl: '',
    plugins: []
  });

  const scrubbedFiles = await scrubTextFiles(bundleDir);
  const baseHrefTargets = [
    { file: path.join(webRoot, 'dashboard', 'index.html'), baseHref: '/', label: 'dashboard' },
    { file: path.join(webRoot, 'apps', 'host', 'index.html'), baseHref: '/apps/host/', label: 'host' },
    ...PLUGINS.map((plugin) => ({
      file: path.join(webRoot, 'apps', plugin.id, 'index.html'),
      baseHref: `/apps/${plugin.id}/`,
      label: plugin.id
    }))
  ];
  const baseHrefs = await rewriteBaseHrefs(baseHrefTargets);

  const dashboardPkg = await readJson(path.join(args.repo, 'apps', 'dashboard', 'package.json'));
  const hostPkg = await readJson(path.join(args.ngXtend, 'apps', 'xt-host', 'package.json'));
  const pluginPackages = {};
  for (const plugin of PLUGINS) {
    pluginPackages[plugin.id] = await readJson(path.join(args.ngXtend, plugin.packagePath));
  }
  let projectServicesVersion = args.projectServicesVersion;
  let dataServicesVersion = args.dataServicesVersion;
  if (!projectServicesVersion) {
    await requireFile(args.projectPom, 'project-services pom');
    projectServicesVersion = pomVersion(await fs.readFile(args.projectPom, 'utf8'), 'project-services');
  }
  if (!dataServicesVersion) {
    await requireFile(args.dataPom, 'data-services pom');
    dataServicesVersion = pomVersion(await fs.readFile(args.dataPom, 'utf8'), 'data-services');
  }
  const ngXtendNpmLibraries = args.ngXtendVersions
    ? await readJson(args.ngXtendVersions)
    : undefined;

  const manifest = {
    schemaVersion: 1,
    version,
    bundle: bundleName,
    deploymentSpecificConfig: false,
    source: {
      'dont-code': sourceInfo('dont-code', 'dont-code/dont-code', 'SOURCE_DONT_CODE_REF', 'SOURCE_DONT_CODE_SHA'),
      core: sourceInfo('core', 'dont-code/core', 'SOURCE_CORE_REF', 'SOURCE_CORE_SHA'),
      'common-quarkus-mongo': sourceInfo('common-quarkus-mongo', 'dont-code/common-quarkus-mongo', 'SOURCE_COMMON_REF', 'SOURCE_COMMON_SHA'),
      'project-services': sourceInfo('project-services', 'dont-code/project-services', 'SOURCE_PROJECT_SERVICES_REF', 'SOURCE_PROJECT_SERVICES_SHA'),
      'data-services': sourceInfo('data-services', 'dont-code/data-services', 'SOURCE_DATA_SERVICES_REF', 'SOURCE_DATA_SERVICES_SHA'),
      'ng-xtend': sourceInfo('ng-xtend', 'dont-code/ng-xtend', 'SOURCE_NG_XTEND_REF', 'SOURCE_NG_XTEND_SHA')
    },
    runtime: {
      node: process.env.NODE_VERSION_PIN || '24',
      java: process.env.JAVA_VERSION_PIN || '25',
      quarkus: process.env.QUARKUS_VERSION || '3.38.0',
      mongodb: process.env.MONGODB_VERSION_PIN || '7.x',
      declaredExact: exactDeclaredVersions([dashboardPkg, hostPkg, ...Object.values(pluginPackages)])
    },
    components: {
      dashboard: { path: 'web/dashboard', version: dashboardPkg.version },
      host: { path: 'web/apps/host', version: (await fs.readFile(path.join(args.ngXtend, 'version.txt'), 'utf8')).trim() },
      plugins: PLUGINS.map((plugin) => ({
        id: plugin.id,
        path: `web/apps/${plugin.id}`,
        version: pluginPackages[plugin.id].version
      })),
      services: {
        'project-services': { path: 'services/project-services.jar', version: projectServicesVersion },
        'data-services': { path: 'services/data-services.jar', version: dataServicesVersion }
      },
      ...(ngXtendNpmLibraries ? { ngXtendNpmLibraries } : {})
    },
    baseHrefs
  };
  await writeJson(path.join(bundleDir, 'manifest.json'), manifest);

  await assertBundleClean(bundleDir);

  const checksummedFiles = await writeChecksums(bundleDir);
  const tarballChecksum = args.tarball ? await createTarball(bundleDir, args.tarball) : undefined;

  console.log(`Bundle: ${bundleDir}`);
  console.log(`Checksummed files: ${checksummedFiles}`);
  console.log(`Scrubbed text files: ${scrubbedFiles}`);
  console.log(`Base hrefs: ${baseHrefs.length}`);
  if (args.tarball) console.log(`Tarball: ${args.tarball} (sha256 ${tarballChecksum})`);
}

main().catch((error) => {
  console.error(`assemble-bundle: ${error.message}`);
  process.exit(1);
});
