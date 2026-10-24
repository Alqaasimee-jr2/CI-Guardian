const http = require('http');
const fs = require('fs');
const path = require('path');
const { parseCliArgs, resolveConfig, printUsage } = require('./config');
const { scanRepository } = require('./scanner');
const { runTargetTests } = require('./testRunner');
const { writeReports, renderConsoleReport } = require('./reporter');
const { getChangedFiles, isGitRepo } = require('./git/diff');
const { postPrCommentIfInCi } = require('./git/prCommenter');

function runGuardian(argv = process.argv.slice(2)) {
  let rawArgs;
  try {
    rawArgs = parseCliArgs(argv);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(2);
  }

  if (rawArgs.help) {
    printUsage();
    process.exit(0);
  }

  if (rawArgs.version) {
    const pkg = require('../package.json');
    console.log(`ci-guardian v${pkg.version}`);
    process.exit(0);
  }

  let config;
  try {
    config = resolveConfig(rawArgs);
  } catch (err) {
    console.error(`Configuration Error: ${err.message}`);
    process.exit(2);
  }

  const { resolvedRepo, outputDir, mode, strict, generateHtml, serve } = config;

  // Determine file filter for diff vs full mode
  let effectiveMode = mode;
  let fileFilter = null;

  if (mode === 'diff' || (mode === 'auto' && isGitRepo(resolvedRepo))) {
    const diffFiles = getChangedFiles(resolvedRepo);
    if (diffFiles && diffFiles.length > 0) {
      fileFilter = diffFiles;
      effectiveMode = 'diff';
    } else {
      effectiveMode = 'full';
    }
  } else {
    effectiveMode = 'full';
  }

  // 1. Static AST Security Scan
  console.log(`[1/3] Running AST Security Analysis on ${resolvedRepo} (Mode: ${effectiveMode.toUpperCase()})...`);
  const scanResult = scanRepository(resolvedRepo, fileFilter);

  // 2. Universal Target Test Execution
  let testResult;
  if (config.skipTests) {
    console.log(`[2/3] Skipping Target Test Runner (--security-only mode enabled)...`);
    testResult = {
      configured: false,
      skipped: true,
      passed: true,
      reason: 'Skipped via --security-only / --skip-tests flag.',
      durationMs: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      output: 'Tests skipped by user preference.'
    };
  } else {
    console.log(`[2/3] Executing Target Test Runner in ${resolvedRepo}...`);
    testResult = runTargetTests(resolvedRepo, 60000, config.testScript);
  }

  // 3. Reports & Artifacts
  console.log(`[3/3] Generating Pre-Flight Artifacts in ${outputDir}...`);
  const artifacts = writeReports(scanResult, testResult, resolvedRepo, effectiveMode, outputDir, generateHtml);

  // Render Visual Console Scorecard
  renderConsoleReport(scanResult, testResult, resolvedRepo, effectiveMode, artifacts, strict);

  // Post PR comment if running in CI with token
  if (artifacts.commentPath && fs.existsSync(artifacts.commentPath)) {
    const commentMarkdown = fs.readFileSync(artifacts.commentPath, 'utf-8');
    postPrCommentIfInCi(commentMarkdown);
  }

  // Optional HTTP preview server (only if explicitly requested via --serve)
  if (serve) {
    const port = process.env.PORT || 3000;
    const server = http.createServer((req, res) => {
      if (artifacts.htmlPath && fs.existsSync(artifacts.htmlPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(artifacts.htmlPath));
      } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('CI-Guardian report generated.');
      }
    });

    server.listen(port, () => {
      console.log(`\n🌐 Live Webview Preview running on http://localhost:${port}`);
      console.log(`   Serving ${artifacts.htmlPath}\n`);
    });
    return;
  }

  // Determine verdict & exit code
  const { determineVerdictState } = require('./reporter/consoleReporter');
  const verdict = determineVerdictState(scanResult, testResult);

  if (verdict.state === 'BLOCKED') {
    process.exit(1);
  } else if (verdict.state === 'COULD_NOT_RUN') {
    process.exit(2);
  } else if (verdict.state === 'WARNING' && strict) {
    process.exit(1);
  }

  process.exit(0);
}

module.exports = {
  runGuardian
};
