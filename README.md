# CI-Guardian 🛡️

> **Autonomous Pre-Flight Security & Quality Gate for Pull Requests & Local Development**  
> Chaining syntax-aware AST security scanning, universal test orchestration, and PR documentation generation into a single sub-10-second command.

[![CI Status](https://github.com/Alqaasimee-jr2/CI-Guardian/actions/workflows/ci.yml/badge.svg)](https://github.com/Alqaasimee-jr2/CI-Guardian/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![SARIF 2.1.0](https://img.shields.io/badge/SARIF-2.1.0_Compliant-purple.svg)](https://docs.oasis-open.org/sarif/sarif/v2.1.0/cos01/schemas/sarif-schema-2.1.0.json)
[![PR Pre-Flight](https://img.shields.io/badge/PR--Pre--Flight-CLEAN_PASSED-brightgreen.svg)](https://github.com/Alqaasimee-jr2/CI-Guardian)

---

## ⚡ The Developer Experience: Before vs. After

| Step | 🛑 Before CI-Guardian (45 Minutes of Manual Friction) | 🚀 After CI-Guardian (Sub-10s Automated Certainty) |
| :--- | :--- | :--- |
| **Security Audit** | Manual eye-balling of diffs; leaked API tokens and multiline SQL injections slip into PRs. | In-process AST scanner flags real vulnerabilities with line coordinates and actionable fixes. |
| **Test Verification** | Forgetting to run tests locally; pushing to GitHub and waiting 15 minutes for remote CI to fail. | Universal test orchestrator runs the target repository's native test suite locally before pushing. |
| **PR Documentation** | Typing manual summaries, copy-pasting test outputs, guessing at risk matrices. | Auto-generated GitHub-ready `pr-description.md`, comment preview, and reviewer checklist. |
| **Result** | Broken CI pipelines, review delays, security regressions. | **Verified clean code, passing tests, and instant PR documentation in under 10 seconds.** |

---

## 🧠 Architecture: The 3 Chained Stages

```
+-------------------------------------------------------------------------------+
|                             CI-GUARDIAN CLI                                   |
+-------------------------------------------------------------------------------+
       │
       ▼
 [Stage 1: AST Security Analysis]
   * Syntax-aware in-process parsing (@babel/parser for JS/TS)
   * High-entropy secret detection (Stripe, Google, AWS, GitHub, Slack, JWT)
   * Multiline SQL injection detection (template literals and string concatenation)
   * Dangerous dynamic execution (eval, child_process.exec/spawn/fork)
   * Zero false positives on RegExp.prototype.exec, Git SHAs, or CSS colors
       │
       ▼
 [Stage 2: Universal Test Orchestration]
   * Auto-discovers target repository's test runner (npm test, Jest, Vitest, Mocha)
   * Executes test suite in target repository context with enforced timeout
   * Captures true duration, pass/fail counts, and assertion metrics
   * Accurately reports unconfigured test suites without simulating false passes
       │
       ▼
 [Stage 3: Multi-Format Reporting & PR Synthesis]
   * Console: ANSI scorecard gauge & executive readiness verdict
   * Markdown: Dynamic reviewer checklist & PR summary (pr-description.md)
   * Dashboard: Modern, self-contained, responsive HTML report (guardian-report.html)
   * Enterprise: OASIS SARIF 2.1.0 security report (guardian.sarif) for GitHub Code Scanning
   * CI Bot: Automated PR comment posting when running under GITHUB_TOKEN
```

---

## 💻 Quick Start & Usage

### Zero-Install Run (npx)
Run CI-Guardian directly in any project:
```bash
npx ci-guardian
```

### Global Installation
```bash
npm install -g ci-guardian
guardian --help
```

### Common Commands

```bash
# Audit current repository in diff mode (only changed/staged files)
guardian

# Audit entire repository (all files)
guardian --full

# Audit a specific target repository path
guardian --repo /path/to/project

# Specify custom output directory for report artifacts
guardian --output ./security-reports

# Strict mode (enforces exit code 1 on any vulnerability or test failure)
guardian --strict

# Launch interactive HTML dashboard in browser preview
guardian --serve
```

---

## 🛠️ CLI Options

| Flag | Description | Default |
| :--- | :--- | :--- |
| `-r, --repo <path>` | Path to target repository directory | `.` |
| `-d, --diff` | Audit only files changed relative to base git branch | Auto-detected |
| `-f, --full` | Audit every file in the target repository | `false` |
| `-o, --output <dir>` | Directory for generated reports (`.guardian/`) | `<repo>/.guardian` |
| `-s, --strict`, `--ci` | Enforce exit code `1` on any blocker finding or failed test | `true` on findings |
| `--serve` | Start lightweight local HTTP server for HTML report preview | `false` |
| `--no-html` | Skip standalone HTML dashboard generation | `false` |
| `-v, --version` | Output CI-Guardian version | — |
| `-h, --help` | Show CLI usage manual | — |

### Process Exit Codes
- **`0`**: Clean audit — zero blocking vulnerabilities and all tests green.
- **`1`**: Policy failure — blocking vulnerabilities or test failures detected.
- **`2`**: Configuration error — invalid flags or non-existent target path.

---

## 🤖 GitHub Actions Integration

Add CI-Guardian to your pull request workflows with 3 lines of YAML:

```yaml
name: PR Pre-Flight Check

on:
  pull_request:
    branches: [ main ]

jobs:
  guardian:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      security-events: write

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full history for git diff

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run CI-Guardian
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npx ci-guardian --diff --strict

      - name: Upload SARIF Security Report to GitHub Code Scanning
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: .guardian/guardian.sarif
```

---

## 🛡️ Static Analysis Rules

| Rule ID | Severity | What It Catches | Remediation Guidance |
| :--- | :---: | :--- | :--- |
| `HARDCODED_SECRET` | **HIGH** | Stripe live keys, Google API keys, GitHub tokens, AWS access keys, Slack tokens, hardcoded JWTs. | Rotate token immediately; extract to environment variables or secret manager. |
| `SQL_INJECTION` | **HIGH** | Unescaped string concatenations and template literal variables in SQL statements. | Use parameterized queries or prepared statements (`?`, `$1`). |
| `UNSAFE_EVAL_EXEC` | **CRITICAL** | Direct `eval()`, global `exec()`, `child_process.exec()`, and dynamic `new Function()`. | Eliminate dynamic evaluation; use safe math tokenizers or `child_process.execFile` with argument arrays. |

---

## 📊 Comparison with Alternatives

| Feature | Snyk / SonarQube | Husky / lint-staged | **CI-Guardian** 🛡️ |
| :--- | :---: | :---: | :---: |
| **Speed** | 10–20 min (Cloud CI) | < 2s (Local) | **< 5s (Local & CI)** |
| **AST Security Scanning** | Yes (Cloud) | No | **Yes (In-Process)** |
| **Native Test Orchestration** | No | Partial | **Yes (Universal)** |
| **PR Markdown Generation** | No | No | **Yes (Auto-Generated)** |
| **Cost** | $$$ Enterprise Tier | Free | **100% Free & Open Source (MIT)** |
| **Setup Friction** | Heavy Cloud Config | Config Files | **Zero Config (`npx ci-guardian`)** |

---

## 🤝 Contributing

Contributions are welcome!
1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/my-new-rule`).
3. Run automated tests: `npm test`.
4. Commit your changes: `git commit -am 'Add new AST security rule'`.
5. Push to the branch: `git push origin feature/my-new-rule`.
6. Open a Pull Request.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.
