/* A quiet lumber finish for this lesson only. It changes surface pictures,
   colour and UVs, never timber vertices, normals or construction stages. */
import { hexRGB, srgbLin } from "../engine/math.js";
import { mulberry32 } from "../engine/seeded.js";

const GRAIN="lessonWoodGrain", END="lessonWoodEnd", VARIANTS=8;
const dot=(a,b)=>a.reduce((sum,value,i)=>sum+value*b[i],0);

// A truss's axis-aligned box includes empty space. Test its real prism,
// including the inward side of a shared cut face, to keep each board's grain.
function inPrism(point,record,epsilon=1e-7) {
  if(point[2]<record.bounds.z0Ft-epsilon || point[2]>record.bounds.z1Ft+epsilon) return false;
  let sign=0;
  for(let i=0;i<record.poly.length;i++) {
    const a=record.poly[i],b=record.poly[(i+1)%record.poly.length];
    const cross=(b[0]-a[0])*(point[1]-a[1])-(b[1]-a[1])*(point[0]-a[0]);
    if(Math.abs(cross)<=epsilon) continue;
    if(sign && Math.sign(cross)!==sign) return false;
    sign=Math.sign(cross);
  }
  return true;
}

function boardHash(value) {
  let hash=2166136261;
  for(const letter of value) hash=Math.imul(hash^letter.charCodeAt(0),16777619);
  return hash>>>0;
}

// The browser and the static model pictures use these same seeded pixels.
// A board keeps its appearance when the camera or visible parts change.
export function floorWoodTexture(name) {
  const match=/^lessonWood(Grain|End)-(\d+)$/.exec(name);
  if(!match) return null;
  const end=match[1]==="End", variant=Number(match[2]);
  const width=512,height=256,pixels=new Uint8ClampedArray(width*height*4);
  const random=mulberry32((end?912:417)+variant*7919);
  const phase=random()*Math.PI*2;
  const knots=Array.from({length:2+Math.floor(random()*4)},()=>({
    x:.08+random()*.84,y:.1+random()*.8,
    rx:.014+random()*.022,ry:.018+random()*.033,
  }));
  const centerX=.3+random()*.4,centerY=.3+random()*.4;
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const u=x/width,v=y/height;
    let warp=0,knotShade=0;
    for(const knot of knots) {
      const dx=(u-knot.x)/knot.rx,dy=(v-knot.y)/knot.ry;
      const radius=Math.hypot(dx,dy);
      warp+=Math.sign(dy)*.017*Math.exp(-dx*dx/9)*Math.exp(-Math.abs(dy)/3);
      knotShade+=.26*Math.exp(-radius*radius*1.5)
        +.09*Math.exp(-radius*.7)*(.5+.5*Math.sin(radius*12));
    }
    const grainY=v+warp+.006*Math.sin(u*12+phase)+.003*Math.sin(u*29+phase);
    const rings=Math.hypot((u-centerX)*.8,v-centerY);
    const streak=end ? .045*Math.sin(rings*230+phase)
      : .046*Math.sin(grainY*420+phase)+.023*Math.sin(grainY*913+u*9);
    const shade=.98+streak-(end?0:knotShade)+(random()-.5)*.025;
    const at=(y*width+x)*4;
    pixels[at]=235*shade;pixels[at+1]=230*shade;pixels[at+2]=219*shade;pixels[at+3]=128;
  }
  return {width,height,pixels};
}

export function installFloorWood(renderer) {
  const gl=renderer.gl;
  for(const base of [GRAIN,END]) for(let variant=0;variant<VARIANTS;variant++) {
    const name=base+"-"+variant;
    if(renderer.textures[name]) continue;
    const {width,height,pixels}=floorWoodTexture(name);
    const texture=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    renderer.textures[name]=texture;
  }
}

