const https = require('https');
const fs = require('fs');

function makeGitHubRequest(path, method, token, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.github.com',
      port: 443,
      path,
      method,
      headers: {
        'User-Agent': 'CI-Guardian-Action',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        ...(payload ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        } : {})
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function postPrCommentIfInCi(commentMarkdown) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (!token || !repo || !eventPath || !fs.existsSync(eventPath)) {
    return;
  }

  try {
    const eventData = JSON.parse(fs.readFileSync(eventPath, 'utf-8'));
    const prNumber = eventData.pull_request && eventData.pull_request.number;
    if (!prNumber) return;

    // 1. Fetch existing PR comments to see if CI-Guardian has already commented
    const listRes = await makeGitHubRequest(`/repos/${repo}/issues/${prNumber}/comments?per_page=100`, 'GET', token);
    const existingComments = Array.isArray(listRes.data) ? listRes.data : [];
    const previousGuardianComment = existingComments.find(c =>
      c.body && c.body.includes('<!-- ci-guardian-comment -->')
    );

    if (previousGuardianComment) {
      // 2. Update existing comment in place
      await makeGitHubRequest(
        `/repos/${repo}/issues/comments/${previousGuardianComment.id}`,
        'PATCH',
        token,
        { body: commentMarkdown }
      );
    } else {
      // 3. Post a new comment
      await makeGitHubRequest(
        `/repos/${repo}/issues/${prNumber}/comments`,
        'POST',
        token,
        { body: commentMarkdown }
      );
    }
  } catch {
    // Graceful fallback
  }
}

module.exports = {
  postPrCommentIfInCi
};
