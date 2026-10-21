let foods=[];
const previewMode=new URLSearchParams(location.search).get('preview');
const isPreview=CalFuelPreview.isPreview(previewMode);
let state=CalFuelPreview.createState(JSON.parse(localStorage.getItem('calfuel-state')||'{}'),previewMode);
state.goals={calories:2200,protein:160,carbs:240,fat:70,...(state.goals||{})};state.log||=[];state.planFoods=Object.assign({},state.planFoods||{});state.targetMode||='calories';
const $=id=>document.getElementById(id),keys=['calories','protein','carbs','fat'],safe=v=>Number(v)||0,persist=()=>CalFuelPreview.save(localStorage,state,previewMode);
function setupPreview() {
  $('menuPreview').hidden=!isPreview;
  document.querySelectorAll('[data-preview-mode]').forEach(link=>{
    const mode=link.dataset.previewMode,url=new URL(location.href);
    if(mode==='real')url.searchParams.delete('preview');else url.searchParams.set('preview',mode);
    link.href=url.href;
    if(mode===(isPreview?previewMode:'real'))link.setAttribute('aria-current','page');
  });
  if(!isPreview)return;
  $('menuPreview').classList.add('is-preview');
  $('previewTitle').textContent=(previewMode==='weekday'?'Weekday':'Weekend')+' preview — sample data';
  $('previewNotice').textContent='Try the planner, percentages, and portion entries below. These are fictional menus, not Berkeley offerings. Nothing here changes your real menu, targets, or food log. Preview changes reset when you switch modes or reload. Choose Real menu to return.';
  $('dailyTotalLabel').textContent='PREVIEW TOTAL · NOT YOUR FOOD LOG';
  document.querySelector('footer').textContent='Preview only: fictional dishes and estimated nutrition for testing the interface. These are not published Berkeley menus. Return to Real menu for your saved snapshot and food log.';
}
let meals=[];
const macroCalories=g=>safe(g.protein)*4+safe(g.carbs)*4+safe(g.fat)*9;
function recommendedGoals(calories,protein){const fat=Math.round(calories*.275/9),carbs=Math.max(0,Math.round((calories-protein*4-fat*9)/4));return{calories,protein,carbs,fat}}
const logDay=at=>{const d=new Date(at);d.setHours(d.getHours()-5);return d.toLocaleDateString('en-CA')};
function resetDailyLog(){const today=logDay(Date.now());if(state.logDay&&state.logDay!==today)state.log=[];state.logDay=today;persist();const now=new Date(),next=new Date(now);next.setHours(5,0,0,0);if(next<=now)next.setDate(next.getDate()+1);setTimeout(()=>{resetDailyLog();if(foods.length)renderDashboard()},next-now)}
const category=f=>{const n=f.name.toLowerCase();if(/cookie|cake|dessert|soft serve|ice cream|pudding|brownie|pie/.test(n))return'dessert';if(/avocado|nut|almond|peanut|cashew|seed|olive|guacamole|tahini|oil|butter/.test(n))return'fat';if(/chicken|beef|salmon|turkey|tuna|tofu|bean|lentil|dal|egg|yogurt|brisket|tempeh/.test(n))return'protein';if(/rice|pasta|noodle|potato|bread|waffle|bagel|roll|oatmeal|fries|samosa|cereal/.test(n))return'carb';return'vegetable'};
const grams=f=>({protein:120,carb:160,fat:45,vegetable:100,dessert:85}[category(f)]||120);
const totals=()=>CalFuelPortions.total(state.log,foods);
function renderDashboard(){const t=totals(),g=state.goals,p=Math.min(100,Math.round(t.calories/g.calories*100));$('caloriesTotal').textContent=Math.round(t.calories);$('calorieGoalLabel').textContent=g.calories;$('calorieRing').style.background=`conic-gradient(var(--orange) ${p*3.6}deg,#e9eee6 0deg)`;$('statusLine').textContent=t.calories?`${Math.round(Math.max(g.calories-t.calories,0))} kcal left today.`:'Start building your day.';$('macroGrid').innerHTML=[['Protein','protein'],['Carbs','carbs'],['Fat','fat']].map(([l,k])=>`<div class="macro"><b>${Number(t[k].toFixed(1))}<small>g</small></b><span>${l} · ${g[k]}g goal</span></div>`).join('')}
function renderTargetForm(){const g=state.goals,mode=state.targetMode,calories=mode==='calories'?safe($('calorieGoal').value)||g.calories:macroCalories({protein:safe($('proteinGoal').value)||g.protein,carbs:safe($('carbGoal').value)||g.carbs,fat:safe($('fatGoal').value)||g.fat});const recommended=recommendedGoals(calories,g.protein),shown=mode==='calories'?recommended:{protein:safe($('proteinGoal').value)||g.protein,carbs:safe($('carbGoal').value)||g.carbs,fat:safe($('fatGoal').value)||g.fat};$('calorieGoal').disabled=mode==='macros';['proteinGoal','carbGoal','fatGoal'].forEach(id=>$(id).disabled=mode==='calories');$('calorieGoal').value=calories;$('proteinGoal').value=shown.protein;$('carbGoal').value=shown.carbs;$('fatGoal').value=shown.fat;const total=macroCalories(shown),difference=calories-total;$('macroBreakdown').innerHTML=`<b>How your macros become calories</b><span>Protein ${shown.protein}g × 4 = ${shown.protein*4} kcal</span><span>Carbs ${shown.carbs}g × 4 = ${shown.carbs*4} kcal</span><span>Fat ${shown.fat}g × 9 = ${shown.fat*9} kcal</span><strong>Macro total: ${total} kcal${mode==='calories'?` · Difference: ${difference>0?'+':''}${difference} kcal`:''}</strong>`;if(mode==='calories')$('targetGuidance').textContent=`Protein keeps your current target of ${shown.protein}g; change it with Start with macros. Fat uses 27.5% of calories; carbs use the calories left after protein and fat.`;else $('targetGuidance').textContent='Your calorie target is calculated from your macros: protein and carbs are 4 kcal/g; fat is 9 kcal/g.'}
function saveGoals(){const mode=document.querySelector('input[name="targetMode"]:checked').value;state.targetMode=mode;if(mode==='calories'){const calories=safe($('calorieGoal').value);state.goals=recommendedGoals(calories,state.goals.protein)}else{state.goals={calories:macroCalories({protein:safe($('proteinGoal').value),carbs:safe($('carbGoal').value),fat:safe($('fatGoal').value)}),protein:safe($('proteinGoal').value),carbs:safe($('carbGoal').value),fat:safe($('fatGoal').value)}}persist();renderTargetForm();renderDashboard();generatePlan()}

