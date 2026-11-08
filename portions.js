// Shared by the browser and regression tests. Nutrition is per source serving.
(function(root) {
  const keys = ['calories', 'protein', 'carbs', 'fat'];
  function toGrams(value, unit='g') {
    if(!['g','oz'].includes(unit))throw new Error('Choose grams or ounces.');
    const weight=Number(value),result=weight*(unit==='oz'?28.349523125:1);
    if(!Number.isFinite(result)||result<=0)throw new Error('Enter a portion weight greater than 0.');
    return result;
  }
  function hasNutrition(food) {
    return !!food && !['estimated','unavailable'].includes(food.nutrition) &&
      keys.every(key => food[key] != null && food[key] !== '' && Number.isFinite(Number(food[key])) && Number(food[key]) >= 0);
  }
  function forServings(food, servings) {
    if(!hasNutrition(food))throw new Error('Published nutrition is unavailable for this food. Enter nutrition manually instead.');
    const amount=Number(servings);
    if(!Number.isFinite(amount)||amount<=0)throw new Error('Enter a serving count greater than 0.');
    return Object.fromEntries(keys.map(key=>{
      const value=Number(food[key])*amount;
      if(!Number.isFinite(value))throw new Error('Enter a smaller serving count.');
      return [key,value];
    }));
  }
  function calculate(food, weightGrams, servingGrams) {
    const weight = Number(weightGrams), serving = Number(servingGrams);
    if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(serving) || serving <= 0) {
      throw new Error('Enter a portion weight greater than 0 grams.');
    }
    if(!hasNutrition(food))throw new Error('Published nutrition is unavailable for this food. Enter nutrition manually instead.');
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
  const api = {calculate, forServings, hasNutrition, toGrams, total};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CalFuelPortions = api;
})(globalThis);
