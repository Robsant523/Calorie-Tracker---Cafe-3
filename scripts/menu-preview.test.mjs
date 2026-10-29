import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const require=createRequire(import.meta.url);
const preview=require('../menu-preview.js');
const schedule=require('../meal-schedule.js');
test('test controls stay hidden in normal mode and appear only for valid previews',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/<section[^>]*id="menuPreview"[^>]*\shidden[\s>]/);
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const setup=app.slice(app.indexOf('function setupPreview()'),app.indexOf('let meals=[];'));
  for(const mode of [null,'','real','invalid','weekday','weekend']){
    const elements=new Map();
    const get=id=>{
      if(!elements.has(id))elements.set(id,{hidden:true,classList:{add(){}},textContent:''});
      return elements.get(id);
    };
    const links=['real','weekday','weekend'].map(mode=>({dataset:{previewMode:mode},setAttribute(){}}));
    runInNewContext(setup+'setupPreview();',{
      $:get,isPreview:preview.isPreview(mode),previewMode:mode,URL,
      location:{href:'http://localhost:4173/?preview='+encodeURIComponent(mode||'')},
      document:{querySelectorAll:()=>links,querySelector:()=>get('footer')}
    });
    assert.equal(get('menuPreview').hidden,!preview.isPreview(mode));
    assert.equal(new URL(links[0].href).searchParams.has('preview'),false);
  }
});
test('sample menus exercise actual weekday/weekend scheduling and availability',()=>{
  for(const [mode,expected] of [['weekday',['Breakfast','Lunch','Dinner']],['weekend',['Brunch','Dinner']]]){
    const menu=preview.createMenu(mode);
    assert.deepEqual(schedule.mealsFor(menu.items),expected);
    assert.deepEqual([...new Set(menu.items.flatMap(f=>f.meals))],expected);
    for(const meal of expected){
      const foods=menu.items.filter(f=>schedule.availableAt(f,meal));
      assert.equal(foods.length,3);
      assert.ok(foods.every(f=>f.name.includes('(sample)') && f.id.startsWith('preview-')));
    }
  }
});
test('preview goals, meal choices, schedule and food logging cannot change real state',()=>{
  const saved={goals:{calories:2000},log:[{id:'real-food'}],history:{'2026-10-28':[{id:'past-food'}]},logDay:'2026-10-29',planFoods:{'real-food':'Dinner'},mealSchedules:{Dinner:{share:100}},hallId:'crossroads'};
  const original=JSON.stringify(saved);
  const writes=[];
  const storage={setItem:(...args)=>writes.push(args)};
  for(const mode of ['weekday','weekend']){
    const state=preview.createState(saved,mode);
    assert.deepEqual(state.log,[]);
    assert.deepEqual(state.history,{});
    assert.equal(state.logDay,undefined);
    assert.deepEqual(state.planFoods,{});
    assert.deepEqual(state.mealSchedules,{});
    state.goals.calories=1500;
    state.log.push({id:'sample-food'});
    state.planFoods.example='Brunch';
    preview.save(storage,state,mode);
    assert.equal(JSON.stringify(saved),original);
  }
  assert.equal(writes.length,0);
  const real=preview.createState(saved,'real');
  assert.deepEqual(real,saved);
  preview.save(storage,real,'real');
  assert.deepEqual(writes,[['calfuel-state',original]]);
});
test('invalid preview values cannot activate sample data or disable real persistence',()=>{
  assert.equal(preview.isPreview('invalid'),false);
  assert.throws(()=>preview.createMenu('invalid'));
});
