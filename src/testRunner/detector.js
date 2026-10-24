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
            if (parsed.scripts && (parsed.scripts.test || parsed.scripts.lint || parsed.scripts.build)) {
              return { pkgPath: subPkg, workingDir: path.join(targetDir, entry.name) };
            }
          } catch {}
        }
      }
    }
  } catch {}

  return null;
}

function detectTestRunner(targetDir, customScript = null) {
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
    const scriptName = customScript || 'test';
    const scriptCmd = pkg.scripts && pkg.scripts[scriptName];

    if (!scriptCmd) {
      return {
        configured: false,
        reason: `No "${scriptName}" script defined in package.json.`
      };
    }

    // Check for dummy npm default test script
    if (scriptName === 'test' && scriptCmd.includes('no test specified') && scriptCmd.includes('exit 1')) {
      return {
        configured: false,
        reason: 'Default npm placeholder test script ("no test specified").'
      };
    }

    let framework = 'npm-test';
    if (/jest/i.test(scriptCmd)) framework = 'jest';
    else if (/vitest/i.test(scriptCmd)) framework = 'vitest';
    else if (/mocha/i.test(scriptCmd)) framework = 'mocha';
    else if (/node\s+--test/i.test(scriptCmd)) framework = 'node-test';
    else if (customScript) framework = `npm run ${customScript}`;

    return {
      configured: true,
      framework,
      scriptName,
      command: 'npm',
      args: ['run', scriptName, '--', '--no-color'],
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
