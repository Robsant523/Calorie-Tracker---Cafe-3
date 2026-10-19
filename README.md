# CalFuel — Berkeley dining tracker

## Visual schedule previews

Test controls are hidden during ordinary use, including before JavaScript loads. To test, open `http://localhost:4173/?preview=weekday` for Breakfast/Lunch/Dinner or `http://localhost:4173/?preview=weekend` for Brunch/Dinner (use the same query parameters on any app URL). The preview controls appear only for these two modes. These modes use fictional, clearly labeled sample dishes and exercise the normal planner and meal filters. Try changing percentages, choosing foods, generating a plan, or recording a portion. Preview state stays in memory: it cannot overwrite your real targets, selections, schedule preferences, or food log, and it resets on reload or mode change. **Real menu** returns to your saved snapshot and data and hides the test controls again. This is a UI convenience, not an access restriction; anyone with a preview link can use sample mode. Run `npm test` to verify preview visibility, sample services, and storage isolation.

## Full-day plans from your choices

Assign menu foods to meals, enable the meals you eat, and make their percentages total 100%. Click **Create full-day plan**. **Only my selected foods** never adds unselected dishes; **My choices + fill missing categories** may add available foods for missing protein/carb/fat categories, favoring the missing macro per calorie. Every selected food in an enabled, available meal is retained, including multiple foods in one category, vegetables, and desserts. Disabled/unavailable choices are called out instead of silently reassigned. Planning is scoped to the selected dining hall.

Portions fit calories and all three macros together, with a minimum quarter serving for each chosen dish and a maximum four estimated servings per dish. The displayed gram weights are rounded to whole grams and totals are calculated from those same weights. The full-day comparison shows planned amounts, targets, and over/under differences; it flags combinations that cannot closely meet every target. These are estimated macro plans, not a guarantee of a nutritionally complete diet. Generating a plan does not record food as eaten and does not subtract the existing food log from the full-day targets.

## About the app

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
