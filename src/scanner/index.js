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

function scanFile(filePath, repoRoot) {
  const code = fs.readFileSync(filePath, 'utf-8');
  const relPath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
  const ast = parseSource(code, filePath);

  const findings = [];
  if (!ast) return findings;

  traverse(ast, {
    StringLiteral(node, parent) {
      const finding = checkHardcodedSecret(node, parent, code, relPath);
      if (finding) findings.push(finding);
    },
    BinaryExpression(node, parent) {
      const finding = checkSqlInjection(node, parent, code, relPath);
      if (finding) findings.push(finding);
    },
    TemplateLiteral(node, parent) {
      const finding = checkSqlInjection(node, parent, code, relPath);
      if (finding) findings.push(finding);
    },
    CallExpression(node, parent) {
      const finding = checkUnsafeDynamicExecution(node, parent, code, relPath);
      if (finding) findings.push(finding);
    },
    NewExpression(node, parent) {
      const finding = checkUnsafeDynamicExecution(node, parent, code, relPath);
      if (finding) findings.push(finding);
    }
  });

  return findings;
}

function scanRepository(repoPath, fileFilter = null) {
  const resolvedRepo = path.resolve(repoPath);
  let filesToScan = [];

  if (Array.isArray(fileFilter) && fileFilter.length > 0) {
    filesToScan = fileFilter
      .map(f => path.resolve(resolvedRepo, f))
      .filter(f => fs.existsSync(f) && SCANNABLE_EXTENSIONS.has(path.extname(f).toLowerCase()));
  } else {
    filesToScan = getSourceFiles(resolvedRepo);
  }

  const allFindings = [];
  for (const file of filesToScan) {
    const fileFindings = scanFile(file, resolvedRepo);
    allFindings.push(...fileFindings);
  }

  return {
    scannedFilesCount: filesToScan.length,
    findings: allFindings
  };
}

module.exports = {
  scanRepository,
  scanFile
};
