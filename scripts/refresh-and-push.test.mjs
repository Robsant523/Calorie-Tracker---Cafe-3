import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {refreshAndPush} from './refresh-and-push.mjs';

const exec=promisify(execFile);
const menuFiles=['data/cafe3-menu.js','data/cafe3-menu.json','dist/data/cafe3-menu.js','dist/data/cafe3-menu.json'];
const env={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_TERMINAL_PROMPT:'0'};
async function git(cwd,...args){
  return (await exec('git',args,{cwd,env,timeout:15000})).stdout.trim();
}
async function snapshot(repo,marker){
  const payload={refreshedAt:'2026-11-07T12:00:00.000Z',marker,items:[]};
  await mkdir(join(repo,'data'),{recursive:true});
  await writeFile(join(repo,'data/cafe3-menu.json'),JSON.stringify(payload)+'\n');
  await writeFile(join(repo,'data/cafe3-menu.js'),'window.CALFUEL_MENU='+JSON.stringify(payload)+';\n');
  return payload;
}
async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),'calfuel-refresh-push-test-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const repo=join(root,'checkout'),remote=join(root,'remote.git');
  await mkdir(repo);
  await git(root,'init','--bare','--initial-branch=main',remote);
  await git(repo,'init','--initial-branch=main');
  await git(repo,'config','user.name','CalFuel Test');
  await git(repo,'config','user.email','calfuel-test@example.invalid');
  await git(repo,'config','commit.gpgsign','false');
  await git(repo,'config','core.hooksPath','/dev/null');
  await snapshot(repo,'original');
  await mkdir(join(repo,'dist/data'),{recursive:true});
  for(const name of ['cafe3-menu.js','cafe3-menu.json'])
    await writeFile(join(repo,'dist/data',name),await readFile(join(repo,'data',name)));
  await writeFile(join(repo,'notes.txt'),'original notes\n');
  await writeFile(join(repo,'dist/site.js'),'original asset\n');
  await git(repo,'add','.');
  await git(repo,'commit','-m','Initial fixture');
  await git(repo,'remote','add','origin',remote);
  await git(repo,'push','-u','origin','main');
  return {repo,remote};
}
const quiet=()=>{};

test('refresh pushes only four snapshot files and preserves unrelated staged and dist edits',async t=>{
  const {repo,remote}=await fixture(t);
  const before=await git(remote,'rev-parse','main');
  await writeFile(join(repo,'notes.txt'),'unrelated staged edit\n');
  await git(repo,'add','notes.txt');
  await writeFile(join(repo,'dist/site.js'),'unrelated dist edit\n');
  let refreshes=0;
  const result=await refreshAndPush({cwd:repo,log:quiet,refresh:async()=>{
    refreshes++;return snapshot(repo,'refreshed');
  }});
  assert.equal(refreshes,1);
  assert.equal(result.committed,true);
  assert.equal(result.pushed,true);
  assert.notEqual(result.sha,before);
  assert.equal(await git(remote,'rev-parse','main'),result.sha);
  assert.equal(await git(repo,'rev-parse','HEAD'),result.sha);
  assert.deepEqual((await git(repo,'diff-tree','--no-commit-id','--name-only','-r',result.sha)).split('\n').sort(),menuFiles);
  assert.equal(await git(repo,'diff','--cached','--name-only'),'notes.txt');
  assert.equal(await readFile(join(repo,'dist/site.js'),'utf8'),'unrelated dist edit\n');
  assert.equal(await git(remote,'show','main:notes.txt'),'original notes');
  assert.equal(await git(remote,'show','main:dist/site.js'),'original asset');
  for(const name of ['cafe3-menu.js','cafe3-menu.json'])
    assert.equal(await readFile(join(repo,'data',name),'utf8'),await readFile(join(repo,'dist/data',name),'utf8'));
});

