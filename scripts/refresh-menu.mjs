/** Refresh the Café 3 recipe elements published on Berkeley Dining's menu page. */
import { readFile, writeFile } from 'node:fs/promises';
const source='https://dining.berkeley.edu/menus/', output=new URL('../data/cafe3-menu.json',import.meta.url);
const old=JSON.parse(await readFile(output,'utf8')), norm=x=>x.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const known=new Map(old.items.map(x=>[norm(x.name),x]));
const estimate=name=>{const n=name.toLowerCase();if(/chicken|beef|salmon|turkey|tuna|brisket/.test(n))return{calories:250,protein:30,carbs:5,fat:12};if(/tofu|lentil|bean|dal|chili|peas/.test(n))return{calories:180,protein:11,carbs:26,fat:4};if(/rice|pasta|noodle|potato|bread|waffle|oatmeal|bagel/.test(n))return{calories:210,protein:5,carbs:42,fat:3};if(/vegetable|broccoli|carrot|salad|spinach|mushroom|zucchini|pepper/.test(n))return{calories:70,protein:3,carbs:12,fat:2};return{calories:150,protein:5,carbs:18,fat:6}};
const html=await (await fetch(source,{headers:{'user-agent':'CalFuel/1.1 menu refresh'}})).text();
const matches=[...html.matchAll(/<li class="recip[^>]*data-location="([^"]+)"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/gi)];
const dishes=[];
for(const [,encoded,rawName] of matches){let location='';try{location=Buffer.from(encoded,'base64').toString('utf8')}catch{}if(!/Cafe_3|Cafe 3/i.test(location))continue;const name=rawName.trim(),id=norm(name);if(!id||dishes.some(x=>x.id===id))continue;const prior=known.get(id),m=prior??estimate(name);dishes.push({id,name,station:'Café 3',meal:prior?.meal??'Lunch',calories:m.calories,protein:m.protein,carbs:m.carbs,fat:m.fat,tags:prior?.tags??[],nutrition:'estimated'})}
if(dishes.length<8)throw new Error(`Only found ${dishes.length} Café 3 dishes; existing menu was left unchanged.`);
const payload={source,refreshedAt:new Date().toISOString(),notice:'Names and dietary labels come from UC Berkeley Dining. Macro values are serving-size estimates, not verified Berkeley nutrition facts.',items:dishes};
await Promise.all([writeFile(output,JSON.stringify(payload,null,2)+'\n'),writeFile(new URL('../data/cafe3-menu.js',import.meta.url),`window.CALFUEL_MENU=${JSON.stringify(payload)};\n`)]);
console.log(`Saved ${dishes.length} Café 3 dishes with tracker-safe estimated macros.`);
