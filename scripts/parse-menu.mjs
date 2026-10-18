// Read Berkeley's hall and meal containers; never infer a hall from a dish name.
export const HALLS = [
  { id: 'cafe-3', name: 'Café 3', sourceKey: 'Cafe_3' },
  { id: 'clark-kerr', name: 'Clark Kerr', sourceKey: 'Clark_Kerr_Campus' },
  { id: 'crossroads', name: 'Crossroads', sourceKey: 'Crossroads' },
  { id: 'foothill', name: 'Foothill', sourceKey: 'Foothill' },
];
export const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const attrs = text => Object.fromEntries([...text.matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/gs)].map(m => [m[1], m[3]]));
const decode = text => text.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (entity, key) => {
  if (key[0] === '#') return String.fromCodePoint(key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1)));
  return {amp:'&', quot:'"', apos:"'", lt:'<', gt:'>', nbsp:' '}[key.toLowerCase()] || entity;
}).trim();

export function estimate(name) {
  const n = name.toLowerCase();
  if (/chicken|beef|salmon|turkey|tuna|brisket/.test(n)) return {calories:250,protein:30,carbs:5,fat:12};
  if (/tofu|lentil|bean|dal|chili|peas/.test(n)) return {calories:180,protein:11,carbs:26,fat:4};
  if (/rice|pasta|noodle|potato|bread|waffle|oatmeal|bagel/.test(n)) return {calories:210,protein:5,carbs:42,fat:3};
  if (/vegetable|broccoli|carrot|salad|spinach|mushroom|zucchini|pepper/.test(n)) return {calories:70,protein:3,carbs:12,fat:2};
  return {calories:150,protein:5,carbs:18,fat:6};
}

export function parseMenu(html, previousItems = []) {
  const known = new Map(previousItems.map(item => [slug(item.name), item]));
  const dishes = new Map(), stack = [];
  // Tracking the nested <li> containers prevents a previous hall/meal leaking
  // into the next one. Recipe names are the first span, not allergen tooltip text.
  for (const token of html.matchAll(/<li\b([^>]*)>|<\/li\s*>/gi)) {
    if (token[1] === undefined) { stack.pop(); continue; }
    const attributes = attrs(token[1]);
    const classes = (attributes.class || '').split(/\s+/);
    const parent = stack.at(-1) || {};
    const context = {...parent};
    if (classes.includes('location-name')) {
      context.hall = HALLS.find(h => (attributes.class || '').includes(h.sourceKey.replaceAll('_', ' ')));
      context.meal = undefined;
    }
    if (classes.includes('preiod-name')) {
      context.meal = (attributes.class || '').match(/\b(Breakfast|Brunch|Lunch|Dinner)\b/i)?.[1];
      if (context.meal) context.meal = context.meal[0].toUpperCase() + context.meal.slice(1).toLowerCase();
    }
    stack.push(context);
    if (!classes.includes('recip') || !context.hall || !context.meal) continue;
    const sourcePath = Buffer.from(attributes['data-location'] || '', 'base64').toString('utf8');
    const file = sourcePath.match(/\/([^/]+)_(\d{8})\.xml$/i);
    // Cross-check the encoded source against its container. Unknown/mismatched
    // locations must not be silently assigned to Café 3 or another known hall.
    if (!file || file[1] !== context.hall.sourceKey) continue;
    const body = html.slice(token.index + token[0].length).split(/<\/li\s*>/i, 1)[0];
    const rawName = body.match(/^\s*<span\b[^>]*>([^<]*)<\/span>/i)?.[1];
    if (!rawName) continue;
    const name = decode(rawName), legacyId = slug(name);
    if (!legacyId) continue;
    // Keep existing Café 3 IDs for saved logs; other halls have separate IDs.
    const id = context.hall.id === 'cafe-3' ? legacyId : `${context.hall.id}--${legacyId}`;
    const date = `${file[2].slice(0,4)}-${file[2].slice(4,6)}-${file[2].slice(6,8)}`;
    const tags = classes.filter(c => !['recip'].includes(c));
    const existing = dishes.get(id);
    if (existing) {
      existing.meals = [...new Set([...existing.meals, context.meal])];
      existing.tags = [...new Set([...existing.tags, ...tags])];
      continue;
    }
    const prior = known.get(legacyId);
    const nutrition = prior && ['calories','protein','carbs','fat'].every(k => Number.isFinite(Number(prior[k]))) ? prior : estimate(name);
    dishes.set(id, {
      id, name, hallId:context.hall.id, diningHall:context.hall.name,
      station:context.hall.name, menuDate:date, meal:context.meal, meals:[context.meal],
      calories:Number(nutrition.calories), protein:Number(nutrition.protein), carbs:Number(nutrition.carbs), fat:Number(nutrition.fat),
      tags:[...new Set(tags)], nutrition:'estimated',
    });
  }
  const items = [...dishes.values()];
  return {
    schemaVersion:2,
    diningHalls:HALLS.map(({id,name}) => ({id,name,itemCount:items.filter(f => f.hallId === id).length})),
    items,
  };
}