export function woodFinish(build,measurements) {
  const out={...build,buckets:{},ORDER:[],tags:{}};
  const inside=(point,b)=>["x","y","z"].every((axis,i)=>point[i]>=b[axis+"0Ft"]-1e-7 && point[i]<=b[axis+"1Ft"]+1e-7);
  const treatedTint=hexRGB("#938469").map(srgbLin);
  const wallTint=hexRGB("#d6c4a2").map(srgbLin); // Appearance only; wall treatment is unspecified.
  for(const key of build.ORDER) {
    const bucket=build.buckets[key], tags=build.tags[key] || [];
    if(!tags.some(tag=>["skids","floor-frame"].includes(tag.part) || (tag.part==="window-header" && measurements.header) || (tag.part==="wall-frame" && measurements.wall) || (tag.part==="gable-frame" && measurements.gable) || (["roof-frame","gable-backing","gable-window-frame"].includes(tag.part) && measurements.truss))) {
      out.buckets[key]=bucket; out.ORDER.push(key); out.tags[key]=tags; continue;
    }
    for(const tag of tags) for(let t=tag.from;t<tag.from+tag.count;t++) {
      const vertices=bucket.v.slice(t*27,t*27+27);
      const points=[vertices.slice(0,3),vertices.slice(9,12),vertices.slice(18,21)];
      // At a butt joint both boards contain the shared face. Its outward
      // normal identifies which board owns it, so end grain stays correct.
      const normal=vertices.slice(3,6),center=points[0].map((_,i)=>points.reduce((sum,p)=>sum+p[i]/3,0));
      const records=tag.part==="floor-frame"?measurements.frame.members:tag.part==="wall-frame"?measurements.wall?.members
        :tag.part==="gable-frame" && measurements.gable?[measurements.gable.board]:null;
      const prismRecords=tag.part==="window-header"?measurements.header?.members:tag.part==="gable-window-frame"?measurements.truss?.windowMembers:tag.part==="gable-backing"?measurements.truss?.backingMembers:tag.part==="roof-frame"?measurements.truss?.trussMembers:tag.part==="gable-frame"?measurements.truss?.studMembers:null;
      const prism=prismRecords?.find(record=>record.poly && points.every(p=>inside(p,record.bounds) && inPrism(p,record))
        && inPrism(center.map((v,i)=>v-normal[i]*1e-5),record)
        && !inPrism(center.map((v,i)=>v+normal[i]*1e-5),record)) || null;
      const member=prism || records?.find(record=>
        points.every(p=>inside(p,record.bounds)) && ["x","y","z"].some((axis,i)=>
          Math.abs(normal[i])>.9 && Math.abs(center[i]-record.bounds[axis+(normal[i]>0?"1Ft":"0Ft")])<1e-7)) || null;
      const vertical=tag.part==="wall-frame" && member && Math.abs(member.p1[1]-member.p0[1])>Math.max(Math.abs(member.p1[0]-member.p0[0]),Math.abs(member.p1[2]-member.p0[2]));
      const axis=vertical?1:member && Math.abs(member.p1[0]-member.p0[0])>Math.abs(member.p1[2]-member.p0[2])?0:2;
      const crossAxis=axis===0?2:0;
      const end=prism?Math.abs(dot(normal,prism.grainAxis))>.65:Math.abs(vertices[3+axis])>.65;
      const run=tag.part==="skids"?measurements.supports.runs.find(run=>points.every(p=>p[0]>=run.x0Ft-1e-7 && p[0]<=run.x1Ft+1e-7)):null;
      const identity=member?(tag.part==="wall-frame"?"wall:":tag.part==="gable-frame"?"gable:":tag.part==="roof-frame"?"truss:":"")+member.member.kind+":"+member.center.map(v=>v.toFixed(6)).join(":")
        :"skid:"+(run?.xFt ?? points[0][0]).toFixed(6);
      const hash=boardHash(identity),random=mulberry32(hash);
      const variant=hash%VARIANTS,seed=random(),crossSeed=random();
      const lengthScale=.86+random()*.28,crossScale=.8+random()*.4;
      const texture=(end?END:GRAIN)+"-"+variant;
      const length=member?.lengthFt || run?.lengthFt || 4;
      for(let i=0;i<27;i+=9) {
        if(prism) {
          const point=vertices.slice(i,i+3),grain=prism.grainAxis,across=[-grain[1],grain[0],0];
          vertices[i+6]=end?dot(point,across)/.65+seed:dot(point,grain)/length*lengthScale+seed;
          vertices[i+7]=(end || Math.abs(normal[2])<.65 ? point[2] : dot(point,across))/.65*crossScale+crossSeed;
        } else if(end) {
          vertices[i+6]=vertices[i+crossAxis]/.65+seed;
          vertices[i+7]=vertices[i+(vertical?2:1)]/.65+crossSeed;
        } else {
          vertices[i+6]=vertices[i+axis]/length*lengthScale+seed;
          vertices[i+7]=(vertical ? vertices[i+(Math.abs(vertices[i+3])>.65?2:0)]
            : Math.abs(vertices[i+4])>.65?vertices[i+crossAxis]:vertices[i+1])/.65*crossScale+crossSeed;
        }
      }
      const nextKey=key+"-"+texture+"-"+hash;
      if(!out.buckets[nextKey]) {
        const treated=tag.part==="skids" || (tag.part==="floor-frame" && measurements.frame.treated===true);
        const tint=["wall-frame","gable-frame","window-header"].includes(tag.part) || (["roof-frame","gable-backing","gable-window-frame"].includes(tag.part) && measurements.truss)?wallTint:treated?treatedTint:bucket.tint;
        const tone=.95+random()*.1;
        out.buckets[nextKey]={...bucket,tex:texture,tint:tint.map(v=>Math.min(1,v*tone)),bump:0,v:[],n:0};
        out.ORDER.push(nextKey); out.tags[nextKey]=[];
      }
      const next=out.buckets[nextKey], segments=out.tags[nextKey], last=segments[segments.length-1];
      const from=next.n/3;
      if(last && last.part===tag.part && last.from+last.count===from) last.count++;
      else segments.push({part:tag.part,from,count:1});
      next.v.push(...vertices); next.n+=3;
    }
  }
  return out;
}
