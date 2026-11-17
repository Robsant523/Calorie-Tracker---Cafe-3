import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {placements,stations,browse}=createRequire(import.meta.url)('../menu-browse.js');
const food=(id,name,assignments,category='carb',hallId='cafe-3')=>({id,name,category,hallId,diningHall:hallId==='cafe-3'?'Café 3':'Crossroads',meals:[...new Set(assignments.map(row=>row.meal))],station:assignments[0]?.station,stationAssignments:assignments});
const rice=food('rice','Brown Rice',[
  {meal:'Breakfast',station:'Hot Cereal/Grains',order:30},
  {meal:'Lunch',station:'Center Plate',order:100},
  {meal:'Lunch',station:'Griddle/Grill',order:130}
]);
const eggs=food('eggs','Scrambled Eggs',[{meal:'Breakfast',station:'Center Plate',order:10}],'protein');
const toast=food('toast','French Toast',[{meal:'Breakfast',station:'Griddle/Grill',order:20}]);
const tofu=food('tofu','Café Tofu',[{meal:'Lunch',station:'Center Plate',order:100}],'protein');

test('station filters use the station for the selected meal, never another meal or hall',()=>{
  assert.deepEqual(browse([rice],{meal:'Breakfast',station:'Center Plate'}).items,[]);
  assert.deepEqual(browse([rice],{meal:'Lunch',station:'Center Plate'}).items,[rice]);
  assert.deepEqual(browse([rice],{meal:'Dinner'}).items,[]);
  const anotherHall=food('cross-rice','Rice',[{meal:'Lunch',station:'Center Plate',order:1}],'carb','crossroads');
  const scoped=[rice,anotherHall].filter(row=>row.hallId==='cafe-3');
  assert.deepEqual(browse(scoped,{meal:'Lunch',station:'Center Plate'}).items,[rice]);
});

test('stations and groups follow Berkeley source order while each food is shown once',()=>{
  assert.deepEqual(stations([rice,toast,eggs]),['Center Plate','Griddle/Grill','Hot Cereal/Grains']);
  const result=browse([rice,toast,eggs,rice]);
  assert.deepEqual(result.groups.map(group=>group.station),['Center Plate','Griddle/Grill','Hot Cereal/Grains']);
  assert.deepEqual(result.items,[eggs,toast,rice]);
  assert.equal(result.total,3);
  assert.deepEqual(stations([rice,eggs], 'Lunch'),['Center Plate','Griddle/Grill']);
  assert.deepEqual(browse([rice],{meal:'Lunch'}).groups,[{station:'Center Plate',items:[rice]}]);
});

test('search is trimmed, case-insensitive, accent-insensitive, and handles station punctuation',()=>{
  assert.deepEqual(browse([rice,eggs,toast,tofu],{query:'  CAFE   tofu '}).items,[tofu]);
  assert.deepEqual(browse([rice,eggs,toast,tofu],{query:'griddle / grill',meal:'Breakfast'}).items,[toast]);
  assert.deepEqual(browse([rice],{query:'GRILL',meal:'Lunch'}).groups,[{station:'Griddle/Grill',items:[rice]}]);
  assert.deepEqual(browse([rice],{query:'rice center',meal:'Breakfast'}).items,[]);
  assert.deepEqual(browse([rice],{query:'rice center',meal:'Lunch'}).items,[rice]);
  assert.deepEqual(browse([rice,eggs],{query:'not-a-dish'}).items,[]);
});

test('search, meal, station and macro category filters work together',()=>{
  assert.deepEqual(browse([rice,tofu,eggs],{query:'center',meal:'Lunch',station:'Center Plate',category:'protein'}).items,[tofu]);
  assert.deepEqual(browse([rice,tofu],{meal:'Lunch',category:'carb',categoryOf:row=>row.id==='rice'?'carb':'protein'}).items,[rice]);
  assert.deepEqual(browse([rice,tofu],{meal:'Lunch',station:'Griddle/Grill',category:'protein'}).items,[]);
});

test('missing station metadata is explicit, hall names never masquerade as stations',()=>{
  const old={id:'old',name:'Old menu dish',diningHall:'Café 3',hallId:'cafe-3',station:'Café 3',meals:['Lunch']};
  assert.deepEqual(placements(old),[{meal:'Lunch',station:'Station unavailable',order:Infinity}]);
  assert.deepEqual(stations([old,tofu]),['Center Plate','Station unavailable']);
  assert.deepEqual(browse([old,tofu],{station:'Station unavailable'}).items,[old]);
  for(const station of ['cafe-3','Cafe 3','Crossroads','Dining hall',null])
    assert.equal(placements({...old,station})[0].station,'Station unavailable');
  assert.equal(placements({...old,station:'Soup'})[0].station,'Soup');
  assert.deepEqual(placements(old,'Breakfast'),[]);
});

test('partial and null assignments do not borrow the first station from a different meal',()=>{
  const partial={...rice,station:'Center Plate',meals:['Breakfast','Lunch'],stationAssignments:[{meal:'Breakfast',station:'Griddle/Grill',order:20}]};
  assert.deepEqual(placements(partial,'Lunch'),[{meal:'Lunch',station:'Station unavailable',order:Infinity}]);
  assert.deepEqual(browse([partial],{meal:'Lunch',station:'Griddle/Grill'}).items,[]);
  const unknown={...partial,stationAssignments:[{meal:'Lunch',station:null,order:5}]};
  assert.deepEqual(placements(unknown,'Lunch'),[{meal:'Lunch',station:'Station unavailable',order:5}]);
  assert.deepEqual(stations([unknown,tofu],'Lunch'),['Center Plate','Station unavailable']);
});

test('name sorting and source grouping leave original foods, placements, and input order intact',()=>{
  const input=[toast,rice,tofu,eggs],before=JSON.stringify(input);
  const result=browse(input,{sort:'name'});
  assert.deepEqual(result.items,[rice,tofu,toast,eggs]);
  assert.deepEqual(result.groups.map(group=>group.station),['Center Plate','Griddle/Grill','Hot Cereal/Grains']);
  assert.equal(JSON.stringify(input),before);
  assert.deepEqual(input,[toast,rice,tofu,eggs]);
  assert.deepEqual(browse([]),{items:[],groups:[],total:0});
});

test('duplicate assignment metadata selects its earliest source occurrence once',()=>{
  const repeated={...rice,stationAssignments:[{meal:'Lunch',station:'Center Plate',order:150},{meal:'Lunch',station:' Center   Plate ',order:100}]};
  assert.deepEqual(placements(repeated,'Lunch'),[{meal:'Lunch',station:'Center Plate',order:100}]);
  assert.deepEqual(browse([repeated],{meal:'Lunch'}).items,[repeated]);
});
