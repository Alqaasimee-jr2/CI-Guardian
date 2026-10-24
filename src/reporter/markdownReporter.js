function determineVerdictSummary(scanRes, testRes) {
  const findings = scanRes.findings || [];
  const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
  const highCount = findings.filter(f => f.severity === 'HIGH').length;
  const skippedCount = (scanRes.skippedFiles || []).length;

  if (findings.length > 0 || (testRes.configured && !testRes.passed)) {
    return {
      state: 'BLOCKED',
      title: '🚨 BLOCKED — Action Required Before Merge',
      badge: '![Status](https://img.shields.io/badge/CI--Guardian-BLOCKED-red)',
      summary: `${findings.length} security finding(s) or failing tests blocking merge.`
    };
  }

  if (testRes.configured && (testRes.exitCode === 127 || testRes.crashed || testRes.timedOut)) {
    return {
      state: 'COULD_NOT_RUN',
      title: '💥 COULD NOT RUN — Test Runner Failed',
      badge: '![Status](https://img.shields.io/badge/CI--Guardian-CRASHED-red)',
      summary: `Test runner crashed or command missing (${testRes.reason || 'Execution error'}).`
    };
  }

  if (skippedCount > 0) {
    return {
      state: 'WARNING',
      title: '⚠️ WARNING — Parse Gaps Detected',
      badge: '![Status](https://img.shields.io/badge/CI--Guardian-WARNING-yellow)',
      summary: `Audit finished with ${skippedCount} file(s) skipped due to syntax errors.`
    };
  }

  const isSecurityOnly = !testRes.configured || testRes.skipped;

  return {
    state: 'CLEAN',
    title: isSecurityOnly ? '✔ CLEAN — Approved for Merge (Security Verified)' : '✔ CLEAN — Approved for Merge',
    badge: '![Status](https://img.shields.io/badge/CI--Guardian-CLEAN_PASSED-brightgreen)',
    summary: isSecurityOnly
      ? 'Zero security findings detected across all in-scope source files.'
      : 'Zero security findings detected and all native test assertions passing.'
  };
}

function generateMarkdownReport(scanRes, testRes, targetDir, mode) {
  const timestamp = new Date().toISOString();
  const findings = scanRes.findings || [];
  const suppressed = scanRes.suppressedFindings || [];
  const skipped = scanRes.skippedFiles || [];
  const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
  const highCount = findings.filter(f => f.severity === 'HIGH').length;

  const verdict = determineVerdictSummary(scanRes, testRes);

  let riskTableRows = '';
  if (findings.length > 0) {
    riskTableRows = findings.map(f => {
      const patch = f.suggestedPatch ? `\`${f.suggestedPatch}\`` : '`Manual refactor required`';
      return `| **${f.severity}** | \`${f.ruleId}\` | \`${f.file}:${f.line}\` | ${f.description}<br/>**Action:** ${f.remediation} | ${patch} |`;
    }).join('\n');
  } else {
    riskTableRows = '| **CLEAN** | `ALL_CLEAR` | `N/A` | Zero static security vulnerabilities detected in in-scope source files. | None required |';
  }

  // Dynamic reviewer checklist
  const checklistItems = [];
  if (findings.length > 0) {
    const rules = new Set(findings.map(f => f.ruleId));
    if (rules.has('HARDCODED_SECRET')) {
      checklistItems.push('- [ ] **Secret Hygiene:** Confirm all flagged credentials and API keys have been rotated and extracted to environment variables or secret vaults.');
    }
    if (rules.has('SQL_INJECTION')) {
      checklistItems.push('- [ ] **SQL Query Safety:** Confirm dynamic SQL concatenations have been replaced with parameterized queries or prepared statements.');
    }
    if (rules.has('UNSAFE_EVAL_EXEC')) {
      checklistItems.push('- [ ] **Execution Safety:** Confirm arbitrary dynamic evaluation (eval/exec) has been eliminated or isolated.');
    }
  } else {
    checklistItems.push('- [ ] **Static Security:** Verified that zero security vulnerabilities or hardcoded secrets are present in modified code.');
  }

  if (testRes.configured) {
    if (testRes.passed) {
      checklistItems.push(`- [ ] **Regression Tests:** Confirmed that native test suite is green (${testRes.passedTests}/${testRes.totalTests} passing).`);
    } else {
      checklistItems.push(`- [ ] **Failing Tests:** Fix ${testRes.failedTests} failing tests before merging.`);
    }
  } else {
    checklistItems.push('- [ ] **Test Coverage:** Target repository does not have a configured test suite; manual verification recommended.');
  }

  if (skipped.length > 0) {
    checklistItems.push(`- [ ] **Parse Coverage:** Review ${skipped.length} skipped file(s) for syntax incompatibilities.`);
  }

  const checklistText = checklistItems.join('\n');

  // PR Full Description Artifact (pr-description.md)
  const prDescription = `# Pull Request Pre-Flight Inspection & Readiness Report

${verdict.badge}
> **Target Repository:** \`${targetDir}\`  
> **Audited At:** \`${timestamp}\`  
> **Scan Accounting:** \`${scanRes.scannedFilesCount} files scanned, ${skipped.length} skipped, ${suppressed.length} suppressed\`  
> **Scan Mode:** \`${mode.toUpperCase()}\`  
> **Orchestrator:** [CI-Guardian](https://github.com/Alqaasimee-jr2/CI-Guardian)

---

## 📋 Pre-Flight Executive Summary

| Category | Status | Metrics | Verdict |
| :--- | :---: | :--- | :---: |
| **Static Security Scan** | ${findings.length === 0 ? '✅ PASSED' : '⚠️ VULNERABILITIES FOUND'} | ${findings.length} findings (${criticalCount} Critical, ${highCount} High, ${suppressed.length} Suppressed) | ${findings.length === 0 ? 'CLEAR' : 'BLOCKED'} |
| **Target Test Suite** | ${!testRes.configured ? '⚠️ NOT CONFIGURED' : (testRes.passed ? '✅ PASSED' : '❌ FAILED')} | ${!testRes.configured ? 'No test script' : `${testRes.passedTests}/${testRes.totalTests} tests green (${testRes.durationMs}ms)`} | ${testRes.passed ? 'CLEAR' : 'BLOCKED'} |
| **Parse Coverage** | ${skipped.length === 0 ? '✅ COMPLETE' : '⚠️ GAPS DETECTED'} | ${scanRes.scannedFilesCount} files scanned, ${skipped.length} files skipped | ${skipped.length === 0 ? 'CLEAR' : 'WARNING'} |

---

## 🛡️ Security Risk Matrix & Actionable Remediation

| Severity | Rule ID | Location | Details & Action | Suggested Fix |
| :--- | :--- | :--- | :--- | :--- |
${riskTableRows}

${suppressed.length > 0 ? `
### ℹ️ Explicitly Suppressed Findings
| Rule ID | Location | Suppression Reason |
| :--- | :--- | :--- |
${suppressed.map(s => `| \`${s.ruleId}\` | \`${s.file}:${s.line}\` | ${s.suppressReason} |`).join('\n')}
` : ''}

${skipped.length > 0 ? `
### ⚠️ Skipped Source Files (Parse Errors)
| File Path | Reason |
| :--- | :--- |
${skipped.map(sk => `| \`${sk.file}${sk.line ? `:${sk.line}` : ''}\` | ${sk.reason} |`).join('\n')}
` : ''}

---

## 🧪 Test Execution Verification

- **Configured Test Runner:** ${testRes.configured ? `\`${testRes.framework || 'npm test'}\`` : 'None'}
- **Execution Status:** ${!testRes.configured ? 'No tests configured in repository' : (testRes.passed ? '100% Pass Rate' : 'Failures Detected')}
${testRes.configured ? `- **Metrics:** \`${testRes.passedTests} passed, ${testRes.failedTests} failed, ${testRes.totalTests} total\` (\`${testRes.durationMs}ms\`)` : ''}

