import {existsSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {readSupabaseConfig} from '../lib/supabase-config.mjs';

export function loadSupabaseConfig() {
  const envFile=new URL('../.env',import.meta.url);
  if(existsSync(envFile))loadEnvFile(envFile);
  return readSupabaseConfig(process.env);
}
