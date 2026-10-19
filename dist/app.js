let foods=[];
const previewMode=new URLSearchParams(location.search).get('preview');
const isPreview=CalFuelPreview.isPreview(previewMode);
let state=CalFuelPreview.createState(JSON.parse(localStorage.getItem('calfuel-state')||'{}'),previewMode);
state.goals={calories:2200,protein:160,carbs:240,fat:70,...(state.goals||{})};state.log||=[];state.planFoods=Object.assign({},state.planFoods||{});state.targetMode||='calories';state.bodyWeight||=170;
const $=id=>document.getElementById(id),keys=['calories','protein','carbs','fat'],safe=v=>Number(v)||0,persist=()=>CalFuelPreview.save(localStorage,state,previewMode);
function setupPreview() {
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
function recommendedGoals(calories,pounds){const protein=Math.round(pounds*.9),fat=Math.round(calories*.275/9),carbs=Math.max(0,Math.round((calories-protein*4-fat*9)/4));return{calories,protein,carbs,fat}}
const logDay=at=>{const d=new Date(at);d.setHours(d.getHours()-5);return d.toLocaleDateString('en-CA')};
function resetDailyLog(){const today=logDay(Date.now());if(state.logDay&&state.logDay!==today)state.log=[];state.logDay=today;persist();const now=new Date(),next=new Date(now);next.setHours(5,0,0,0);if(next<=now)next.setDate(next.getDate()+1);setTimeout(()=>{resetDailyLog();if(foods.length)renderDashboard()},next-now)}
const category=f=>{const n=f.name.toLowerCase();if(/cookie|cake|dessert|soft serve|ice cream|pudding|brownie|pie/.test(n))return'dessert';if(/avocado|nut|almond|peanut|cashew|seed|olive|guacamole|tahini|oil|butter/.test(n))return'fat';if(/chicken|beef|salmon|turkey|tuna|tofu|bean|lentil|dal|egg|yogurt|brisket|tempeh/.test(n))return'protein';if(/rice|pasta|noodle|potato|bread|waffle|bagel|roll|oatmeal|fries|samosa|cereal/.test(n))return'carb';return'vegetable'};
const grams=f=>({protein:120,carb:160,fat:45,vegetable:100,dessert:85}[category(f)]||120);
const totals=()=>CalFuelPortions.total(state.log,foods);
function renderDashboard(){const t=totals(),g=state.goals,p=Math.min(100,Math.round(t.calories/g.calories*100));$('caloriesTotal').textContent=Math.round(t.calories);$('calorieGoalLabel').textContent=g.calories;$('calorieRing').style.background=`conic-gradient(var(--orange) ${p*3.6}deg,#e9eee6 0deg)`;$('statusLine').textContent=t.calories?`${Math.round(Math.max(g.calories-t.calories,0))} kcal left today.`:'Start building your day.';$('macroGrid').innerHTML=[['Protein','protein'],['Carbs','carbs'],['Fat','fat']].map(([l,k])=>`<div class="macro"><b>${Number(t[k].toFixed(1))}<small>g</small></b><span>${l} · ${g[k]}g goal</span></div>`).join('')}
function renderTargetForm(){const g=state.goals,mode=state.targetMode,calories=mode==='calories'?safe($('calorieGoal').value)||g.calories:macroCalories({protein:safe($('proteinGoal').value)||g.protein,carbs:safe($('carbGoal').value)||g.carbs,fat:safe($('fatGoal').value)||g.fat});const weight=safe($('bodyWeight').value)||state.bodyWeight,recommended=recommendedGoals(calories,weight),shown=mode==='calories'?recommended:{protein:safe($('proteinGoal').value)||g.protein,carbs:safe($('carbGoal').value)||g.carbs,fat:safe($('fatGoal').value)||g.fat};$('calorieGoal').disabled=mode==='macros';['proteinGoal','carbGoal','fatGoal'].forEach(id=>$(id).disabled=mode==='calories');$('bodyWeightRow').hidden=mode==='macros';$('calorieGoal').value=calories;$('proteinGoal').value=shown.protein;$('carbGoal').value=shown.carbs;$('fatGoal').value=shown.fat;const total=macroCalories(shown),difference=calories-total;$('macroBreakdown').innerHTML=`<b>How your macros become calories</b><span>Protein ${shown.protein}g × 4 = ${shown.protein*4} kcal</span><span>Carbs ${shown.carbs}g × 4 = ${shown.carbs*4} kcal</span><span>Fat ${shown.fat}g × 9 = ${shown.fat*9} kcal</span><strong>Macro total: ${total} kcal${mode==='calories'?` · Difference: ${difference>0?'+':''}${difference} kcal`:''}</strong>`;if(mode==='calories')$('targetGuidance').textContent=`Suggested from ${weight} lb: protein uses the midpoint of 0.8–1.0 g/lb; fat uses the midpoint of the 20–35% calorie range; carbs use the calories left after protein and fat.`;else $('targetGuidance').textContent='Your calorie target is calculated from your macros: protein and carbs are 4 kcal/g; fat is 9 kcal/g.'}
function saveGoals(){const mode=document.querySelector('input[name="targetMode"]:checked').value;state.targetMode=mode;if(mode==='calories'){const calories=safe($('calorieGoal').value),weight=safe($('bodyWeight').value);state.bodyWeight=weight;state.goals=recommendedGoals(calories,weight)}else{state.goals={calories:macroCalories({protein:safe($('proteinGoal').value),carbs:safe($('carbGoal').value),fat:safe($('fatGoal').value)}),protein:safe($('proteinGoal').value),carbs:safe($('carbGoal').value),fat:safe($('fatGoal').value)}}persist();renderTargetForm();renderDashboard();generatePlan()}

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
    $('plan').className='plan empty';$('plan').textContent='Choices updated. Generate a plan to recalculate portions.';
  });
}
function renderSelections(){const selected=Object.entries(state.planFoods).map(([id,meal])=>({food:hallFoods().find(f=>f.id===id),meal})).filter(x=>x.food);$('planSelections').innerHTML=selected.length?meals.map(meal=>{const list=selected.filter(x=>x.meal===meal);return list.length?`<div class="selection-meal"><p class="eyebrow">${meal.toUpperCase()}</p>${list.map(({food})=>`<div class="selected-food"><span><b>${food.name}</b><small>${category(food)} · P ${food.protein}g · C ${food.carbs}g · F ${food.fat}g</small></span><button class="remove-selection" data-remove="${food.id}">Remove</button></div>`).join('')}</div>`:''}).join(''):'<p class="muted">Choose dishes below and assign each to an available meal. CalFuel only fills unselected macro categories with a smart fallback.</p>';document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{delete state.planFoods[b.dataset.remove];persist();renderFoods();renderSelections()})}
function schedule(){const enabled=[...document.querySelectorAll('[data-meal]:checked')].map(x=>x.dataset.meal),shares=Object.fromEntries([...document.querySelectorAll('[data-share]')].map(x=>[x.dataset.share,safe(x.value)]));return{enabled,shares,sum:enabled.reduce((a,m)=>a+shares[m],0)}}
const macroCategory={protein:'protein',carbs:'carb',fat:'fat'};function denseFor(macro,pool){return [...pool.filter(f=>safe(f[macro])>0)].sort((a,b)=>(safe(b[macro])/Math.max(1,safe(b.calories)))-(safe(a[macro])/Math.max(1,safe(a.calories))))[0]}function pickFood(macro,meal) {
  const pool=hallFoods().filter(f=>availableAt(f,meal));
  const selected=Object.entries(state.planFoods).filter(([,m])=>m===meal).map(([id])=>pool.find(f=>f.id===id)).filter(Boolean);
  const chosen=denseFor(macro,selected.filter(f=>category(f)===macroCategory[macro]));
  return chosen?{food:chosen,auto:false}:{food:denseFor(macro,pool.filter(f=>category(f)===macroCategory[macro]))||denseFor(macro,pool),auto:true};
}
function generatePlan(){if(!hallFoods().length){$('plan').className='plan empty';$('plan').textContent='No menu available for '+hallName()+' in this snapshot.';return}const s=schedule();if(!s.enabled.length||s.sum!==100){$('plan').className='plan empty';$('plan').textContent=`Choose at least one meal and make enabled meal percentages add to 100% (currently ${s.sum}%).`;return}let all={calories:0,protein:0,carbs:0,fat:0};const cards=s.enabled.map(meal=>{if(!hallFoods().some(f=>availableAt(f,meal)))return '<article class="meal-card"><p class="eyebrow">'+meal+'</p><p>No '+meal.toLowerCase()+' menu published for '+escapeHtml(hallName())+'.</p></article>';const share=s.shares[meal]/100,targets={protein:state.goals.protein*share,carbs:state.goals.carbs*share,fat:state.goals.fat*share},portions=new Map();Object.entries(targets).forEach(([macro,target])=>{const pick=pickFood(macro,meal);if(!pick.food)return;const servings=target/Math.max(1,safe(pick.food[macro])),prior=portions.get(pick.food.id);if(prior){prior.servings=Math.max(prior.servings,servings);prior.macros.push(macro);prior.auto=prior.auto&&pick.auto}else portions.set(pick.food.id,{food:pick.food,servings,macros:[macro],auto:pick.auto})});const rows=[...portions.values()],t=rows.reduce((a,row)=>{keys.forEach(k=>a[k]+=safe(row.food[k])*row.servings);return a},{calories:0,protein:0,carbs:0,fat:0});keys.forEach(k=>all[k]+=t[k]);return `<article class="meal-card"><p class="eyebrow">${meal.toUpperCase()} · ${s.shares[meal]}%</p><h3>${Math.round(t.calories)} kcal plate</h3>${rows.map(({food,servings,macros,auto})=>`<div class="meal-item"><span><b>${food.name}</b><small>${servings.toFixed(2)} servings · <strong>${Math.round(servings*grams(food))}g</strong>${auto?` · <i>auto-picked for ${macros.join(' + ')}</i>`:''}</small></span><span>${Math.round(safe(food.calories)*servings)} kcal</span></div>`).join('')}<p class="numbers">P ${Math.round(t.protein)}g · C ${Math.round(t.carbs)}g · F ${Math.round(t.fat)}g</p></article>`}).join('');$('plan').className='plan';$('plan').innerHTML=cards+`<article class="meal-card"><p class="eyebrow">DAY ESTIMATE</p><h3>${Math.round(all.calories)} kcal</h3><p class="numbers">P ${Math.round(all.protein)}g · C ${Math.round(all.carbs)}g · F ${Math.round(all.fat)}g</p><p class="muted">Each food appears once per meal. Auto-picked foods come only from this dining hall and meal service. Meals without a published menu are excluded from this estimate.</p></article>`}
async function init(){setupPreview();resetDailyLog();const menu=isPreview?CalFuelPreview.createMenu(previewMode):(window.CALFUEL_MENU||await fetch('data/cafe3-menu.json').then(r=>r.json()));foods=menu.items.filter(f=>keys.every(k=>Number.isFinite(Number(f[k]))));setupDiningHalls(menu);$('calorieGoal').value=state.goals.calories;$('proteinGoal').value=state.goals.protein;$('carbGoal').value=state.goals.carbs;$('fatGoal').value=state.goals.fat;$('bodyWeight').value=state.bodyWeight;document.querySelector(`input[name="targetMode"][value="${state.targetMode}"]`).checked=true;document.querySelectorAll('input[name="targetMode"],#calorieGoal,#proteinGoal,#carbGoal,#fatGoal,#bodyWeight').forEach(input=>input.oninput=renderTargetForm);$('saveGoals').onclick=saveGoals;$('generatePlan').onclick=generatePlan;$('search').oninput=renderFoods;$('mealFilter').onchange=renderFoods;$('categoryFilter').onchange=renderFoods;renderTargetForm();renderDashboard();renderFoods();renderSelections();generatePlan()}
init().catch(e=>$('menuInfo').textContent=`Could not load the menu: ${e.message}`);
