import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';

const require=createRequire(import.meta.url);
const CalFuelHistory=require('../food-history.js');
const CalFuelPortions=require('../portions.js');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const historyCode=app.slice(app.indexOf('let selectedHistoryDay=null;'),app.indexOf('function setupManualEntry()'));
const dashboardCode=app.slice(app.indexOf('function renderDashboard()'),app.indexOf('function renderTargetForm()'));
const clockCode=app.slice(app.indexOf('const logDay='),app.indexOf('function resetDailyLog()'));
const entry=(name,calories)=>({id:name,name,weightGrams:100,nutrition:{calories,protein:10,carbs:20,fat:5}});

function harness(input,at=new Date(2026,10,16,12).getTime()){
  const state={goals:{calories:2200,protein:160,carbs:240,fat:70},...input};
  const fields=new Map(),calls={persist:0},listeners={window:{},document:{}};
  const field=id=>{
    if(!fields.has(id))fields.set(id,{textContent:'',innerHTML:'',value:'',style:{}});
    return fields.get(id);
  };
  let now=at,dayLinks=[],removeButtons=[];
  class Clock extends Date {
    constructor(...args){super(...(args.length?args:[now]));}
    static now(){return now;}
  }
  const listen=(target,type,handler)=>{(listeners[target][type]||=[]).push(handler);};
  const context={
    state,foods:[],CalFuelHistory,CalFuelPortions,isPreview:false,Date:Clock,
    $:field,persist(){calls.persist++;},totals:()=>CalFuelPortions.total(state.log,[]),
    window:{addEventListener:(type,handler)=>listen('window',type,handler)},
    document:{hidden:false,addEventListener:(type,handler)=>listen('document',type,handler),querySelectorAll(selector){
      if(selector==='[data-history-day]'){
        dayLinks=[...field('weeklyDays').innerHTML.matchAll(/data-history-day="([^"]+)"/g)].map(match=>({dataset:{historyDay:match[1]}}));
        return dayLinks;
      }
      if(selector==='[data-remove-entry]'){
        removeButtons=[...field('foodHistory').innerHTML.matchAll(/data-remove-entry="([^"]+)"/g)].map(match=>({dataset:{removeEntry:match[1]}}));
        return removeButtons;
      }
      throw new Error('Unexpected selector: '+selector);
    }}
  };
  const escapeCode=app.match(/^const escapeHtml =.*$/m)[0];
  runInNewContext(escapeCode+'\n'+clockCode+'\n'+historyCode+'\n'+dashboardCode,context);
  return {context,state,field,calls,listeners,
    setTime(value){now=value;},
    chooseDay(day){const link=dayLinks.find(link=>link.dataset.historyDay===day);assert.ok(link,day);link.onclick();},
    remove(index){const button=removeButtons.find(button=>Number(button.dataset.removeEntry)===index);assert.ok(button,index);button.onclick();}
  };
}

test('weekly days open empty history without losing the selection, and older days stay accessible',()=>{
  const h=harness({logDay:'2026-11-16',log:[entry('Rice',100)],history:{'2026-11-13':[entry('Chicken',300)],'2026-11-01':[entry('Older food',200)]}});
  h.context.setupFoodHistory();h.context.renderDashboard();
  assert.equal(Number(h.field('weeklyCalories').textContent),400);
  h.chooseDay('2026-11-14');
  assert.equal(h.field('historyDay').value,'2026-11-14');
  assert.match(h.field('historySummary').textContent,/^0 entries · 0 calories/);
  assert.match(h.field('foodHistory').innerHTML,/No food recorded for this day/);
  h.context.renderDashboard();
  assert.equal(h.field('historyDay').value,'2026-11-14');
  assert.match(h.field('historyDay').innerHTML,/value="2026-11-01"/);
  h.field('historyDay').value='2026-11-13';h.field('historyDay').onchange();
  assert.match(h.field('historySummary').textContent,/^1 entry · 300 calories/);
  assert.equal(Number(h.field('weeklyCalories').textContent),400);
  assert.equal(h.calls.persist,0);
});

