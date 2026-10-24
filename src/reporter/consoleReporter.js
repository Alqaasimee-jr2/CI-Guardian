const useColor = Boolean(process.stdout.isTTY && !process.env.NO_COLOR);

const c = {
  reset: useColor ? '\x1b[0m' : '',
  bold: useColor ? '\x1b[1m' : '',
  dim: useColor ? '\x1b[2m' : '',
  red: useColor ? '\x1b[31m' : '',
  green: useColor ? '\x1b[32m' : '',
  yellow: useColor ? '\x1b[33m' : '',
  blue: useColor ? '\x1b[34m' : '',
  cyan: useColor ? '\x1b[36m' : '',
  bgRed: useColor ? '\x1b[41m\x1b[37m\x1b[1m' : '',
  bgGreen: useColor ? '\x1b[42m\x1b[30m\x1b[1m' : '',
  bgYellow: useColor ? '\x1b[43m\x1b[30m\x1b[1m' : ''
};

function printScorecard(securityPct, testPct, isClean) {
  const width = 64;
  const barLen = 16;

  const secFilled = Math.round((securityPct / 100) * barLen);
  const secBar = '█'.repeat(secFilled) + '░'.repeat(barLen - secFilled);

  const testFilled = Math.round((testPct / 100) * barLen);
  const testBar = '█'.repeat(testFilled) + '░'.repeat(barLen - testFilled);

  console.log(`\n${c.cyan}┌${'─'.repeat(width)}┐${c.reset}`);
  console.log(`${c.cyan}│${c.reset}  ${c.bold}PRE-FLIGHT READINESS SCORECARD${c.reset}${' '.repeat(width - 32)}${c.cyan}│${c.reset}`);
  console.log(`${c.cyan}├${'─'.repeat(width)}┤${c.reset}`);

  const secColor = securityPct === 100 ? c.green : c.yellow;
  const secLine = `  Security Health : [${secColor}${secBar}${c.reset}] ${secColor}${securityPct}%${c.reset}`;
  console.log(`${c.cyan}│${c.reset}${secLine}${' '.repeat(Math.max(0, width - 39))}${c.cyan}│${c.reset}`);

  const testColor = testPct === 100 ? c.green : (testPct === 0 ? c.red : c.yellow);
  const testLine = `  Test Pass Rate  : [${testColor}${testBar}${c.reset}] ${testColor}${testPct}%${c.reset}`;
  console.log(`${c.cyan}│${c.reset}${testLine}${' '.repeat(Math.max(0, width - 39))}${c.cyan}│${c.reset}`);

  console.log(`${c.cyan}├${'─'.repeat(width)}┤${c.reset}`);
  const verdictBadge = isClean
    ? `${c.bgGreen} ✔ CLEAN - APPROVED FOR MERGE ${c.reset}`
    : `${c.bgRed} 🚨 ACTION REQUIRED - BLOCKED ${c.reset}`;
  console.log(`${c.cyan}│${c.reset}  Verdict : ${verdictBadge}${' '.repeat(Math.max(0, width - 40))}${c.cyan}│${c.reset}`);
  console.log(`${c.cyan}└${'─'.repeat(width)}┘${c.reset}\n`);
}

