# CalFuel — Berkeley dining tracker

A small, no-build calorie and macro tracker for UC Berkeley students. Choose Café 3, Clark Kerr, Crossroads, or Foothill with the **Where are you eating?** selector. Menu cards, saved plan selections, and automatic plan choices are limited to that hall. Daily consumption totals still include food logged from every hall.

The chosen hall and meal selections are saved on the current device. Weekend menus use **Brunch and Dinner** (50% / 50% by default); weekday menus use Breakfast, Lunch, and Dinner (30% / 40% / 30%). The planner follows the menu's serving date and service labels, so a brunch dish is never duplicated into breakfast and lunch. Existing breakfast/lunch choices for brunch dishes migrate to Brunch. Meal percentages remain adjustable in steps of 5 and are saved separately for each schedule. A hall or meal without published dishes shows an empty state; it never borrows food from another hall. The page displays the snapshot refresh date; menus and nutrition are not live guarantees.

To track food eaten, enter its portion weight in grams on the menu card. The card previews calories and macros for that weight; **Record portion** saves it to the day's consumed totals. For example, 60g of a food whose estimated 120g serving has 250 kcal counts as 125 kcal. Nutrition and reference serving weights are estimates. Recorded portions preserve their calculated nutrition across menu refreshes, and previous one-serving records remain supported.

## Use it

```bash
npm start
```

Then open http://localhost:4173. Set your calorie, protein, carbohydrate, and fat targets; the interface updates instantly.

## Refresh the menu

```bash
npm run refresh-menu
```

This retrieves the public Berkeley Dining menu and preserves each dish's dining hall and meal services in `data/cafe3-menu.json` and its JavaScript companion. The original filenames remain for compatibility. The parser cross-checks hall containers against the encoded source location and keeps shared dishes separate between halls. Existing Café 3 IDs are retained for saved logs. Macros remain explicitly marked as estimates.

For a previously downloaded official HTML snapshot, run `npm run refresh-menu -- --input /absolute/path/to/menu.html`. Run `npm test` for the parser regression checks.

The deployable static bundle is in `dist/`. When preparing a release, synchronize the HTML, CSS, JavaScript, and data files from the project root to that folder.

Source: https://dining.berkeley.edu/menus/
