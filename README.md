# CalFuel — Café 3 macro tracker

A small, no-build calorie and macro tracker for UC Berkeley students using Café 3. It includes a current Café 3 menu snapshot captured from Berkeley Dining on September 12, 2026, daily macro targets, food logging stored locally, and a macro-first meal-plan generator.

## Use it

```bash
npm start
```

Then open http://localhost:4173. Set your calorie, protein, carbohydrate, and fat targets; the interface updates instantly.

## Refresh the menu

```bash
npm run refresh-menu
```

This retrieves the public Berkeley Dining menu and saves dish names to `data/cafe3-menu.json`. Berkeley’s menu page provides the live offerings and dietary tags, but not a convenient documented bulk nutrition export, so included macro figures are explicitly marked as estimates. For accurate dietary or medical use, confirm serving size and nutrition from the official item detail or a dining staff member.

Source: https://dining.berkeley.edu/menus/
