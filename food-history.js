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
  const api = {rollover, days, entries, remove};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CalFuelHistory = api;
})(globalThis);
