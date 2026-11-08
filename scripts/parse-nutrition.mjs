const decode=text=>text.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi,(entity,key)=>{
  if(key[0]==='#')return String.fromCodePoint(key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1)));
  return {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '}[key.toLowerCase()]||entity;
});
const text=html=>decode(html.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const name=value=>text(String(value)).toLowerCase();
const labels=new Map([
  ['calories(kcal)','calories'],['totallipid/fat(g)','fat'],
  ['carbohydrate(g)','carbs'],['protein(g)','protein']
]);
const units={g:1,gram:1,grams:1,kg:1000,kilogram:1000,kilograms:1000,
  oz:28.349523125,ounce:28.349523125,ounces:28.349523125,
  lb:453.59237,lbs:453.59237,pound:453.59237,pounds:453.59237};
function weightCandidates(value) {
  const candidates=[];
  const pattern=/(?<![\w.])([+-]?(?:(?:\d+\s+)?\d+\s*\/\s*\d+|\d+(?:\.\d+)?|\.\d+))\s*(kilograms?|kg|grams?|g|ounces?|oz|pounds?|lbs?)\b/gi;
  for(const match of value.matchAll(pattern)){
    // A fluid ounce is volume; converting it to mass requires food density.
    if(/(?:fl\.?|fluid)\s*$/i.test(value.slice(0,match.index)))continue;
    const raw=match[1].trim().replace(/\s*\/\s*/g,'/');
    if(raw.startsWith('-'))throw new Error('Berkeley provided an invalid serving weight.');
    let amount;
    if(raw.includes('/')){
      const parts=raw.split(/\s+/),fraction=parts.pop().split('/');
      amount=Number(parts[0]||0)+Number(fraction[0])/Number(fraction[1]);
    } else amount=Number(raw);
    const grams=amount*units[match[2].toLowerCase()];
    if(!Number.isFinite(grams)||grams<=0)throw new Error('Berkeley provided an invalid serving weight.');
    candidates.push({grams,unit:match[2].toLowerCase()});
  }
  return candidates;
}
function servingWeight(value) {
  // Prefer a parenthetical gram weight over a preceding piece or volume count.
  for(const match of value.matchAll(/\(([^)]*)\)/g)){
    const grams=weightCandidates(match[1]).find(weight=>/^(g|grams?)$/.test(weight.unit));
    if(grams)return grams.grams;
  }
  const candidates=weightCandidates(value);
  const grams=candidates.find(weight=>/^(g|grams?)$/.test(weight.unit));
  return (grams||candidates[0])?.grams??null;
}

/** Parse one official get_recipe_details response; never infer missing macros. */
export function parseNutrition(html,expectedName) {
  const title=html.match(/<h5\b[^>]*>([\s\S]*?)<\/h5\s*>/i)?.[1];
  if(!title||!name(expectedName)||name(title)!==name(expectedName))
    throw new Error('Berkeley recipe name did not match the requested dish.');
  const serving=html.match(/<span\b[^>]*class\s*=\s*(["'])[^"']*\bserving-size\b[^"']*\1[^>]*>([\s\S]*?)<\/span\s*>/i)?.[2];
  const servingMatch=serving&&text(serving).match(/^Serving\s+Size\s*:\s*(.+)$/i);
  if(!servingMatch)throw new Error('Berkeley recipe is missing a serving size.');
  const servingSize=servingMatch[1].trim();
  const nutritionSection=html.match(/<div\b[^>]*class\s*=\s*(["'])[^"']*\b(?:nutration|nutrition)-details\b[^"']*\1[^>]*>([\s\S]*?)<\/div\s*>/i)?.[2];
  if(!nutritionSection)throw new Error('Berkeley recipe is missing nutrition details.');
  const result={};
  for(const row of nutritionSection.matchAll(/<li\b[^>]*>\s*<span\b[^>]*>([\s\S]*?)<\/span\s*>([\s\S]*?)<\/li\s*>/gi)){
    const label=text(row[1]).toLowerCase().replace(/\s/g,'').replace(/:$/,'');
    const key=labels.get(label);
    if(!key)continue;
    const value=text(row[2]);
    if(Object.hasOwn(result,key)||!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$|^\.\d+$/.test(value))
      throw new Error('Berkeley recipe has an invalid '+key+' value.');
    const amount=Number(value.replaceAll(',',''));
    if(!Number.isFinite(amount)||amount<0)throw new Error('Berkeley recipe has an invalid '+key+' value.');
    result[key]=amount;
  }
  for(const key of ['calories','protein','carbs','fat'])
    if(!Object.hasOwn(result,key))throw new Error('Berkeley recipe is missing '+key+'.');
  return {calories:result.calories,protein:result.protein,carbs:result.carbs,fat:result.fat,
    servingSize,servingGrams:servingWeight(servingSize),nutrition:'berkeley'};
}
