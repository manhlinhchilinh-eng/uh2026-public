#!/usr/bin/env node
/**
 * UMS Digital Logbook E2E Test Suite Runner
 * Independent Opaque-Box Verification Harness
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../..');

const TIERS = [
  { id: 'Tier 1', name: 'Feature Coverage', glob: 'ums-logbook/tests/e2e/tier1_features/*.test.ts' },
  { id: 'Tier 2', name: 'Boundary & Corner Cases', glob: 'ums-logbook/tests/e2e/tier2_boundaries/*.test.ts' },
  { id: 'Tier 3', name: 'Cross-Feature Combinations', glob: 'ums-logbook/tests/e2e/tier3_combinations/*.test.ts' },
  { id: 'Tier 4', name: 'Real-World Application Scenarios', glob: 'ums-logbook/tests/e2e/tier4_scenarios/*.test.ts' },
];

async function runCommand(args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd, shell: false, stdio: ['inherit', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

function parseTestCounts(output) {
  const passMatch = output.match(/ℹ pass (\d+)/);
  const failMatch = output.match(/ℹ fail (\d+)/);
  const totalMatch = output.match(/ℹ tests (\d+)/);
  const durMatch = output.match(/ℹ duration_ms ([\d.]+)/);

  return {
    passed: passMatch ? parseInt(passMatch[1], 10) : 0,
    failed: failMatch ? parseInt(failMatch[1], 10) : 0,
    total: totalMatch ? parseInt(totalMatch[1], 10) : 0,
    durationMs: durMatch ? parseFloat(durMatch[1]) : 0,
  };
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('       UMS DIGITAL CLASS LOGBOOK - E2E TEST TRACK RUNNER');
  console.log('       Independent Opaque-Box Verification (Tiers 1 - 4)');
  console.log('='.repeat(70) + '\n');

  const startTime = Date.now();
  let overallPassed = 0;
  let overallFailed = 0;
  let overallTotal = 0;

  const results = [];

  for (const tier of TIERS) {
    process.stdout.write(` Running ${tier.id}: ${tier.name.padEnd(35)} ... `);
    const args = ['--experimental-strip-types', '--test', tier.glob];
    const res = await runCommand(args, projectRoot);
    const counts = parseTestCounts(res.stdout);

    overallPassed += counts.passed;
    overallFailed += counts.failed;
    overallTotal += counts.total;

    if (res.code === 0 && counts.failed === 0) {
      console.log(`\x1b[32mPASS\x1b[0m (${counts.passed}/${counts.total} tests, ${counts.durationMs.toFixed(1)}ms)`);
      results.push({ tier: tier.id, name: tier.name, status: 'PASS', ...counts });
    } else {
      console.log(`\x1b[31mFAIL\x1b[0m (${counts.failed} failed)`);
      console.error(res.stderr || res.stdout);
      results.push({ tier: tier.id, name: tier.name, status: 'FAIL', ...counts });
    }
  }

  const totalDuration = Date.now() - startTime;
  console.log('\n' + '-'.repeat(70));
  console.log(' SUMMARY MATRIX:');
  console.log('-'.repeat(70));
  for (const r of results) {
    const statusStr = r.status === 'PASS' ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`  [${statusStr}] ${r.tier.padEnd(8)} | ${r.name.padEnd(35)} | ${r.passed.toString().padStart(2)} passed / ${r.total.toString().padStart(2)} total`);
  }
  console.log('-'.repeat(70));
  console.log(`  TOTAL: ${overallPassed}/${overallTotal} passed in ${totalDuration}ms`);
  console.log('='.repeat(70) + '\n');

  if (overallFailed > 0 || overallPassed === 0) {
    console.error(`❌ Test suite failed with ${overallFailed} errors.`);
    process.exit(1);
  } else {
    console.log(`✅ All ${overallPassed} E2E tests across 4 tiers PASSED perfectly!`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
