(function(root) {
  function nutrition(input) {
    const result={};
    for(const key of ['protein','carbs','fat']){
      const raw=input[key];
      if(raw==null || String(raw).trim()==='' || !Number.isFinite(Number(raw)) || Number(raw)<0)
        throw new Error('Enter a non-negative number for '+key+' (use 0 if none).');
      result[key]=Number(raw);
    }
    const calculated=result.protein*4+result.carbs*4+result.fat*9;
    const provided=input.calories!=null && String(input.calories).trim()!=='';
    result.calories=provided?Number(input.calories):calculated;
    if(!Number.isFinite(result.calories)||result.calories<0||!Number.isFinite(calculated))
      throw new Error('Enter valid calories, or leave calories blank to calculate from macros.');
    return result;
  }
  function add(state,input,day,at=Date.now(),id='manual-'+at+'-'+Math.random().toString(36).slice(2)) {
    const name=String(input.name||'').trim();
    if(!name || name.length>120)throw new Error('Enter a food name between 1 and 120 characters.');
    const entry={id,name,source:'manual',nutrition:nutrition(input),at,
      caloriesSource:input.calories!=null&&String(input.calories).trim()!==''?'entered':'calculated'};
    // Validate before changing any saved data. Sleeping tabs must roll over
    // before a new entry is recorded, just like weighed dining-hall portions.
    if(state.logDay!==day)state.log=[];
    state.logDay=day;
    state.log||=[];
    state.log.push(entry);
    return entry;
  }
  const api={nutrition,add};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.CalFuelManual=api;
})(globalThis);
