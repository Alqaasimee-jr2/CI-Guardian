const { spawnSync } = require('child_process');
const { detectTestRunner } = require('./detector');

function parseTestMetrics(output, exitCode) {
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  // 1. Jest pattern: Tests: 2 failed, 5 passed, 7 total
  const jestMatch = output.match(/Tests:\s+(?:(\d+)\s+failed,?\s*)?(?:(\d+)\s+passed,?\s*)?(\d+)\s+total/i);
  if (jestMatch) {
    failedTests = parseInt(jestMatch[1] || '0', 10);
    passedTests = parseInt(jestMatch[2] || (jestMatch[1] ? '0' : jestMatch[3]), 10);
    totalTests = parseInt(jestMatch[3], 10);
    return { totalTests, passedTests, failedTests };
  }

  // 2. Vitest pattern: Tests 5 passed | 1 failed (6)
  const vitestMatch = output.match(/Tests\s+(?:(\d+)\s+passed)?(?:\s*\|\s*(\d+)\s+failed)?\s*\((\d+)\)/i);
  if (vitestMatch) {
    passedTests = parseInt(vitestMatch[1] || '0', 10);
    failedTests = parseInt(vitestMatch[2] || '0', 10);
    totalTests = parseInt(vitestMatch[3] || '0', 10);
    return { totalTests, passedTests, failedTests };
  }

  // 3. Mocha pattern: 12 passing (230ms), 2 failing
  const mochaPass = output.match(/(\d+)\s+passing/i);
  const mochaFail = output.match(/(\d+)\s+failing/i);
  if (mochaPass || mochaFail) {
    passedTests = mochaPass ? parseInt(mochaPass[1], 10) : 0;
    failedTests = mochaFail ? parseInt(mochaFail[1], 10) : 0;
    totalTests = passedTests + failedTests;
    return { totalTests, passedTests, failedTests };
  }

  // 4. Node --test pattern: ℹ tests 10, ℹ pass 8, ℹ fail 2
  const nodePass = output.match(/ℹ\s+pass\s+(\d+)/i) || output.match(/pass\s+(\d+)/i);
  const nodeFail = output.match(/ℹ\s+fail\s+(\d+)/i) || output.match(/fail\s+(\d+)/i);
  const nodeTotal = output.match(/ℹ\s+tests\s+(\d+)/i) || output.match(/tests\s+(\d+)/i);
  if (nodeTotal || nodePass) {
    totalTests = nodeTotal ? parseInt(nodeTotal[1], 10) : (passedTests + failedTests);
    passedTests = nodePass ? parseInt(nodePass[1], 10) : (exitCode === 0 ? totalTests : 0);
    failedTests = nodeFail ? parseInt(nodeFail[1], 10) : (exitCode !== 0 ? totalTests : 0);
    return { totalTests, passedTests, failedTests };
  }

  // Fallback if pass/fail lines exist
  if (exitCode === 0) {
    return { totalTests: 1, passedTests: 1, failedTests: 0 };
  } else {
    return { totalTests: 1, passedTests: 0, failedTests: 1 };
  }
}

function runTargetTests(targetDir, timeoutMs = 60000) {
  const runner = detectTestRunner(targetDir);

  if (!runner.configured) {
    return {
      configured: false,
      passed: true,
      reason: runner.reason,
      exitCode: 0,
      durationMs: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      output: `Notice: ${runner.reason}`
    };
  }

  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';
  const testCwd = runner.workingDir || targetDir;
  const startTime = Date.now();

  try {
    const result = spawnSync(npmCmd, ['test'], {
      cwd: testCwd,
      encoding: 'utf-8',
      timeout: timeoutMs,
      shell: isWindows,
      env: { ...process.env, CI: 'true', NO_COLOR: '1' }
    });

    const durationMs = Date.now() - startTime;
    const output = ((result.stdout || '') + '\n' + (result.stderr || '')).trim();
    const passed = result.status === 0;

    const metrics = parseTestMetrics(output, result.status);

    return {
      configured: true,
      framework: runner.framework,
      passed,
      exitCode: result.status,
      durationMs,
      totalTests: metrics.totalTests,
      passedTests: metrics.passedTests,
      failedTests: metrics.failedTests,
      output
    };
  } catch (err) {
    return {
      configured: true,
      passed: false,
      exitCode: 1,
      durationMs: Date.now() - startTime,
      totalTests: 0,
      passedTests: 0,
      failedTests: 1,
      output: `Test runner execution error: ${err.message}`
    };
  }
}

module.exports = {
  runTargetTests,
  parseTestMetrics
};
