const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function isGitRepo(targetDir) {
  try {
    const res = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: targetDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    });
    return res.status === 0 && res.stdout.trim() === 'true';
  } catch {
    return false;
  }
}

function getChangedFiles(targetDir, baseBranch = 'origin/main') {
  if (!isGitRepo(targetDir)) {
    return null; // Not a git repository
  }

  const changedFiles = new Set();

  try {
    // 1. Unstaged and staged modified/untracked files
    const statusRes = spawnSync('git', ['status', '--porcelain'], {
      cwd: targetDir,
      encoding: 'utf-8'
    });

    if (statusRes.status === 0 && statusRes.stdout) {
      const lines = statusRes.stdout.split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        const filePath = line.slice(3).trim();
        // Remove quotes if git added them
        const cleanPath = filePath.replace(/^"|"$/g, '');
        changedFiles.add(cleanPath);
      }
    }

    // 2. Diff against base branch if available
    const diffRes = spawnSync('git', ['diff', '--name-only', baseBranch], {
      cwd: targetDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    });

    if (diffRes.status === 0 && diffRes.stdout) {
      const lines = diffRes.stdout.split(/\r?\n/);
      for (const line of lines) {
        if (line.trim()) changedFiles.add(line.trim().replace(/^"|"$/g, ''));
      }
    }
  } catch {
    return null;
  }

  return Array.from(changedFiles);
}

module.exports = {
  isGitRepo,
  getChangedFiles
};
