import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {spawnSync} from 'node:child_process';

const require=createRequire(import.meta.url);
const {week,rollover,remove}=require('../food-history.js');
const rice={id:'rice',name:'Rice',hallId:'cafe-3',weightGrams:150,
  nutrition:{calories:195,protein:4,carbs:42,fat:0.5}};
const chicken={id:'chicken',name:'Chicken',hallId:'crossroads',weightGrams:100,
  nutrition:{calories:165,protein:31,carbs:0,fat:3.6}};
const shake={id:'shake',name:'Shake',source:'manual',weightGrams:300,
  nutrition:{calories:190,protein:25,carbs:10.5,fat:4}};
const zero={calories:0,protein:0,carbs:0,fat:0};

test('past week includes today and six preceding days, fills gaps, and excludes older or future records',()=>{
  const state={logDay:'2026-11-16',log:[chicken],history:{
    '2026-11-09':[shake],'2026-11-10':[rice],'2026-11-14':[shake],'2026-11-17':[chicken]
  }};
  const result=week(state,state.logDay);
  assert.deepEqual(result.days.map(bucket=>bucket.day),['2026-11-10','2026-11-11','2026-11-12','2026-11-13','2026-11-14','2026-11-15','2026-11-16']);
  assert.deepEqual(result.days[1],{day:'2026-11-11',entries:[],total:zero});
  assert.deepEqual(result.total,{calories:550,protein:60,carbs:52.5,fat:8.1});
  assert.equal(result.entryCount,3);
  assert.equal(result.daysLogged,3);
  assert.equal(result.averageCalories,550/7);
});

test('weekly totals combine all dining halls and manual food and retain saved nutrition after a menu changes',()=>{
  const state={logDay:'2026-11-16',log:[rice,chicken,shake],history:{'2026-11-15':['legacy-toast']}};
  const changedMenu=[{id:'rice',calories:999,protein:999,carbs:999,fat:999},
    {id:'legacy-toast',calories:80,protein:3,carbs:14,fat:1}];
  const result=week(JSON.parse(JSON.stringify(state)),state.logDay,changedMenu);
  assert.deepEqual(result.total,{calories:630,protein:63,carbs:66.5,fat:9.1});
  assert.equal(result.entryCount,4);
  assert.equal(result.daysLogged,2);
  assert.deepEqual(result.days[6].entries,[rice,chicken,shake]);
});

test('weekly reads do not mutate storage, archive entries again, or count a duplicate current-day archive',()=>{
  const state={logDay:'2026-11-16',log:[rice],history:{'2026-11-16':[shake],'2026-11-15':[chicken]}};
  const before=JSON.stringify(state);
  const first=week(state,state.logDay),second=week(state,state.logDay);
  assert.deepEqual(second,first);
  assert.equal(first.entryCount,2);
  assert.equal(first.total.calories,360);
  assert.equal(JSON.stringify(state),before);
  assert.deepEqual(week({},'2026-11-16').total,zero);
});

test('removing a recorded portion updates only its day and the weekly total',()=>{
  const state={logDay:'2026-11-16',log:[rice],history:{'2026-11-15':[chicken,shake],'2026-11-01':[rice]}};
  assert.equal(week(state,state.logDay).total.calories,550);
  remove(state,'2026-11-15',1);
  const result=week(state,state.logDay);
  assert.equal(result.total.calories,360);
  assert.equal(result.days[5].total.calories,165);
  assert.equal(result.entryCount,2);
  assert.deepEqual(state.history['2026-11-01'],[rice]);
});

test('week boundaries handle a new year, leap day, and local daylight-saving transitions',()=>{
  const modulePath=require.resolve('../food-history.js');
  const script=`const {week}=require(${JSON.stringify(modulePath)});process.stdout.write(JSON.stringify(['2027-01-03','2024-03-03','2026-03-10','2026-11-03'].map(end=>week({},end).days.map(day=>day.day))));`;
  const run=spawnSync(process.execPath,['-e',script],{encoding:'utf8',env:{...process.env,TZ:'America/Los_Angeles'}});
  assert.equal(run.status,0,run.stderr);
  assert.deepEqual(JSON.parse(run.stdout),[
    ['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03'],
    ['2024-02-26','2024-02-27','2024-02-28','2024-02-29','2024-03-01','2024-03-02','2024-03-03'],
    ['2026-03-04','2026-03-05','2026-03-06','2026-03-07','2026-03-08','2026-03-09','2026-03-10'],
    ['2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01','2026-11-02','2026-11-03']
  ]);
});

test('the week follows the app tracking day before and after the 5 AM reset without losing yesterday',()=>{
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const trackingDay=runInNewContext(app.match(/^const logDay=.*$/m)[0]+'\nlogDay;',{Date});
  const before=trackingDay(new Date(2026,10,16,4,59).getTime());
  const after=trackingDay(new Date(2026,10,16,5,0).getTime());
  const state={logDay:before,log:[rice]};
  assert.equal(week(state,before).days[6].day,before);
  assert.equal(week(state,before).days[6].total.calories,195);
  rollover(state,after);
  rollover(state,after);
  const result=week(state,state.logDay);
  assert.equal(result.days[6].day,after);
  assert.equal(result.days[6].total.calories,0);
  assert.equal(result.days[5].total.calories,195);
  assert.equal(result.entryCount,1);
  assert.equal(result.total.calories,195);
});

test('invalid tracking dates fail instead of silently showing an unrelated week',()=>{
  for(const value of ['2026-02-30','2026-2-03','not-a-date',undefined])
    assert.throws(()=>week({},value),/valid tracking day/);
});
