import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseNutrition} from './parse-nutrition.mjs';

// Shape and labels match Berkeley's get_recipe_details popup response.
const recipe=({name='Halal Beef Fajitas',serving='3.18 oz',calories='93.86',protein='12.83',carbs='3.31',fat='3.37'}={})=>`
<div class="title sec"><h5 style="font-weight:700;">${name}</h5>
<span class="serving-size">Serving Size:\n ${serving}</span></div>
<div class="nutration-details sec"><h4>Nutrition Facts</h4><ul>
<li><span>Calories (kcal):</span>${calories}</li>
<li><span>Total Lipid/Fat (g):</span>${fat}</li>
<li><span>Saturated fatty acid (g):</span>1.15</li>
<li><span>Trans Fat (g):</span>0.13</li>
<li><span>Carbohydrate (g):</span>${carbs}</li>
<li><span>Total Dietary Fiber (g):</span>0.63</li>
<li><span>Sugar (g):</span>1.09</li>
<li><span>Protein (g):</span>${protein}</li>
<li><span>Carbon Footprint (kg CO2):</span>2.35</li>
</ul></div>`;

test('official decimal macros map exact labels and use published weight, not a guessed serving',()=>{
  const result=parseNutrition(recipe(),'Halal Beef Fajitas');
  assert.deepEqual(result,{calories:93.86,protein:12.83,carbs:3.31,fat:3.37,
    servingSize:'3.18 oz',servingGrams:3.18*28.349523125,nutrition:'berkeley'});
});
test('recipe identity tolerates HTML entities, case, and whitespace but rejects another dish',()=>{
  const html=recipe({name:' Rice &amp;\n Beans&nbsp; ',serving:'100 grams'});
  assert.equal(parseNutrition(html,'rice & Beans').servingGrams,100);
  assert.equal(parseNutrition(html,'Rice &amp; Beans').servingGrams,100);
  assert.throws(()=>parseNutrition(html,'Rice'),/name did not match/);
  assert.throws(()=>parseNutrition(html,''),/name did not match/);
});
test('zero macro values are valid; blank, missing, negative, and nonnumeric macros fail',()=>{
  const zero=parseNutrition(recipe({calories:'0',protein:'0',carbs:'0',fat:'0'}),'Halal Beef Fajitas');
  assert.equal(zero.calories,0);assert.equal(zero.fat,0);
  for(const key of ['calories','protein','carbs','fat'])for(const value of ['', '-1', 'NaN', 'Infinity', 'not available'])
    assert.throws(()=>parseNutrition(recipe({[key]:value}),'Halal Beef Fajitas'),/invalid/);
  assert.throws(()=>parseNutrition(recipe().replace('<li><span>Protein (g):</span>12.83</li>',''),'Halal Beef Fajitas'),/missing protein/);
});
test('only exact total nutrient labels are accepted, including labels without spaces',()=>{
  const html=recipe().replace('Carbohydrate (g):','Carbohydrate(g):');
  assert.equal(parseNutrition(html,'Halal Beef Fajitas').carbs,3.31);
  assert.throws(()=>parseNutrition(recipe().replace('Total Lipid/Fat (g):','Saturated Fat (g):'),'Halal Beef Fajitas'),/missing fat/);
  assert.throws(()=>parseNutrition(recipe().replace('</ul>','<li><span>Calories (kcal):</span>99</li></ul>'),'Halal Beef Fajitas'),/invalid calories/);
});
test('published mass units convert to grams and parenthetical gram weights take priority',()=>{
  for(const [serving,expected] of [['85 g',85],['0.25 kg',250],['2 ounces',56.69904625],['0.5 lb',226.796185],['1 cup (120g)',120],['3 oz (85 grams)',85],['1 each (95 g)',95],['1 / 2 oz',14.1747615625],['2 1/2 oz',70.8738078125]])
    assert.equal(parseNutrition(recipe({serving}),'Halal Beef Fajitas').servingGrams,expected,serving);
});
test('volume and piece servings retain macros without fabricating a gram weight',()=>{
  for(const serving of ['1 cup','2 fl oz','2 fluid ounces','1 each','3 pieces']){
    const result=parseNutrition(recipe({serving}),'Halal Beef Fajitas');
    assert.equal(result.servingGrams,null,serving);
    assert.equal(result.calories,93.86);
    assert.equal(result.servingSize,serving);
  }
});
test('missing serving information and invalid weights are rejected',()=>{
  assert.throws(()=>parseNutrition(recipe({serving:''}),'Halal Beef Fajitas'),/missing a serving size/);
  assert.throws(()=>parseNutrition(recipe().replace('Serving Size:','Quantity:'),'Halal Beef Fajitas'),/missing a serving size/);
  for(const serving of ['0 g','-3 oz'])assert.throws(()=>parseNutrition(recipe({serving}),'Halal Beef Fajitas'),/invalid serving weight/);
  assert.throws(()=>parseNutrition(recipe().replace('nutration-details','unrelated'),'Halal Beef Fajitas'),/missing nutrition details/);
});
