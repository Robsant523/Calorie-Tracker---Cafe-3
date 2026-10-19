(function(root) {
  const weekday = ['Breakfast','Lunch','Dinner'];
  const weekend = ['Brunch','Dinner'];
  function mealsFor(items, snapshotDate) {
    // Use the menu's serving date so an older snapshot does not get relabeled
    // according to the visitor's local clock or timezone.
    const date = items.find(f => f.menuDate)?.menuDate || snapshotDate;
    const day = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? new Date(date+'T12:00:00Z').getUTCDay() : NaN;
    const offered = new Set(items.flatMap(f => f.meals || [f.meal]));
    const brunchService = offered.has('Brunch') && !offered.has('Breakfast') && !offered.has('Lunch');
    return [...(day === 0 || day === 6 || brunchService ? weekend : weekday)];
  }
  function availableAt(food, meal) {
    return (food.meals || [food.meal]).includes(meal);
  }
  function migrateChoice(choice, food, meals) {
    if (meals.includes('Brunch') && ['Breakfast','Lunch'].includes(choice) && availableAt(food,'Brunch')) return 'Brunch';
    return choice;
  }
  const api = {mealsFor,availableAt,migrateChoice};
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  else root.CalFuelSchedule=api;
})(globalThis);