test('removing a current-day portion updates weekly and daily totals without changing earlier days',()=>{
  const earlier=entry('Earlier rice',320);
  const h=harness({logDay:'2026-11-16',log:[entry('Today rice',180)],history:{'2026-11-15':[earlier]}});
  h.context.renderDashboard();
  assert.equal(Number(h.field('weeklyCalories').textContent),500);
  assert.equal(Number(h.field('caloriesTotal').textContent),180);
  h.remove(0);
  assert.equal(Number(h.field('weeklyCalories').textContent),320);
  assert.equal(Number(h.field('caloriesTotal').textContent),0);
  assert.deepEqual(h.state.history['2026-11-15'],[earlier]);
  assert.equal(h.field('weeklyDaysLogged').textContent,'1 / 7');
  assert.equal(h.calls.persist,1);
});

test('removing one earlier portion corrects the week while leaving today and other portions intact',()=>{
  const first=entry('Repeated rice',100),second=entry('Repeated rice',200),today=entry('Today food',50);
  const h=harness({logDay:'2026-11-16',log:[today],history:{'2026-11-14':[first,second]}});
  h.context.renderDashboard();h.chooseDay('2026-11-14');h.remove(1);
  assert.deepEqual(h.state.history['2026-11-14'],[first]);
  assert.deepEqual(h.state.log,[today]);
  assert.equal(Number(h.field('weeklyCalories').textContent),150);
  assert.equal(Number(h.field('caloriesTotal').textContent),50);
  assert.equal(h.field('historyDay').value,'2026-11-14');
  assert.match(h.field('historySummary').textContent,/^1 entry · 100 calories/);
  assert.equal(h.calls.persist,1);
});

test('returning at the 5 AM boundary archives yesterday once and refreshes the weekly view',()=>{
  const yesterday=entry('Late snack',400);
  const h=harness({logDay:'2026-11-15',log:[yesterday],history:{}},new Date(2026,10,16,4,59).getTime());
  h.context.setupFoodHistory();h.context.renderDashboard();
  h.listeners.window.focus[0]();
  assert.equal(h.state.logDay,'2026-11-15');
  assert.equal(h.calls.persist,0);
  h.setTime(new Date(2026,10,16,5,0).getTime());
  h.listeners.window.focus[0]();
  assert.equal(h.state.logDay,'2026-11-16');
  assert.deepEqual(h.state.log,[]);
  assert.deepEqual(h.state.history['2026-11-15'],[yesterday]);
  assert.equal(Number(h.field('caloriesTotal').textContent),0);
  assert.equal(Number(h.field('weeklyCalories').textContent),400);
  assert.match(h.field('weeklyRange').textContent,/Nov 16, 2026/);
  h.listeners.document.visibilitychange[0]();h.listeners.window.focus[0]();
  assert.equal(h.calls.persist,1);
  assert.equal(h.state.history['2026-11-15'].length,1);
});

test('resuming after several days moves the weekly window without duplicating or discarding history',()=>{
  const saved=entry('Last recorded food',500);
  const h=harness({logDay:'2026-11-09',log:[saved],history:{}},new Date(2026,10,16,12).getTime());
  h.context.setupFoodHistory();
  h.context.document.hidden=true;h.listeners.document.visibilitychange[0]();
  assert.equal(h.calls.persist,0);
  h.context.document.hidden=false;h.listeners.document.visibilitychange[0]();
  assert.equal(h.state.logDay,'2026-11-16');
  assert.deepEqual(h.state.history['2026-11-09'],[saved]);
  assert.equal(Number(h.field('weeklyCalories').textContent),0);
  assert.equal(h.field('weeklyDaysLogged').textContent,'0 / 7');
  assert.match(h.field('historyDay').innerHTML,/value="2026-11-09"/);
  h.listeners.window.focus[0]();
  assert.equal(h.calls.persist,1);
  assert.equal(h.state.history['2026-11-09'].length,1);
});
