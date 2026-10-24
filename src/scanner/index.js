const fs = require('fs');
const path = require('path');
const { parseSource, traverse } = require('./astParser');
const {
  checkHardcodedSecret,
  checkSqlInjection,
  checkUnsafeDynamicExecution
} = require('./rules');

const DEFAULT_IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.guardian',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  'vendor',
  'test',
  'tests',
  '__tests__',
  'fixtures'
]);

const SCANNABLE_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs'
]);

function getSourceFiles(dir, fileList = [], baseDir = dir) {
  if (!fs.existsSync(dir)) return fileList;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!DEFAULT_IGNORED_DIRS.has(entry.name.toLowerCase())) {
        getSourceFiles(fullPath, fileList, baseDir);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SCANNABLE_EXTENSIONS.has(ext)) {
        fileList.push(fullPath);
      }
    }
  }

  return fileList;
}

function parseIgnoreRules(repoRoot) {
  const ignoreFile = path.join(repoRoot, '.guardianignore');
  const rules = [];

  if (fs.existsSync(ignoreFile)) {
    try {
      const lines = fs.readFileSync(ignoreFile, 'utf-8').split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        if (trimmed.includes(':')) {
          const [filePattern, ruleId] = trimmed.split(':');
          rules.push({ filePattern: filePattern.trim(), ruleId: ruleId.trim() });
        } else {
          rules.push({ filePattern: trimmed, ruleId: '*' });
        }
      }
    } catch {}
  }

  return rules;
}

function extractLineSuppressions(code) {
  const lines = code.split(/\r?\n/);
  const suppressions = new Map();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // // guardian-disable-next-line RULE_ID
    const nextLineMatch = line.match(/\/\/\s*(?:guardian|ci-guardian)-disable-next-line\s+([A-Za-z0-9_,\s*]+)/i);
    if (nextLineMatch) {
      const targetLine = i + 2;
      const ruleList = nextLineMatch[1].split(/[\s,]+/).map(r => r.trim()).filter(Boolean);
      if (!suppressions.has(targetLine)) suppressions.set(targetLine, new Set());
      for (const r of ruleList) suppressions.get(targetLine).add(r.toUpperCase());
    }

    // // guardian-disable-line RULE_ID
    const sameLineMatch = line.match(/\/\/\s*(?:guardian|ci-guardian)-disable(?:-line)?\s+([A-Za-z0-9_,\s*]+)/i);
    if (sameLineMatch && !line.includes('-next-line')) {
      const targetLine = i + 1;
      const ruleList = sameLineMatch[1].split(/[\s,]+/).map(r => r.trim()).filter(Boolean);
      if (!suppressions.has(targetLine)) suppressions.set(targetLine, new Set());
      for (const r of ruleList) suppressions.get(targetLine).add(r.toUpperCase());
    }
  }

  return suppressions;
}

function scanFile(filePath, repoRoot, ignoreRules = []) {
  const relPath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
  const findings = [];
  findings.suppressed = [];
  findings.skipped = null;

  let code;
  try {
    code = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    findings.skipped = { file: relPath, reason: `File read error: ${err.message}` };
    return findings;
  }

  // Gracefully handle binary / non-UTF-8 files
  if (code.includes('\0')) {
    findings.skipped = { file: relPath, reason: 'Binary file skipped (null bytes detected)' };
    return findings;
  }

  const { ast, error } = parseSource(code, filePath);
  if (error || !ast) {
    findings.skipped = {
      file: relPath,
      reason: error ? error.message.replace(/\s*\(\d+:\d+\)$/, '') : 'AST parse failed',
      line: error && error.loc ? error.loc.line : null
    };
    return findings;
  }

  const lineSuppressions = extractLineSuppressions(code);
  const rawFindings = [];

  traverse(ast, {
    StringLiteral(node, parent) {
      const finding = checkHardcodedSecret(node, parent, code, relPath);
      if (finding) rawFindings.push(finding);
    },
    BinaryExpression(node, parent) {
      const finding = checkSqlInjection(node, parent, code, relPath);
      if (finding) rawFindings.push(finding);
    },
    TemplateLiteral(node, parent) {
      const finding = checkSqlInjection(node, parent, code, relPath);
      if (finding) rawFindings.push(finding);
    },
    CallExpression(node, parent) {
      const finding = checkUnsafeDynamicExecution(node, parent, code, relPath);
      if (finding) rawFindings.push(finding);
    },
    NewExpression(node, parent) {
      const finding = checkUnsafeDynamicExecution(node, parent, code, relPath);
      if (finding) rawFindings.push(finding);
    }
  });

  // Evaluate suppressions per finding
  for (const f of rawFindings) {
    let isSuppressed = false;
    let reason = null;

    // 1. Check line-level comment suppression
    const lineRules = lineSuppressions.get(f.line);
    if (lineRules && (lineRules.has('*') || lineRules.has(f.ruleId.toUpperCase()))) {
      isSuppressed = true;
      reason = `Suppressed via code comment at line ${f.line}`;
    }

    // 2. Check .guardianignore pattern
    if (!isSuppressed && ignoreRules.length > 0) {
      for (const rule of ignoreRules) {
        const fileMatches = relPath.includes(rule.filePattern) || (rule.filePattern === '*');
        const ruleMatches = rule.ruleId === '*' || rule.ruleId.toUpperCase() === f.ruleId.toUpperCase();
        if (fileMatches && ruleMatches) {
          isSuppressed = true;
          reason = `Suppressed via .guardianignore (${rule.filePattern})`;
          break;
        }
      }
    }

    if (isSuppressed) {
      f.suppressed = true;
      f.suppressReason = reason;
      findings.suppressed.push(f);
    } else {
      findings.push(f);
    }
  }

  return findings;
}

function scanRepository(repoPath, fileFilter = null) {
  const resolvedRepo = path.resolve(repoPath);
  const ignoreRules = parseIgnoreRules(resolvedRepo);
  let filesToScan = [];

  if (Array.isArray(fileFilter) && fileFilter.length > 0) {
    filesToScan = fileFilter
      .map(f => path.resolve(resolvedRepo, f))
      .filter(f => fs.existsSync(f) && SCANNABLE_EXTENSIONS.has(path.extname(f).toLowerCase()));
  } else {
    filesToScan = getSourceFiles(resolvedRepo);
  }

  const allFindings = [];
  const allSuppressed = [];
  const skippedFiles = [];

  for (const file of filesToScan) {
    const fileFindings = scanFile(file, resolvedRepo, ignoreRules);
    if (fileFindings.skipped) {
      skippedFiles.push(fileFindings.skipped);
    }
    allFindings.push(...fileFindings);
    if (fileFindings.suppressed && fileFindings.suppressed.length > 0) {
      allSuppressed.push(...fileFindings.suppressed);
    }
  }

  return {
    scannedFilesCount: filesToScan.length,
    skippedFiles,
    ignoredDirs: Array.from(DEFAULT_IGNORED_DIRS),
    findings: allFindings,
    suppressedFindings: allSuppressed
  };
}

module.exports = {
  scanRepository,
  scanFile
};
