// AST-based Security Rules for CI-Guardian

const SQL_KEYWORDS = /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|FROM|WHERE|JOIN|UNION)\b/i;

const SECRET_PATTERNS = [
  { id: 'STRIPE_SECRET_KEY', regex: /\bsk_live_[0-9a-zA-Z]{20,}\b/, name: 'Live Stripe Secret Key' },
  { id: 'GOOGLE_API_KEY', regex: /\bAIza[0-9A-Za-z\-_]{35}\b/, name: 'Google API Key' },
  { id: 'GITHUB_TOKEN', regex: /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/, name: 'GitHub Personal Access Token' },
  { id: 'SLACK_TOKEN', regex: /\bxox[baprs]-[0-9a-zA-Z]{10,48}\b/, name: 'Slack API Token' },
  { id: 'AWS_ACCESS_KEY', regex: /\bAKIA[0-9A-Z]{16}\b/, name: 'AWS Access Key ID' },
  { id: 'JWT_TOKEN', regex: /\beyJ[A-Za-z0-9-_]{10,}\.eyJ[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_+/=]{10,}\b/, name: 'Hardcoded JSON Web Token (JWT)' }
];

const CREDENTIAL_IDENTIFIERS = /^(jwtSecret|apiKey|apiSecret|api_key|secretKey|privateKey|password|secretToken|authToken|clientSecret|dbPassword)$/i;

function isSqlString(str) {
  if (typeof str !== 'string') return false;
  return SQL_KEYWORDS.test(str);
}

function getLineSnippet(code, lineNumber) {
  const lines = code.split(/\r?\n/);
  return (lines[lineNumber - 1] || '').trim();
}

function checkHardcodedSecret(node, parent, code, relPath) {
  if (node.type !== 'StringLiteral') return null;

  const value = node.value;
  if (!value || typeof value !== 'string' || value.length < 8) return null;

  // Ignore standard HTTP headers or MIME types
  if (/^(Access-Control-|Content-Type|Authorization|Accept|User-Agent)/i.test(value)) {
    return null;
  }

  // 1. Check known high-entropy token formats
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.regex.test(value)) {
      const line = node.loc ? node.loc.start.line : 1;
      return {
        ruleId: 'HARDCODED_SECRET',
        issue: pattern.name,
        severity: 'HIGH',
        file: relPath,
        line,
        snippet: getLineSnippet(code, line),
        description: `Potential high-entropy credential or secret detected (${pattern.name}).`,
        remediation: 'Rotate token immediately. Extract credential to environment variables (e.g. process.env.API_KEY) or a secret manager.',
        suggestedPatch: 'process.env.SECRET_KEY || ""'
      };
    }
  }

  // 2. Check assignment to credential identifiers (e.g. jwtSecret: "...", apiKey = "...")
  let isAssignedToSecretName = false;
  if (parent) {
    if (parent.type === 'ObjectProperty' && parent.key) {
      const keyName = parent.key.name || parent.key.value;
      if (CREDENTIAL_IDENTIFIERS.test(keyName)) isAssignedToSecretName = true;
    } else if (parent.type === 'VariableDeclarator' && parent.id) {
      const varName = parent.id.name;
      if (CREDENTIAL_IDENTIFIERS.test(varName)) isAssignedToSecretName = true;
    } else if (parent.type === 'AssignmentExpression' && parent.left) {
      const leftName = parent.left.name || (parent.left.property && parent.left.property.name);
      if (CREDENTIAL_IDENTIFIERS.test(leftName)) isAssignedToSecretName = true;
    }
  }

  if (isAssignedToSecretName && value.length >= 16) {
    const line = node.loc ? node.loc.start.line : 1;
    return {
      ruleId: 'HARDCODED_SECRET',
      issue: 'Hardcoded Credential Assignment',
      severity: 'HIGH',
      file: relPath,
      line,
      snippet: getLineSnippet(code, line),
      description: 'Hardcoded secret or sensitive token assigned to credential variable.',
      remediation: 'Extract credential to environment variables (e.g. process.env.SECRET) or secret vault.',
      suggestedPatch: 'process.env.SECRET_TOKEN || ""'
    };
  }

  return null;
}

