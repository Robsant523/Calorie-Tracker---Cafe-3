import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {build}=require('../full-day-plan.js');
const keys=['calories','protein','carbs','fat'];
const food=(id,group,protein,carbs,fat,meals=['Breakfast','Lunch','Dinner'])=>({
  id,name:id,hallId:'cafe-3',group,protein,carbs,fat,calories:4*protein+4*carbs+9*fat,meals
});
const base={hallId:'cafe-3',choices:{},enabled:['Breakfast','Lunch','Dinner'],
  shares:{Breakfast:30,Lunch:40,Dinner:30},goals:{calories:2200,protein:150,carbs:250,fat:600/9},
  category:f=>f.group,grams:()=>100};
const foods=[food('Chicken','protein',30,0,0),food('Rice','carb',0,40,0),food('Oil','fat',0,0,20)];
test('full day distributes targets across enabled meals and fits all nutrients together',()=>{
  const result=build({...base,foods});
  assert.equal(result.meals.length,3);
  for(const key of keys)assert.ok(Math.abs(result.total[key]-base.goals[key])<(key==='calories'?5:1));
  assert.ok(result.closeToTargets);
  assert.ok(result.meals.every(m=>m.rows.every(row=>row.auto&&row.weightGrams>0)));
  for(const key of keys){
    const total=result.meals.flatMap(m=>m.rows).reduce((n,r)=>n+r.food[key]*r.weightGrams/100,0);
    assert.ok(Math.abs(total-result.total[key])<1e-8,'totals use displayed gram weights');
  }
});
test('all choices are retained, including two carb dishes, vegetables and dessert',()=>{
  const extras=[food('Potatoes','carb',0,30,0),food('Greens','vegetable',1,3,0),food('Cookie','dessert',1,15,5)];
  const choices=Object.fromEntries([...foods,...extras].map(f=>[f.id,'Lunch']));
  const original=JSON.stringify(choices);
  const result=build({...base,foods:[...foods,...extras],choices,enabled:['Lunch'],shares:{Lunch:100},mode:'selected'});
  assert.equal(result.selectedCount,6);
  assert.equal(result.autoCount,0);
  assert.equal(result.meals[0].rows.length,6);
  assert.ok(result.meals[0].rows.every(r=>r.weightGrams>=25&&r.weightGrams<=400));
  assert.equal(JSON.stringify(choices),original);
});
test('fill mode adds only missing categories from the same hall and meal, favoring density',()=>{
  const rich=food('Fried chicken','protein',20,10,20,['Lunch']);
  const lean=food('Lean chicken','protein',30,0,1,['Lunch']);
  const wrongHall={...food('Other hall','protein',99,0,0,['Lunch']),hallId:'crossroads'};
  const wrongMeal=food('Breakfast chicken','protein',99,0,0,['Breakfast']);
  const result=build({...base,foods:[foods[1],foods[2],rich,lean,wrongHall,wrongMeal],choices:{Rice:'Lunch'},enabled:['Lunch'],shares:{Lunch:100}});
  const rows=result.meals[0].rows;
  assert.ok(rows.some(r=>r.food.id==='Lean chicken'&&r.auto));
  assert.ok(rows.some(r=>r.food.id==='Rice'&&!r.auto));
  assert.ok(!rows.some(r=>['Other hall','Breakfast chicken','Fried chicken'].includes(r.food.id)));
  assert.equal(new Set(rows.map(r=>r.food.id)).size,rows.length);
});
test('only-my-choices never adds food; impossible targets and empty meals are explained',()=>{
  const result=build({...base,foods,choices:{Rice:'Lunch'},mode:'selected'});
  assert.equal(result.autoCount,0);
  assert.equal(result.selectedCount,1);
  assert.equal(result.total.protein,0);
  assert.equal(result.closeToTargets,false);
  assert.ok(result.warnings.some(w=>w.includes('breakfast')));
  assert.ok(result.warnings.some(w=>w.includes('cannot closely match')));
});
test('weekend schedules and skipped meals never include breakfast or lunch',()=>{
  const weekend=foods.map(f=>({...f,meals:['Brunch','Dinner']}));
  const result=build({...base,foods:weekend,choices:{Rice:'Brunch'},enabled:['Dinner'],shares:{Dinner:100}});
  assert.deepEqual(result.meals.map(m=>m.meal),['Dinner']);
  assert.ok(result.warnings.some(w=>w.includes('Brunch is disabled')));
  const both=build({...base,foods:weekend,enabled:['Brunch','Dinner'],shares:{Brunch:50,Dinner:50}});
  assert.deepEqual(both.meals.map(m=>m.meal),['Brunch','Dinner']);
});
test('invalid shares fail clearly and unavailable meals remain incomplete',()=>{
  for(const shares of [{Lunch:0},{Lunch:NaN},{Lunch:-5},{Lunch:99}])
    assert.throws(()=>build({...base,foods,enabled:['Lunch'],shares}));
  assert.throws(()=>build({...base,foods,enabled:[]}));
  const result=build({...base,foods:[],enabled:['Lunch'],shares:{Lunch:100}});
  assert.equal(result.total.calories,0);
  assert.ok(result.warnings.some(w=>w.includes('No lunch menu')));
});
test('mixed foods are not independently scaled to each macro and double counted',()=>{
  const mixed=food('Mixed plate','protein',25,25,10,['Lunch']);
  const result=build({...base,foods:[mixed],choices:{'Mixed plate':'Lunch'},enabled:['Lunch'],shares:{Lunch:100},
    goals:{calories:580,protein:50,carbs:50,fat:20}});
  assert.equal(result.meals[0].rows.length,1);
  assert.equal(result.meals[0].rows[0].weightGrams,200);
  assert.equal(result.total.calories,580);
});