test('unchanged snapshots do not create or push an empty commit',async t=>{
  const {repo,remote}=await fixture(t);
  const before=await git(repo,'rev-parse','HEAD');
  const result=await refreshAndPush({cwd:repo,log:quiet,refresh:()=>snapshot(repo,'original')});
  assert.deepEqual(result,{committed:false,pushed:false,sha:null});
  assert.equal(await git(repo,'rev-parse','HEAD'),before);
  assert.equal(await git(remote,'rev-parse','main'),before);
});

test('local-only refresh works outside Git and synchronizes only menu assets',async t=>{
  const repo=await mkdtemp(join(tmpdir(),'calfuel-refresh-local-test-'));
  t.after(()=>rm(repo,{recursive:true,force:true}));
  await mkdir(join(repo,'dist'),{recursive:true});
  await writeFile(join(repo,'dist/site.js'),'keep local code\n');
  const result=await refreshAndPush({cwd:repo,localOnly:true,log:quiet,refresh:()=>snapshot(repo,'local')});
  assert.equal(result.committed,false);
  assert.equal(result.pushed,false);
  for(const name of ['cafe3-menu.js','cafe3-menu.json'])
    assert.equal(await readFile(join(repo,'data',name),'utf8'),await readFile(join(repo,'dist/data',name),'utf8'));
  assert.equal(await readFile(join(repo,'dist/site.js'),'utf8'),'keep local code\n');
});

test('wrong branch, detached HEAD, and unpushed commits fail before fetching menu data',async t=>{
  for(const state of ['wrong-branch','detached','ahead'])await t.test(state,async t=>{
    const {repo,remote}=await fixture(t);
    const before=await git(remote,'rev-parse','main');
    if(state==='wrong-branch')await git(repo,'checkout','-b','feature');
    if(state==='detached')await git(repo,'checkout','--detach');
    if(state==='ahead'){
      await writeFile(join(repo,'notes.txt'),'unpublished code\n');
      await git(repo,'add','notes.txt');
      await git(repo,'commit','-m','Unpublished change');
    }
    let refreshed=false;
    await assert.rejects(()=>refreshAndPush({cwd:repo,log:quiet,refresh:async()=>{refreshed=true;}}));
    assert.equal(refreshed,false);
    assert.equal(await git(remote,'rev-parse','main'),before);
    assert.equal(JSON.parse(await readFile(join(repo,'data/cafe3-menu.json'),'utf8')).marker,'original');
  });
});

test('failed source refresh leaves the commit and remote unchanged',async t=>{
  const {repo,remote}=await fixture(t);
  const before=await git(repo,'rev-parse','HEAD');
  await assert.rejects(()=>refreshAndPush({cwd:repo,log:quiet,refresh:async()=>{throw new Error('Menu request failed');}}),/Menu request failed/);
  assert.equal(await git(repo,'rev-parse','HEAD'),before);
  assert.equal(await git(remote,'rev-parse','main'),before);
  assert.equal(await git(repo,'status','--porcelain'),'');
});

test('a failed push keeps the scoped menu commit locally with a recovery command',async t=>{
  const {repo,remote}=await fixture(t);
  const before=await git(repo,'rev-parse','HEAD');
  // Fetch still succeeds against origin; only the final push is made to fail.
  await git(repo,'remote','set-url','--push','origin',join(repo,'nonexistent-remote.git'));
  await assert.rejects(()=>refreshAndPush({cwd:repo,log:quiet,refresh:()=>snapshot(repo,'awaiting-push')}),/git push origin main/);
  const saved=await git(repo,'rev-parse','HEAD');
  assert.notEqual(saved,before);
  assert.equal(await git(remote,'rev-parse','main'),before);
  assert.deepEqual((await git(repo,'diff-tree','--no-commit-id','--name-only','-r',saved)).split('\n').sort(),menuFiles);
  assert.equal(await git(repo,'status','--porcelain'),'');
  assert.equal(JSON.parse(await readFile(join(repo,'data/cafe3-menu.json'),'utf8')).marker,'awaiting-push');
});
