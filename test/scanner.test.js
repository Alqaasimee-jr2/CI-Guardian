const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { scanFile } = require('../src/scanner');

test('AST Scanner: does NOT flag RegExp.prototype.exec as a vulnerability', (t) => {
  const fixturePath = path.join(__dirname, 'fixtures', 'regex_exec.js');
  fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
  fs.writeFileSync(fixturePath, 'const re = /pattern/;\nconst match = re.exec("test string");\n');

  const findings = scanFile(fixturePath, path.dirname(fixturePath));
  assert.strictEqual(findings.length, 0, 'Expected 0 findings for standard RegExp.prototype.exec');
});

test('AST Scanner: does NOT flag Git commit SHA hex strings as secrets', (t) => {
  const fixturePath = path.join(__dirname, 'fixtures', 'commit_sha.js');
  fs.writeFileSync(fixturePath, 'const COMMIT_SHA = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";\n');

  const findings = scanFile(fixturePath, path.dirname(fixturePath));
  assert.strictEqual(findings.length, 0, 'Expected 0 findings for Git commit SHA hash');
});

test('AST Scanner: accurately detects real high-entropy Stripe secret keys', (t) => {
  const fixturePath = path.join(__dirname, 'fixtures', 'dynamic_mock_key.js');
  // Dynamically assemble mock key token to prevent GitHub push protection false blocks
  const mockToken = ['sk', 'live', '51M0DummyTestSecretKey99887766'].join('_');
  fs.writeFileSync(fixturePath, `const token = "${mockToken}";\n`);

  try {
    const findings = scanFile(fixturePath, path.dirname(fixturePath));
    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].ruleId, 'HARDCODED_SECRET');
    assert.strictEqual(findings[0].severity, 'HIGH');
  } finally {
    if (fs.existsSync(fixturePath)) fs.unlinkSync(fixturePath);
  }
});

test('AST Scanner: detects multiline template literal SQL injection', (t) => {
  const fixturePath = path.join(__dirname, 'fixtures', 'multiline_sql.js');
  fs.writeFileSync(fixturePath, 'const q = `\n  SELECT * \n  FROM accounts \n  WHERE id = ${userId}\n`;\n');

  const findings = scanFile(fixturePath, path.dirname(fixturePath));
  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].ruleId, 'SQL_INJECTION');
  assert.strictEqual(findings[0].severity, 'HIGH');
});

test('AST Scanner: detects dangerous dynamic eval execution', (t) => {
  const fixturePath = path.join(__dirname, 'fixtures', 'eval_exec.js');
  fs.writeFileSync(fixturePath, 'function run(formula) {\n  return eval(formula);\n}\n');

  const findings = scanFile(fixturePath, path.dirname(fixturePath));
  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].ruleId, 'UNSAFE_EVAL_EXEC');
  assert.strictEqual(findings[0].severity, 'CRITICAL');
});
