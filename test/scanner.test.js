const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('node:os');
const { scanFile } = require('../src/scanner');

function createTempFixture(content) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-guardian-test-'));
  const filePath = path.join(tmpDir, 'source.js');
  fs.writeFileSync(filePath, content, 'utf-8');
  return {
    filePath,
    tmpDir,
    cleanup: () => {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  };
}

test('AST Scanner: does NOT flag RegExp.prototype.exec as a vulnerability', (t) => {
  const fixture = createTempFixture('const re = /pattern/;\nconst match = re.exec("test string");\n');
  t.after(fixture.cleanup);

  const findings = scanFile(fixture.filePath, fixture.tmpDir);
  assert.strictEqual(findings.length, 0, 'Expected 0 findings for standard RegExp.prototype.exec');
});

test('AST Scanner: does NOT flag Git commit SHA hex strings as secrets', (t) => {
  const fixture = createTempFixture('const COMMIT_SHA = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";\n');
  t.after(fixture.cleanup);

  const findings = scanFile(fixture.filePath, fixture.tmpDir);
  assert.strictEqual(findings.length, 0, 'Expected 0 findings for Git commit SHA hash');
});

test('AST Scanner: accurately detects real high-entropy Stripe secret keys', (t) => {
  const mockToken = ['sk', 'live', '51M0DummyTestSecretKey99887766'].join('_');
  const fixture = createTempFixture(`const token = "${mockToken}";\n`);
  t.after(fixture.cleanup);

  const findings = scanFile(fixture.filePath, fixture.tmpDir);
  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].ruleId, 'HARDCODED_SECRET');
  assert.strictEqual(findings[0].severity, 'HIGH');
});

test('AST Scanner: detects multiline template literal SQL injection', (t) => {
  const fixture = createTempFixture('const userId = 42;\nconst q = `\n  SELECT * \n  FROM accounts \n  WHERE id = ${userId}\n`;\n');
  t.after(fixture.cleanup);

  const findings = scanFile(fixture.filePath, fixture.tmpDir);
  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].ruleId, 'SQL_INJECTION');
  assert.strictEqual(findings[0].severity, 'HIGH');
});

test('AST Scanner: detects dangerous dynamic eval execution', (t) => {
  const fixture = createTempFixture('function run(formula) {\n  return eval(formula);\n}\n');
  t.after(fixture.cleanup);

  const findings = scanFile(fixture.filePath, fixture.tmpDir);
  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].ruleId, 'UNSAFE_EVAL_EXEC');
  assert.strictEqual(findings[0].severity, 'CRITICAL');
});
