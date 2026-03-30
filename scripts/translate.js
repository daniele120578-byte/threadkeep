#!/usr/bin/env node
/**
 * Translate workflow script
 * Fonte di verità: _locales/en/messages.json
 * Rileva gap nelle altre lingue e produce report — traduzioni manuali
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '..', '_locales');
const LANGUAGES = ['it', 'fr', 'de', 'es', 'ko'];
const SOURCE_LANG = 'en';

function loadMessages(lang) {
  const path = join(LOCALES_DIR, lang, 'messages.json');
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}

function main() {
  const source = loadMessages(SOURCE_LANG);
  const sourceKeys = Object.keys(source);
  console.log(`Source (${SOURCE_LANG}): ${sourceKeys.length} keys\n`);

  let totalGaps = 0;

  for (const lang of LANGUAGES) {
    const target = loadMessages(lang);
    const targetKeys = Object.keys(target);

    const missing = sourceKeys.filter(key => !target[key]);
    const extra = targetKeys.filter(key => !source[key]);

    if (missing.length === 0 && extra.length === 0) {
      console.log(`${lang}: ✓ up to date (${targetKeys.length} keys)`);
    } else {
      totalGaps += missing.length;
      console.log(`${lang}: ✗ ${missing.length} missing, ${extra.length} extra\n`);
      console.log('  MISSING KEYS:');
      missing.forEach(key => {
        const src = source[key];
        console.log(`    - ${key}`);
        console.log(`      EN: "${src.message}"`);
      });
      if (extra.length > 0) {
        console.log('  EXTRA KEYS:');
        extra.forEach(key => {
          console.log(`    + ${key}`);
        });
      }
      console.log('');
    }
  }

  if (totalGaps > 0) {
    console.log(`\nTotal missing translations: ${totalGaps}`);
    console.log('Add translations manually to the missing keys above.\n');
  } else {
    console.log('\nAll languages up to date.');
  }
}

main();
