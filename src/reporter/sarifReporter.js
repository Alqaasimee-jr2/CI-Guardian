function generateSarifReport(scanRes) {
  const findings = scanRes.findings || [];

  const rulesMap = new Map();
  findings.forEach(f => {
    if (!rulesMap.has(f.ruleId)) {
      rulesMap.set(f.ruleId, {
        id: f.ruleId,
        name: f.issue,
        shortDescription: { text: f.issue },
        fullDescription: { text: f.description },
        help: { text: f.remediation },
        defaultConfiguration: {
          level: f.severity === 'CRITICAL' ? 'error' : 'warning'
        }
      });
    }
  });

  const results = findings.map(f => {
    return {
      ruleId: f.ruleId,
      level: f.severity === 'CRITICAL' ? 'error' : 'warning',
      message: {
        text: `${f.issue}: ${f.description} Remediation: ${f.remediation}`
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: f.file.replace(/\\/g, '/'),
              uriBaseId: '%SRCROOT%'
            },
            region: {
              startLine: f.line,
              startColumn: 1,
              snippet: {
                text: f.snippet
              }
            }
          }
        }
      ]
    };
  });

  return {
    $schema: 'https://docs.oasis-open.org/sarif/sarif/v2.1.0/cos01/schemas/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'CI-Guardian',
            version: '1.0.0',
            informationUri: 'https://github.com/Alqaasimee-jr2/CI-Guardian',
            rules: Array.from(rulesMap.values())
          }
        },
        results
      }
    ]
  };
}

module.exports = {
  generateSarifReport
};
