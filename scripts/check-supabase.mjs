import {loadSupabaseConfig} from './supabase-env.mjs';

try {
  const config=loadSupabaseConfig();
  if(!config.configured)throw new Error('Supabase is not configured. Copy .env.example to .env and fill in both public values.');
  console.log('Supabase public configuration is valid. No credentials were printed.');
  console.log('This checks local configuration only; it does not verify project connectivity or authentication.');
} catch(error) {
  console.error(error.message);
  process.exitCode=1;
}
