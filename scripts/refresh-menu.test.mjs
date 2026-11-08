import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fetchRecipeDetails,hydrateNutrition,refreshMenu} from './refresh-menu.mjs';

const ref={location:Buffer.from('/code/menus/Cafe_3_20261107.xml').toString('base64'),recipeId:'600',menuId:'374',meal:'Brunch'};
const facts=name=>`<div class="title sec"><h5>${name}</h5><span class="serving-size">Serving Size: 3.18 oz</span></div><div class="nutration-details sec"><ul><li><span>Calories (kcal):</span>93.86</li><li><span>Total Lipid/Fat (g):</span>3.37</li><li><span>Carbohydrate (g):</span>3.31</li><li><span>Protein (g):</span>12.83</li></ul></div>`;

test('recipe requests use the official popup endpoint and exact menu reference',async()=>{
  let requests=0;
  const result=await fetchRecipeDetails(ref,{fetchImpl:async(url,options)=>{
    requests++;
    assert.equal(url,'https://dining.berkeley.edu/wp-admin/admin-ajax.php');
    assert.equal(options.method,'POST');
    assert.deepEqual(Object.fromEntries(options.body),{action:'get_recipe_details',location:ref.location,id:'600',menu_id:'374'});
    return new Response('recipe response');
  }});
  assert.equal(result,'recipe response');assert.equal(requests,1);
  await assert.rejects(()=>fetchRecipeDetails({...ref,menuId:''}),/complete recipe reference/);
});

test('nutrition retrieval deduplicates source tuples and never keeps guessed values on failure',async()=>{
  const items=[
    {name:'Halal Beef Fajitas',sourceRefs:[ref],calories:250,nutrition:'estimated'},
    {name:'Halal Beef Fajitas',sourceRefs:[ref]},
    {name:'Missing food',sourceRefs:[{...ref,recipeId:'99'}],calories:250,protein:30,carbs:5,fat:12,nutrition:'estimated'}
  ];
  let calls=0;
  const stats=await hydrateNutrition(items,{fetchDetails:async source=>{
    calls++;
    if(source.recipeId==='99')throw new Error('Unavailable');
    return facts('Halal Beef Fajitas');
  }});
  assert.deepEqual(stats,{published:2,unavailable:1,requests:2});
  assert.equal(calls,2);
  for(const food of items.slice(0,2)){
    assert.equal(food.calories,93.86);assert.equal(food.protein,12.83);
    assert.equal(food.servingGrams,3.18*28.349523125);assert.equal(food.nutrition,'berkeley');
  }
  for(const key of ['calories','protein','carbs','fat','servingGrams'])assert.equal(items[2][key],null);
  assert.equal(items[2].nutrition,'unavailable');
});

test('a wrong-name recipe response cannot overwrite a different food',async()=>{
  const items=[{name:'Rice',sourceRefs:[ref]}];
  const stats=await hydrateNutrition(items,{fetchDetails:async()=>facts('Halal Beef Fajitas')});
  assert.equal(stats.published,0);assert.equal(stats.unavailable,1);
  assert.equal(items[0].calories,null);
});

test('a complete live nutrition failure preserves both existing snapshot files',async()=>{
  const files=[new URL('../data/cafe3-menu.json',import.meta.url),new URL('../data/cafe3-menu.js',import.meta.url)];
  const before=await Promise.all(files.map(file=>readFile(file,'utf8')));
  const html=`<li class="location-name Cafe 3 20261107"><ul><li class="preiod-name Fall - Brunch"><ul>${Array.from({length:8},(_,i)=>`<li class="recip" data-location="${ref.location}" data-id="${i}" data-menuid="374"><span>Food ${i}</span></li>`).join('')}</ul></li></ul></li>`;
  const originalFetch=globalThis.fetch;
  try {
    globalThis.fetch=async url=>new Response(url==='https://dining.berkeley.edu/menus/'?html:'');
    await assert.rejects(()=>refreshMenu([]),/No Berkeley recipe nutrition could be verified/);
  } finally {globalThis.fetch=originalFetch;}
  assert.deepEqual(await Promise.all(files.map(file=>readFile(file,'utf8'))),before);
});
