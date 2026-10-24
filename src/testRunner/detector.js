const fs = require('fs');
const path = require('path');

const IGNORED_SUBDIRS = new Set([
  'node_modules',
  '.git',
  '.guardian',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  'vendor',
  '.system_generated'
]);

function findTargetPackage(targetDir) {
  // 1. Check direct package.json in targetDir
  const rootPkg = path.join(targetDir, 'package.json');
  if (fs.existsSync(rootPkg)) {
    return { pkgPath: rootPkg, workingDir: targetDir };
  }

  // 2. Search 1-level subdirectories for monorepo / subproject structures (e.g. oaumods/, client/, frontend/, app/, web/)
  try {
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !IGNORED_SUBDIRS.has(entry.name.toLowerCase())) {
        const subPkg = path.join(targetDir, entry.name, 'package.json');
        if (fs.existsSync(subPkg)) {
          try {
            const parsed = JSON.parse(fs.readFileSync(subPkg, 'utf-8'));
            if (parsed.scripts && parsed.scripts.test) {
              return { pkgPath: subPkg, workingDir: path.join(targetDir, entry.name) };
            }
          } catch {}
        }
      }
    }
  } catch {}

  return null;
}

function detectTestRunner(targetDir) {
  const target = findTargetPackage(targetDir);

  if (!target) {
    return {
      configured: false,
      reason: 'No package.json found in target repository.'
    };
  }

  const { pkgPath, workingDir } = target;

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const testScript = pkg.scripts && pkg.scripts.test;

    if (!testScript) {
      return {
        configured: false,
        reason: 'No "test" script defined in package.json.'
      };
    }

    // Check for dummy npm default test script
    if (testScript.includes('no test specified') && testScript.includes('exit 1')) {
      return {
        configured: false,
        reason: 'Default npm placeholder test script ("no test specified").'
      };
    }

    let framework = 'npm-test';
    if (/jest/i.test(testScript)) framework = 'jest';
    else if (/vitest/i.test(testScript)) framework = 'vitest';
    else if (/mocha/i.test(testScript)) framework = 'mocha';
    else if (/node\s+--test/i.test(testScript)) framework = 'node-test';

    return {
      configured: true,
      framework,
      command: 'npm',
      args: ['test', '--', '--no-color'],
      workingDir
    };
  } catch (err) {
    return {
      configured: false,
      reason: `Failed to parse package.json: ${err.message}`
    };
  }
}

module.exports = {
  detectTestRunner
};