function checkSqlInjection(node, parent, code, relPath) {
  // Check BinaryExpression concatenation: "SELECT ... " + userInput
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    let hasSql = false;
    let hasDynamicVar = false;

    if (node.left.type === 'StringLiteral' && isSqlString(node.left.value)) {
      hasSql = true;
      if (node.right.type !== 'StringLiteral' && node.right.type !== 'NumericLiteral') {
        hasDynamicVar = true;
      }
    } else if (node.right.type === 'StringLiteral' && isSqlString(node.right.value)) {
      hasSql = true;
      if (node.left.type !== 'StringLiteral' && node.left.type !== 'NumericLiteral') {
        hasDynamicVar = true;
      }
    }

    if (hasSql && hasDynamicVar) {
      const line = node.loc ? node.loc.start.line : 1;
      return {
        ruleId: 'SQL_INJECTION',
        issue: 'SQL Injection via String Concatenation',
        severity: 'HIGH',
        file: relPath,
        line,
        snippet: getLineSnippet(code, line),
        description: 'Dynamic SQL query construction with unescaped string concatenation detected.',
        remediation: 'Use parameterized queries or prepared statements (e.g. db.query("... WHERE id = ?", [id])) to safely bind inputs.',
        suggestedPatch: 'Use parameterized query placeholders (?, $1, :id) with client.execute(query, [params])'
      };
    }
  }

  // Check TemplateLiteral: `SELECT * FROM users WHERE id = ${userId}` (multiline supported!)
  if (node.type === 'TemplateLiteral') {
    const fullRawString = node.quasis.map(q => q.value.raw).join(' ');
    if (isSqlString(fullRawString) && node.expressions.length > 0) {
      const line = node.loc ? node.loc.start.line : 1;
      return {
        ruleId: 'SQL_INJECTION',
        issue: 'SQL Injection via Template Literal Interpolation',
        severity: 'HIGH',
        file: relPath,
        line,
        snippet: getLineSnippet(code, line),
        description: 'Dynamic SQL query construction via template literal interpolation detected.',
        remediation: 'Use parameterized queries with prepared placeholders rather than inline template variables.',
        suggestedPatch: 'Use parameterized query placeholders (?, $1, :id) with client.execute(query, [params])'
      };
    }
  }

  return null;
}

function checkUnsafeDynamicExecution(node, parent, code, relPath) {
  // Check CallExpression: eval(...), child_process.exec(...)
  if (node.type === 'CallExpression') {
    const callee = node.callee;

    // 1. Direct eval(...)
    if (callee.type === 'Identifier' && callee.name === 'eval') {
      const line = node.loc ? node.loc.start.line : 1;
      return {
        ruleId: 'UNSAFE_EVAL_EXEC',
        issue: 'Unsafe Dynamic Code Evaluation (eval)',
        severity: 'CRITICAL',
        file: relPath,
        line,
        snippet: getLineSnippet(code, line),
        description: 'Dangerous dynamic evaluation via eval() detected. Allows arbitrary code execution.',
        remediation: 'Eliminate eval(). Parse formulas or data using a sandboxed arithmetic parser or JSON.parse().',
        suggestedPatch: 'Replace eval() with safe math tokenizer or structured parser'
      };
    }

    // 2. Direct global exec(...) call (NOT member expression like pattern.exec)
    if (callee.type === 'Identifier' && callee.name === 'exec') {
      const line = node.loc ? node.loc.start.line : 1;
      return {
        ruleId: 'UNSAFE_EVAL_EXEC',
        issue: 'Unsafe Shell Command Execution (exec)',
        severity: 'CRITICAL',
        file: relPath,
        line,
        snippet: getLineSnippet(code, line),
        description: 'Dangerous shell command execution via exec() detected.',
        remediation: 'Avoid raw shell execution. Use execFile or spawn with argument arrays and shell: false.',
        suggestedPatch: 'Use child_process.execFile(cmd, args, { shell: false })'
      };
    }

    // 3. MemberExpression child_process.exec(...)
    if (callee.type === 'MemberExpression') {
      const objName = callee.object.name || (callee.object.property && callee.object.property.name);
      const propName = callee.property.name;

      // Only flag exec if the object is child_process or cp (NOT regex, pattern, re, etc.!)
      const isChildProcessObj = /^(child_process|childProcess|cp)$/i.test(objName);
      if (isChildProcessObj && (propName === 'exec' || propName === 'execSync')) {
        const line = node.loc ? node.loc.start.line : 1;
        return {
          ruleId: 'UNSAFE_EVAL_EXEC',
          issue: 'Dangerous Child Process Shell Execution',
          severity: 'CRITICAL',
          file: relPath,
          line,
          snippet: getLineSnippet(code, line),
          description: `Arbitrary shell execution via child_process.${propName}() detected.`,
          remediation: 'Use child_process.execFile or spawn with argument arrays without shell interpolation.',
          suggestedPatch: 'child_process.execFile(binaryPath, args, { shell: false })'
        };
      }
    }
  }

  // 4. new Function(...) constructor
  if (node.type === 'NewExpression' && node.callee.type === 'Identifier' && node.callee.name === 'Function') {
    const line = node.loc ? node.loc.start.line : 1;
    return {
      ruleId: 'UNSAFE_EVAL_EXEC',
      issue: 'Dynamic Function Constructor (new Function)',
      severity: 'CRITICAL',
      file: relPath,
      line,
      snippet: getLineSnippet(code, line),
      description: 'Dynamic code execution via new Function() constructor detected.',
      remediation: 'Eliminate dynamic Function constructor. Use explicit callbacks or static mappings.',
      suggestedPatch: 'Replace dynamic function constructor with static dispatch table'
    };
  }

  return null;
}

module.exports = {
  checkHardcodedSecret,
  checkSqlInjection,
  checkUnsafeDynamicExecution
};
