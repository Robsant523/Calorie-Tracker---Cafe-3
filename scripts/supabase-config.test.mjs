import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readSupabaseConfig} from '../lib/supabase-config.mjs';

const publicKey=()=>['sb','publishable',randomUUID().replaceAll('-','')].join('_');
const jwt=role=>[
  Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),
  Buffer.from(JSON.stringify({role,ref:'test-only'})).toString('base64url'),
  Buffer.from(randomUUID()).toString('base64url')
].join('.');
const configuredEnv=key=>({PUBLIC_SUPABASE_URL:'https://calfuel-test.invalid',PUBLIC_SUPABASE_ANON_KEY:key});

async function withPublicEnv(values,callback) {
  const names=['PUBLIC_SUPABASE_URL','PUBLIC_SUPABASE_ANON_KEY'];
  const saved=Object.fromEntries(names.map(name=>[name,process.env[name]]));
  try {
    for(const name of names){
      if(values[name]===undefined)delete process.env[name];
      else process.env[name]=values[name];
    }
    return await callback();
  } finally {
    for(const name of names){
      if(saved[name]===undefined)delete process.env[name];
      else process.env[name]=saved[name];
    }
  }
}

test('an unconfigured app can import the client without attempting a connection',async()=>{
  assert.deepEqual(readSupabaseConfig({}),{url:'',anonKey:'',configured:false});
  await withPublicEnv({},async()=>{
    const client=await import('../lib/supabase.mjs?unconfigured='+randomUUID());
    assert.equal(client.isSupabaseConfigured(),false);
    assert.throws(()=>client.getSupabaseClient(),/Supabase is not configured.*SETUP\.md/);
  });
});

test('partial configuration fails rather than constructing a client',()=>{
  for(const env of [
    {PUBLIC_SUPABASE_URL:'https://calfuel-test.invalid'},
    {PUBLIC_SUPABASE_ANON_KEY:publicKey()},
    {PUBLIC_SUPABASE_URL:'  ',PUBLIC_SUPABASE_ANON_KEY:publicKey()}
  ])assert.throws(()=>readSupabaseConfig(env),/Set both PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY/);
});

test('project URLs reject malformed, insecure remote, and credential-bearing addresses',()=>{
  const key=publicKey();
  for(const url of [
    'not a url','http://calfuel-test.invalid','ftp://localhost',
    'https://user:password@calfuel-test.invalid','https://calfuel-test.invalid/private',
    'https://calfuel-test.invalid/?token=private','https://calfuel-test.invalid/#private'
  ]){
    assert.throws(()=>readSupabaseConfig({...configuredEnv(key),PUBLIC_SUPABASE_URL:url}),error=>{
      assert.equal(error.message.includes(key),false);
      assert.equal(error.message.includes(url),false);
      return /URL|HTTPS/.test(error.message);
    });
  }
});

test('publishable and legacy anon keys are accepted with trimmed public configuration',()=>{
  for(const key of [publicKey(),jwt('anon')]){
    assert.deepEqual(readSupabaseConfig({
      PUBLIC_SUPABASE_URL:' https://calfuel-test.invalid/ ',PUBLIC_SUPABASE_ANON_KEY:' '+key+' '
    }),{url:'https://calfuel-test.invalid',anonKey:key,configured:true});
  }
  for(const url of ['http://localhost:54321','http://127.0.0.1:54321','http://[::1]:54321'])
    assert.equal(readSupabaseConfig({...configuredEnv(publicKey()),PUBLIC_SUPABASE_URL:url}).configured,true);
});

test('privileged and malformed credentials are rejected without echoing their values',()=>{
  for(const key of [jwt('service_role'),jwt('authenticated'),['sb','secret',randomUUID()].join('_'),randomUUID()]){
    assert.throws(()=>readSupabaseConfig(configuredEnv(key)),error=>{
      assert.equal(error.message.includes(key),false);
      return /publishable key or legacy anon key/.test(error.message);
    });
  }
});

test('the shared module creates one client instance without network requests',async()=>{
  await withPublicEnv(configuredEnv(publicKey()),async()=>{
    const originalFetch=globalThis.fetch;
    let requests=0,client;
    globalThis.fetch=async()=>{requests++;throw new Error('Unexpected network request in configuration test');};
    try {
      const module=await import('../lib/supabase.mjs?singleton='+randomUUID());
      assert.equal(module.isSupabaseConfigured(),true);
      client=module.getSupabaseClient();
      assert.equal(module.getSupabaseClient(),client);
      const {data,error}=await client.auth.getSession();
      assert.equal(error,null);
      assert.equal(data.session,null);
      assert.equal(requests,0);
    } finally {
      if(client)await client.auth.stopAutoRefresh();
      globalThis.fetch=originalFetch;
    }
  });
});
