import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {mealsFor,availableAt,migrateChoice}=createRequire(import.meta.url)('../meal-schedule.js');
test('Saturday and Sunday menus have only brunch and dinner, including empty halls',()=>{
  for(const date of ['2026-10-17','2026-10-18']){
    assert.deepEqual(mealsFor([],date),['Brunch','Dinner']);
    assert.deepEqual(mealsFor([{menuDate:date,meals:['Brunch','Dinner']}],'2026-10-19'),['Brunch','Dinner']);
  }
});
test('weekday menus keep breakfast, lunch and dinner; published brunch is respected',()=>{
  assert.deepEqual(mealsFor([{menuDate:'2026-10-19',meals:['Breakfast','Lunch','Dinner']}]),['Breakfast','Lunch','Dinner']);
  assert.deepEqual(mealsFor([{menuDate:'2026-10-19',meals:['Brunch','Dinner']}]),['Brunch','Dinner']);
});
test('brunch cannot be duplicated as breakfast or lunch; old brunch-food choices migrate',()=>{
  const food={meals:['Brunch']};
  assert.equal(availableAt(food,'Brunch'),true);
  assert.equal(availableAt(food,'Breakfast'),false);
  assert.equal(availableAt(food,'Lunch'),false);
  for(const meal of ['Breakfast','Lunch'])assert.equal(migrateChoice(meal,food,['Brunch','Dinner']),'Brunch');
  assert.equal(migrateChoice('Dinner',{meals:['Dinner']},['Brunch','Dinner']),'Dinner');
});
