// Read Berkeley's hall and meal containers; never infer nutrition from a dish name.
import {createHash} from 'node:crypto';
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

export function parseMenu(html) {
  const dishes = new Map(), usedIds = new Set(), stack = [];
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
    const sourceRef={location:attributes['data-location'],recipeId:attributes['data-id']||'',menuId:attributes['data-menuid']||'',meal:context.meal};
    // Different recipe/menu IDs can use the same display name and serving size.
    // Merge only the exact recipe source, never a name match or old estimate.
    const identity=JSON.stringify([context.hall.id,sourceRef.location,sourceRef.recipeId,sourceRef.menuId,name]);
    const date = `${file[2].slice(0,4)}-${file[2].slice(4,6)}-${file[2].slice(6,8)}`;
    const tags = classes.filter(c => !['recip'].includes(c));
    const existing = dishes.get(identity);
    if (existing) {
      existing.meals = [...new Set([...existing.meals, context.meal])];
      existing.tags = [...new Set([...existing.tags, ...tags])];
      if(!existing.sourceRefs.some(ref=>ref.meal===context.meal))existing.sourceRefs.push(sourceRef);
      continue;
    }
    // Keep the first recipe's legacy ID so saved selections keep working.
    const baseId=context.hall.id==='cafe-3'?legacyId:`${context.hall.id}--${legacyId}`;
    let id=baseId;
    if(usedIds.has(id))id=baseId+'--recipe-'+createHash('sha256').update(identity).digest('hex').slice(0,12);
    usedIds.add(id);
    dishes.set(identity, {
      id, name, hallId:context.hall.id, diningHall:context.hall.name,
      station:context.hall.name, menuDate:date, meal:context.meal, meals:[context.meal],
      calories:null,protein:null,carbs:null,fat:null,servingSize:null,servingGrams:null,
      tags:[...new Set(tags)],nutrition:'unavailable',sourceRefs:[sourceRef],
    });
  }
  const items = [...dishes.values()];
  return {
    schemaVersion:3,
    diningHalls:HALLS.map(({id,name}) => ({id,name,itemCount:items.filter(f => f.hallId === id).length})),
    items,
  };
}
