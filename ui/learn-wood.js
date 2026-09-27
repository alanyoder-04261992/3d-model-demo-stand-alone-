/* A quiet lumber finish for this lesson only. It changes surface pictures,
   colour and UVs, never timber vertices, normals or construction stages. */
import { hexRGB, srgbLin } from "../engine/math.js";
import { mulberry32 } from "../engine/seeded.js";

const GRAIN="lessonWoodGrain", END="lessonWoodEnd";

export function installFloorWood(renderer) {
  const gl=renderer.gl;
  for(const [name,end] of [[GRAIN,false],[END,true]]) {
    if(renderer.textures[name]) continue;
    const canvas=document.createElement("canvas");
    canvas.width=512; canvas.height=256;
    const ctx=canvas.getContext("2d"), random=mulberry32(end?912:417);
    ctx.fillStyle="#ebe7de"; ctx.fillRect(0,0,512,256);
    if(end) {
      for(let r=6;r<380;r+=3+random()*5) {
        ctx.strokeStyle=`rgba(74,60,39,${.08+random()*.13})`;
        ctx.lineWidth=.6+random()*.7;
        ctx.beginPath(); ctx.ellipse(236,136,r,r*.69,.06,0,Math.PI*2); ctx.stroke();
      }
    } else {
      const knots=[{x:92,y:60},{x:288,y:133},{x:434,y:205}];
      for(let i=0;i<215;i++) {
        const y=random()*256, amp=.5+random()*2, phase=random()*Math.PI*2;
        ctx.strokeStyle=`rgba(70,54,31,${.1+random()*.2})`;
        ctx.lineWidth=.35+random()*.7; ctx.beginPath();
        for(let x=0;x<=512;x+=4) {
          let yy=y+amp*Math.sin(x/512*Math.PI*2+phase);
          for(const knot of knots) {
            const dy=y-knot.y, dx=x-knot.x;
            yy+=Math.sign(dy)*Math.max(0,17-Math.abs(dy))*Math.exp(-dx*dx/950);
          }
          if(x===0) ctx.moveTo(x,yy); else ctx.lineTo(x,yy);
        }
        ctx.stroke();
      }
      for(const knot of knots) {
        for(let r=16;r>2;r-=1.7) {
          ctx.strokeStyle=`rgba(67,49,28,${.22+(16-r)*.012})`;
          ctx.lineWidth=.75; ctx.beginPath();
          ctx.ellipse(knot.x,knot.y,r*1.3,r*.7,.1,0,Math.PI*2); ctx.stroke();
        }
        ctx.fillStyle="rgba(65,47,27,.65)"; ctx.beginPath();
        ctx.ellipse(knot.x,knot.y,3.2,1.8,.1,0,Math.PI*2); ctx.fill();
      }
    }
    for(let i=0;i<5000;i++) {
      ctx.fillStyle=`rgba(75,61,41,${random()*.05})`;
      ctx.fillRect(random()*512,random()*256,1,1);
    }
    // Height is neutral; the finish is colour detail without bumpy edges.
    const pixels=ctx.getImageData(0,0,512,256);
    for(let i=3;i<pixels.data.length;i+=4) pixels.data[i]=128;
    const texture=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,512,256,0,gl.RGBA,gl.UNSIGNED_BYTE,pixels.data);
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
  for(const key of build.ORDER) {
    const bucket=build.buckets[key], tags=build.tags[key] || [];
    if(!tags.some(tag=>["skids","floor-frame"].includes(tag.part))) {
      out.buckets[key]=bucket; out.ORDER.push(key); out.tags[key]=tags; continue;
    }
    for(const tag of tags) for(let t=tag.from;t<tag.from+tag.count;t++) {
      const vertices=bucket.v.slice(t*27,t*27+27);
      const points=[vertices.slice(0,3),vertices.slice(9,12),vertices.slice(18,21)];
      const member=tag.part==="floor-frame"?measurements.frame.members.find(record=>points.every(p=>inside(p,record.bounds))):null;
      const axis=member && Math.abs(member.p1[0]-member.p0[0])>Math.abs(member.p1[2]-member.p0[2])?0:2;
      const crossAxis=axis===0?2:0;
      const end=Math.abs(vertices[3+axis])>.65;
      const texture=end?END:GRAIN;
      const seed=member?member.center[crossAxis]*.39:points[0][0]*.31;
      for(let i=0;i<27;i+=9) {
        if(end) {
          vertices[i+6]=vertices[i+crossAxis]/.65+seed;
          vertices[i+7]=vertices[i+1]/.65;
        } else {
          vertices[i+6]=vertices[i+axis]/4+seed;
          vertices[i+7]=(Math.abs(vertices[i+4])>.65?vertices[i+crossAxis]:vertices[i+1])/.65+seed;
        }
      }
      const nextKey=key+"-"+texture;
      if(!out.buckets[nextKey]) {
        out.buckets[nextKey]={...bucket,tex:texture,tint:tag.part==="skids"?treatedTint:bucket.tint,bump:0,v:[],n:0};
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
