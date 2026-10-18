# CalFuel — Berkeley dining tracker

A small, no-build calorie and macro tracker for UC Berkeley students. Choose Café 3, Clark Kerr, Crossroads, or Foothill with the **Where are you eating?** selector. Menu cards, saved plan selections, and automatic plan choices are limited to that hall. Daily consumption totals still include food logged from every hall.

The chosen hall and meal selections are saved on the current device. Breakfast and lunch can use items from a published brunch service. A hall or meal without published dishes shows an empty state; it never borrows food from another hall. The page displays the snapshot refresh date; menus and nutrition are not live guarantees.

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
