const https = require('https');
const fs = require('fs');

function postPrCommentIfInCi(commentMarkdown) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (!token || !repo || !eventPath || !fs.existsSync(eventPath)) {
    return; // Not in a GitHub Action PR context or missing token
  }

  try {
    const eventData = JSON.parse(fs.readFileSync(eventPath, 'utf-8'));
    const prNumber = eventData.pull_request && eventData.pull_request.number;

    if (!prNumber) return;

    const payload = JSON.stringify({ body: commentMarkdown });
    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: `/repos/${repo}/issues/${prNumber}/comments`,
      method: 'POST',
      headers: {
        'User-Agent': 'CI-Guardian-Action',
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      // Consume response stream
      res.resume();
    });

    req.on('error', () => {
      // Silent error in background
    });

    req.write(payload);
    req.end();
  } catch {
    // Graceful fallback
  }
}

module.exports = {
  postPrCommentIfInCi
};
