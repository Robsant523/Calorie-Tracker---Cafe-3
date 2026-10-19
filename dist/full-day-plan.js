(function(root) {
  const keys=['calories','protein','carbs','fat'];
  const macros={protein:'protein',carbs:'carb',fat:'fat'};
  const empty=()=>Object.fromEntries(keys.map(k=>[k,0]));
  const available=(food,meal)=>(food.meals||[food.meal]).includes(meal);
  const add=(total,nutrition)=>{keys.forEach(k=>total[k]+=nutrition[k]);return total;};
  function denseFor(macro,pool) {
    return pool.filter(f=>f[macro]>0).sort((a,b)=>
      b[macro]/Math.max(1,b.calories)-a[macro]/Math.max(1,a.calories))[0];
  }
  function fitPortions(candidates,targets,grams) {
    // Bounded coordinate descent fits all nutrients together, accounting for
    // the protein/carbs/fat already contributed by each mixed food.
    const scales=keys.map(k=>Math.max(k==='calories'?100:10,targets[k]));
    const vectors=candidates.map(({food})=>keys.map((k,j)=>food[k]/scales[j]));
    const target=keys.map((k,j)=>targets[k]/scales[j]);
    const minimum=candidates.map(c=>c.auto?0:0.25);
    const servings=[...minimum];
    const residual=target.map((v,j)=>-v+vectors.reduce((sum,a,i)=>sum+a[j]*servings[i],0));
    for(let pass=0;pass<800;pass++) {
      let change=0;
      vectors.forEach((a,i)=>{
        const norm=a.reduce((s,v)=>s+v*v,0);
        if(norm===0)return;
        const gradient=a.reduce((s,v,j)=>s+v*residual[j],0);
        const next=Math.max(minimum[i],Math.min(4,servings[i]-gradient/norm));
        const delta=next-servings[i];
        a.forEach((v,j)=>residual[j]+=v*delta);
        servings[i]=next;change=Math.max(change,Math.abs(delta));
      });
      if(change<1e-7)break;
    }
    return candidates.map((candidate,i)=>{
      const reference=grams(candidate.food);
      const weightGrams=Math.round(servings[i]*reference);
      const amount=weightGrams/reference;
      return {...candidate,weightGrams,servings:amount,
        nutrition:Object.fromEntries(keys.map(k=>[k,candidate.food[k]*amount]))};
    }).filter(row=>row.weightGrams>0);
  }
  function build({foods,hallId,choices,enabled,shares,goals,mode='fill',category,grams}) {
    if(!enabled.length)throw new Error('Choose at least one meal.');
    if(enabled.some(m=>!Number.isFinite(shares[m])||shares[m]<=0||shares[m]>100))
      throw new Error('Give each enabled meal a percentage above 0, or uncheck it.');
    const sum=enabled.reduce((s,m)=>s+shares[m],0);
    if(Math.abs(sum-100)>0.001)throw new Error(`Enabled meal percentages must total 100% (currently ${sum}%).`);
    if(keys.some(k=>!Number.isFinite(goals[k])||goals[k]<0)||goals.calories<=0)
      throw new Error('Set valid daily calorie and macro targets first.');
    const pool=foods.filter(f=>f.hallId===hallId && keys.every(k=>Number.isFinite(Number(f[k]))&&Number(f[k])>=0))
      .map(f=>({...f,...Object.fromEntries(keys.map(k=>[k,Number(f[k])]))}));
    const warnings=[];
    for(const [id,meal] of Object.entries(choices)) {
      const food=pool.find(f=>f.id===id);
      if(food && (!enabled.includes(meal)||!available(food,meal)))
        warnings.push(`${food.name} was not included: ${meal} is disabled or that food is not offered at that meal.`);
    }
    const meals=enabled.map(meal=>{
      const offered=pool.filter(f=>available(f,meal));
      const selected=offered.filter(f=>choices[f.id]===meal);
      const candidates=selected.map(food=>({food,auto:false,reasons:[]}));
      const targets=Object.fromEntries(keys.map(k=>[k,goals[k]*shares[meal]/100]));
      if(!offered.length)warnings.push(`No ${meal.toLowerCase()} menu is available for this dining hall; that meal is incomplete.`);
      else if(mode==='fill'){
        for(const [macro,group] of Object.entries(macros)){
          if(targets[macro]===0||selected.some(f=>category(f)===group))continue;
          const food=denseFor(macro,offered.filter(f=>category(f)===group))||denseFor(macro,offered);
          if(!food)continue;
          const existing=candidates.find(c=>c.food.id===food.id);
          if(existing)existing.reasons.push(macro);
          else candidates.push({food,auto:true,reasons:[macro]});
        }
      } else if(!selected.length)warnings.push(`Choose foods for ${meal.toLowerCase()}, or enable filling missing categories.`);
      const rows=fitPortions(candidates,targets,grams);
      const total=rows.reduce((t,row)=>add(t,row.nutrition),empty());
      return {meal,share:shares[meal],targets,rows,total};
    });
    const total=meals.reduce((t,meal)=>add(t,meal.total),empty());
    const differences=Object.fromEntries(keys.map(k=>[k,total[k]-goals[k]]));
    const closeToTargets=keys.every(k=>Math.abs(differences[k])<=Math.max(k==='calories'?50:5,goals[k]*0.1));
    if(!closeToTargets)warnings.push('These food choices and portions cannot closely match every target. Adjust your choices or meal percentages; the differences below show what is still over or under.');
    return {meals,total,differences,warnings,closeToTargets,
      selectedCount:meals.reduce((n,m)=>n+m.rows.filter(r=>!r.auto).length,0),
      autoCount:meals.reduce((n,m)=>n+m.rows.filter(r=>r.auto).length,0)};
  }
  const api={build};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.CalFuelDayPlan=api;
})(globalThis);
