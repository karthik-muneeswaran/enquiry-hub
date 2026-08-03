/**
 * Generate a consolidated SECURITY_REPORT.md from Trivy and npm audit scan results.
 *
 * Usage: ts-node scripts/generate-security-report.ts <scan-results-directory>
 *
 * Expected files in the scan results directory:
 *   - trivy-backend-fs.json      (Trivy filesystem scan of backend)
 *   - trivy-backend-image.json   (Trivy image scan of backend Docker image)
 *   - trivy-frontend-fs.json     (Trivy filesystem scan of frontend)
 *   - trivy-frontend-image.json  (Trivy image scan of frontend Docker image)
 *   - npm-audit-backend.json     (npm audit output for backend)
 *   - npm-audit-frontend.json    (npm audit output for frontend)
 */

import * as fs from 'fs';
import * as path from 'path';

// --- Types ---

interface TrivyVulnerability {
  VulnerabilityID: string;
  PkgName: string;
  InstalledVersion: string;
  FixedVersion?: string;
  Severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  Title?: string;
  Description?: string;
  PrimaryURL?: string;
}

interface TrivyResult {
  Target: string;
  Type: string;
  Vulnerabilities?: TrivyVulnerability[];
}

interface TrivyReport {
  Results?: TrivyResult[];
}

interface NpmAuditVulnerability {
  name: string;
  severity: string;
  via: Array<string | { name: string; url?: string; title?: string }>;
  effects: string[];
  range: string;
  fixAvailable: boolean | { name: string; version: string };
}

interface NpmAuditReport {
  vulnerabilities?: Record<string, NpmAuditVulnerability>;
  metadata?: {
    vulnerabilities?: {
      total: number;
      critical: number;
      high: number;
      moderate: number;
      low: number;
      info: number;
    };
  };
}

interface Finding {
  source: string;
  component: string;
  id: string;
  package: string;
  installedVersion: string;
  fixedVersion: string;
  severity: string;
  title: string;
  url: string;
}

interface SeveritySummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

// --- Helpers ---

function readJsonFile<T>(filePath: string): T | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

function parseTrivyReport(report: TrivyReport | null, source: string): Finding[] {
  if (!report?.Results) return [];

  const findings: Finding[] = [];

  for (const result of report.Results) {
    if (!result.Vulnerabilities) continue;

    for (const vuln of result.Vulnerabilities) {
      findings.push({
        source,
        component: result.Target,
        id: vuln.VulnerabilityID,
        package: vuln.PkgName,
        installedVersion: vuln.InstalledVersion,
        fixedVersion: vuln.FixedVersion || 'N/A',
        severity: vuln.Severity,
        title: vuln.Title || vuln.Description?.substring(0, 100) || 'No description',
        url: vuln.PrimaryURL || '',
      });
    }
  }

  return findings;
}

function parseNpmAudit(report: NpmAuditReport | null, source: string): Finding[] {
  if (!report?.vulnerabilities) return [];

  const findings: Finding[] = [];

  for (const [name, vuln] of Object.entries(report.vulnerabilities)) {
    const severity = vuln.severity.toUpperCase();
    const fixInfo =
      typeof vuln.fixAvailable === 'object'
        ? `${vuln.fixAvailable.name}@${vuln.fixAvailable.version}`
        : vuln.fixAvailable
          ? 'Available'
          : 'No fix available';

    let title = '';
    let url = '';
    for (const v of vuln.via) {
      if (typeof v === 'object') {
        title = v.title || '';
        url = v.url || '';
        break;
      }
    }

    findings.push({
      source,
      component: 'npm',
      id: name,
      package: name,
      installedVersion: vuln.range,
      fixedVersion: fixInfo,
      severity,
      title: title || `Vulnerability in ${name}`,
      url,
    });
  }

  return findings;
}

function countSeverities(findings: Finding[]): SeveritySummary {
  return findings.reduce(
    (acc, f) => {
      const sev = f.severity.toUpperCase();
      if (sev === 'CRITICAL') acc.critical++;
      else if (sev === 'HIGH') acc.high++;
      else if (sev === 'MEDIUM' || sev === 'MODERATE') acc.medium++;
      else if (sev === 'LOW') acc.low++;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 },
  );
}

function severityOrder(severity: string): number {
  switch (severity.toUpperCase()) {
    case 'CRITICAL':
      return 0;
    case 'HIGH':
      return 1;
    case 'MEDIUM':
    case 'MODERATE':
      return 2;
    case 'LOW':
      return 3;
    default:
      return 4;
  }
}

