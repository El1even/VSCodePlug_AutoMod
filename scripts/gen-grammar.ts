import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildGrammar } from '../src/grammar/build';

const target = join(__dirname, '..', '..', 'syntaxes', 'automod.tmLanguage.json');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(buildGrammar(), null, 2)}\n`, 'utf8');
console.log(`generated ${target}`);