function renderConsoleReport(scanRes, testRes, targetDir, mode, artifacts) {
  const findings = scanRes.findings || [];
  const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
  const highCount = findings.filter(f => f.severity === 'HIGH').length;
  const isClean = findings.length === 0 && testRes.passed;

  console.log(`\n${c.cyan}${c.bold}============================================================================${c.reset}`);
  console.log(`${c.cyan}${c.bold}  CI-GUARDIAN — PRE-FLIGHT SECURITY & QUALITY GATE 🛡️${c.reset}`);
  console.log(`${c.cyan}${c.bold}============================================================================${c.reset}`);
  console.log(`Target Repository : ${c.bold}${targetDir}${c.reset}`);
  console.log(`Scan Mode         : ${c.dim}${mode.toUpperCase()} (Scanned ${scanRes.scannedFilesCount} files)${c.reset}`);
  console.log(`Audit Timestamp   : ${c.dim}${new Date().toISOString()}${c.reset}`);
  console.log(`${c.cyan}----------------------------------------------------------------------------${c.reset}`);

  // PHASE 1: SECURITY
  console.log(`\n${c.bold}[PHASE 1: STATIC AST SECURITY SCAN]${c.reset}`);
  if (findings.length > 0) {
    console.log(`Status        : ${c.yellow}${c.bold}VULNERABILITIES DETECTED${c.reset}`);
    console.log(`Total Issues  : ${c.bold}${findings.length}${c.reset} (${c.red}${criticalCount} Critical${c.reset}, ${c.yellow}${highCount} High${c.reset})\n`);

    findings.forEach((f, idx) => {
      const badge = f.severity === 'CRITICAL' ? `${c.bgRed} CRITICAL ${c.reset}` : `${c.bgYellow} HIGH ${c.reset}`;
      console.log(`  ${c.bold}#${idx + 1}${c.reset} ${badge} ${c.bold}${f.issue}${c.reset}`);
      console.log(`     Location : ${c.cyan}${f.file}:${f.line}${c.reset}`);
      console.log(`     Detail   : ${f.description}`);
      console.log(`     Code     : ${c.dim}${f.snippet}${c.reset}`);
      console.log(`     Action   : ${c.yellow}${f.remediation}${c.reset}`);
      console.log('');
    });
  } else {
    console.log(`Status        : ${c.green}${c.bold}PASSED — 0 VULNERABILITIES DETECTED${c.reset}`);
    console.log(`  ${c.green}✔ All AST security rules clean.${c.reset}`);
  }

  // PHASE 2: TESTS
  console.log(`\n${c.bold}[PHASE 2: TARGET TEST SUITE EXECUTION]${c.reset}`);
  if (!testRes.configured) {
    console.log(`Runner Status : ${c.yellow}NO TESTS CONFIGURED${c.reset}`);
    console.log(`Detail        : ${c.dim}${testRes.reason}${c.reset}`);
  } else {
    console.log(`Runner Status : ${testRes.passed ? `${c.green}${c.bold}PASSED (100% GREEN)${c.reset}` : `${c.red}${c.bold}FAILED${c.reset}`}`);
    console.log(`Framework     : ${c.dim}${testRes.framework || 'npm test'}${c.reset}`);
    console.log(`Duration      : ${c.dim}${testRes.durationMs}ms${c.reset}`);
    console.log(`Metrics       : ${testRes.passedTests}/${testRes.totalTests} tests passing\n`);
  }

  // PHASE 3: ARTIFACTS
  if (artifacts) {
    console.log(`${c.bold}[PHASE 3: GENERATED PRE-FLIGHT ARTIFACTS]${c.reset}`);
    console.log(`  📄 PR Markdown Description : ${c.cyan}${artifacts.prDocPath}${c.reset}`);
    console.log(`  💬 PR Comment Snippet      : ${c.cyan}${artifacts.commentPath}${c.reset}`);
    if (artifacts.htmlPath) {
      console.log(`  🌐 Interactive Dashboard   : ${c.cyan}${artifacts.htmlPath}${c.reset}`);
    }
    if (artifacts.sarifPath) {
      console.log(`  🛡️ SARIF Security Report   : ${c.cyan}${artifacts.sarifPath}${c.reset}`);
    }
  }

  // SCORECARD
  const secScore = findings.length === 0 ? 100 : Math.max(10, 100 - (criticalCount * 30 + highCount * 20));
  const testScore = !testRes.configured ? 100 : (testRes.totalTests > 0 ? Math.round((testRes.passedTests / testRes.totalTests) * 100) : (testRes.passed ? 100 : 0));
  printScorecard(secScore, testScore, isClean);

  // FINAL VERDICT
  console.log(`${c.cyan}${c.bold}============================================================================${c.reset}`);
  if (isClean) {
    console.log(`${c.green}${c.bold}>> PRE-FLIGHT VERDICT: [CLEAN] — Zero security issues & tests passing!${c.reset}`);
    console.log(`${c.dim}>> Ready for pull request merge.${c.reset}`);
  } else if (!testRes.passed) {
    console.log(`${c.red}${c.bold}>> PRE-FLIGHT VERDICT: [FAILED] — Target tests failed.${c.reset}`);
    console.log(`${c.dim}>> Fix failing test assertions before merging.${c.reset}`);
  } else {
    console.log(`${c.yellow}${c.bold}>> PRE-FLIGHT VERDICT: [ACTION REQUIRED] — Blocker security findings detected.${c.reset}`);
    console.log(`${c.dim}>> Resolve security findings listed above before merging.${c.reset}`);
  }
  console.log(`${c.cyan}${c.bold}============================================================================${c.reset}\n`);
}

module.exports = {
  renderConsoleReport
};
