import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const require=createRequire(import.meta.url);
const CalFuelBrowse=require('../menu-browse.js');
const CalFuelPortions=require('../portions.js');
const CalFuelSchedule=require('../meal-schedule.js');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const escapeCode=app.slice(app.indexOf('const escapeHtml ='),app.indexOf('const hallFoods ='));
const renderCode=app.slice(app.indexOf('function updateStationFilter()'),app.indexOf('function renderSelections()'));
const dish=(id,name,category,assignments,hallId='cafe-3')=>({
  id,name,category,hallId,diningHall:hallId==='cafe-3'?'Café 3':'Crossroads',
  meals:[...new Set(assignments.map(row=>row.meal))],stationAssignments:assignments,
  calories:100,protein:5,carbs:15,fat:2,servingGrams:100,servingSize:'100 g',nutrition:'berkeley'
});
const rice=dish('rice','Brown Rice','carb',[
  {meal:'Breakfast',station:'Hot Cereal/Grains',order:30},
  {meal:'Lunch',station:'Center Plate',order:100},
  {meal:'Lunch',station:'Salad Bar',order:150}
]);
const eggs=dish('eggs','Scrambled Eggs','protein',[{meal:'Breakfast',station:'Center Plate',order:10}]);
const toast=dish('toast','French Toast','carb',[{meal:'Breakfast',station:'Griddle/Grill',order:20}]);
const tofu=dish('tofu','Tofu','protein',[{meal:'Lunch',station:'Center Plate',order:100}]);
const soup=dish('soup','Tomato Soup','vegetable',[{meal:'Lunch',station:'Soup',order:200}]);
const crossRice=dish('cross-rice','Brown Rice at Crossroads','carb',[{meal:'Lunch',station:'Pasta',order:300}],'crossroads');
function harness(foods=[rice,eggs,toast,tofu,soup,crossRice]) {
  const elements=Object.fromEntries(['search','mealFilter','stationFilter','categoryFilter','foodSort','foodResults','clearFoodFilters','foods'].map(id=>[id,{value:'',innerHTML:'',textContent:'',disabled:false}]));
  Object.assign(elements.mealFilter,{value:'all'});
  Object.assign(elements.stationFilter,{value:'all'});
  Object.assign(elements.categoryFilter,{value:'all'});
  Object.assign(elements.foodSort,{value:'station'});
  const state={hallId:'cafe-3',planFoods:{}};
  const context={
    $:id=>{assert.ok(elements[id],id);return elements[id];},
    foods,state,CalFuelBrowse,CalFuelPortions,
    hallFoods:()=>foods.filter(food=>food.hallId===state.hallId),
    hallName:()=>state.hallId==='cafe-3'?'Café 3':'Crossroads',
    category:food=>food.category,grams:food=>food.servingGrams,
    historyNumber:value=>value,isPreview:false,
    meals:['Breakfast','Lunch','Dinner'],availableAt:CalFuelSchedule.availableAt,
    document:{querySelectorAll:()=>[]}
  };
  runInNewContext(escapeCode+renderCode,context);
  return {elements,state,render:()=>context.renderFoods(),updateStations:()=>context.updateStationFilter()};
}
const cards=html=>(html.match(/<article class="food-card"/g)||[]).length;

test('changing meal or hall retains only available station choices and clears a stale selection',()=>{
  const {elements,state,updateStations}=harness();
  elements.mealFilter.value='Breakfast';elements.stationFilter.value='Griddle/Grill';
  updateStations();
  assert.equal(elements.stationFilter.value,'Griddle/Grill');
  assert.match(elements.stationFilter.innerHTML,/Center Plate/);
  assert.match(elements.stationFilter.innerHTML,/Hot Cereal\/Grains/);
  assert.doesNotMatch(elements.stationFilter.innerHTML,/>Soup</);
  elements.mealFilter.value='Lunch';
  updateStations();
  assert.equal(elements.stationFilter.value,'all');
  assert.match(elements.stationFilter.innerHTML,/>Soup</);
  assert.doesNotMatch(elements.stationFilter.innerHTML,/Griddle\/Grill|Hot Cereal\/Grains/);
  elements.stationFilter.value='Soup';state.hallId='crossroads';
  updateStations();
  assert.equal(elements.stationFilter.value,'all');
  assert.match(elements.stationFilter.innerHTML,/>Pasta</);
  assert.doesNotMatch(elements.stationFilter.innerHTML,/Center Plate|Soup/);
  state.hallId='foothill';
  updateStations();
  assert.equal(elements.stationFilter.innerHTML,'<option value="all">All stations</option>');
});

