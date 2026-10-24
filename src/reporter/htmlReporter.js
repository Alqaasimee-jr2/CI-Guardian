function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generateHtmlReport(scanRes, testRes, targetDir, mode) {
  const timestamp = new Date().toLocaleString();
  const findings = scanRes.findings || [];
  const isClean = findings.length === 0 && testRes.passed;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CI-Guardian — Executive Pre-Flight Report</title>
  <style>
    :root {
      --bg: #090d16;
      --surface: #111726;
      --surface-border: #1e293b;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --critical: #ef4444;
      --high: #f59e0b;
      --success: #10b981;
      --card-bg: rgba(17, 23, 38, 0.85);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 40px 20px;
      line-height: 1.6;
    }
    .container { max-width: 1100px; margin: 0 auto; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--surface-border);
      margin-bottom: 32px;
    }
    .brand { display: flex; align-items: center; gap: 14px; }
    .shield-icon {
      font-size: 32px;
      background: linear-gradient(135deg, #0ea5e9, #6366f1);
      padding: 10px;
      border-radius: 12px;
      display: inline-flex;
    }
    .title h1 { font-size: 24px; font-weight: 800; }
    .title p { color: var(--text-muted); font-size: 14px; }
    .verdict-tag {
      padding: 8px 16px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .verdict-clean { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); }
    .verdict-blocked { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }

    .grid-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 36px;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--surface-border);
      border-radius: 14px;
      padding: 20px;
    }
    .stat-label { font-size: 13px; color: var(--text-muted); margin-bottom: 6px; }
    .stat-value { font-size: 24px; font-weight: 800; }

    .section-title {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 16px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--surface-border);
      border-radius: 14px;
      margin-bottom: 24px;
      overflow: hidden;
    }
    .finding-item {
      padding: 20px;
      border-bottom: 1px solid var(--surface-border);
    }
    .finding-item:last-child { border-bottom: none; }
    .finding-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .badge {
      font-size: 11px;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 6px;
    }
    .badge-critical { background: #ef4444; color: #fff; }
    .badge-high { background: #f59e0b; color: #000; }
    .code-box {
      background: #020617;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 12px 16px;
      font-family: monospace;
      font-size: 13px;
      color: #e2e8f0;
      margin: 10px 0;
      overflow-x: auto;
    }
    .remediation-box {
      background: rgba(14, 165, 233, 0.08);
      border-left: 3px solid #0ea5e9;
      padding: 12px 16px;
      border-radius: 0 8px 8px 0;
      font-size: 13px;
      margin-top: 10px;
    }
    .footer {
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid var(--surface-border);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">
        <div class="shield-icon">🛡️</div>
        <div class="title">
          <h1>CI-Guardian</h1>
          <p>Autonomous Pre-Flight Security & Quality Verification</p>
        </div>
      </div>
      <div>
        <span class="verdict-tag ${isClean ? 'verdict-clean' : 'verdict-blocked'}">
          ${isClean ? '✔ Verdict: Clean (Ready to Merge)' : '🚨 Verdict: Action Required'}
        </span>
      </div>
    </div>

    <div class="grid-stats">
      <div class="stat-card">
        <div class="stat-label">Target Repository</div>
        <div class="stat-value" style="font-size: 18px; color: var(--accent);">${escapeHtml(targetDir)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Security Vulnerabilities</div>
        <div class="stat-value" style="color: ${findings.length === 0 ? 'var(--success)' : 'var(--critical)'};">
          ${findings.length}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Target Test Pass Rate</div>
        <div class="stat-value" style="color: ${testRes.passed ? 'var(--success)' : 'var(--critical)'};">
          ${!testRes.configured ? 'No tests' : `${testRes.passedTests}/${testRes.totalTests}`}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Scan Mode</div>
        <div class="stat-value" style="font-size: 16px; color: var(--text-muted);">${escapeHtml(mode.toUpperCase())} (${scanRes.scannedFilesCount} files)</div>
      </div>
    </div>

    <div class="section-title">🔒 Static AST Security Analysis (${findings.length} Issues Detected)</div>
    <div class="card">
      ${findings.length === 0 ? `
        <div style="padding: 24px; text-align: center; color: var(--success); font-weight: 600;">
          ✔ Zero security vulnerabilities detected in scanned codebase!
        </div>
      ` : findings.map((f, i) => `
        <div class="finding-item">
          <div class="finding-header">
            <strong>#${i + 1} — ${escapeHtml(f.issue)}</strong>
            <span class="badge ${f.severity === 'CRITICAL' ? 'badge-critical' : 'badge-high'}">${f.severity}</span>
          </div>
          <div style="color: var(--text-muted); font-size: 13px;">Location: <code>${escapeHtml(f.file)}:${f.line}</code></div>
          <div class="code-box">${escapeHtml(f.snippet)}</div>
          <div class="remediation-box">
            <strong>Actionable Remediation:</strong> ${escapeHtml(f.remediation)}
          </div>
        </div>
      `).join('')}
    </div>

    <div class="section-title">🧪 Target Test Suite Execution</div>
    <div class="card">
      <div style="padding: 20px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <strong>${escapeHtml(testRes.framework || 'Test Runner')}</strong>
          <span style="color: ${testRes.passed ? 'var(--success)' : 'var(--critical)'}; font-weight: 700;">
            ${!testRes.configured ? 'NOT CONFIGURED' : (testRes.passed ? 'PASS' : 'FAIL')}
          </span>
        </div>
        <div class="code-box" style="white-space: pre-wrap;">${escapeHtml(testRes.output)}</div>
      </div>
    </div>

    <div class="footer">
      Generated autonomously by <strong><a href="https://github.com/Alqaasimee-jr2/CI-Guardian" style="color: var(--accent); text-decoration: none;">CI-Guardian</a></strong> • Timestamp: ${escapeHtml(timestamp)}
    </div>
  </div>
</body>
</html>`;
}

module.exports = {
  generateHtmlReport
};
