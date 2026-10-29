(function(root) {
  const isPreview = mode => mode === 'weekday' || mode === 'weekend';
  function createState(saved, mode) {
    const copy = JSON.parse(JSON.stringify(saved));
    if (isPreview(mode)) {
      copy.log = [];
      copy.history = {};
      delete copy.logDay;
      copy.planFoods = {};
      copy.mealSchedules = {};
      copy.hallId = 'cafe-3';
    }
    return copy;
  }
  function save(storage, state, mode) {
    // Preview interactions only live in memory, never in the real food log.
    if (!isPreview(mode)) storage.setItem('calfuel-state', JSON.stringify(state));
  }
  function createMenu(mode) {
    if (!isPreview(mode)) throw new Error('Unknown preview mode');
    const weekend = mode === 'weekend';
    const date = weekend ? '2026-10-18' : '2026-10-19';
    const services = weekend ? ['Brunch', 'Dinner'] : ['Breakfast', 'Lunch', 'Dinner'];
    const dishes = {
      Breakfast: [['Scrambled Eggs',18,2,12],['Oatmeal',5,27,3],['Peanut Butter',7,6,16]],
      Lunch: [['Grilled Chicken',32,0,4],['Brown Rice',4,36,1],['Avocado',1,4,7]],
      Brunch: [['Scrambled Eggs',18,2,12],['Roasted Potatoes',3,32,4],['Avocado',1,4,7]],
      Dinner: [['Baked Tofu',18,4,8],['Steamed Rice',4,44,0],['Almonds',9,9,22]]
    };
    return {
      schemaVersion: 2,
      refreshedAt: date + 'T19:00:00Z',
      diningHalls: [{id:'cafe-3',name:'Café 3 (sample)'}],
      items: services.flatMap(meal => dishes[meal].map(([name,protein,carbs,fat],i) => ({
        id:`preview-${mode}-${meal.toLowerCase()}-${i}`,
        name: name + ' (sample)', hallId:'cafe-3', diningHall:'Café 3 (sample)',
        meal, meals:[meal], menuDate:date,
        protein, carbs, fat, calories:protein*4+carbs*4+fat*9
      })))
    };
  }
  const api = {isPreview,createState,save,createMenu};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CalFuelPreview = api;
})(globalThis);
