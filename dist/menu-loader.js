(function(root) {
  function valid(menu) {
    return !!menu&&Array.isArray(menu.items)&&Array.isArray(menu.diningHalls)&&menu.diningHalls.length>0&&
      menu.diningHalls.every(h=>typeof h.id==='string'&&typeof h.name==='string')&&
      menu.items.every(f=>typeof f.id==='string'&&typeof f.name==='string')&&
      typeof menu.refreshedAt==='string'&&Number.isFinite(Date.parse(menu.refreshedAt));
  }
  async function load({protocol='https:',fallback,fetchImpl=fetch,now=Date.now}={}) {
    if(protocol==='file:'){
      if(valid(fallback))return {menu:fallback,fromFallback:true,error:null};
      throw new Error('The local menu snapshot is unavailable. Run npm start to load the published menu.');
    }
    try {
      // A unique query also bypasses the static host's shared ten-minute cache.
      const response=await fetchImpl('data/cafe3-menu.json?_='+now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error('Menu request failed.');
      const menu=await response.json();
      if(!valid(menu))throw new Error('Invalid menu snapshot.');
      return {menu,fromFallback:false,error:null};
    } catch {
      if(valid(fallback))return {menu:fallback,fromFallback:true,error:'Could not check for menu updates. Showing the saved snapshot.'};
      throw new Error('Could not load the menu. Check your connection and try again.');
    }
  }
  const api={load};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.CalFuelMenuLoader=api;
})(globalThis);
