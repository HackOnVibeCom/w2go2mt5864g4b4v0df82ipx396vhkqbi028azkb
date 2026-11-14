// Fails if any questionnaire answer in SUBMISSION.md is longer than 300 characters.
import { readFileSync } from 'node:fs';

const LIMIT = 300;
const text = readFileSync('SUBMISSION.md', 'utf8');
const section = text.split('## Questionnaire answers')[1]?.split('\n## ')[0] ?? '';
const blocks = section.split(/\n\*\*(.+?)\*\*\n/).slice(1);
let bad = 0;
for (let i = 0; i < blocks.length; i += 2) {
  const question = blocks[i];
  const answer = blocks[i + 1].trim();
  const length = [...answer].length;
  const flag = length > LIMIT ? 'TOO LONG' : 'ok';
  if (length > LIMIT) bad++;
  console.log(`${String(length).padStart(3)}  ${flag.padEnd(8)}  ${question}`);
}
if (!blocks.length) {
  console.error('No answers found under "## Questionnaire answers".');
  process.exit(1);
}
process.exit(bad ? 1 : 0);