\`\`\`text
${testRes.output || 'No output'}
\`\`\`

---

## ✍️ Reviewer Sign-Off Checklist

${checklistText}

---
*Report generated autonomously by [CI-Guardian](https://github.com/Alqaasimee-jr2/CI-Guardian).*
`;

  // Concise, human-reviewer focused PR comment (pr-comment-preview.md)
  let findingsSnippet = '';
  if (findings.length > 0) {
    findingsSnippet = `
| Severity | Rule ID | Location | Required Action | Fix |
| :--- | :--- | :--- | :--- | :--- |
${findings.map(f => `| **${f.severity}** | \`${f.ruleId}\` | \`${f.file}:${f.line}\` | ${f.issue} | ${f.suggestedPatch ? `\`${f.suggestedPatch}\`` : 'Manual refactor'} |`).join('\n')}
`;
  }

  const commentPreview = `<!-- ci-guardian-comment -->
### 🛡️ CI-Guardian: **${verdict.title}**

${verdict.summary}

| Check | Result | Details |
| :--- | :---: | :--- |
| **AST Security** | ${findings.length === 0 ? '✅ Clean' : '🚨 Findings'} | ${findings.length} findings (${criticalCount} Critical, ${highCount} High${suppressed.length > 0 ? `, ${suppressed.length} suppressed` : ''}) |
| **Native Tests** | ${!testRes.configured ? '⚠️ No Tests' : (testRes.passed ? '✅ Passed' : '❌ Failed')} | ${!testRes.configured ? 'No test script found' : `${testRes.passedTests}/${testRes.totalTests} passing (${testRes.durationMs}ms)`} |
| **File Coverage** | ${skipped.length === 0 ? '✅ Clean' : '⚠️ Skipped'} | Scanned ${scanRes.scannedFilesCount} files${skipped.length > 0 ? ` (${skipped.length} parse errors skipped)` : ''} |
${findingsSnippet}
<details>
<summary>📋 Reviewer Checklist & Full Execution Log</summary>

#### Reviewer Checklist
${checklistText}

#### Test Runner Detail
\`\`\`text
${(testRes.output || 'No test output available').slice(0, 500)}
\`\`\`

*Report generated by [CI-Guardian](https://github.com/Alqaasimee-jr2/CI-Guardian). Pushes update this comment in-place.*
</details>
`;

  return { prDescription, commentPreview };
}

module.exports = {
  generateMarkdownReport
};
