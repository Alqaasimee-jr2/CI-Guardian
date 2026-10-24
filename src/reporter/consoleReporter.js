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
  magenta: useColor ? '\x1b[35m' : '',
  bgRed: useColor ? '\x1b[41m\x1b[37m\x1b[1m' : '',
  bgGreen: useColor ? '\x1b[42m\x1b[30m\x1b[1m' : '',
  bgYellow: useColor ? '\x1b[43m\x1b[30m\x1b[1m' : ''
};

function determineVerdictState(scanRes, testRes) {
  const findings = scanRes.findings || [];
  const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
  const highCount = findings.filter(f => f.severity === 'HIGH').length;
  const hasBlockers = (criticalCount + highCount) > 0;
  const skippedCount = (scanRes.skippedFiles || []).length;

  // 1. Blocked: security findings or failing tests
  if (hasBlockers || (testRes.configured && !testRes.passed && testRes.exitCode !== null && testRes.exitCode !== 127)) {
    return {
      state: 'BLOCKED',
      badge: `${c.bgRed} 🚨 ACTION REQUIRED - BLOCKED ${c.reset}`,
      scorecardLabel: '🚨 ACTION REQUIRED - BLOCKED',
      headline: '>> PRE-FLIGHT VERDICT: [ACTION REQUIRED] — Blocker security findings or failing tests detected.',
      subline: '>> Resolve blocking security findings and failing tests before merging.',
      color: c.red
    };
  }

  // 2. Could not run: test runner crashed or command missing
  if (testRes.configured && (testRes.exitCode === 127 || testRes.timedOut || testRes.crashed)) {
    return {
      state: 'COULD_NOT_RUN',
      badge: `${c.bgRed} 💥 EXECUTION HALTED - COULD NOT RUN ${c.reset}`,
      scorecardLabel: '💥 EXECUTION HALTED - COULD NOT RUN',
      headline: `>> PRE-FLIGHT VERDICT: [COULD NOT RUN] — Test runner crashed or command missing.`,
      subline: `>> Reason: ${testRes.reason || 'Process execution error'}`,
      color: c.red
    };
  }

  // 3. Warning: no tests exist, or files were skipped (won't call this approved)
  if (!testRes.configured || skippedCount > 0) {
    const reasons = [];
    if (!testRes.configured) reasons.push('no automated tests configured');
    if (skippedCount > 0) reasons.push(`${skippedCount} file(s) skipped due to parse errors`);

    return {
      state: 'WARNING',
      badge: `${c.bgYellow} ⚠️ ATTENTION NEEDED - UNVERIFIED GAPS ${c.reset}`,
      scorecardLabel: '⚠️ ATTENTION NEEDED - UNVERIFIED GAPS',
      headline: `>> PRE-FLIGHT VERDICT: [WARNING] — Audit finished with unverified gaps (${reasons.join(', ')}).`,
      subline: '>> CI-Guardian will not approve as clean without full parse and test verification.',
      color: c.yellow
    };
  }

  // 4. Clean: only when genuinely checked and found nothing
  return {
    state: 'CLEAN',
    badge: `${c.bgGreen} ✔ CLEAN - APPROVED FOR MERGE ${c.reset}`,
    scorecardLabel: '✔ CLEAN - APPROVED FOR MERGE',
    headline: '>> PRE-FLIGHT VERDICT: [CLEAN] — Zero security issues & tests passing!',
    subline: '>> Ready for pull request merge.',
    color: c.green
  };
}

function printScorecard(securityPct, testPct, verdict) {
  const width = 64;
  const barLen = 16;

  const secFilled = Math.round((securityPct / 100) * barLen);
  const secBar = '█'.repeat(secFilled) + '░'.repeat(barLen - secFilled);

  const testFilled = Math.round((testPct / 100) * barLen);
  const testBar = '█'.repeat(testFilled) + '░'.repeat(barLen - testFilled);

  console.log(`\n${c.cyan}┌${'─'.repeat(width)}┐${c.reset}`);
  console.log(`${c.cyan}│${c.reset}  ${c.bold}PRE-FLIGHT READINESS SCORECARD${c.reset}${' '.repeat(width - 32)}${c.cyan}│${c.reset}`);
  console.log(`${c.cyan}├${'─'.repeat(width)}┤${c.reset}`);

  const secColor = securityPct === 100 ? c.green : (securityPct < 50 ? c.red : c.yellow);
  const secLine = `  Security Health : [${secColor}${secBar}${c.reset}] ${secColor}${securityPct}%${c.reset}`;
  console.log(`${c.cyan}│${c.reset}${secLine}${' '.repeat(Math.max(0, width - 39))}${c.cyan}│${c.reset}`);

  const testColor = testPct === 100 ? c.green : (testPct === 0 ? c.red : c.yellow);
  const testLine = `  Test Pass Rate  : [${testColor}${testBar}${c.reset}] ${testColor}${testPct}%${c.reset}`;
  console.log(`${c.cyan}│${c.reset}${testLine}${' '.repeat(Math.max(0, width - 39))}${c.cyan}│${c.reset}`);

  console.log(`${c.cyan}├${'─'.repeat(width)}┤${c.reset}`);
  console.log(`${c.cyan}│${c.reset}  Verdict :  ${verdict.badge}${' '.repeat(Math.max(0, width - 42))}${c.cyan}│${c.reset}`);
  console.log(`${c.cyan}└${'─'.repeat(width)}┘${c.reset}\n`);
}

