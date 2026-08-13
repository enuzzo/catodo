import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(resolve(root, path), 'utf8');
const [packageSource, lockSource, changelog, readme, brief, architecture, appHtml, viteConfig] = await Promise.all([
  read('package.json'),
  read('package-lock.json'),
  read('CHANGELOG.md'),
  read('README.md'),
  read('BRIEF.md'),
  read('docs/ARCHITECTURE.md'),
  read('app.html'),
  read('vite.config.js'),
]);

const packageJson = JSON.parse(packageSource);
const packageLock = JSON.parse(lockSource);
const version = packageJson.version;
const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

expect(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version), 'package.json must contain a valid SemVer version.');
expect(packageLock.version === version, 'package-lock.json top-level version is stale.');
expect(packageLock.packages?.['']?.version === version, 'package-lock.json root package version is stale.');

const firstReleasedVersion = changelog.match(/## \[(?!Unreleased\])([^\]]+)\]/)?.[1];
expect(firstReleasedVersion === version, `CHANGELOG.md latest release must be ${version}.`);
expect(readme.startsWith(`# CATODO ${version}\n`), 'README.md version is stale.');
expect(brief.startsWith(`# CATODO ${version} — product brief\n`), 'BRIEF.md version is stale.');
expect(architecture.includes(`maintainer map for CATODO ${version}`), 'docs/ARCHITECTURE.md version is stale.');
expect(appHtml.includes('VERSION __CATODO_VERSION__'), 'app.html splash must use the injected version token.');
expect(!/VERSION \d+\.\d+\.\d+/.test(appHtml), 'app.html contains a hard-coded version.');
expect(viteConfig.includes('fileName: "version.json"'), 'Vite must emit version.json for the PHP gate.');
expect(viteConfig.includes('__CATODO_VERSION__: JSON.stringify(appVersion)'), 'Vite must expose the version to frontend modules.');

if (failures.length > 0) {
  throw new Error(`Release metadata is inconsistent:\n- ${failures.join('\n- ')}`);
}

console.log(`Release metadata OK: CATODO ${version}`);
