/**
 * Pulls the current Cafe 3 menu from UC Berkeley Dining's public menu page.
 * This intentionally records dishes and tags only. Nutrition remains marked as
 * estimated until Berkeley exposes structured nutrition data for an item.
 */
import { writeFile } from 'node:fs/promises';

const source = 'https://dining.berkeley.edu/menus/';
const html = await (await fetch(source, { headers: { 'user-agent': 'CalFuel menu refresh' } })).text();
const cafe = html.match(/Caf(?:é|&eacute;) 3[\s\S]*?(?=<[^>]*>\s*(?:Clark Kerr|Crossroads|Foothill))/i)?.[0] ?? '';
const plain = cafe.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')
  .replace(/<[^>]+>/g, '\n').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
  .split('\n').map(s => s.trim()).filter(Boolean);
const skip = /^(Caf.|Now Open|Fall|Brunch|Dinner|Lunch|Center Plate|Pasta|Soup|Salad Bar|salad bar|Allergen Friendly|Dessert|Soft Serve|Deli Bar|Breakfast)/i;
const names = [...new Set(plain.filter(s => !skip.test(s) && s.length > 2 && s.length < 90))];
const payload = { source, refreshedAt: new Date().toISOString(), notice: 'Names and dietary labels come from UC Berkeley Dining. Macro values in the app are estimates until verified on the official item detail.', items: names.map(name => ({ name, station: 'Café 3', source: 'official', nutrition: 'estimated' })) };
await writeFile(new URL('../data/cafe3-menu.json', import.meta.url), JSON.stringify(payload, null, 2) + '\n');
console.log(`Saved ${names.length} Cafe 3 menu names.`);