function generateReport(findings: Finding[], scanDate: string): string {
  const summary = countSeverities(findings);
  const sortedFindings = [...findings].sort(
    (a, b) => severityOrder(a.severity) - severityOrder(b.severity),
  );

  const lines: string[] = [];

  lines.push('# Security Scan Report');
  lines.push('');
  lines.push(`**Scan Date:** ${scanDate}`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push('| Severity | Count |');
  lines.push('|----------|-------|');
  lines.push(`| CRITICAL | ${summary.critical} |`);
  lines.push(`| HIGH | ${summary.high} |`);
  lines.push(`| MEDIUM | ${summary.medium} |`);
  lines.push(`| LOW | ${summary.low} |`);
  lines.push(`| **Total** | **${findings.length}** |`);
  lines.push('');

  if (findings.length === 0) {
    lines.push('No vulnerabilities found. All clear.');
    lines.push('');
    return lines.join('\n');
  }

  // Status indicator
  if (summary.critical > 0) {
    lines.push('> **Status:** CRITICAL vulnerabilities detected. Immediate action required.');
  } else if (summary.high > 0) {
    lines.push('> **Status:** HIGH severity vulnerabilities detected. Action recommended this week.');
  } else {
    lines.push('> **Status:** No critical or high severity issues. Review at next sprint.');
  }
  lines.push('');

  // Detailed findings by source
  const sourceGroups = new Map<string, Finding[]>();
  for (const finding of sortedFindings) {
    const group = sourceGroups.get(finding.source) || [];
    group.push(finding);
    sourceGroups.set(finding.source, group);
  }

  lines.push('## Detailed Findings');
  lines.push('');

  for (const [source, sourceFindings] of sourceGroups) {
    lines.push(`### ${source}`);
    lines.push('');
    lines.push('| Severity | Package | Installed | Fixed | ID | Title |');
    lines.push('|----------|---------|-----------|-------|-----|-------|');

    for (const f of sourceFindings) {
      const idCell = f.url ? `[${f.id}](${f.url})` : f.id;
      const titleTruncated = f.title.length > 60 ? f.title.substring(0, 57) + '...' : f.title;
      lines.push(
        `| ${f.severity} | ${f.package} | ${f.installedVersion} | ${f.fixedVersion} | ${idCell} | ${titleTruncated} |`,
      );
    }

    lines.push('');
  }

  // Remediation guidance
  lines.push('## Remediation');
  lines.push('');
  lines.push('### Automated Fixes');
  lines.push('');
  lines.push('```bash');
  lines.push('# Backend - fix npm vulnerabilities');
  lines.push('cd backend && npm audit fix');
  lines.push('');
  lines.push('# Frontend - fix npm vulnerabilities');
  lines.push('cd frontend && npm audit fix');
  lines.push('```');
  lines.push('');
  lines.push('### Manual Review Required');
  lines.push('');
  lines.push(
    '- CRITICAL and HIGH findings with no automated fix need manual package upgrade or replacement.',
  );
  lines.push('- Docker image vulnerabilities may require base image upgrade in Dockerfiles.');
  lines.push('- Review Dependabot PRs for pending security updates.');
  lines.push('');

  return lines.join('\n');
}

// --- Main ---

function main(): void {
  const scanDir = process.argv[2];

  if (!scanDir) {
    console.error('Usage: ts-node scripts/generate-security-report.ts <scan-results-directory>');
    process.exit(1);
  }

  const resolvedDir = path.resolve(scanDir);

  if (!fs.existsSync(resolvedDir)) {
    console.error(`Scan results directory not found: ${resolvedDir}`);
    process.exit(1);
  }

  console.log(`Reading scan results from: ${resolvedDir}`);

  // Parse all scan results
  const allFindings: Finding[] = [];

  const trivyBackendFs = readJsonFile<TrivyReport>(path.join(resolvedDir, 'trivy-backend-fs.json'));
  allFindings.push(...parseTrivyReport(trivyBackendFs, 'Trivy - Backend (filesystem)'));

  const trivyBackendImage = readJsonFile<TrivyReport>(
    path.join(resolvedDir, 'trivy-backend-image.json'),
  );
  allFindings.push(...parseTrivyReport(trivyBackendImage, 'Trivy - Backend (Docker image)'));

  const trivyFrontendFs = readJsonFile<TrivyReport>(
    path.join(resolvedDir, 'trivy-frontend-fs.json'),
  );
  allFindings.push(...parseTrivyReport(trivyFrontendFs, 'Trivy - Frontend (filesystem)'));

  const trivyFrontendImage = readJsonFile<TrivyReport>(
    path.join(resolvedDir, 'trivy-frontend-image.json'),
  );
  allFindings.push(...parseTrivyReport(trivyFrontendImage, 'Trivy - Frontend (Docker image)'));

  const npmBackend = readJsonFile<NpmAuditReport>(
    path.join(resolvedDir, 'npm-audit-backend.json'),
  );
  allFindings.push(...parseNpmAudit(npmBackend, 'npm audit - Backend'));

  const npmFrontend = readJsonFile<NpmAuditReport>(
    path.join(resolvedDir, 'npm-audit-frontend.json'),
  );
  allFindings.push(...parseNpmAudit(npmFrontend, 'npm audit - Frontend'));

  // Deduplicate by ID + package combination
  const seen = new Set<string>();
  const deduped = allFindings.filter((f) => {
    const key = `${f.id}:${f.package}:${f.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`Found ${deduped.length} unique findings across all scans`);

  // Generate report
  const scanDate = process.env.SCAN_DATE || new Date().toISOString().split('T')[0];
  const report = generateReport(deduped, scanDate);

  // Write report
  const outputPath = path.resolve('SECURITY_REPORT.md');
  fs.writeFileSync(outputPath, report, 'utf-8');
  console.log(`Security report written to: ${outputPath}`);

  // Exit with non-zero if CRITICAL findings exist
  const summary = countSeverities(deduped);
  if (summary.critical > 0) {
    console.error(`CRITICAL vulnerabilities found: ${summary.critical}`);
    process.exit(2);
  }
}

main();
