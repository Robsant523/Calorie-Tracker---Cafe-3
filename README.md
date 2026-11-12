# CalFuel — Berkeley dining tracker

## Visual schedule previews

Test controls are hidden during ordinary use, including before JavaScript loads. To test, open `http://localhost:4173/?preview=weekday` for Breakfast/Lunch/Dinner or `http://localhost:4173/?preview=weekend` for Brunch/Dinner (use the same query parameters on any app URL). The preview controls appear only for these two modes. These modes use fictional, clearly labeled sample dishes and exercise the normal planner and meal filters. Try changing percentages, choosing foods, generating a plan, or recording a portion. Preview state stays in memory: it cannot overwrite your real targets, selections, schedule preferences, or food log, and it resets on reload or mode change. **Real menu** returns to your saved snapshot and data and hides the test controls again. This is a UI convenience, not an access restriction; anyone with a preview link can use sample mode. Run `npm test` to verify preview visibility, sample services, and storage isolation.

## Full-day plans from your choices

Assign menu foods to meals, enable the meals you eat, and make their percentages total 100%. Click **Create full-day plan**. **Only my selected foods** never adds unselected dishes; **My choices + fill missing categories** may add available foods for missing protein/carb/fat categories, favoring the missing macro per calorie. Every selected food in an enabled, available meal is retained, including multiple foods in one category, vegetables, and desserts. Disabled/unavailable choices are called out instead of silently reassigned. Planning is scoped to the selected dining hall.

Portions fit calories and all three macros together, with a minimum quarter serving for each chosen dish and a maximum four published servings per dish. The displayed gram weights are rounded to whole grams and totals are calculated from those same weights. The full-day comparison shows planned amounts, targets, and over/under differences; it flags combinations that cannot closely meet every target. Plans scale the published serving nutrition and are not a guarantee of a nutritionally complete diet. Generating a plan does not record food as eaten and does not subtract the existing food log from the full-day targets.

## About the app

### Manual foods

Use **Enter food manually** below the daily totals for snacks, restaurant meals, or other foods outside the menu. Enter nutrition for the portion actually eaten: a name, protein, carbs, and fat in grams. Calories are optional; blank calories use protein × 4 + carbs × 4 + fat × 9, while an entered value uses the label calories as-is. Optionally enter the portion weight in grams for your records; this does not scale the entered nutrition. **Record food eaten** adds to consumed totals without changing your targets or meal plan.

### Food history

**Food history** shows dining hall portions and manual foods together, newest first, with the hall or source, time, portion weight, calories, protein, carbs, and fat. Use **Day** to view earlier days and their totals. Each recorded portion is separate, even for the same dish; **Remove** corrects only that entry. Missing weights from older entries are shown as not recorded. New dining hall entries use the published nutrition; older entries keep their previously saved estimates.

History is saved on this device and survives menu refreshes. At 5 AM local time, current consumption resets and the previous day's entries move into history. History starts with records still saved when this feature is first opened; records deleted by older daily resets cannot be recovered. Preview history is isolated from real records and resets on reload.

A small calorie and macro tracker for UC Berkeley students. Choose Café 3, Clark Kerr, Crossroads, or Foothill with the **Where are you eating?** selector. Menu cards, saved plan selections, and automatic plan choices are limited to that hall. Daily consumption totals still include food logged from every hall.

The chosen hall and meal selections are saved on the current device. Meals follow the services actually published for each hall, including holidays and shortened schedules. Breakfast/Lunch/Dinner defaults to 30% / 40% / 30%; two-meal schedules such as Lunch/Dinner or Brunch/Dinner default to 50% / 50%, and a single meal defaults to 100%. Empty halls have no meal slots. Calendar weekdays never force a missing breakfast into the plan. The planner follows the menu's serving date and service labels, so a brunch dish is never duplicated into breakfast and lunch. Existing breakfast/lunch choices for brunch dishes migrate to Brunch. Meal percentages remain adjustable in steps of 5 and are saved separately for each schedule. A hall or meal without published dishes shows an empty state; it never borrows food from another hall. The page displays the snapshot refresh date; menus and nutrition are not live guarantees.

To track food eaten, choose **grams** or **oz** beside **Portion eaten**, then enter the weight on the menu card. Ounces convert to grams for nutrition calculations; food history retains the unit you entered. The card previews calories and macros for that weight; **Record portion** saves it to the day's consumed totals. The nutrition is scaled from the exact Berkeley serving weight. When Berkeley supplies only a cup or piece count, record published servings instead; the app cannot infer a gram weight from volume or pieces. Recorded portions preserve their calculated nutrition across menu refreshes, and previous one-serving records remain supported.

## Supabase setup (Phase 1)

See [SETUP.md](SETUP.md) for creating your Supabase project, enabling Email auth, configuring redirects, and copying `.env.example` to the ignored `.env` file. Only the project URL and anon/publishable key belong in the browser. `lib/supabase.mjs` provides one lazy shared client for later auth and data modules; Phase 1 does not yet change local storage or add login screens.