test('rendered search results compose meal, station, food category, and dining hall filters',()=>{
  const {elements,state,render}=harness();
  elements.search.value='  RICE center  ';elements.mealFilter.value='Lunch';
  elements.stationFilter.value='Center Plate';elements.categoryFilter.value='carb';
  render();
  assert.equal(cards(elements.foods.innerHTML),1);
  assert.match(elements.foods.innerHTML,/<h3>Brown Rice<\/h3>/);
  assert.doesNotMatch(elements.foods.innerHTML,/Crossroads|<h3>Tofu<\/h3>|French Toast/);
  assert.equal(elements.foodResults.textContent,'1 food shown in Café 3 · Lunch · Center Plate · Search: RICE center');
  state.hallId='crossroads';
  render();
  assert.equal(cards(elements.foods.innerHTML),0);
  assert.equal(elements.stationFilter.value,'all');
  assert.match(elements.foods.innerHTML,/No foods match/);
  elements.search.value='rice';
  render();
  assert.equal(cards(elements.foods.innerHTML),1);
  assert.match(elements.foods.innerHTML,/<h3>Brown Rice at Crossroads<\/h3>/);
  assert.doesNotMatch(elements.foods.innerHTML,/data-hall="cafe-3"/);
});

test('food and station text stays escaped in card markup, headings, and station options',()=>{
  const maliciousName='<img src=x onerror="alert(1)">',maliciousStation='Center "<svg onload="alert(2)">';
  const food=dish('unsafe',maliciousName,'protein',[{meal:'Lunch',station:maliciousStation,order:1}]);
  const {elements,render}=harness([food]);
  elements.mealFilter.value='Lunch';
  render();
  assert.equal(cards(elements.foods.innerHTML),1);
  assert.doesNotMatch(elements.foods.innerHTML,/<img|<svg/);
  assert.doesNotMatch(elements.stationFilter.innerHTML,/<svg/);
  assert.match(elements.foods.innerHTML,/&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(elements.foods.innerHTML,/Center &quot;&lt;svg onload=&quot;alert\(2\)&quot;&gt;/);
  assert.match(elements.stationFilter.innerHTML,/value="Center &quot;&lt;svg/);
});

test('station grouping lists each food once and name sorting removes the station headings',()=>{
  const {elements,render}=harness([rice,toast,tofu,eggs,rice]);
  render();
  assert.equal(cards(elements.foods.innerHTML),4);
  assert.equal((elements.foods.innerHTML.match(/data-portion="rice"/g)||[]).length,1);
  assert.match(elements.foods.innerHTML,/class="menu-station-heading"/);
  const center=elements.foods.innerHTML.indexOf('<h3>Center Plate</h3>');
  const grill=elements.foods.innerHTML.indexOf('<h3>Griddle/Grill</h3>');
  const grains=elements.foods.innerHTML.indexOf('<h3>Hot Cereal/Grains</h3>');
  assert.ok(center>=0&&grill>center&&grains>grill);
  elements.foodSort.value='name';
  render();
  assert.equal(cards(elements.foods.innerHTML),4);
  assert.doesNotMatch(elements.foods.innerHTML,/menu-station-heading/);
  assert.deepEqual([...elements.foods.innerHTML.matchAll(/<h3>(.*?)<\/h3>/g)].map(match=>match[1]),['Brown Rice','French Toast','Scrambled Eggs','Tofu']);
});

test('clear-filter availability reflects search and sorting while an empty hall has an explicit result',()=>{
  const {elements,state,render}=harness();
  render();assert.equal(elements.clearFoodFilters.disabled,true);
  elements.search.value='rice';render();assert.equal(elements.clearFoodFilters.disabled,false);
  elements.search.value='';elements.foodSort.value='name';render();assert.equal(elements.clearFoodFilters.disabled,false);
  state.hallId='foothill';render();
  assert.equal(cards(elements.foods.innerHTML),0);
  assert.match(elements.foodResults.textContent,/^0 foods shown/);
  assert.match(elements.foods.innerHTML,/No foods match your search and filters/);
});
