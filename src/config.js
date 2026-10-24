const fs = require('fs');
const path = require('path');

function printUsage() {
  console.log(`
CI-Guardian 🛡️ — Production Pre-Flight Quality Gate

Usage:
  guardian [options] [target-dir]
  ci-guardian [options] [target-dir]

Options:
  -r, --repo <path>         Target repository directory to audit (default: ".")
  -d, --diff                Audit only files changed/staged relative to base git branch (default in git repos)
  -f, --full                Audit the entire repository regardless of git diff status
  -o, --output <dir>        Directory for generated reports (default: "<target-repo>/.guardian")
  -s, --strict, --ci        Strict CI mode: exit code 1 on warnings or missing tests
  --security-only, --no-tests, --skip-tests
                            Skip test execution and run static AST security scan only
  --test-script <name>      Custom package.json script to run instead of "test" (e.g. "lint", "build")
  --serve                   Launch live HTTP preview server for HTML dashboard report
  --no-html                 Disable HTML dashboard generation
  --format <type>           Report format: "console", "json", "sarif", "all" (default: "all")
  -v, --version             Show CI-Guardian version
  -h, --help                Show this help manual

Exit Codes:
  0 = Clean run, zero blocking vulnerabilities.
  1 = Policy failure (blocking security vulnerabilities or test failures detected).
  2 = Configuration error, invalid arguments, or test runner crash.
`);
}

function parseCliArgs(argv = process.argv.slice(2)) {
  const options = {
    repoPath: '.',
    mode: 'auto', // 'auto', 'diff', or 'full'
    outputDir: null,
    strict: false,
    skipTests: false,
    testScript: null,
    generateHtml: true,
    serve: false,
    format: 'all',
    help: false,
    version: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else if (arg === '-v' || arg === '--version') {
      options.version = true;
    } else if (arg === '-r' || arg === '--repo') {
      if (argv[i + 1] && !argv[i + 1].startsWith('-')) {
        options.repoPath = argv[++i];
      } else {
        throw new Error('Option --repo requires a directory path argument.');
      }
    } else if (arg.startsWith('--repo=')) {
      options.repoPath = arg.split('=')[1];
    } else if (arg === '-d' || arg === '--diff') {
      options.mode = 'diff';
    } else if (arg === '-f' || arg === '--full') {
      options.mode = 'full';
    } else if (arg === '-o' || arg === '--output') {
      if (argv[i + 1] && !argv[i + 1].startsWith('-')) {
        options.outputDir = argv[++i];
      } else {
        throw new Error('Option --output requires a directory path argument.');
      }
    } else if (arg.startsWith('--output=')) {
      options.outputDir = arg.split('=')[1];
    } else if (arg === '-s' || arg === '--strict' || arg === '--ci') {
      options.strict = true;
    } else if (arg === '--security-only' || arg === '--no-tests' || arg === '--skip-tests') {
      options.skipTests = true;
    } else if (arg === '--test-script' || arg === '--script') {
      if (argv[i + 1] && !argv[i + 1].startsWith('-')) {
        options.testScript = argv[++i];
      } else {
        throw new Error('Option --test-script requires a script name (e.g. "lint", "build").');
      }
    } else if (arg.startsWith('--test-script=')) {
      options.testScript = arg.split('=')[1];
    } else if (arg === '--serve') {
      options.serve = true;
    } else if (arg === '--no-html') {
      options.generateHtml = false;
    } else if (arg === '--format') {
      if (argv[i + 1]) {
        options.format = argv[++i].toLowerCase();
      }
    } else if (arg.startsWith('--format=')) {
      options.format = arg.split('=')[1].toLowerCase();
    } else if (!arg.startsWith('-') && options.repoPath === '.') {
      options.repoPath = arg;
    } else {
      throw new Error(`Unknown option: ${arg}. Run "guardian --help" for usage.`);
    }
  }

  return options;
}

function resolveConfig(rawOptions) {
  const resolvedRepo = path.resolve(process.cwd(), rawOptions.repoPath);

  if (!fs.existsSync(resolvedRepo)) {
    throw new Error(`Target repository directory does not exist: "${resolvedRepo}"`);
  }

  const stat = fs.statSync(resolvedRepo);
  if (!stat.isDirectory()) {
    throw new Error(`Target repository path is not a directory: "${resolvedRepo}"`);
  }

  const outputDir = rawOptions.outputDir
    ? path.resolve(process.cwd(), rawOptions.outputDir)
    : path.join(resolvedRepo, '.guardian');

  return {
    ...rawOptions,
    resolvedRepo,
    outputDir
  };
}

module.exports = {
  printUsage,
  parseCliArgs,
  resolveConfig
};