function renderConsoleReport(scanRes, testRes, targetDir, mode, artifacts) {
  const findings = scanRes.findings || [];
  const suppressed = scanRes.suppressedFindings || [];
  const skipped = scanRes.skippedFiles || [];
  const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
  const highCount = findings.filter(f => f.severity === 'HIGH').length;

  const verdict = determineVerdictState(scanRes, testRes);

  console.log(`\n${c.cyan}${c.bold}============================================================================${c.reset}`);
  console.log(`${c.cyan}${c.bold}  CI-GUARDIAN — PRE-FLIGHT SECURITY & QUALITY GATE 🛡️${c.reset}`);
  console.log(`${c.cyan}${c.bold}============================================================================${c.reset}`);
  console.log(`Target Repository : ${c.bold}${targetDir}${c.reset}`);

  // Transparent accounting line
  const skippedNote = skipped.length > 0 ? `${c.yellow}Skipped ${skipped.length} (parse errors: listed below)${c.reset}` : `Skipped 0`;
  const ignoredSample = (scanRes.ignoredDirs || ['test', 'vendor', 'dist']).slice(0, 4).join('/, ') + '/';
  console.log(`Scan Accounting   : ${c.dim}Scanned ${scanRes.scannedFilesCount} files. ${c.reset}${skippedNote}${c.dim}. Ignored: ${ignoredSample}${c.reset}`);
  console.log(`Scan Mode         : ${c.dim}${mode.toUpperCase()}${c.reset}`);
  console.log(`Audit Timestamp   : ${c.dim}${new Date().toISOString()}${c.reset}`);
  console.log(`${c.cyan}----------------------------------------------------------------------------${c.reset}`);

  // PHASE 1: AST SECURITY SCAN
  console.log(`\n${c.bold}[PHASE 1: STATIC AST SECURITY SCAN]${c.reset}`);
  if (findings.length > 0) {
    console.log(`Status        : ${c.yellow}${c.bold}VULNERABILITIES DETECTED${c.reset}`);
    console.log(`Total Issues  : ${c.bold}${findings.length}${c.reset} (${c.red}${criticalCount} Critical${c.reset}, ${c.yellow}${highCount} High${c.reset})\n`);

    findings.forEach((f, idx) => {
      const badge = f.severity === 'CRITICAL' ? `${c.bgRed} CRITICAL ${c.reset}` : `${c.bgYellow} HIGH ${c.reset}`;
      console.log(`  ${c.bold}#${idx + 1}${c.reset} ${badge} ${c.bold}[${f.ruleId}] ${f.issue}${c.reset}`);
      console.log(`     Location : ${c.cyan}${f.file}:${f.line}${c.reset}`);
      console.log(`     Detail   : ${f.description}`);
      console.log(`     Code     : ${c.dim}${f.snippet}${c.reset}`);
      console.log(`     Action   : ${c.yellow}${f.remediation}${c.reset}`);
      if (f.suggestedPatch) {
        console.log(`     Fix      : ${c.green}${f.suggestedPatch}${c.reset}`);
      } else {
        console.log(`     Fix      : ${c.dim}No automated patch available; manual structural refactor required.${c.reset}`);
      }
      console.log('');
    });
  } else {
    console.log(`Status        : ${c.green}${c.bold}PASSED — 0 VULNERABILITIES DETECTED${c.reset}`);
    console.log(`  ${c.green}✔ All AST security rules clean.${c.reset}`);
  }

  // Display Suppressed Findings transparently
  if (suppressed.length > 0) {
    console.log(`\n  ${c.cyan}ℹ ${suppressed.length} finding(s) explicitly suppressed:${c.reset}`);
    suppressed.forEach(sf => {
      console.log(`    - [${sf.ruleId}] ${sf.file}:${sf.line} (${sf.suppressReason})`);
    });
  }

  // Display Skipped Files transparently
  if (skipped.length > 0) {
    console.log(`\n  ${c.yellow}⚠️ Warning: ${skipped.length} file(s) skipped during AST parse:${c.reset}`);
    skipped.forEach(sf => {
      const linePart = sf.line ? `:${sf.line}` : '';
      console.log(`    - ${c.bold}${sf.file}${linePart}${c.reset}: ${c.dim}${sf.reason}${c.reset}`);
    });
  }

  // PHASE 2: TARGET TESTS
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
  const testScore = !testRes.configured ? 0 : (testRes.totalTests > 0 ? Math.round((testRes.passedTests / testRes.totalTests) * 100) : (testRes.passed ? 100 : 0));
  printScorecard(secScore, testScore, verdict);

  // FINAL VERDICT
  console.log(`${c.cyan}${c.bold}============================================================================${c.reset}`);
  console.log(`${verdict.color}${c.bold}${verdict.headline}${c.reset}`);
  console.log(`${c.dim}${verdict.subline}${c.reset}`);
  console.log(`${c.cyan}${c.bold}============================================================================${c.reset}\n`);
}

module.exports = {
  renderConsoleReport,
  determineVerdictState
};
