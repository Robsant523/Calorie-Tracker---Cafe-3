import {createClient} from '@supabase/supabase-js';
import {readSupabaseConfig} from './supabase-config.mjs';

let client;
function config() {
  // The build injects only these two public values, never the full environment.
  return readSupabaseConfig({
    PUBLIC_SUPABASE_URL:process.env.PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY:process.env.PUBLIC_SUPABASE_ANON_KEY
  });
}
export function isSupabaseConfigured() {
  return config().configured;
}
export function getSupabaseClient() {
  if(client)return client;
  const {url,anonKey,configured}=config();
  if(!configured)throw new Error('Supabase is not configured. Fill in .env using SETUP.md, then rebuild with npm run build.');
  client=createClient(url,anonKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  return client;
}
// Phase 3 auth and Phase 4 data modules will import this singleton.
// TODO: Add social login and password reset handlers in the future auth module.
// TODO: Keep offline sync and analytics outside this client module.
