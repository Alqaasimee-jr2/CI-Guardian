const fs = require('fs');
const path = require('path');

function detectTestRunner(targetDir) {
  const pkgPath = path.join(targetDir, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    return {
      configured: false,
      reason: 'No package.json found in target repository.'
    };
  }

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
      args: ['test', '--', '--no-color']
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
