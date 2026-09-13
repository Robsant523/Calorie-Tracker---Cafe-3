let foods = [];
let state = JSON.parse(localStorage.getItem('calfuel-state') || '{}');
state.goals ||= { calories: 2200, protein: 160, carbs: 240, fat: 70 };
state.log ||= [];
const $ = id => document.getElementById(id);
const totals = () => state.log.reduce((a, id) => { const f = foods.find(x => x.id === id); if (f) ['calories','protein','carbs','fat'].forEach(k => a[k] += f[k]); return a; }, {calories:0,protein:0,carbs:0,fat:0});
const persist = () => localStorage.setItem('calfuel-state', JSON.stringify(state));
function renderDashboard(){
  const t = totals(), g = state.goals, pct = Math.min(100, Math.round(t.calories / g.calories * 100));
  $('caloriesTotal').textContent = t.calories; $('calorieGoalLabel').textContent = g.calories;
  $('calorieRing').style.background = `conic-gradient(var(--orange) ${pct * 3.6}deg,#e9eee6 0deg)`;
  $('statusLine').textContent = t.calories ? `${Math.max(g.calories-t.calories,0)} kcal left today.` : 'Start building your day.';
  $('macroGrid').innerHTML = [['Protein','protein','g'],['Carbs','carbs','g'],['Fat','fat','g']].map(([label,key,unit]) => `<div class="macro"><b>${t[key]}<small>${unit}</small></b><span>${label} · ${g[key]}${unit} goal</span></div>`).join('');
}
function renderFoods(){
  const term = $('search').value.toLowerCase(), meal = $('mealFilter').value;
  $('foods').innerHTML = foods.filter(f => (meal === 'all' || f.meal === meal) && f.name.toLowerCase().includes(term)).map(f => `<article class="food-card"><span class="station">${f.meal} · ${f.station}</span><h3>${f.name}</h3><div>${f.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div><p class="numbers">${f.calories} kcal · P ${f.protein}g · C ${f.carbs}g · F ${f.fat}g</p><button class="add" title="Add ${f.name}" data-id="${f.id}">+</button></article>`).join('');
  document.querySelectorAll('.add').forEach(b => b.onclick = () => { state.log.push(b.dataset.id); persist(); renderDashboard(); });
}
function generatePlan(){
  const g = state.goals, remaining = {...g};
  const picks = [];
  // High protein first makes the output practical for a typical student macro goal.
  const candidates = [...foods].sort((a,b) => (b.protein/b.calories) - (a.protein/a.calories));
  while (picks.length < 9 && remaining.calories > 120) {
    const scored = candidates.map(f => ({f, score: 2*Math.min(f.protein,remaining.protein)+.55*Math.min(f.carbs,remaining.carbs)+.9*Math.min(f.fat,remaining.fat)-Math.max(0,f.calories-remaining.calories)*.3})).filter(x => !picks.includes(x.f) || x.f.id === 'rice' || x.f.id === 'broccoli').sort((a,b)=>b.score-a.score)[0];
    if (!scored || scored.score < 1) break;
    picks.push(scored.f); ['calories','protein','carbs','fat'].forEach(k => remaining[k] -= scored.f[k]);
  }
  const meals = {Brunch: picks.filter(x=>x.meal==='Brunch'), Dinner:picks.filter(x=>x.meal==='Dinner')};
  const summary = picks.reduce((a,f)=>{['calories','protein','carbs','fat'].forEach(k=>a[k]+=f[k]);return a},{calories:0,protein:0,carbs:0,fat:0});
  $('plan').classList.remove('empty');
  $('plan').innerHTML = Object.entries(meals).map(([meal,items]) => `<article class="meal-card"><p class="eyebrow">${meal.toUpperCase()}</p><h3>${items.length ? 'Your plate' : 'Flexible meal'}</h3>${items.map(f=>`<div class="meal-item"><span>${f.name}</span><span>${f.calories} kcal · ${f.protein}P</span></div>`).join('') || '<p class="muted">Use your remaining targets to choose from the menu.</p>'}</article>`).join('') + `<article class="meal-card"><p class="eyebrow">PLAN TOTAL</p><h3>${summary.calories} kcal</h3><p class="numbers">P ${summary.protein}g · C ${summary.carbs}g · F ${summary.fat}g</p><p class="muted">This is a suggested full-day pattern. Add individual items to record what you actually eat.</p></article>`;
}
async function init(){
  const menu = await fetch('data/cafe3-menu.json').then(r=>r.json()); foods = menu.items;
  $('menuInfo').textContent = `Café 3 snapshot · ${new Date(menu.refreshedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'})} · estimates shown`;
  Object.entries(state.goals).forEach(([k,v]) => $(k+'Goal').value=v);
  $('saveGoals').onclick = () => { state.goals = {calories:+$('calorieGoal').value,protein:+$('proteinGoal').value,carbs:+$('carbGoal').value,fat:+$('fatGoal').value}; persist(); renderDashboard(); generatePlan(); };
  $('generatePlan').onclick = generatePlan; $('search').oninput = renderFoods; $('mealFilter').onchange = renderFoods;
  renderDashboard(); renderFoods(); generatePlan();
}
init();
