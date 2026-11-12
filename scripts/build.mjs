import {build} from 'esbuild';
import {copyFile,mkdir,rm,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {loadSupabaseConfig} from './supabase-env.mjs';

// Only public app assets enter the output. Never copy the repository wholesale.
const assets=[
  'index.html','style.css','plan.css','targets.css','dining-halls.css',
  'portions.css','menu-preview.css','manual-entry.css','food-history.css',
  'app.js','targets-interactions.js','portions.js','meal-schedule.js','menu-loader.js',
  'menu-preview.js','full-day-plan.js','food-history.js','manual-entry.js',
  'data/cafe3-menu.json','data/cafe3-menu.js'
];
const root=new URL('../',import.meta.url),output=new URL('dist/',root);
try {
  const {url,anonKey,configured}=loadSupabaseConfig();
  const bundle=await build({
    entryPoints:[fileURLToPath(new URL('lib/supabase.mjs',root))],
    bundle:true,format:'esm',platform:'browser',target:'es2022',write:false,
    define:{
      'process.env.PUBLIC_SUPABASE_URL':JSON.stringify(url),
      'process.env.PUBLIC_SUPABASE_ANON_KEY':JSON.stringify(anonKey),
      'process.env.NODE_ENV':'"production"'
    },
    minify:true,legalComments:'inline',logLevel:'silent'
  });
  // dist is generated output. Validation/bundling succeeds before replacing it.
  await rm(output,{recursive:true,force:true});
  await mkdir(new URL('data/',output),{recursive:true});
  await mkdir(new URL('lib/',output),{recursive:true});
  for(const asset of assets)await copyFile(new URL(asset,root),new URL(asset,output));
  await writeFile(new URL('lib/supabase.mjs',output),bundle.outputFiles[0].contents);
  console.log('Built CalFuel into dist/ (Supabase '+(configured?'configured':'not configured; local tracking still works')+').');
} catch(error) {
  // Avoid dumping bundler diagnostics or environment values into output.
  console.error(error.errors?'Could not bundle the Supabase client. Check dependencies and lib/supabase.mjs.':error.message);
  process.exitCode=1;
}
