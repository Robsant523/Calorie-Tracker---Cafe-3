(function(root) {
  const unavailable='Station unavailable';
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const label=value=>typeof value==='string'?value.trim().replace(/\s+/g,' '):'';
  const sourceOrder=value=>Number.isFinite(value)&&value>=0?value:Infinity;
  const stationOrder=(a,b)=>(a.station===unavailable)-(b.station===unavailable)||a.order-b.order;
  function legacyStation(food) {
    const station=label(food.station),key=normalize(station);
    const halls=[food.diningHall,food.hallId,'Café 3','Clark Kerr','Clark Kerr Campus','Crossroads','Foothill','Dining hall'].map(normalize);
    return station&&!halls.includes(key)?station:unavailable;
  }
  function placements(food,meal='all') {
    const assignments=Array.isArray(food.stationAssignments)?food.stationAssignments:[];
    const offered=[...new Set((Array.isArray(food.meals)?food.meals:[food.meal]).filter(Boolean).concat(assignments.map(row=>row.meal).filter(Boolean)))];
    if(meal!=='all'&&!offered.includes(meal))return [];
    let rows;
    if(assignments.length){
      // Missing station metadata for one meal must never borrow another meal's station.
      rows=assignments.filter(row=>meal==='all'||row.meal===meal).map(row=>({
        meal:row.meal,station:label(row.station)||unavailable,order:sourceOrder(row.order)
      }));
      const missing=(meal==='all'?offered:[meal]).filter(service=>!rows.some(row=>row.meal===service));
      rows.push(...missing.map(service=>({meal:service,station:unavailable,order:Infinity})));
    } else {
      rows=(meal==='all'?(offered.length?offered:[null]):[meal]).map(service=>({meal:service,station:legacyStation(food),order:Infinity}));
    }
    const unique=new Map();
    for(const row of rows){
      const key=JSON.stringify([row.meal,row.station]);
      if(!unique.has(key)||row.order<unique.get(key).order)unique.set(key,row);
    }
    return [...unique.values()].sort(stationOrder);
  }
  function stations(foods,meal='all') {
    const rows=foods.flatMap(food=>placements(food,meal)).sort(stationOrder);
    return [...new Set(rows.map(row=>row.station))];
  }
  function browse(foods,{query='',meal='all',station='all',category='all',categoryOf=food=>food.category,sort='station'}={}) {
    const terms=normalize(query).split(/\s+/).filter(Boolean),seen=new Set(),matches=[];
    for(const food of foods){
      const active=placements(food,meal).filter(row=>station==='all'||row.station===station);
      if(!active.length||category!=='all'&&categoryOf(food)!==category)continue;
      const name=normalize(food.name),text=name+' '+active.map(row=>normalize(row.station)).join(' ');
      if(!terms.every(term=>text.includes(term)))continue;
      const identity=food.id||food;
      if(seen.has(identity))continue;
      seen.add(identity);
      // A station search puts the dish under the station that matched the query.
      const placement=active.find(row=>terms.every(term=>(name+' '+normalize(row.station)).includes(term)))||active[0];
      matches.push({food,...placement});
    }
    const grouped=new Map();
    for(const row of matches){
      if(!grouped.has(row.station))grouped.set(row.station,{station:row.station,order:row.order,items:[]});
      const group=grouped.get(row.station);
      group.order=Math.min(group.order,row.order);
      group.items.push(row.food);
    }
    const groups=[...grouped.values()].sort(stationOrder).map(({station,items})=>({station,items}));
    const items=sort==='name'
      ? matches.map(row=>row.food).sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:'base',numeric:true}))
      : groups.flatMap(group=>group.items);
    return {items,groups,total:items.length};
  }
  const api={placements,stations,browse};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.CalFuelBrowse=api;
})(globalThis);
