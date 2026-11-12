import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const refreshCode=app.slice(app.indexOf('let menuRequestActive=false'),app.indexOf('function setupMenuUpdates()'));
const menu=day=>({refreshedAt:`2026-11-${day}T12:00:00Z`,items:[{id:'rice',name:'Rice'}],diningHalls:[{id:'cafe-3',name:'Café 3'}]});
function deferred(){
  let resolve,reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
function harness({current=menu('11'),isPreview=false,load}={}){
  const elements={refreshMenu:{disabled:false},menuRefreshStatus:{textContent:''}};
  const draft={value:''},editing={focused:false};
  const calls={loads:0,halls:0,dashboard:0,foods:0,selections:0,plans:0};
  const context={
    isPreview,menuSnapshot:current,foods:current?.items||[],Date,
    $:id=>{assert.ok(elements[id],id);return elements[id];},
    location:{protocol:'https:'},window:{CALFUEL_MENU:current},
    document:{activeElement:{matches:()=>editing.focused},querySelectorAll:()=>[draft]},
    CalFuelMenuLoader:{load:async args=>{calls.loads++;return load(args);}},
    setupDiningHalls(value){calls.halls++;context.menuSnapshot=value;},
    renderDashboard(){calls.dashboard++;},
    renderFoods(){calls.foods++;draft.value='';},
    renderSelections(){calls.selections++;},generatePlan(){calls.plans++;}
  };
  runInNewContext(refreshCode+'\nfunction refreshState(){return {menuRequestActive,lastMenuCheck};}',context);
  return {context,elements,draft,editing,calls};
}

test('automatic refresh preserves a portion started while the request was pending',async()=>{
  const request=deferred(),current=menu('11');
  const {context,elements,draft,editing,calls}=harness({current,load:()=>request.promise});
  const pending=context.refreshMenuSnapshot();
  assert.equal(calls.loads,1);
  assert.equal(elements.refreshMenu.disabled,true);
  draft.value='150';editing.focused=true;
  request.resolve({menu:menu('12'),fromFallback:false});
  await pending;
  assert.equal(context.menuSnapshot,current);
  assert.equal(draft.value,'150');
  assert.equal(calls.foods,0);
  assert.equal(calls.halls,0);
  assert.match(elements.menuRefreshStatus.textContent,/newer menu.*available/i);
  assert.equal(elements.refreshMenu.disabled,false);
  assert.equal(context.refreshState().menuRequestActive,false);
});

test('manual refresh applies changed data and releases the button after loading',async()=>{
  const request=deferred(),fresh=menu('12');
  const {context,elements,calls}=harness({load:()=>request.promise});
  const pending=context.refreshMenuSnapshot({manual:true});
  assert.equal(elements.refreshMenu.disabled,true);
  request.resolve({menu:fresh,fromFallback:false});
  await pending;
  assert.equal(context.menuSnapshot,fresh);
  assert.equal(context.foods,fresh.items);
  assert.deepEqual(calls,{loads:1,halls:1,dashboard:1,foods:1,selections:1,plans:1});
  assert.match(elements.menuRefreshStatus.textContent,/Menu updated/);
  assert.equal(elements.refreshMenu.disabled,false);
  assert.equal(context.refreshState().menuRequestActive,false);
});

test('unchanged menu checks do not rerender menu forms',async()=>{
  const current=menu('12');
  const {context,elements,draft,calls}=harness({current,load:async()=>({menu:JSON.parse(JSON.stringify(current)),fromFallback:false})});
  draft.value='80';
  await context.refreshMenuSnapshot({manual:true});
  assert.equal(context.menuSnapshot,current);
  assert.equal(draft.value,'80');
  assert.equal(calls.foods,0);
  assert.match(elements.menuRefreshStatus.textContent,/latest published menu/);
  assert.equal(elements.refreshMenu.disabled,false);
});

test('an initial menu load failure can recover through the manual check button',async()=>{
  let attempt=0;
  const fresh=menu('12');
  const {context,elements,calls}=harness({current:null,load:async()=>{
    if(attempt++===0)throw new Error('Could not load the menu.');
    return {menu:fresh,fromFallback:false};
  }});
  await context.refreshMenuSnapshot({manual:true});
  assert.equal(context.menuSnapshot,null);
  assert.equal(elements.refreshMenu.disabled,false);
  assert.match(elements.menuRefreshStatus.textContent,/Could not load/);
  await context.refreshMenuSnapshot({manual:true});
  assert.equal(context.menuSnapshot,fresh);
  assert.equal(calls.foods,1);
  assert.equal(elements.refreshMenu.disabled,false);
});

test('preview mode never requests or applies a real menu update',async()=>{
  const current=menu('11');
  const {context,calls}=harness({current,isPreview:true,load:async()=>{throw new Error('Unexpected preview network request');}});
  await context.refreshMenuSnapshot({manual:true});
  assert.equal(calls.loads,0);
  assert.equal(calls.foods,0);
  assert.equal(context.menuSnapshot,current);
});
