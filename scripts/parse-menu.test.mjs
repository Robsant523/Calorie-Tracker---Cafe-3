import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseMenu} from './parse-menu.mjs';

const dish=(hall,name='Rice &amp; Beans',id='10',menuId='50') => `<li class="recip vegan-option" data-id="${id}" data-menuid="${menuId}" data-location="${Buffer.from(`/code/menus/${hall}_20261018.xml`).toString('base64')}"><span>${name}</span><span class="icons-wrap">Vegan Option</span></li>`;
const meal=(name,content) => `<li class="preiod-name Fall - ${name}"><span>Fall - ${name}</span><ul>${content}</ul></li>`;
const hall=(name,content) => `<li class="location-name ${name} 20261018"><ul>${content}</ul></li>`;

test('same dish stays separate across halls, repeated services merge only within a hall',()=>{
  const parsed=parseMenu(hall('Cafe 3',meal('Brunch',dish('Cafe_3')+dish('Cafe_3'))+meal('Dinner',dish('Cafe_3')))+hall('Crossroads',meal('Dinner',dish('Crossroads'))));
  assert.equal(parsed.items.length,2);
  const [cafe,crossroads]=parsed.items;
  assert.equal(cafe.id,'rice-beans'); // retain legacy Café 3 log/selection IDs
  assert.equal(cafe.hallId,'cafe-3');
  assert.equal(cafe.name,'Rice & Beans');
  assert.deepEqual(cafe.meals,['Brunch','Dinner']);
  assert.equal(crossroads.hallId,'crossroads');
  assert.notEqual(cafe.id,crossroads.id);
  assert.deepEqual(crossroads.meals,['Dinner']);
  assert.equal(parsed.diningHalls.find(h=>h.id==='foothill').itemCount,0);
});
test('unrecognized locations and mismatched encoded sources do not leak into another hall',()=>{
  const parsed=parseMenu(hall('Cafe 3',meal('Dinner',dish('Crossroads')))+hall('Bear Market',meal('Dinner',dish('Bear_Market')))+dish('Cafe_3'));
  assert.deepEqual(parsed.items,[]);
});
test('menus never infer macros from names or preserve old fabricated estimates',()=>{
  const parsed=parseMenu(hall('Clark Kerr Campus',meal('Breakfast',dish('Clark_Kerr_Campus','Scrambled Eggs'))),[{name:'Scrambled Eggs',meal:'Lunch',calories:180,protein:13,carbs:2,fat:13}]);
  assert.equal(parsed.items[0].meal,'Breakfast');
  assert.equal(parsed.items[0].diningHall,'Clark Kerr');
  assert.equal(parsed.items[0].calories,null);
  assert.equal(parsed.items[0].protein,null);
  assert.equal(parsed.items[0].carbs,null);
  assert.equal(parsed.items[0].fat,null);
  assert.equal(parsed.items[0].servingGrams,null);
  assert.equal(parsed.items[0].nutrition,'unavailable');
  assert.deepEqual(parsed.items[0].sourceRefs,[{location:Buffer.from('/code/menus/Clark_Kerr_Campus_20261018.xml').toString('base64'),recipeId:'10',menuId:'50',meal:'Breakfast'}]);
  assert.equal(parsed.schemaVersion,3);
});
test('identically named dishes with different recipe or menu IDs do not merge',()=>{
  const html=hall('Cafe 3',meal('Brunch',dish('Cafe_3','Rice','10','50')+dish('Cafe_3','Rice','11','50'))+meal('Dinner',dish('Cafe_3','Rice','10','60')));
  const {items}=parseMenu(html);
  assert.equal(items.length,3);
  assert.equal(items[0].id,'rice');
  assert.equal(new Set(items.map(f=>f.id)).size,3);
  assert.ok(items.slice(1).every(f=>f.id.startsWith('rice--recipe-')));
  assert.deepEqual(items.map(f=>f.meals),[['Brunch'],['Brunch'],['Dinner']]);
  assert.deepEqual(parseMenu(html).items.map(f=>f.id),items.map(f=>f.id));
});
