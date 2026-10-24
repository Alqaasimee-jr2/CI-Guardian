function generateMarkdownReport(scanRes, testRes, targetDir, mode) {
  const timestamp = new Date().toISOString();
  const findings = scanRes.findings || [];
  const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
  const highCount = findings.filter(f => f.severity === 'HIGH').length;
  const isClean = findings.length === 0 && testRes.passed;

  const verdictBadge = isClean
    ? '![Status](https://img.shields.io/badge/CI--Guardian-CLEAN_PASSED-brightgreen)'
    : '![Status](https://img.shields.io/badge/CI--Guardian-ACTION_REQUIRED-red)';

  let riskTableRows = '';
  if (findings.length > 0) {
    riskTableRows = findings.map(f => {
      const patch = f.suggestedPatch ? `\`${f.suggestedPatch}\`` : '`Manual fix required`';
      return `| **${f.severity}** | \`${f.ruleId}\` | \`${f.file}:${f.line}\` | ${f.description}<br/>**Action:** ${f.remediation} | ${patch} |`;
    }).join('\n');
  } else {
    riskTableRows = '| **CLEAN** | `ALL_CLEAR` | `N/A` | Zero static security vulnerabilities detected in in-scope source files. | None required |';
  }

  // Dynamic reviewer sign-off checklist based on actual findings
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
      checklistItems.push(`- [ ] **Regression Tests:** Confirmed that target test suite is green (${testRes.passedTests}/${testRes.totalTests} passing).`);
    } else {
      checklistItems.push(`- [ ] **Failing Tests:** Fix ${testRes.failedTests} failing tests before merging.`);
    }
  } else {
    checklistItems.push('- [ ] **Test Coverage:** Target repository does not have a configured test suite; manual verification recommended.');
  }

  const checklistText = checklistItems.join('\n');

  const prDescription = `# Pull Request Pre-Flight Inspection & Readiness Report

${verdictBadge}
> **Target Repository:** \`${targetDir}\`  
> **Audited At:** \`${timestamp}\`  
> **Scan Mode:** \`${mode.toUpperCase()}\` (${scanRes.scannedFilesCount} files analyzed)  
> **Orchestrator:** [CI-Guardian](https://github.com/Alqaasimee-jr2/CI-Guardian)

---

## 📋 Pre-Flight Executive Summary

| Category | Status | Metrics | Verdict |
| :--- | :---: | :--- | :---: |
| **Static Security Scan** | ${findings.length === 0 ? '✅ PASSED' : '⚠️ VULNERABILITIES FOUND'} | ${findings.length} findings (${criticalCount} Critical, ${highCount} High) | ${findings.length === 0 ? 'CLEAR' : 'BLOCKED'} |
| **Target Test Suite** | ${!testRes.configured ? '⚠️ NOT CONFIGURED' : (testRes.passed ? '✅ PASSED' : '❌ FAILED')} | ${!testRes.configured ? 'No test script' : `${testRes.passedTests}/${testRes.totalTests} tests green (${testRes.durationMs}ms)`} | ${testRes.passed ? 'CLEAR' : 'BLOCKED'} |

---

## 🛡️ Security Risk Matrix & Actionable Remediation

| Severity | Rule ID | Location | Details & Action | Suggested Fix |
| :--- | :--- | :--- | :--- | :--- |
${riskTableRows}

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

  const commentPreview = `### 🛡️ CI-Guardian Summary

**Verdict:** ${isClean ? '✅ **CLEAN - APPROVED TO MERGE**' : '🚨 **ACTION REQUIRED - BLOCKED**'}
- **Security Findings:** ${findings.length} (${criticalCount} Critical, ${highCount} High)
- **Target Tests:** ${!testRes.configured ? 'No tests configured' : `${testRes.passedTests}/${testRes.totalTests} passed (${testRes.durationMs}ms)`}
- **Scan Mode:** \`${mode.toUpperCase()}\` (${scanRes.scannedFilesCount} files analyzed)
- **Detailed Audit:** See generated \`pr-description.md\` or run \`npx ci-guardian\` locally.
`;

  return { prDescription, commentPreview };
}

module.exports = {
  generateMarkdownReport
};
