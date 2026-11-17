import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseMenu} from './parse-menu.mjs';

const dish=(hall,name,id='10',menuId='50')=>'<li class="recip vegan-option" data-id="'+id+'" data-menuid="'+menuId+'" data-location="'+Buffer.from('/code/menus/'+hall+'_20261116.xml').toString('base64')+'"><span>'+name+'</span><span class="icons-wrap">Vegan Option</span></li>';
const station=(label,content)=>'<div class="cat-name"><span>'+label+'</span><ul class="recipe-name">'+content+'</ul></div>';
const meal=(name,content)=>'<li class="preiod-name Fall - '+name+'"><span>Fall - '+name+' <span class="accordion-icon"></span></span><div class="recipes-main-wrap">'+content+'</div></li>';
const hall=(name,content)=>'<li class="location-name '+name+' 20261116"><div class="location-title"><span>'+name+'</span></div><ul class="meal-period">'+content+'</ul></li>';

test('official station divs retain their published names and order within a meal',()=>{
  const html=hall('Cafe 3',meal('Breakfast',
    station('Center Plate',dish('Cafe_3','Eggs','1'))+
    station('Griddle/Grill',dish('Cafe_3','French Toast','2'))+
    station('Hot Cereal/Grains','<div class="extra-wrapper">'+dish('Cafe_3','Oatmeal','3')+'</div>')));
  const {items}=parseMenu(html);
  assert.deepEqual(items.map(food=>food.station),['Center Plate','Griddle/Grill','Hot Cereal/Grains']);
  assert.deepEqual(items.map(food=>food.stationAssignments.map(row=>[row.meal,row.station])),[
    [['Breakfast','Center Plate']],[['Breakfast','Griddle/Grill']],[['Breakfast','Hot Cereal/Grains']]
  ]);
  const orders=items.map(food=>food.stationAssignments[0].order);
  assert.deepEqual(orders,[html.indexOf('<div class="cat-name">'),html.indexOf('<div class="cat-name">',orders[0]+1),html.indexOf('<div class="cat-name">',orders[1]+1)]);
});

test('one recipe keeps every station and meal placement without duplicating food or source references',()=>{
  const rice=dish('Cafe_3','Brown Rice');
  const html=hall('Cafe 3',meal('Breakfast',station('Hot Cereal/Grains',rice+rice))+
    meal('Lunch',station('Center Plate',rice)+station('Allergen Friendly',rice)));
  const {items}=parseMenu(html);
  assert.equal(items.length,1);
  const [food]=items;
  assert.equal(food.id,'brown-rice');
  assert.equal(food.station,'Hot Cereal/Grains');
  assert.deepEqual(food.meals,['Breakfast','Lunch']);
  assert.deepEqual(food.stationAssignments.map(row=>[row.meal,row.station]),[
    ['Breakfast','Hot Cereal/Grains'],['Lunch','Center Plate'],['Lunch','Allergen Friendly']
  ]);
  assert.deepEqual(food.sourceRefs.map(ref=>ref.meal),['Breakfast','Lunch']);
  assert.equal(food.stationAssignments.length,3);
});

test('station context ends at its div, meal, and hall without inventing labels for unknown stations',()=>{
  const html=hall('Cafe 3',meal('Breakfast',station('Center Plate',dish('Cafe_3','Eggs','1'))+dish('Cafe_3','Unassigned Toast','2'))+
    meal('Lunch',dish('Cafe_3','Unassigned Soup','3')+station('',dish('Cafe_3','Unlabeled Rice','4'))))+
    hall('Crossroads',meal('Dinner',dish('Crossroads','Noodles','5')));
  const {items}=parseMenu(html);
  assert.equal(items[0].station,'Center Plate');
  assert.ok(items.slice(1).every(food=>food.station===null));
  assert.ok(items.slice(1).every(food=>food.stationAssignments[0].station===null));
  assert.equal(items[4].hallId,'crossroads');
  assert.equal(items[4].stationAssignments[0].meal,'Dinner');
});

test('station labels decode entities as text and do not capture recipe names or allergen labels',()=>{
  const html=hall('Cafe 3',meal('Dinner',station('Grill &amp; Griddle &lt;Hot&gt;',dish('Cafe_3','Rice &amp; Beans'))));
  const [food]=parseMenu(html).items;
  assert.equal(food.station,'Grill & Griddle <Hot>');
  assert.equal(food.name,'Rice & Beans');
  assert.equal(food.stationAssignments[0].station,'Grill & Griddle <Hot>');
});

test('adding station metadata preserves legacy and collision recipe IDs and nutrition source identity',()=>{
  const recipes=[dish('Cafe_3','Rice','10'),dish('Cafe_3','Rice','11'),dish('Cafe_3','Rice','10','60')];
  const plain=parseMenu(hall('Cafe 3',meal('Lunch',recipes.join('')))).items;
  const grouped=parseMenu(hall('Cafe 3',meal('Lunch',recipes.map((recipe,i)=>station('Station '+i,recipe)).join('')))).items;
  assert.deepEqual(grouped.map(food=>food.id),plain.map(food=>food.id));
  assert.deepEqual(grouped.map(food=>food.sourceRefs),plain.map(food=>food.sourceRefs));
  assert.ok(grouped.every(food=>food.nutrition==='unavailable'&&food.calories===null));
});

test('a later known placement supplies the first known label without losing an unknown service placement',()=>{
  const rice=dish('Cafe_3','Rice');
  const [food]=parseMenu(hall('Cafe 3',meal('Breakfast',rice)+meal('Dinner',station('Center Plate',rice)))).items;
  assert.equal(food.station,'Center Plate');
  assert.deepEqual(food.stationAssignments.map(row=>[row.meal,row.station]),[['Breakfast',null],['Dinner','Center Plate']]);
});
