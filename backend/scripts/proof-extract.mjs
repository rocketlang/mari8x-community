#!/usr/bin/env node
/**
 * PROOF Extractor — Mari8X Community
 * Crawls all .ts source files for @rule: @task: @capability: annotations.
 * Writes proof-cache.json at service root.
 *
 * @rule:FRJ-P-008  Annotations are the machine-readable contract between LOGICS and code
 *
 * Usage: node scripts/proof-extract.mjs
 * Output: proof-cache.json  (read by GET /api/v2/forja/proof)
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir   = dirname(fileURLToPath(import.meta.url));
const srcDir  = resolve(__dir, '../src');
const outPath = resolve(__dir, '../proof-cache.json');

// ── Annotation regex ─────────────────────────────────────────────────────────
// Matches: @rule:MAR-007 @task:MAR-YK-002 @capability:NOON_REPORT
// Multiple annotations can appear on the same comment line
const RULE_RE       = /@rule:([\w-]+)/g;
const TASK_RE       = /@task:([\w-]+)/g;
const CAPABILITY_RE = /@capability:([\w-]+)/g;

// ── Walk .ts files recursively ───────────────────────────────────────────────
function walkTs(dir) {
  const entries = [];
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    if (statSync(full).isDirectory()) entries.push(...walkTs(full));
    else if (f.endsWith('.ts')) entries.push(full);
  }
  return entries;
}

const files = walkTs(srcDir);
const annotations = [];

for (const filePath of files) {
  const rel   = filePath.replace(srcDir + '/', '');
  const lines = readFileSync(filePath, 'utf8').split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('@rule:')) continue;

    // Extract all rule refs on this line
    const ruleMatches = [...line.matchAll(RULE_RE)].map(m => m[1]);
    const taskMatches = [...line.matchAll(TASK_RE)].map(m => m[1]);
    const capMatches  = [...line.matchAll(CAPABILITY_RE)].map(m => m[1]);

    for (const ruleId of ruleMatches) {
      annotations.push({
        rule_id:    ruleId,
        task_id:    taskMatches[0] ?? null,
        capability: capMatches[0]  ?? null,
        file:       rel,
        line:       i + 1,
        raw:        line.trim(),
      });
    }
  }
}

// ── Summary by rule ──────────────────────────────────────────────────────────
const byRule = {};
for (const ann of annotations) {
  if (!byRule[ann.rule_id]) byRule[ann.rule_id] = [];
  byRule[ann.rule_id].push({ file: ann.file, line: ann.line, capability: ann.capability });
}

const output = {
  service:                 'mari8x-community',
  extracted_at:            new Date().toISOString(),
  source_dir:              srcDir,
  files_scanned:           files.length,
  annotations_found:       annotations.length,
  unique_rules_referenced: Object.keys(byRule).length,
  by_rule:                 byRule,
  annotations,
};

writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`[proof-extract] Done.`);
console.log(`  Files scanned:              ${files.length}`);
console.log(`  @rule: annotations found:   ${annotations.length}`);
console.log(`  Unique rule IDs referenced: ${Object.keys(byRule).length}`);
console.log(`  Rules referenced:`);
for (const [ruleId, refs] of Object.entries(byRule)) {
  console.log(`    ${ruleId.padEnd(20)} → ${refs.length} annotation(s) in ${[...new Set(refs.map(r => r.file))].join(', ')}`);
}
console.log(`  Written: ${outPath}`);
