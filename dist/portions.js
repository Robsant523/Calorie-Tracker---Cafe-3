// Shared by the browser and regression tests. Nutrition is per estimated serving.
(function(root) {
  const keys = ['calories', 'protein', 'carbs', 'fat'];
  function calculate(food, weightGrams, servingGrams) {
    const weight = Number(weightGrams), serving = Number(servingGrams);
    if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(serving) || serving <= 0) {
      throw new Error('Enter a portion weight greater than 0 grams.');
    }
    return Object.fromEntries(keys.map(key => {
      const amount = Number(food[key]) * weight / serving;
      if (!Number.isFinite(amount) || amount < 0) throw new Error('Nutrition is unavailable for this portion.');
      return [key, amount];
    }));
  }
  function total(log, foods) {
    return log.reduce((sum, entry) => {
      // New records keep calculated nutrition, so a later menu refresh cannot
      // change food already eaten. Old one-serving records remain supported.
      const nutrition = entry?.nutrition || foods.find(f => f.id === (typeof entry === 'string' ? entry : entry.id));
      if (nutrition) keys.forEach(key => { sum[key] += Number(nutrition[key]) || 0; });
      return sum;
    }, {calories:0,protein:0,carbs:0,fat:0});
  }
  const api = {calculate, total};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CalFuelPortions = api;
})(globalThis);
