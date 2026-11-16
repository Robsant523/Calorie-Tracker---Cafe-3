(function(root) {
  function rollover(state, day) {
    state.history ||= {};
    state.log ||= [];
    if (state.logDay && state.logDay !== day) {
      if (state.log.length) {
        const previous = state.history[state.logDay] || [];
        state.history[state.logDay] = previous.concat(JSON.parse(JSON.stringify(state.log)));
      }
      state.log = [];
    }
    state.logDay = day;
  }
  function days(state) {
    return [...new Set([
      ...Object.keys(state.history || {}).filter(day => state.history[day]?.length),
      ...(state.logDay ? [state.logDay] : [])
    ])].sort().reverse();
  }
  function entries(state, day) {
    return (day === state.logDay ? state.log : state.history?.[day]) || [];
  }
  function remove(state, day, index) {
    const records = entries(state, day);
    if (!Number.isInteger(index) || index < 0 || index >= records.length) return;
    return records.splice(index, 1)[0];
  }
  function week(state, endDay, foods=[]) {
    const portions = typeof module !== 'undefined' && module.exports ? require('./portions.js') : root.CalFuelPortions;
    const date = new Date(endDay+'T12:00:00');
    const dayKey = value => value.getFullYear()+'-'+String(value.getMonth()+1).padStart(2,'0')+'-'+String(value.getDate()).padStart(2,'0');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDay) || !Number.isFinite(date.getTime()) || dayKey(date)!==endDay) {
      throw new Error('Choose a valid tracking day for the week.');
    }
    // Move by calendar dates at noon so daylight-saving changes keep seven days.
    date.setDate(date.getDate()-6);
    const buckets = Array.from({length:7},()=>{
      const day = dayKey(date), records = entries(state,day);
      const bucket = {day,entries:records,total:portions.total(records,foods)};
      date.setDate(date.getDate()+1);
      return bucket;
    });
    const total = buckets.reduce((sum,bucket)=>{
      Object.keys(sum).forEach(key=>{sum[key]+=bucket.total[key];});
      return sum;
    },{calories:0,protein:0,carbs:0,fat:0});
    return {
      days:buckets,total,
      entryCount:buckets.reduce((count,bucket)=>count+bucket.entries.length,0),
      daysLogged:buckets.filter(bucket=>bucket.entries.length>0).length,
      averageCalories:total.calories/7
    };
  }
  const api = {rollover, days, entries, remove, week};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CalFuelHistory = api;
})(globalThis);
