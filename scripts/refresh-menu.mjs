/** Refresh menus for the four Berkeley dining halls, preserving hall + meal. */
import { readFile, writeFile } from 'node:fs/promises';
import { parseMenu } from './parse-menu.mjs';
const source = 'https://dining.berkeley.edu/menus/';
// Retain these filenames so existing local bookmarks and deployments still work.
const output = new URL('../data/cafe3-menu.json', import.meta.url);
const old = JSON.parse(await readFile(output, 'utf8'));
let html;
if (process.argv[2] === '--input' && process.argv[3]) {
  html = await readFile(process.argv[3], 'utf8');
} else {
  const response = await fetch(source, {headers:{'user-agent':'CalFuel/2.0 menu refresh'}, signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`Berkeley menu returned HTTP ${response.status}; existing menu was left unchanged.`);
  html = await response.text();
}
const parsed = parseMenu(html, old.items);
if (parsed.items.length < 8) throw new Error(`Only found ${parsed.items.length} dining-hall dishes; existing menu was left unchanged.`);
const payload = {
  source, refreshedAt:new Date().toISOString(), ...parsed,
  notice:'Names, hall assignments, meal services and dietary labels come from UC Berkeley Dining. Macro values are serving-size estimates, not verified Berkeley nutrition facts.',
};
await Promise.all([
  writeFile(output, JSON.stringify(payload, null, 2)+'\n'),
  writeFile(new URL('../data/cafe3-menu.js', import.meta.url), `window.CALFUEL_MENU=${JSON.stringify(payload).replaceAll('<', '\\u003c')};\n`),
]);
for (const hall of parsed.diningHalls) console.log(`${hall.name}: ${hall.itemCount} dishes${hall.itemCount ? '' : ' (no menu published in this snapshot)'}`);
