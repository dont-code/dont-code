#!/usr/bin/env node
/**
 * Remove environment-specific defaults from Quarkus application.properties
 * before packaging. Called by the release workflow on throwaway checkouts so
 * no test Mongo URI or demo URL is compiled into the runner jars.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

function neutralLine(line) {
  if (/^\s*%test\./.test(line) || /^\s*%scalewaytest\./.test(line)) return undefined;
  if (/^\s*quarkus\.mongodb\..*connection-string\s*=/.test(line)) return line.replace(/=.*$/, '= ');
  if (/^\s*document-external-url\s*=/.test(line)) return line.replace(/=.*$/, '= ');
  return line;
}

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('Usage: neutralize-service-properties.mjs <application.properties> [more...]');
    process.exit(1);
  }
  for (const raw of files) {
    const file = path.resolve(raw);
    const original = await fs.readFile(file, 'utf8');
    const updated = original.split(/\r?\n/).map(neutralLine).filter((line) => line !== undefined).join('\n');
    await fs.writeFile(file, updated, 'utf8');
    console.log(`Neutralized ${path.basename(path.dirname(path.dirname(file)))}/${path.basename(file)}`);
  }
}

main().catch((error) => {
  console.error(`neutralize-service-properties: ${error.message}`);
  process.exit(1);
});
