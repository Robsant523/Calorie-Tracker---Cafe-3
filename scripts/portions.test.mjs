import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {calculate,total}=createRequire(import.meta.url)('../portions.js');
const food={id:'chicken',calories:250,protein:30,carbs:5,fat:12};
test('weighed portions scale every nutrient, including fractional grams',()=>{
  assert.deepEqual(calculate(food,60,120),{calories:125,protein:15,carbs:2.5,fat:6});
  assert.deepEqual(calculate(food,180,120),{calories:375,protein:45,carbs:7.5,fat:18});
  assert.equal(calculate(food,30.5,120).protein,7.625);
});
test('blank, zero, negative and non-finite weights cannot be recorded',()=>{
  for(const weight of ['',0,-1,NaN,Infinity])assert.throws(()=>calculate(food,weight,120));
});
test('daily totals mix legacy servings and weighed records; new records survive menu changes',()=>{
  const record={id:food.id,weightGrams:60,nutrition:calculate(food,60,120)};
  assert.equal(total(['chicken',{id:'chicken'},record],[food]).calories,625);
  assert.equal(total([record],[]).calories,125);
  assert.equal(total([record],[{...food,calories:900}]).calories,125);
});
