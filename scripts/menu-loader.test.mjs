import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {load}=createRequire(import.meta.url)('../menu-loader.js');

const menu=(refreshedAt='2026-11-12T21:32:03.473Z')=>({
  refreshedAt,items:[],diningHalls:[{id:'cafe-3',name:'Café 3'}]
});
const response=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});

test('HTTP requests prefer fresh JSON over an already loaded JavaScript snapshot',async()=>{
  const fallback=menu('2026-11-11T12:00:00.000Z'),fresh=menu();
  let calls=0;
  const result=await load({protocol:'https:',fallback,now:()=>12345,fetchImpl:async(url,options)=>{
    calls++;
    assert.equal(url,'data/cafe3-menu.json?_=12345');
    assert.equal(options.cache,'no-store');
    return response(fresh);
  }});
  assert.equal(calls,1);
  assert.deepEqual(result.menu,fresh);
  assert.equal(result.fromFallback,false);
  assert.equal(result.error,null);
  assert.equal(fallback.refreshedAt,'2026-11-11T12:00:00.000Z');
});

test('separate checks use different cache-busting URLs on HTTP and HTTPS',async()=>{
  const urls=[];
  for(const [protocol,time] of [['http:',123],['https:',456]]){
    await load({protocol,now:()=>time,fetchImpl:async url=>{
      urls.push(url);return response(menu());
    }});
  }
  assert.deepEqual(urls,['data/cafe3-menu.json?_=123','data/cafe3-menu.json?_=456']);
});

test('a published menu with no foods remains valid for a closed day',async()=>{
  const closed=menu();
  const result=await load({fetchImpl:async()=>response(closed)});
  assert.equal(result.fromFallback,false);
  assert.deepEqual(result.menu.items,[]);
});

test('file previews use the embedded menu without attempting HTTP requests',async()=>{
  const fallback=menu();
  let calls=0;
  const result=await load({protocol:'file:',fallback,fetchImpl:async()=>{
    calls++;throw new Error('File preview should not fetch');
  }});
  assert.equal(calls,0);
  assert.deepEqual(result.menu,fallback);
  assert.equal(result.fromFallback,true);
  assert.equal(result.error,null);
});

test('failed HTTP and network requests visibly mark the embedded fallback',async()=>{
  const fallback=menu('2026-11-11T12:00:00.000Z');
  for(const fetchImpl of [
    async()=>new Response('Unavailable',{status:503}),
    async()=>{throw new Error('Network unavailable');}
  ]){
    const result=await load({fallback,fetchImpl});
    assert.deepEqual(result.menu,fallback);
    assert.equal(result.fromFallback,true);
    assert.equal(typeof result.error,'string');
    assert.ok(result.error.trim().length>0);
  }
});

test('malformed JSON or invalid menu structure falls back rather than replacing the menu',async()=>{
  const fallback=menu();
  const invalid=[null,{}, {...menu(),items:null},{...menu(),diningHalls:[]},
    {...menu(),refreshedAt:'not-a-date'}, {...menu(),refreshedAt:undefined}];
  const fetches=[async()=>new Response('{broken JSON'),...invalid.map(value=>async()=>response(value))];
  for(const fetchImpl of fetches){
    const result=await load({fallback,fetchImpl});
    assert.deepEqual(result.menu,fallback);
    assert.equal(result.fromFallback,true);
    assert.equal(typeof result.error,'string');
    assert.ok(result.error.length>0);
  }
});

test('failed loading with no usable fallback rejects instead of returning an invalid menu',async()=>{
  for(const fallback of [undefined,null,{}, {...menu(),diningHalls:[]}]){
    await assert.rejects(()=>load({fallback,fetchImpl:async()=>new Response('Unavailable',{status:503})}));
    await assert.rejects(()=>load({protocol:'file:',fallback,fetchImpl:async()=>response(menu())}));
  }
});
