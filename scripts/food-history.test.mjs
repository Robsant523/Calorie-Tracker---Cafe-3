import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const require=createRequire(import.meta.url);
const {rollover,days,entries,remove}=require('../food-history.js');
const {total}=require('../portions.js');
const rice={id:'rice',name:'Steamed rice',hallId:'cafe-3',weightGrams:150,servingGrams:100,
  nutrition:{calories:195,protein:4.05,carbs:42,fat:0.45},at:1793210400000};
const shake={id:'manual-shake',name:'Shake',source:'manual',weightGrams:300,
  nutrition:{calories:190,protein:25,carbs:10.5,fat:4},caloriesSource:'entered',at:1793211000000};

test('history preserves portion and nutrition snapshots across rollover, reload, and a changed menu',()=>{
  const state={goals:{calories:2200,protein:160,carbs:240,fat:70},logDay:'2026-10-28',log:[rice,shake]};
  const originalGoals={...state.goals};
  rollover(state,'2026-10-29');
  const saved=JSON.parse(JSON.stringify(state));
  assert.deepEqual(entries(saved,'2026-10-28'),[rice,shake]);
  assert.deepEqual(saved.goals,originalGoals);
  assert.deepEqual(entries(saved,'2026-10-29'),[]);
  assert.deepEqual(total(saved.log,[]),{calories:0,protein:0,carbs:0,fat:0});
  assert.deepEqual(total(entries(saved,'2026-10-28'),[{id:'rice',calories:999,protein:999,carbs:999,fat:999}]),
    {calories:385,protein:29.05,carbs:52.5,fat:4.45});
  saved.log.push({...shake,id:'new-shake'});
  assert.equal(total(saved.log,[]).calories,190);
  assert.equal(entries(saved,'2026-10-28').length,2);
});

test('reopening after 5 AM archives the previous tracking day exactly once',()=>{
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const logDay=runInNewContext(app.match(/^const logDay=.*$/m)[0]+'\nlogDay;',{Date});
  const before=logDay(new Date(2026,9,29,4,59).getTime());
  const after=logDay(new Date(2026,9,29,5,0).getTime());
  assert.notEqual(before,after);
  const state={logDay:before,log:[rice]};
  rollover(state,before);
  assert.equal(state.log.length,1);
  rollover(state,after);
  rollover(state,after);
  assert.deepEqual(entries(state,before),[rice]);
  assert.deepEqual(state.log,[]);
  assert.equal(state.logDay,after);
  assert.deepEqual(days(state),[after,before]);
});

test('removing one repeated dining-hall portion leaves other servings and days intact',()=>{
  const second={...rice,weightGrams:75,nutrition:{calories:97.5,protein:2.025,carbs:21,fat:0.225}};
  const state={logDay:'2026-10-29',log:[rice,second],history:{'2026-10-28':[rice,second]}};
  assert.equal(remove(state,'2026-10-29',0),rice);
  assert.deepEqual(state.log,[second]);
  assert.equal(total(state.log,[]).calories,97.5);
  assert.deepEqual(entries(state,'2026-10-28'),[rice,second]);
  assert.equal(remove(state,'2026-10-28',1),second);
  assert.deepEqual(entries(state,'2026-10-28'),[rice]);
  const unchanged=JSON.stringify(state);
  for(const index of [-1,3,0.5,NaN])assert.equal(remove(state,'2026-10-29',index),undefined);
  assert.equal(remove(state,'missing-day',0),undefined);
  assert.equal(JSON.stringify(state),unchanged);
});

test('history days include the empty current day and omit empty archive days',()=>{
  const state={logDay:'2026-10-29',log:[],history:{'2026-10-27':[rice],'2026-10-28':[],'2026-10-29':[shake]}};
  assert.deepEqual(days(state),['2026-10-29','2026-10-27']);
  assert.deepEqual(entries(state,'2026-10-29'),[]);
  assert.deepEqual(entries(state,'2026-10-26'),[]);
});

test('older state without a tracking date is retained and existing archive records are not overwritten',()=>{
  const legacy={log:[rice]};
  rollover(legacy,'2026-10-28');
  assert.deepEqual(legacy.log,[rice]);
  assert.deepEqual(legacy.history,{});
  assert.equal(legacy.logDay,'2026-10-28');
  legacy.history['2026-10-28']=[shake];
  rollover(legacy,'2026-10-29');
  assert.deepEqual(entries(legacy,'2026-10-28'),[shake,rice]);
  assert.deepEqual(legacy.log,[]);
  const fresh={};
  rollover(fresh,'2026-10-29');
  assert.deepEqual(fresh,{log:[],history:{},logDay:'2026-10-29'});
});
