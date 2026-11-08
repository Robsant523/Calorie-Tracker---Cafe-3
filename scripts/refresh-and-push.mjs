/** Refresh public menu snapshots and publish only those snapshots to origin/main. */
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {copyFile,mkdir,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {refreshMenu} from './refresh-menu.mjs';

const exec=promisify(execFile);
const projectRoot=fileURLToPath(new URL('../',import.meta.url));
const menuFiles=['data/cafe3-menu.json','data/cafe3-menu.js',
  'dist/data/cafe3-menu.json','dist/data/cafe3-menu.js'];

async function git(cwd,args) {
  const {stdout}=await exec('git',args,{cwd,timeout:120000,maxBuffer:1024*1024});
  return stdout.trim();
}
async function preflight(cwd) {
  let root,branch,upstream;
  try {
    root=await git(cwd,['rev-parse','--show-toplevel']);
    branch=await git(cwd,['symbolic-ref','--quiet','--short','HEAD']);
    upstream=await git(cwd,['rev-parse','--abbrev-ref','--symbolic-full-name','@{upstream}']);
  } catch {
    throw new Error('Run this command from the CalFuel Git checkout on main with upstream origin/main. Use --local-only to refresh without Git.');
  }
  if(await realpath(root)!==await realpath(cwd)||branch!=='main'||upstream!=='origin/main')
    throw new Error('Publishing requires the CalFuel repository root, branch main, and upstream origin/main. No menu changes were made.');
  for(const state of ['MERGE_HEAD','CHERRY_PICK_HEAD','REVERT_HEAD','rebase-merge','rebase-apply']){
    const path=await git(cwd,['rev-parse','--git-path',state]);
    try {await realpath(resolve(cwd,path));}
    catch(error){if(error.code==='ENOENT')continue;throw error;}
    throw new Error('Finish the current Git merge/rebase/cherry-pick/revert before publishing a menu. No menu changes were made.');
  }
  try {await git(cwd,['fetch','--quiet','origin','main']);}
  catch {throw new Error('Could not fetch origin/main. Check your GitHub sign-in and network connection. No menu changes were made.');}
  const head=await git(cwd,['rev-parse','HEAD']);
  if(head!==await git(cwd,['rev-parse','refs/remotes/origin/main']))
    throw new Error('Local main and origin/main differ. Push any pending commits or pull remote changes first, then retry. No menu changes were made.');
  return head;
}

export async function refreshAndPush({cwd=projectRoot,refresh=()=>refreshMenu([]),localOnly=false,log=console.log}={}) {
  // Check the branch before making requests or overwriting any snapshots.
  const originalHead=localOnly?null:await preflight(cwd);
  await refresh();
  await mkdir(resolve(cwd,'dist/data'),{recursive:true});
  for(const name of ['cafe3-menu.json','cafe3-menu.js'])
    await copyFile(resolve(cwd,'data',name),resolve(cwd,'dist/data',name));
  if(localOnly){
    log('Updated source and dist menu snapshots locally. No Git commit or push was made.');
    return {committed:false,pushed:false,sha:null};
  }
  if(await git(cwd,['rev-parse','HEAD'])!==originalHead)
    throw new Error('The local branch changed during the refresh. Menu files are updated locally; review Git status before publishing.');
  const changed=await git(cwd,['diff','--name-only','HEAD','--',...menuFiles]);
  if(!changed){
    log('Menu files are unchanged; no commit or push needed.');
    return {committed:false,pushed:false,sha:null};
  }
  try {
    await git(cwd,['add','--',...menuFiles]);
    // --only prevents other staged files from entering this commit.
    await git(cwd,['commit','--only','-m','Refresh Berkeley dining menu and nutrition','--',...menuFiles]);
  } catch {
    throw new Error('Menu files were refreshed, but Git could not create the commit. Check git status, Git author settings, and commit hooks, then retry. Nothing was pushed.');
  }
  const sha=await git(cwd,['rev-parse','HEAD']);
  try {
    // Push the captured commit, never an unrelated commit created concurrently.
    await git(cwd,['push','origin',sha+':refs/heads/main']);
  } catch {
    throw new Error('Menu commit '+sha.slice(0,7)+' was saved locally, but the push failed. Check GitHub sign-in, connectivity, or remote changes. After resolving the issue, run git push origin main. The local commit has been kept.');
  }
  log('Pushed menu commit '+sha.slice(0,7)+' to origin/main. Only the four menu snapshot files were committed.');
  log('Your website updates when its hosting deployment runs from this branch.');
  return {committed:true,pushed:true,sha};
}

export async function runRefreshCommand(args=process.argv.slice(2)) {
  let localOnly=false,input;
  for(let i=0;i<args.length;i++){
    if(args[i]==='--local-only')localOnly=true;
    else if(args[i]==='--input'&&args[i+1]&&!args[i+1].startsWith('--'))input=args[++i];
    else throw new Error('Usage: npm run refresh-menu [-- --local-only] [-- --input /path/to/menu.html]');
  }
  // Offline fixtures can lack nutrition; never publish them automatically.
  if(input)localOnly=true;
  return refreshAndPush({localOnly,refresh:()=>refreshMenu(input?['--input',input]:[])});
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))
  runRefreshCommand().catch(error=>{console.error(error.message);process.exitCode=1;});
