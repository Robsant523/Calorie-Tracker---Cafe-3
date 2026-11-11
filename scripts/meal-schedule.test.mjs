import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {mealsFor,defaultShares,availableAt,migrateChoice}=createRequire(import.meta.url)('../meal-schedule.js');
test('Saturday and Sunday menus respect published services and empty halls',()=>{
  for(const date of ['2026-10-17','2026-10-18']){
    assert.deepEqual(mealsFor([],date),[]);
    assert.deepEqual(mealsFor([{menuDate:date,meals:['Brunch','Dinner']}],'2026-10-19'),['Brunch','Dinner']);
  }
});
test('holiday weekdays use only the meals published for each hall',()=>{
  const date='2026-11-11';
  const holiday=mealsFor([{menuDate:date,meals:['Lunch']},{menuDate:date,meals:['Dinner']}]);
  assert.deepEqual(holiday,['Lunch','Dinner']);
  assert.deepEqual(defaultShares(holiday),{Lunch:50,Dinner:50});
  assert.deepEqual(mealsFor([{menuDate:date,meals:['Breakfast','Lunch','Dinner']}]),['Breakfast','Lunch','Dinner']);
  assert.deepEqual(defaultShares(['Breakfast','Lunch','Dinner']),{Breakfast:30,Lunch:40,Dinner:30});
  assert.deepEqual(defaultShares(['Dinner']),{Dinner:100});
  assert.deepEqual(defaultShares([]),{});
  assert.deepEqual(mealsFor([{menuDate:'2026-11-14',meals:['Lunch','Dinner']}]),['Lunch','Dinner']);
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
