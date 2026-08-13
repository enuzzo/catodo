import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const targetVersion = process.argv[2];
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function compareVersions(left, right) {
  const core = (value) => value.split('-')[0].split('.').map(Number);
  const a = core(left);
  const b = core(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  if (left === right) return 0;
  if (!left.includes('-')) return 1;
  if (!right.includes('-')) return -1;
  return left.localeCompare(right);
}

if (!targetVersion || !SEMVER.test(targetVersion)) {
  throw new Error('Usage: npm run release -- X.Y.Z');
}

const packagePath = resolve(root, 'package.json');
const lockPath = resolve(root, 'package-lock.json');
const changelogPath = resolve(root, 'CHANGELOG.md');
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
const packageLock = JSON.parse(await readFile(lockPath, 'utf8'));
let changelog = await readFile(changelogPath, 'utf8');

if (compareVersions(targetVersion, packageJson.version) <= 0) {
  throw new Error(`Target ${targetVersion} must be newer than ${packageJson.version}.`);
}

const unreleasedMatch = changelog.match(/## \[Unreleased\]\n\n([\s\S]*?)(?=\n## \[)/);
if (!unreleasedMatch || unreleasedMatch[1].trim() === '') {
  throw new Error('CHANGELOG.md has no entries under [Unreleased].');
}

const releaseDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Rome',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
const releaseNotes = unreleasedMatch[1].trim();
changelog = changelog.replace(
  unreleasedMatch[0],
  `## [Unreleased]\n\n## [${targetVersion}] - ${releaseDate}\n\n${releaseNotes}\n`,
);

const repositoryUrl = 'https://github.com/enuzzo/catodo';
const previousVersion = packageJson.version;
changelog = changelog.replace(
  /^\[Unreleased\]:.*$/m,
  `[Unreleased]: ${repositoryUrl}/compare/v${targetVersion}...HEAD\n[${targetVersion}]: ${repositoryUrl}/compare/v${previousVersion}...v${targetVersion}`,
);

packageJson.version = targetVersion;
packageLock.version = targetVersion;
packageLock.packages[''].version = targetVersion;

const textUpdates = [
  ['README.md', /^# CATODO .+$/m, `# CATODO ${targetVersion}`],
  ['BRIEF.md', /^# CATODO .+? — product brief$/m, `# CATODO ${targetVersion} — product brief`],
  ['docs/ARCHITECTURE.md', /maintainer map for CATODO [0-9]+\.[0-9]+(?:\.[0-9]+)?/, `maintainer map for CATODO ${targetVersion}`],
];

await Promise.all([
  writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`),
  writeFile(lockPath, `${JSON.stringify(packageLock, null, 2)}\n`),
  writeFile(changelogPath, changelog),
  ...textUpdates.map(async ([file, pattern, replacement]) => {
    const path = resolve(root, file);
    const source = await readFile(path, 'utf8');
    if (!pattern.test(source)) throw new Error(`Could not update version in ${file}.`);
    await writeFile(path, source.replace(pattern, replacement));
  }),
]);

console.log(`Prepared CATODO ${targetVersion}. Run npm test, npm run check and npm run build before publishing.`);
