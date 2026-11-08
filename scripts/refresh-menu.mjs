/** Refresh Berkeley's menus and the nutrition behind each official recipe popup. */
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {parseMenu} from './parse-menu.mjs';
import {parseNutrition} from './parse-nutrition.mjs';
const source='https://dining.berkeley.edu/menus/';
// Public endpoint and fields used by the menu's cal-dining/assets/custom.js.
const recipeEndpoint='https://dining.berkeley.edu/wp-admin/admin-ajax.php';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function fetchRecipeDetails(ref,{fetchImpl=fetch}={}) {
  if(!ref?.location||!/^\d+$/.test(ref.recipeId)||!/^\d+$/.test(ref.menuId))
    throw new Error('The menu did not provide a complete recipe reference.');
  for(let attempt=0;attempt<2;attempt++){
    try {
      const response=await fetchImpl(recipeEndpoint,{
        method:'POST',
        headers:{'user-agent':'CalFuel/3.0 published nutrition import','content-type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({action:'get_recipe_details',location:ref.location,id:ref.recipeId,menu_id:ref.menuId}),
        signal:AbortSignal.timeout(15000)
      });
      if(!response.ok){
        if(attempt===0&&(response.status===429||response.status>=500)){
          const seconds=Number(response.headers.get('retry-after'));
          await pause(Number.isFinite(seconds)&&seconds>0?Math.min(5000,seconds*1000):500);
          continue;
        }
        throw new Error('Berkeley recipe request returned HTTP '+response.status+'.');
      }
      return await response.text();
    } catch(error){
      if(attempt===1||/^Berkeley recipe request/.test(error.message))throw error;
      await pause(500);
    }
  }
}

export async function hydrateNutrition(items,{fetchDetails=fetchRecipeDetails,concurrency=3,onProgress=()=>{}}={}) {
  const requests=new Map();
  let next=0,published=0,unavailable=0,complete=0;
  const retrievedAt=new Date().toISOString();
  const worker=async()=>{
    while(next<items.length){
      const item=items[next++],ref=item.sourceRefs?.[0];
      const key=JSON.stringify([ref?.location,ref?.recipeId,ref?.menuId]);
      try {
        if(!requests.has(key))requests.set(key,Promise.resolve().then(()=>fetchDetails(ref)));
        const details=parseNutrition(await requests.get(key),item.name);
        Object.assign(item,details,{nutritionSource:source,nutritionRetrievedAt:retrievedAt});
        delete item.nutritionError;published++;
      } catch {
        // Missing facts are not zero nutrition. Never retain a previous guess.
        Object.assign(item,{calories:null,protein:null,carbs:null,fat:null,servingSize:null,servingGrams:null,
          nutrition:'unavailable',nutritionError:'Berkeley nutrition could not be retrieved or verified for this recipe.'});
        unavailable++;
      }
      onProgress({complete:++complete,total:items.length,published,unavailable});
    }
  };
  await Promise.all(Array.from({length:Math.max(1,Math.min(4,concurrency,items.length))},worker));
  return {published,unavailable,requests:requests.size};
}

export async function refreshMenu(args=process.argv.slice(2)) {
  // Retain the filenames for local bookmarks and deployments.
  const output=new URL('../data/cafe3-menu.json',import.meta.url);
  let html,offline=false;
  if(args.length){
    if(args.length!==2||args[0]!=='--input')throw new Error('Usage: npm run refresh-menu [-- --input /path/to/menu.html]');
    html=await readFile(args[1],'utf8');offline=true;
  } else {
    const response=await fetch(source,{headers:{'user-agent':'CalFuel/3.0 published nutrition import'},signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error(`Berkeley menu returned HTTP ${response.status}; existing menu was left unchanged.`);
    html=await response.text();
  }
  const parsed=parseMenu(html);
  if(parsed.items.length<8)throw new Error(`Only found ${parsed.items.length} dining-hall dishes; existing menu was left unchanged.`);
  let nutrition;
  if(offline){
    nutrition={published:0,unavailable:parsed.items.length,requests:0};
    parsed.items.forEach(item=>{item.nutritionError='Nutrition is not included in an offline menu HTML snapshot.';});
  } else {
    nutrition=await hydrateNutrition(parsed.items,{onProgress:({complete,total,published,unavailable})=>{
      if(complete%25===0||complete===total)console.log(`Nutrition: ${complete}/${total} recipes (${published} published, ${unavailable} unavailable)`);
    }});
    if(!nutrition.published)throw new Error('No Berkeley recipe nutrition could be verified; existing menu was left unchanged.');
  }
  const payload={source,refreshedAt:new Date().toISOString(),...parsed,nutritionCoverage:nutrition,
    notice:'Menu names, halls, meals, nutrition and serving sizes are published by UC Berkeley Dining. Nutrition reflects standard recipes and may vary with actual preparation and portions. Missing nutrition or gram weights are marked unavailable; CalFuel does not invent values.'};
  await Promise.all([
    writeFile(output,JSON.stringify(payload,null,2)+'\n'),
    writeFile(new URL('../data/cafe3-menu.js',import.meta.url),`window.CALFUEL_MENU=${JSON.stringify(payload).replaceAll('<','\\u003c')};\n`)
  ]);
  for(const hall of parsed.diningHalls)console.log(`${hall.name}: ${hall.itemCount} dishes${hall.itemCount?'':' (no menu published in this snapshot)'}`);
  console.log(`Nutrition: ${nutrition.published} published, ${nutrition.unavailable} unavailable.`);
  return payload;
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))
  refreshMenu().catch(error=>{console.error(error.message);process.exitCode=1;});
