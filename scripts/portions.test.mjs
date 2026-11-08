import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {calculate,total,forServings,hasNutrition,toGrams}=createRequire(import.meta.url)('../portions.js');
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
test('published serving weights scale exact macros; missing nutrition is never treated as zero',()=>{
  const published={calories:93.86,protein:12.83,carbs:3.31,fat:3.37,nutrition:'berkeley'};
  const weight=3.18*28.349523125;
  const half=calculate(published,weight/2,weight);
  for(const [key,value] of Object.entries({calories:46.93,protein:6.415,carbs:1.655,fat:1.685}))
    assert.ok(Math.abs(half[key]-value)<1e-10);
  for(const value of [null,undefined,'',NaN]){
    const missing={...published,protein:value};
    assert.equal(hasNutrition(missing),false);
    assert.throws(()=>calculate(missing,100,weight),/unavailable/);
  }
  assert.equal(hasNutrition({...published,protein:0}),true);
  assert.throws(()=>calculate({...published,nutrition:'estimated'},100,weight),/unavailable/);
  assert.throws(()=>calculate(published,100,null));
});
test('published serving counts can be recorded without guessing a gram weight',()=>{
  assert.deepEqual(forServings(food,0.5),{calories:125,protein:15,carbs:2.5,fat:6});
  for(const servings of ['',0,-1,Infinity])assert.throws(()=>forServings(food,servings));
  assert.throws(()=>forServings(food,Number.MAX_VALUE),/smaller/);
  assert.throws(()=>forServings({...food,carbs:null},1),/unavailable/);
});
test('grams and ounces describe the same portion and produce identical nutrition',()=>{
  const grams=90.1514835375;
  const ounceWeight=toGrams('3.18','oz');
  assert.ok(Math.abs(ounceWeight-grams)<1e-10);
  assert.equal(toGrams('30.5','g'),30.5);
  assert.equal(toGrams(100),100);
  const fromOunces=calculate(food,ounceWeight,120);
  const fromGrams=calculate(food,toGrams(grams,'g'),120);
  for(const key of ['calories','protein','carbs','fat'])
    assert.ok(Math.abs(fromOunces[key]-fromGrams[key])<1e-10,key+' differs by input unit');
});
test('portion unit conversion rejects invalid weights, unsupported units, and overflow',()=>{
  for(const unit of ['g','oz'])for(const value of ['', ' ',0,-1,NaN,Infinity,-Infinity,null,undefined])
    assert.throws(()=>toGrams(value,unit));
  for(const unit of ['kg','fl oz','grams','ounces','',null])assert.throws(()=>toGrams(5,unit));
  assert.throws(()=>toGrams(Number.MAX_VALUE,'oz'));
});
