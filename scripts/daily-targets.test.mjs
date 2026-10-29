import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function harness(mode='calories') {
  const ids=['calorieGoal','proteinGoal','carbGoal','fatGoal','macroBreakdown','targetGuidance'];
  const elements=Object.fromEntries(ids.map(id=>[id,{value:'',disabled:false,textContent:'',innerHTML:''}]));
  for(const [id,value] of [['calorieGoal',2200],['proteinGoal',160],['carbGoal',240],['fatGoal',70]])elements[id].value=String(value);
  const state={targetMode:mode,bodyWeight:999,goals:{calories:2200,protein:160,carbs:240,fat:70}};
  const calls={persist:0,dashboard:0,plan:0};
  const context={state,$:id=>{assert.ok(elements[id],'Unexpected field: '+id);return elements[id];},
    safe:v=>Number(v)||0,persist(){calls.persist++},renderDashboard(){calls.dashboard++},generatePlan(){calls.plan++},
    document:{querySelector:()=>({value:state.targetMode})}};
  const helpers=app.match(/^const macroCalories=.*$/m)[0]+'\n'+app.match(/^function recommendedGoals.*$/m)[0];
  const targets=app.slice(app.indexOf('function renderTargetForm()'),app.indexOf('let menuSnapshot;'));
  runInNewContext(helpers+'\n'+targets,context);
  return {context,elements,state,calls};
}
test('daily targets no longer display or read body weight',()=>{
  assert.doesNotMatch(html,/bodyWeight|Target weight/);
  assert.doesNotMatch(app,/bodyWeight|pounds|Suggested from/);
});
test('calorie mode renders and saves while retaining current protein target',()=>{
  const {context,elements,state}=harness();
  context.renderTargetForm();
  assert.equal(elements.proteinGoal.value,160);
  assert.match(elements.targetGuidance.textContent,/current target of 160g/);
  elements.calorieGoal.value='2400';
  context.saveGoals();
  assert.equal(state.goals.calories,2400);
  assert.equal(state.goals.protein,160);
  assert.equal(state.goals.fat,73);
  assert.equal(state.goals.carbs,276);
});
test('macro mode still calculates calories and saves edited macros without weight',()=>{
  const {context,elements,state}=harness('macros');
  elements.proteinGoal.value='150';elements.carbGoal.value='200';elements.fatGoal.value='60';
  context.renderTargetForm();context.saveGoals();
  assert.equal(state.goals.calories,1940);
  assert.equal(state.goals.protein,150);
  assert.equal(state.goals.carbs,200);
  assert.equal(state.goals.fat,60);
  assert.equal(elements.calorieGoal.disabled,true);
  assert.equal(elements.proteinGoal.disabled,false);
});
test('calorie input can be cleared without restoring or saving the previous value',()=>{
  const {context,elements,state,calls}=harness();
  const originalGoals=JSON.stringify(state.goals);
  elements.calorieGoal.value='';
  context.renderTargetForm();
  assert.equal(elements.calorieGoal.value,'');
  context.saveGoals();
  assert.equal(elements.calorieGoal.value,'');
  assert.equal(JSON.stringify(state.goals),originalGoals);
  assert.deepEqual(calls,{persist:0,dashboard:0,plan:0});
  elements.calorieGoal.value='2500';
  context.renderTargetForm();
  assert.equal(elements.calorieGoal.value,'2500');
  context.saveGoals();
  assert.equal(state.goals.calories,2500);
  assert.equal(calls.persist,1);
});
test('each macro field can stay empty while editing without altering saved targets',()=>{
  for(const id of ['proteinGoal','carbGoal','fatGoal']){
    const {context,elements,state,calls}=harness('macros');
    const originalGoals=JSON.stringify(state.goals);
    elements[id].value='';
    context.renderTargetForm();
    assert.equal(elements[id].value,'',id);
    context.saveGoals();
    assert.equal(elements[id].value,'',id);
    assert.equal(JSON.stringify(state.goals),originalGoals,id);
    assert.deepEqual(calls,{persist:0,dashboard:0,plan:0},id);
  }
});
test('zero macro values are preserved and contribute zero calories',()=>{
  const {context,elements,state}=harness('macros');
  elements.carbGoal.value='0';
  context.renderTargetForm();
  assert.equal(elements.carbGoal.value,'0');
  assert.equal(Number(elements.calorieGoal.value),1270);
  context.saveGoals();
  assert.equal(state.goals.carbs,0);
  assert.equal(state.goals.calories,1270);
});
test('rendering preserves editable fractional text instead of rewriting the input',()=>{
  const {context,elements,state}=harness('macros');
  elements.proteinGoal.value='150.50';
  context.renderTargetForm();
  assert.equal(elements.proteinGoal.value,'150.50');
  context.saveGoals();
  assert.equal(state.goals.protein,150.5);
  assert.equal(elements.proteinGoal.value,'150.50');
});
test('invalid drafts cannot replace daily targets',()=>{
  for(const [mode,id,values] of [
    ['calories','calorieGoal',['0','-5','Infinity','invalid']],
    ['macros','proteinGoal',['-1','Infinity','invalid']]
  ])for(const value of values){
    const {context,elements,state,calls}=harness(mode);
    const originalGoals=JSON.stringify(state.goals);
    elements[id].value=value;
    context.renderTargetForm();
    context.saveGoals();
    assert.equal(JSON.stringify(state.goals),originalGoals,mode+' '+value);
    assert.deepEqual(calls,{persist:0,dashboard:0,plan:0},mode+' '+value);
  }
});
