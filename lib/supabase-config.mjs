// This checks configuration shape, not token authenticity. Supabase verifies keys.
export function readSupabaseConfig(env) {
  const url=String(env.PUBLIC_SUPABASE_URL||'').trim();
  const anonKey=String(env.PUBLIC_SUPABASE_ANON_KEY||'').trim();
  if(!url&&!anonKey)return {url:'',anonKey:'',configured:false};
  if(!url||!anonKey)throw new Error('Set both PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY in .env.');
  let parsed;
  try {parsed=new URL(url);} catch {throw new Error('PUBLIC_SUPABASE_URL must be a valid Supabase project URL.');}
  const local=['localhost','127.0.0.1','[::1]'].includes(parsed.hostname);
  if((parsed.protocol!=='https:'&&!(local&&parsed.protocol==='http:'))||parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=='/')
    throw new Error('Use an HTTPS project URL (HTTP is allowed only for local Supabase), without credentials, a path, or query parameters.');
  let isPublic=/^sb_publishable_[A-Za-z0-9_-]+$/.test(anonKey);
  if(!isPublic){
    try {
      const parts=anonKey.split('.');
      if(parts.length===3&&parts.every(part=>/^[A-Za-z0-9_-]+$/.test(part))){
        const payload=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
        isPublic=payload.role==='anon';
      }
    } catch { /* Invalid or privileged credentials are rejected below. */ }
  }
  if(!isPublic)throw new Error('Use a Supabase publishable key or legacy anon key. Secret and service_role keys must never be used in the browser.');
  return {url:parsed.origin,anonKey,configured:true};
}