Use Node.js 22+ and Python 3. Run `npm ci`, fill in `.env`, and run `npm run check:supabase` to validate public configuration without printing it. `npm start` builds the browser client and serves only `dist/`, keeping environment and repository files out of the web root. With no configuration, the existing local tracker still runs.

## Use it

```bash
npm ci
npm start
```

Then open http://localhost:4173. Set your calorie, protein, carbohydrate, and fat targets; the interface updates instantly.

## Published nutrition and serving sizes

Menu cards show the reference serving size and per-serving macros. Calories and macros come from Berkeley's recipe popup, not category estimates. The label's calorie value is preserved as published rather than recalculated from macros. For example, the fetched Halal Beef Fajitas serving of 3.18 oz has 93.86 calories, 12.83g protein, 3.31g carbs, and 3.37g fat. That ounce weight converts to approximately 90.15g; it is not the old guessed 120g protein serving.

Foods with missing nutrition remain visible with an unavailable notice and cannot silently enter calorie totals or plans. Foods with published nutrition but no explicit mass can be recorded by the published serving count; automatic gram plans exclude them. Nutrition is Berkeley's published recipe information, which Berkeley warns can vary with preparation and portioning. Previously recorded entries retain their saved values and are labeled as previous estimates; remove and re-enter a past entry if you need to correct it using known nutrition.

Refresh uses the menu page's recipe identifiers and the same `get_recipe_details` request as [Berkeley's menu](https://dining.berkeley.edu/menus/). It makes at most four concurrent requests, retries transient failures once, and reports nutrition coverage. If all live nutrition requests fail, the previous snapshot is kept. An offline `--input` menu does not make network requests and marks nutrition unavailable. The refresh command also synchronizes the served menu snapshots in `dist/data/`.

## Refresh the menu

On the public website, **Check for menu updates** loads the latest published snapshot. The app also checks on page load, when you return to the tab, and every five minutes while the page is visible. Automatic checks preserve unfinished portion entries. The menu heading shows the serving date, and a failed check shows a warning while retaining the saved snapshot. These checks download the deployed data; they do not scrape Berkeley or publish changes. The owner still runs the command below to fetch Berkeley's latest menu and publish it to GitHub Pages.

```bash
npm run refresh-menu
```

This now refreshes the menu **and commits and pushes its four snapshot files to `origin/main`**. It checks your branch and fetches GitHub before refreshing; your checkout must be on `main`, track `origin/main`, and have no unpushed commits or unpulled changes. It synchronizes `data/cafe3-menu.{json,js}` into `dist/data/` without rebuilding or changing other site assets. Other edits and staged files stay out of the menu commit. You need Git push access and GitHub authentication configured on your computer.

A push makes the snapshot available on GitHub. A GitHub Pages deployment or other hosting integration must deploy that branch for the public website to change; an independently hosted `chatgpt.site` does not redeploy just because you pushed GitHub. This command does not add a daily schedule. Refresh timestamps are recorded, so another successful refresh can create a new snapshot commit even when the dishes have not changed.

For a local refresh without Git actions, use:

```bash
npm run refresh-menu:local
# Or: npm run refresh-menu -- --local-only
```

If fetching GitHub fails or the branches differ, the command stops before changing the menu. If the menu fetch fails, nothing is committed. If pushing fails after a commit, the local commit is kept; resolve the connection/authentication or branch issue and run `git push origin main`. No force-push, automatic rebase, reset, or stash is performed.

This retrieves the public Berkeley Dining menu and preserves each dish's dining hall and meal services in `data/cafe3-menu.json` and its JavaScript companion. The original filenames remain for compatibility. The parser cross-checks hall containers against the encoded source location and keeps shared dishes separate between halls. Existing Café 3 IDs are retained for saved logs. The importer fetches each recipe’s official nutrition popup using its source location, recipe ID, and menu ID. It validates the recipe name and nutrient labels, preserves the published decimals, and converts explicit weight units (such as ounces) to grams. It never assigns macros from dish-name keywords or preserves old guessed macros. Missing or failed nutrition is marked unavailable, never zero. Recipes with different source identifiers stay separate even when their names match.

For a previously downloaded official HTML snapshot, run `npm run refresh-menu -- --input /absolute/path/to/menu.html`. Offline input always stays local and does not commit or push; nutrition is unavailable unless fetched through the live importer. Run `npm test` for parser and isolated Git publishing regression checks (these use temporary local repositories and never push test data to GitHub).

The deployable static bundle is in `dist/`. Run `npm run build` after changing code or environment values; it copies only public assets and bundles the Supabase SDK. `npm run preview` serves the last build. Deploy only `dist/`; do not serve the repository root after adding `.env`.

Source: https://dining.berkeley.edu/menus/
