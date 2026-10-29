import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const require=createRequire(import.meta.url);
const {nutrition,add}=require('../manual-entry.js');
const {total}=require('../portions.js');
const input={name:'Protein shake',protein:'25',carbs:'10.5',fat:'4',calories:''};
test('manual macros calculate calories using 4/4/9, including fractional grams',()=>{
  assert.deepEqual(nutrition(input),{protein:25,carbs:10.5,fat:4,calories:178});
  assert.equal(nutrition({...input,calories:'190'}).calories,190);
  assert.equal(nutrition({protein:0,carbs:0,fat:0,calories:0}).calories,0);
});
test('invalid manual values cannot mutate the log or reset the previous day',()=>{
  for(const key of ['protein','carbs','fat','calories'])for(const value of [-1,Infinity,NaN,'nope']){
    const state={logDay:'yesterday',log:[{id:'old'}]};
    assert.throws(()=>add(state,{...input,[key]:value},'today'));
    assert.deepEqual(state,{logDay:'yesterday',log:[{id:'old'}]});
  }
  for(const key of ['protein','carbs','fat'])for(const value of ['',null,undefined])
    assert.throws(()=>nutrition({...input,[key]:value}));
  for(const name of ['', '   ', 'a'.repeat(121)])assert.throws(()=>add({log:[]},{...input,name},'today'));
});
test('manual foods add to consumed totals, preserve goals, and survive menu refresh and reload',()=>{
  const state={goals:{calories:2200,protein:160,carbs:240,fat:70},logDay:'today',log:[{id:'weighed',nutrition:{calories:100,protein:10,carbs:5,fat:4}}]};
  const goals=JSON.stringify(state.goals);
  const entry=add(state,input,'today',123,'manual-test');
  assert.equal(entry.source,'manual');assert.equal(entry.caloriesSource,'calculated');
  assert.deepEqual(total(JSON.parse(JSON.stringify(state.log)),[]),{calories:278,protein:35,carbs:15.5,fat:8});
  assert.equal(JSON.stringify(state.goals),goals);
  const override=add(state,{...input,calories:'190'},'today',124,'manual-label');
  assert.equal(override.caloriesSource,'entered');
  assert.equal(total(state.log,[]).calories,468);
});
test('5 AM rollover clears yesterday before recording a manual food',()=>{
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const logDay=runInNewContext(app.match(/^const logDay=.*$/m)[0]+'\nlogDay;', {Date});
  const before=new Date(2026,9,28,4,59).getTime(),after=new Date(2026,9,28,5,0).getTime();
  assert.notEqual(logDay(before),logDay(after));
  const state={goals:{calories:2200},logDay:logDay(before),log:[{id:'yesterday'}]};
  add(state,input,logDay(after),after,'new-day');
  assert.equal(state.log.length,1);assert.equal(state.log[0].id,'new-day');
  assert.equal(state.goals.calories,2200);
  assert.deepEqual(state.history[logDay(before)],[{id:'yesterday'}]);
});
test('optional portion weight is saved without scaling manually entered nutrition',()=>{
  const state={logDay:'today',log:[]};
  const weighed=add(state,{...input,weightGrams:'250.5'},'today');
  assert.equal(weighed.weightGrams,250.5);
  assert.equal(weighed.nutrition.calories,178);
  assert.equal(add(state,input,'today').weightGrams,null);
  const saved=JSON.stringify(state);
  for(const weightGrams of ['0','-5','invalid',Infinity])
    assert.throws(()=>add(state,{...input,weightGrams},'tomorrow'));
  assert.equal(JSON.stringify(state),saved);
});
