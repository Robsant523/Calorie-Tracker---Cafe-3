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
  const context={state,$:id=>{assert.ok(elements[id],'Unexpected field: '+id);return elements[id];},
    safe:v=>Number(v)||0,persist(){},renderDashboard(){},generatePlan(){},
    document:{querySelector:()=>({value:state.targetMode})}};
  const helpers=app.match(/^const macroCalories=.*$/m)[0]+'\n'+app.match(/^function recommendedGoals.*$/m)[0];
  const targets=app.slice(app.indexOf('function renderTargetForm()'),app.indexOf('let menuSnapshot;'));
  runInNewContext(helpers+'\n'+targets,context);
  return {context,elements,state};
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