let menuSnapshot;
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hallFoods = () => foods.filter(f => f.hallId === state.hallId);
const hallName = () => menuSnapshot.diningHalls.find(h => h.id === state.hallId)?.name || 'Dining hall';
const availableAt = CalFuelSchedule.availableAt;
function setupMealSchedule() {
  const snapshotDate=menuSnapshot.items.find(f=>f.menuDate)?.menuDate || new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(menuSnapshot.refreshedAt));
  meals=CalFuelSchedule.mealsFor(hallFoods(),snapshotDate);
  const layout=meals.join('-');
  state.mealSchedules ||= {};
  const defaults=meals.includes('Brunch')?{Brunch:50,Dinner:50}:{Breakfast:30,Lunch:40,Dinner:30};
  const saved=state.mealSchedules[layout] || {};
  $('schedule').innerHTML=meals.map(meal=>`<label><input type="checkbox" data-meal="${meal}" ${saved[meal]?.enabled===false?'':'checked'}/> ${meal} <input aria-label="${meal} percentage" class="meal-share" data-share="${meal}" type="number" value="${Number.isFinite(saved[meal]?.share)?saved[meal].share:defaults[meal]}" min="0" max="100" step="5"/>%</label>`).join('');
  $('scheduleNote').textContent=meals.includes('Brunch')?'Brunch replaces breakfast and lunch for this menu. Split your day between brunch and dinner; enabled meals must total 100%.':'Split your day between breakfast, lunch, and dinner; enabled meals must total 100%.';
  const currentFilter=$('mealFilter').value;
  $('mealFilter').innerHTML='<option value="all">All meals</option>'+meals.map(m=>`<option>${m}</option>`).join('');
  $('mealFilter').value=meals.includes(currentFilter)?currentFilter:'all';
  for(const food of hallFoods()) {
    const choice=state.planFoods[food.id];
    if(choice)state.planFoods[food.id]=CalFuelSchedule.migrateChoice(choice,food,meals);
  }
  persist();
  $('schedule').oninput=$('schedule').onchange=()=>{
    const shares=schedule();
    state.mealSchedules[layout]=Object.fromEntries(meals.map(m=>[m,{enabled:shares.enabled.includes(m),share:shares.shares[m]}]));
    persist();generatePlan();
  };
}
function renderHall() {
  $('planTitle').textContent = 'Your ' + hallName() + ' plan';
  $('menuTitle').textContent = 'Browse ' + hallName();
  const count = hallFoods().length;
  const date = new Date(menuSnapshot.refreshedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  $('menuInfo').textContent = hallName() + ' · ' + count + ' dishes · updated ' + date + ' · macros are estimates';
  $('hallStatus').textContent = count
    ? 'Menu and plan choices are limited to ' + hallName() + '. Your daily food log includes all halls.'
    : 'No menu was published for ' + hallName() + ' in this snapshot. Choose another hall or refresh the menu.';
  if(isPreview){
    $('menuInfo').textContent=`Sample ${previewMode} menu · ${count} fictional dishes · estimated nutrition`;
    $('hallStatus').textContent='Sample Café 3 menu for testing only. Your real dining hall, selections, and food log are unchanged.';
  }
}
function setupDiningHalls(menu) {
  menuSnapshot = menu;
  menuSnapshot.diningHalls ||= [{id:'cafe-3',name:'Café 3'}];
  foods.forEach(f => { f.hallId ||= 'cafe-3'; f.diningHall ||= 'Café 3'; f.meals ||= [f.meal]; });
  if (!menuSnapshot.diningHalls.some(h => h.id === state.hallId)) state.hallId = 'cafe-3';
  $('hallFilter').innerHTML = menuSnapshot.diningHalls.map(h =>
    '<option value="' + escapeHtml(h.id) + '">' + escapeHtml(h.name) + '</option>').join('');
  $('hallFilter').value = state.hallId;
  $('hallFilter').onchange = () => {
    state.hallId = $('hallFilter').value;
    persist();
    setupMealSchedule(); renderHall(); renderFoods(); renderSelections(); generatePlan();
  };
  setupMealSchedule(); renderHall();
}

function renderFoods() {
  const term=$('search').value.toLowerCase(), meal=$('mealFilter').value, filter=$('categoryFilter').value;
  const visible=hallFoods().filter(f=>(meal==='all'||availableAt(f,meal))&&(filter==='all'||category(f)===filter)&&f.name.toLowerCase().includes(term));
  $('foods').innerHTML=visible.map(f=>{
    const chosen=state.planFoods[f.id]||'';
    return `<article class="food-card" data-hall="${escapeHtml(f.hallId)}">
      <span class="station">${escapeHtml(f.diningHall)} · ${escapeHtml(f.meals.join(' / '))} · <b>${category(f)}</b></span>
      <h3>${escapeHtml(f.name)}</h3>
      <p class="numbers">${f.calories} kcal · P ${f.protein}g · C ${f.carbs}g · F ${f.fat}g</p>
      <p class="muted">Est. ${grams(f)}g per serving</p>
      <div class="food-actions"><div class="plan-picker">
        <select data-plan-meal="${escapeHtml(f.id)}" aria-label="Meal for ${escapeHtml(f.name)}">
          <option value="">Add to plan…</option>
          ${meals.map(m=>`<option value="${m}" ${chosen===m?'selected':''} ${availableAt(f,m)?'':'disabled'}>${m}${availableAt(f,m)?'':' (not offered)'}</option>`).join('')}
        </select>
      </div></div>
      <form class="portion-form" data-portion="${escapeHtml(f.id)}">
        <label for="portion-${escapeHtml(f.id)}">Portion eaten (grams)</label>
        <div class="portion-input-row"><input id="portion-${escapeHtml(f.id)}" name="weight" type="number" min="0.1" step="any" inputmode="decimal" required placeholder="e.g. 150" aria-label="Grams eaten of ${escapeHtml(f.name)}"/>
        <button type="submit">Record portion</button></div>
        <p class="portion-feedback" role="status" aria-live="polite">Enter your portion weight to preview its estimated macros.</p>
      </form>
    </article>`;
  }).join('') || '<p class="menu-empty" role="status">No dishes match this hall and these filters. Try another meal, category, or dining hall.</p>';
  document.querySelectorAll('[data-portion]').forEach(form=>{
    const food=foods.find(f=>f.id===form.dataset.portion),input=form.elements.weight,feedback=form.querySelector('.portion-feedback');
    input.oninput=()=>{
      try {
        const n=CalFuelPortions.calculate(food,input.value,grams(food));
        feedback.textContent=`${input.value}g ≈ ${Math.round(n.calories)} kcal · P ${Number(n.protein.toFixed(1))}g · C ${Number(n.carbs.toFixed(1))}g · F ${Number(n.fat.toFixed(1))}g`;
      } catch { feedback.textContent='Enter a portion weight greater than 0 grams.'; }
    };
    form.onsubmit=event=>{
      event.preventDefault();
      try {
        const nutrition=CalFuelPortions.calculate(food,input.value,grams(food));
        const weightGrams=Number(input.value);
        // Catch an overnight sleeping tab before recording today's portion.
        if(state.logDay!==logDay(Date.now())){state.log=[];state.logDay=logDay(Date.now());}
        state.log.push({id:food.id,name:food.name,hallId:food.hallId,weightGrams,servingGrams:grams(food),nutrition,at:Date.now()});
        persist();renderDashboard();input.value='';
        feedback.textContent=`Recorded ${weightGrams}g of ${food.name} · ${Math.round(nutrition.calories)} kcal.`;
      } catch(error) { feedback.textContent=error.message; }
    };
  });
  document.querySelectorAll('[data-plan-meal]').forEach(s=>s.onchange=()=>{
    const id=s.dataset.planMeal;
    if(s.value)state.planFoods[id]=s.value;else delete state.planFoods[id];
    persist();renderSelections();
    invalidatePlan();
  });
}
function renderSelections(){const selected=Object.entries(state.planFoods).map(([id,meal])=>({food:hallFoods().find(f=>f.id===id),meal})).filter(x=>x.food);$('planSelections').innerHTML=selected.length?meals.map(meal=>{const list=selected.filter(x=>x.meal===meal);return list.length?`<div class="selection-meal"><p class="eyebrow">${meal.toUpperCase()}</p>${list.map(({food})=>`<div class="selected-food"><span><b>${food.name}</b><small>${category(food)} · P ${food.protein}g · C ${food.carbs}g · F ${food.fat}g</small></span><button class="remove-selection" data-remove="${food.id}">Remove</button></div>`).join('')}</div>`:''}).join(''):'<p class="muted">Choose dishes below and assign each to an available meal. Choose whether to use only your foods or fill missing categories.</p>';document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{delete state.planFoods[b.dataset.remove];persist();renderFoods();renderSelections();invalidatePlan()})}
function schedule(){const enabled=[...document.querySelectorAll('[data-meal]:checked')].map(x=>x.dataset.meal),shares=Object.fromEntries([...document.querySelectorAll('[data-share]')].map(x=>[x.dataset.share,safe(x.value)]));return{enabled,shares,sum:enabled.reduce((a,m)=>a+shares[m],0)}}
function invalidatePlan() {
  $('plan').className='plan empty';
  $('plan').textContent='Choices updated. Create your full-day plan to recalculate portions.';
}
function setupPlanOptions() {
  $('planChoiceMode').value=state.planChoiceMode==='selected'?'selected':'fill';
  $('planChoiceMode').onchange=()=>{
    state.planChoiceMode=$('planChoiceMode').value;persist();invalidatePlan();
  };
}
function generatePlan() {
  const s=schedule();
  try {
    const result=CalFuelDayPlan.build({
      foods,hallId:state.hallId,choices:state.planFoods,enabled:s.enabled,shares:s.shares,
      goals:state.goals,mode:$('planChoiceMode').value,category,grams
    });
    const number=n=>Number(n.toFixed(1));
    const comparison=keys.map(k=>{
      const unit=k==='calories'?'calories':'g',delta=result.differences[k];
      const gap=Math.abs(delta)<0.5?'On target':number(Math.abs(delta))+' '+unit+(delta>0?' over':' under');
      return '<tr><th scope="row">'+k[0].toUpperCase()+k.slice(1)+'</th><td>'+number(result.total[k])+' '+unit+'</td><td>'+number(state.goals[k])+' '+unit+'</td><td>'+gap+'</td></tr>';
    }).join('');
    const summary='<article class="day-summary"><p class="eyebrow">FULL-DAY PLAN · '+(isPreview?'SAMPLE DATA':'ESTIMATES')+'</p><h3>'+Math.round(result.total.calories)+' calories planned</h3><p>'+result.selectedCount+' of your choices included · '+result.autoCount+' auto-added foods</p><div class="plan-comparison"><table><caption>Planned totals compared with your daily targets</caption><thead><tr><th scope="col">Nutrient</th><th scope="col">Planned</th><th scope="col">Target</th><th scope="col">Difference</th></tr></thead><tbody>'+comparison+'</tbody></table></div><p class="muted">This plans your whole day, not just calories remaining. It does not record anything as eaten. Nutrition and serving weights are estimates.</p>'+(result.warnings.length?'<ul class="plan-warnings">'+result.warnings.map(w=>'<li>'+escapeHtml(w)+'</li>').join('')+'</ul>':'')+'</article>';
    const cards=result.meals.map(m=>'<article class="meal-card"><p class="eyebrow">'+m.meal.toUpperCase()+' · '+m.share+'%</p><h3>'+Math.round(m.total.calories)+' calories</h3>'+(m.rows.length?m.rows.map(row=>'<div class="meal-item"><span><b>'+escapeHtml(row.food.name)+'</b><small>'+row.servings.toFixed(2)+' estimated servings · '+(row.auto?'Auto-added for '+row.reasons.join(' + '):'Your choice')+'</small><small>P '+number(row.nutrition.protein)+'g · C '+number(row.nutrition.carbs)+'g · F '+number(row.nutrition.fat)+'g</small></span><span><strong>'+row.weightGrams+'g</strong><small>'+Math.round(row.nutrition.calories)+' calories</small></span></div>').join(''):'<p class="muted">No foods planned for this meal. See the notes above.</p>')+'<p class="numbers">P '+number(m.total.protein)+'g · C '+number(m.total.carbs)+'g · F '+number(m.total.fat)+'g</p></article>').join('');
    $('plan').className='plan';
    $('plan').innerHTML=summary+cards;
  } catch(error) {
    $('plan').className='plan empty';$('plan').textContent=error.message;
  }
}
async function init(){setupPreview();setupPlanOptions();resetDailyLog();const menu=isPreview?CalFuelPreview.createMenu(previewMode):(window.CALFUEL_MENU||await fetch('data/cafe3-menu.json').then(r=>r.json()));foods=menu.items.filter(f=>keys.every(k=>Number.isFinite(Number(f[k]))));setupDiningHalls(menu);$('calorieGoal').value=state.goals.calories;$('proteinGoal').value=state.goals.protein;$('carbGoal').value=state.goals.carbs;$('fatGoal').value=state.goals.fat;document.querySelector(`input[name="targetMode"][value="${state.targetMode}"]`).checked=true;document.querySelectorAll('input[name="targetMode"],#calorieGoal,#proteinGoal,#carbGoal,#fatGoal').forEach(input=>input.oninput=renderTargetForm);$('saveGoals').onclick=saveGoals;$('generatePlan').onclick=generatePlan;$('search').oninput=renderFoods;$('mealFilter').onchange=renderFoods;$('categoryFilter').onchange=renderFoods;renderTargetForm();renderDashboard();renderFoods();renderSelections();generatePlan()}
init().catch(e=>$('menuInfo').textContent=`Could not load the menu: ${e.message}`);
