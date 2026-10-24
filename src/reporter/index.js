const fs = require('fs');
const path = require('path');
const { generateMarkdownReport } = require('./markdownReporter');
const { generateHtmlReport } = require('./htmlReporter');
const { generateSarifReport } = require('./sarifReporter');
const { renderConsoleReport } = require('./consoleReporter');

function writeReports(scanRes, testRes, targetDir, mode, outputDir, generateHtml = true) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. findings.json
  const findingsPath = path.join(outputDir, 'findings.json');
  fs.writeFileSync(findingsPath, JSON.stringify(scanRes.findings, null, 2), 'utf-8');

  // 2. Markdown reports
  const { prDescription, commentPreview } = generateMarkdownReport(scanRes, testRes, targetDir, mode);
  const prDocPath = path.join(outputDir, 'pr-description.md');
  const commentPath = path.join(outputDir, 'pr-comment-preview.md');
  fs.writeFileSync(prDocPath, prDescription, 'utf-8');
  fs.writeFileSync(commentPath, commentPreview, 'utf-8');

  // 3. HTML Dashboard
  let htmlPath = null;
  if (generateHtml) {
    const htmlContent = generateHtmlReport(scanRes, testRes, targetDir, mode);
    htmlPath = path.join(outputDir, 'guardian-report.html');
    fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
  }

  // 4. SARIF Security Report
  const sarifData = generateSarifReport(scanRes);
  const sarifPath = path.join(outputDir, 'guardian.sarif');
  fs.writeFileSync(sarifPath, JSON.stringify(sarifData, null, 2), 'utf-8');

  return {
    findingsPath,
    prDocPath,
    commentPath,
    htmlPath,
    sarifPath
  };
}

module.exports = {
  writeReports,
  renderConsoleReport
};
