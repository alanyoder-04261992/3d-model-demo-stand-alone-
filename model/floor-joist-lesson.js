/* Isolate the regular crosswise floor joists for the manual lesson. The
   shared floor-frame part and its normal finished/framing views stay whole.
   Retained triangles keep their original coordinates, normals, UVs, stages
   and materials; the floor-frame tag also keeps the lesson wood finish. */
export function onlyFloorJoists(build, measurements) {
  const joists=(measurements?.frame?.members || [])
    .filter((record)=>record.member.kind==="joist");
  const fits=(vertices,offset,bounds)=>{
    for(let corner=0;corner<3;corner++) for(let axis=0;axis<3;axis++) {
      const value=vertices[offset+corner*9+axis],name=["x","y","z"][axis];
      if(value<bounds[name+"0Ft"]-1e-9 || value>bounds[name+"1Ft"]+1e-9) return false;
    }
    return true;
  };
  const out={...build,ORDER:build.ORDER.slice(),buckets:{},tags:{},hitQuads:build.hitQuads.slice()};
  for(const key of build.ORDER) {
    const bucket=build.buckets[key],next={...bucket,v:[],n:0},segments=[];
    for(const tag of build.tags[key] || []) {
      for(let triangle=tag.from;triangle<tag.from+tag.count;triangle++) {
        const offset=triangle*27;
        if(tag.part==="floor-frame" && !joists.some((record)=>fits(bucket.v,offset,record.bounds))) continue;
        const from=next.n/3,last=segments[segments.length-1];
        if(last && last.part===tag.part && last.from+last.count===from) last.count++;
        else segments.push({part:tag.part,from,count:1});
        for(let i=offset;i<offset+27;i++) next.v.push(bucket.v[i]);
        next.n+=3;
      }
    }
    out.buckets[key]=next;
    out.tags[key]=segments;
  }
  return out;
}
