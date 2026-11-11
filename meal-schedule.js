(function(root) {
  function mealsFor(items, snapshotDate) {
    const offered = new Set(items.flatMap(f => f.meals || [f.meal]));
    // Published services take priority over calendar assumptions, including
    // holidays, shortened hours, and hall-specific closures.
    return ['Breakfast','Brunch','Lunch','Dinner'].filter(meal=>offered.has(meal));
  }
  function defaultShares(meals) {
    if(meals.join('-')==='Breakfast-Lunch-Dinner')return {Breakfast:30,Lunch:40,Dinner:30};
    if(!meals.length)return {};
    const steps=Math.floor(20/meals.length),extra=20%meals.length;
    return Object.fromEntries(meals.map((meal,index)=>[meal,(steps+(index<extra?1:0))*5]));
  }
  function availableAt(food, meal) {
    return (food.meals || [food.meal]).includes(meal);
  }
  function migrateChoice(choice, food, meals) {
    if (meals.includes('Brunch') && ['Breakfast','Lunch'].includes(choice) && availableAt(food,'Brunch')) return 'Brunch';
    return choice;
  }
  const api = {mealsFor,defaultShares,availableAt,migrateChoice};
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  else root.CalFuelSchedule=api;
})(globalThis);
