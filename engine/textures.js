/* THE ELEVEN SURFACE PICTURES (textures), painted in the browser when the
   designer opens: the grain of the LP siding, the ribs and screws of a metal
   panel, the trim board, the lawn, the channel map the glass shader reads,
   the roof pan, the ridge cap and three soft shadows. Browser file: it paints
   on 2D canvases and uploads the result to the graphics card.

   createTextures(gl, { randFor }) -> { siding: <texture>, metal: ..., ... }
     keyed by the names in engine/tex-names.js. All eleven are made at once,
     in Barnwright's order, before anything is drawn.

   THE PAINTERS ARE BARNWRIGHT'S, COPIED BYTE FOR BYTE (3ddesign.html
   1714-2058) between the BEGIN/END markers below -- the look depends on every
   number in them, and tools/check-shaders.mjs compares the text against
   Barnwright's file. The only edits allowed, and the only ones made:
     * every Math.random() is rand()  (127 of them);
     * mkTex gained ONE line, at its very start, that picks what rand is for
       this texture;
     * the code sits inside createTextures (so each WebGL context gets its own
       set) instead of at the top of the page, and gl / extAniso are that
       function's own.
   The painters are left at the left margin on purpose, so the text stays
   identical to Barnwright's line for line.

   RANDOMNESS. The painters scatter grain, pits, clouds and grass blades at
   random, so every page load paints slightly different (but equally good)
   pictures -- exactly like Barnwright. Normal use leaves randFor out and rand
   is plain Math.random. A test that needs identical pictures passes
     randFor: (i) => mulberry32(textureSeed(i))     (engine/seeded.js)
   or simply { seeded: true }, and rand restarts at the ENTRY of the i-th
   mkTex call (i = 0 siding ... 10 corner shadow, tex-names.js TEX_ORDER).
   `rand` is accepted as another name for randFor.
   Checked by reading Barnwright's file (Sep 2026): EVERY random call happens
   inside one mkTex call and nowhere else --
     * mkTex runs painter(), then hpaint() if there is one, synchronously; the
       only randomness is in those two functions, so painter and relief draw
       one after the other from the same restarted stream;
     * grain() (1748) calls random but is only ever called from inside the
       siding and trim painters; wrapBlob() lives inside the grass painter;
     * mkTex is only called by the eleven `var texX=mkTex(...)` lines, and no
       random call sits between them;
     * nothing else in Barnwright's page calls Math.random at all.
   So "restart at the entry of the i-th mkTex call" gives one fixed stream per
   texture, and the golden capture seeds Barnwright's own painters the same
   way (it restarts Math.random when mkTex creates its first canvas). */

import * as TN from "./tex-names.js";
import { mulberry32, textureSeed } from "./seeded.js";

export function createTextures(gl, opts){
opts=opts||{};
var randFor0=opts.randFor||opts.rand||(opts.seeded?function(i){return mulberry32(textureSeed(i));}:null);
/* randFor (or rand) is a MAKER of generators, called once per texture with its
   number -- not a generator itself. Handing over a generator by mistake would
   otherwise surface as "rand is not a function" deep inside a painter. */
var randFor=randFor0&&function(i){var g=randFor0(i);if(typeof g!=="function")throw new Error("createTextures: randFor (or rand) must be a function of the texture number that RETURNS a generator, e.g. (i) => mulberry32(textureSeed(i)) -- not a generator itself");return g;};
var rand=Math.random, texIndex=0;
var extAniso=gl.getExtension("EXT_texture_filter_anisotropic")||gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic")||gl.getExtension("MOZ_EXT_texture_filter_anisotropic");
/* ==== BEGIN mkTex (Barnwright 3ddesign.html 1714-1747; one line added) ==== */
/* painter draws the color; hpaint (optional) draws a grayscale relief map whose red
   channel is packed into the texture's alpha, where the shader reads it as height. */
function mkTex(painter,size,norm,hpaint){
  rand=randFor?randFor(texIndex++):Math.random;   /* ADDED: restart the test randomness for this texture (see the note at the top) */
  var c=document.createElement("canvas");c.width=size;c.height=size;
  var x=c.getContext("2d");painter(x,size);
  var im=x.getImageData(0,0,size,size), d=im.data;
  if(norm){
    var sum=0, n=d.length/4;
    for(var i=0;i<d.length;i+=4) sum+=(d[i]+d[i+1]+d[i+2])/3;
    var k=249/(sum/n);
    for(var j=0;j<d.length;j+=4){
      d[j]=Math.min(255,d[j]*k); d[j+1]=Math.min(255,d[j+1]*k); d[j+2]=Math.min(255,d[j+2]*k);
    }
  }
  if(hpaint){
    var hc=document.createElement("canvas");hc.width=size;hc.height=size;
    var hx=hc.getContext("2d");
    hx.fillStyle="#808080";hx.fillRect(0,0,size,size);
    hpaint(hx,size);
    var hd=hx.getImageData(0,0,size,size).data;
    for(var q=0;q<d.length;q+=4) d[q+3]=hd[q];
  }
  var t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  if(extAniso){ /* keeps grass and siding sharp at grazing angles */
    try{ gl.texParameterf(gl.TEXTURE_2D,extAniso.TEXTURE_MAX_ANISOTROPY_EXT,
      Math.min(8,gl.getParameter(extAniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)||1)); }catch(e){}
  }
  gl.generateMipmap(gl.TEXTURE_2D);
  return t;
}
/* ==== END mkTex ==== */
/* ==== BEGIN PAINTERS (Barnwright 3ddesign.html 1748-2058; Math.random() -> rand() only) ==== */
function grain(x,s,n,a){for(var i=0;i<n;i++){var gx=rand()*s;var w=1+rand()*2;
  x.fillStyle="rgba(0,0,0,"+(rand()*a)+")";x.fillRect(gx,0,w,s);}}
var texSiding=mkTex(function(x,s){ /* one tile = one 8-inch board, rough-sawn LP panel */
  x.fillStyle="#ececec";x.fillRect(0,0,s,s);
  for(var b=0;b<130;b++){ /* broad vertical tone bands */
    x.fillStyle="rgba(0,0,0,"+(0.02+rand()*0.06)+")";
    x.fillRect(rand()*s,0,4+rand()*18,s);}
  for(var wb=0;wb<90;wb++){
    x.fillStyle="rgba(255,255,255,"+(0.03+rand()*0.08)+")";
    x.fillRect(rand()*s,0,3+rand()*12,s);}
  for(var g1=0;g1<220;g1++){ /* long grain lines running full height */
    x.fillStyle="rgba(0,0,0,"+(0.02+rand()*0.05)+")";
    x.fillRect(rand()*s,0,0.8+rand()*1.6,s);}
  for(var i=0;i<5200;i++){ /* knurled saw marks */
    x.fillStyle="rgba(0,0,0,"+(0.04+rand()*0.11)+")";
    x.fillRect(rand()*s,rand()*s,1.2+rand()*2.4,4+rand()*26);}
  for(var i2=0;i2<3000;i2++){
    x.fillStyle="rgba(255,255,255,"+(0.05+rand()*0.12)+")";
    x.fillRect(rand()*s,rand()*s,1+rand()*1.8,3+rand()*15);}
  for(var p=0;p<340;p++){ /* pits */
    x.fillStyle="rgba(0,0,0,"+(0.08+rand()*0.12)+")";
    x.fillRect(rand()*s,rand()*s,2+rand()*4,2+rand()*7);}
  grain(x,s,30,0.06);
  x.fillStyle="rgba(255,255,255,0.05)";x.fillRect(0,0,s,s*0.5);
  var gr=x.createLinearGradient(0,0,s*0.048,0);                 /* groove shadow, soft exit */
  gr.addColorStop(0,"rgba(0,0,0,0.44)");gr.addColorStop(0.45,"rgba(0,0,0,0.22)");gr.addColorStop(1,"rgba(0,0,0,0)");
  x.fillStyle=gr;x.fillRect(0,0,s*0.048,s);
  x.fillStyle="rgba(0,0,0,0.30)";x.fillRect(0,0,s*0.016,s);
  x.fillStyle="rgba(255,255,255,0.16)";x.fillRect(s*0.048,0,s*0.012,s); /* sun-caught shoulder */
  x.fillStyle="rgba(0,0,0,0.07)";x.fillRect(s-s*0.016,0,s*0.016,s);
},1024,true,function(h,s){ /* relief: crisp kerf at the tile seam + wood grain, face stays flat */
  h.fillStyle="#8c8c8c";h.fillRect(0,0,s,s);
  for(var i=0;i<800;i++){
    h.fillStyle=(rand()<0.5)?"rgba(255,255,255,"+(0.04+rand()*0.07)+")":"rgba(0,0,0,"+(0.04+rand()*0.07)+")";
    h.fillRect(rand()*s,rand()*s,1.5+rand()*2.5,8+rand()*42);}
  var cg=h.createLinearGradient(0,0,s,0);                       /* barely-there crown across the board */
  cg.addColorStop(0,"rgba(0,0,0,0.08)");cg.addColorStop(0.30,"rgba(255,255,255,0.03)");
  cg.addColorStop(0.70,"rgba(255,255,255,0.03)");cg.addColorStop(1,"rgba(0,0,0,0.06)");
  h.fillStyle=cg;h.fillRect(0,0,s,s);
  var gg=h.createLinearGradient(0,0,s*0.030,0);                 /* kerf wall rising out of the groove */
  gg.addColorStop(0,"rgba(0,0,0,0.88)");gg.addColorStop(0.5,"rgba(0,0,0,0.40)");gg.addColorStop(1,"rgba(0,0,0,0)");
  h.fillStyle=gg;h.fillRect(0,0,s*0.030,s);
  var ggr=h.createLinearGradient(s-s*0.012,0,s,0);              /* kerf wall dropping in on the far side */
  ggr.addColorStop(0,"rgba(0,0,0,0)");ggr.addColorStop(1,"rgba(0,0,0,0.75)");
  h.fillStyle=ggr;h.fillRect(s-s*0.012,0,s*0.012,s);
});
var texMetal=mkTex(function(x,s){ /* one tile = one 9-inch panel: major rib + two flutes + screws */
  var g=x.createLinearGradient(0,0,s,0);
  g.addColorStop(0,"#cdd0d2");g.addColorStop(0.16,"#e6e8ea");g.addColorStop(0.38,"#eff1f2");
  g.addColorStop(0.60,"#e3e6e8");g.addColorStop(0.84,"#edeff0");g.addColorStop(1,"#d0d3d5");
  x.fillStyle=g;x.fillRect(0,0,s,s);
  for(var i=0;i<300;i++){ /* brushed streaks running down the slope */
    x.fillStyle="rgba(255,255,255,"+(rand()*0.05)+")";
    x.fillRect(rand()*s,0,1,s);}
  for(var d2=0;d2<170;d2++){
    x.fillStyle="rgba(60,66,72,"+(rand()*0.04)+")";
    x.fillRect(rand()*s,0,1,s);}
  /* major rib: shade both walls, light the crest */
  var RW=s*0.165;
  x.fillStyle="rgba(52,58,64,0.34)";x.fillRect(0,0,s*0.028,s);
  var rc=x.createLinearGradient(s*0.028,0,RW*0.52,0);
  rc.addColorStop(0,"rgba(255,255,255,0.55)");rc.addColorStop(1,"rgba(255,255,255,0.18)");
  x.fillStyle=rc;x.fillRect(s*0.028,0,RW*0.52-s*0.028,s);
  var rs=x.createLinearGradient(RW*0.52,0,RW,0);
  rs.addColorStop(0,"rgba(52,58,64,0.10)");rs.addColorStop(0.8,"rgba(52,58,64,0.38)");rs.addColorStop(1,"rgba(52,58,64,0.16)");
  x.fillStyle=rs;x.fillRect(RW*0.52,0,RW*0.48,s);
  x.fillStyle="rgba(40,46,52,0.20)";x.fillRect(RW,0,s*0.012,s); /* shadow at rib base */
  /* two shallow stiffener flutes in the pan */
  [0.42,0.72].forEach(function(fx2){
    var fx=s*fx2;
    x.fillStyle="rgba(255,255,255,0.30)";x.fillRect(fx-s*0.016,0,s*0.016,s);
    x.fillStyle="rgba(52,58,64,0.18)";x.fillRect(fx,0,s*0.016,s);
  });
  /* screw heads with neoprene washers, one row per 3-ft tile */
  [[0.29,0.50],[0.88,0.50]].forEach(function(sc){
    var sx=s*sc[0], sy=s*sc[1];
    x.fillStyle="rgba(30,34,38,0.45)";
    x.beginPath();x.arc(sx+s*0.004,sy+s*0.006,s*0.0155,0,7);x.fill(); /* drop shadow */
    x.fillStyle="#8d9296";
    x.beginPath();x.arc(sx,sy,s*0.014,0,7);x.fill();
    x.fillStyle="#c9cdd0";
    x.beginPath();x.arc(sx-s*0.003,sy-s*0.004,s*0.008,0,7);x.fill(); /* glint */
  });
},512,false,function(h,s){ /* relief: trapezoid rib, flutes, screw bumps, oil-canning */
  h.fillStyle="#6e6e6e";h.fillRect(0,0,s,s);
  var RW=s*0.165;
  var up=h.createLinearGradient(0,0,s*0.045,0);
  up.addColorStop(0,"#6e6e6e");up.addColorStop(1,"#ffffff");
  h.fillStyle=up;h.fillRect(0,0,s*0.045,s);
  h.fillStyle="#ffffff";h.fillRect(s*0.045,0,RW*0.55-s*0.045,s); /* crest plateau */
  var dn=h.createLinearGradient(RW*0.55,0,RW,0);
  dn.addColorStop(0,"#ffffff");dn.addColorStop(1,"#6e6e6e");
  h.fillStyle=dn;h.fillRect(RW*0.55,0,RW*0.45,s);
  [0.42,0.72].forEach(function(fx2){ /* flutes: gentle ridges */
    var fx=s*fx2;
    h.fillStyle="rgba(255,255,255,0.16)";h.fillRect(fx-s*0.024,0,s*0.048,s);
    h.fillStyle="rgba(255,255,255,0.22)";h.fillRect(fx-s*0.012,0,s*0.024,s);
  });
  for(var oc=0;oc<9;oc++){ /* oil-canning: broad soft dents in the pan */
    var ox=RW+rand()*(s-RW), oy=rand()*s, orr=s*(0.10+rand()*0.16);
    var og=h.createRadialGradient(ox,oy,0,ox,oy,orr);
    var dark=rand()<0.5;
    og.addColorStop(0,dark?"rgba(0,0,0,0.10)":"rgba(255,255,255,0.10)");
    og.addColorStop(1,"rgba(0,0,0,0)");
    h.fillStyle=og;h.fillRect(ox-orr,oy-orr,orr*2,orr*2);
  }
  [[0.29,0.50],[0.88,0.50]].forEach(function(sc){ /* screw domes */
    var sx=s*sc[0], sy=s*sc[1];
    h.fillStyle="#d8d8d8";h.beginPath();h.arc(sx,sy,s*0.013,0,7);h.fill();
  });
});
var texTrim=mkTex(function(x,s){
  x.fillStyle="#f7f7f7";x.fillRect(0,0,s,s);
  for(var i=0;i<900;i++){x.fillStyle="rgba(0,0,0,"+(rand()*0.035)+")";
    x.fillRect(rand()*s,rand()*s,1.3,3+rand()*10);}
  for(var h2=0;h2<520;h2++){x.fillStyle="rgba(0,0,0,"+(rand()*0.025)+")";
    x.fillRect(rand()*s,rand()*s,3+rand()*9,1.2);}
  for(var w2=0;w2<420;w2++){x.fillStyle="rgba(255,255,255,"+(rand()*0.09)+")";
    x.fillRect(rand()*s,rand()*s,2+rand()*6,1.2);}
  grain(x,s,14,0.03);
},256,true,function(h,s){ /* painted wood: faint vertical grain under the paint */
  for(var i=0;i<420;i++){
    h.fillStyle=(rand()<0.5)?"rgba(255,255,255,"+(rand()*0.06)+")":"rgba(0,0,0,"+(rand()*0.06)+")";
    h.fillRect(rand()*s,rand()*s,1.4+rand()*2,6+rand()*22);}
});
var texFlat=mkTex(function(x,s){x.fillStyle="#f2f2f2";x.fillRect(0,0,s,s);
  for(var i=0;i<300;i++){x.fillStyle="rgba(0,0,0,"+(rand()*0.03)+")";
    x.fillRect(rand()*s,rand()*s,2,2);}},128,true);
var texGrass=mkTex(function(x,s){ /* one tile = 3 ft of lawn */
  /* A LAWN IN PORT CHARLOTTE. The old one was 9,000 identical blades over four
     soft green blobs, which at any distance averaged out to one flat colour --
     the felt-mat look. This one is built the way turf actually reads from
     fifteen feet: clumps first, then blades, then the dry straw that runs
     through every St Augustine yard down here by August. */
  x.fillStyle="#4e5f33";x.fillRect(0,0,s,s);
  function wrapBlob(px,py,pr,col,alpha){
    [[0,0],[-s,0],[s,0],[0,-s],[0,s],[-s,-s],[s,s],[-s,s],[s,-s]].forEach(function(o){
      var g=x.createRadialGradient(px+o[0],py+o[1],0,px+o[0],py+o[1],pr);
      g.addColorStop(0,col);g.addColorStop(0.55,col);g.addColorStop(1,"rgba(0,0,0,0)");
      x.globalAlpha=alpha;x.fillStyle=g;x.fillRect(px+o[0]-pr,py+o[1]-pr,pr*2,pr*2);x.globalAlpha=1;});
  }
  var clump=["#3d4d26","#5f7038","#4a5b2e","#6d8043","#33421e","#576a34","#728449","#2c3a19"];
  for(var c1=0;c1<90;c1++)                                   /* broad colour drift */
    wrapBlob(rand()*s,rand()*s,s*(0.05+rand()*0.15),clump[c1%8],0.42);
  for(var c2=0;c2<240;c2++)                                  /* tighter clumps -- this is the scale the eye reads as grass */
    wrapBlob(rand()*s,rand()*s,s*(0.010+rand()*0.040),clump[(c2*3)%8],0.46);
  for(var d1=0;d1<26;d1++)                                   /* straw and thatch */
    wrapBlob(rand()*s,rand()*s,s*(0.015+rand()*0.05),
      ["#8d8a5a","#9a9463","#7e7b50"][d1%3],0.16+rand()*0.14);
  var greens=["#243318","#2e3d20","#39492a","#455430","#526239","#1d2b12","#63744a","#3d4c2b","#6f8152"];
  for(var i=0;i<13000;i++){                                  /* blades, leaning every which way */
    x.fillStyle=greens[(rand()*greens.length)|0];
    x.globalAlpha=0.30+rand()*0.45;
    var a2=(rand()-0.5)*1.5, ca=Math.cos(a2), sa=Math.sin(a2);
    x.setTransform(ca,sa,-sa,ca,rand()*s,rand()*s);
    x.fillRect(0,0,0.9+rand()*0.9,2+rand()*6.5);
  }
  x.setTransform(1,0,0,1,0,0); x.globalAlpha=1;
  for(var dr=0;dr<1600;dr++){                                /* dry blades mixed through */
    x.fillStyle=["rgba(158,150,96,.55)","rgba(140,132,84,.5)","rgba(176,168,110,.45)"][dr%3];
    var a3=(rand()-0.5)*1.6, cb=Math.cos(a3), sb=Math.sin(a3);
    x.setTransform(cb,sb,-sb,cb,rand()*s,rand()*s);
    x.fillRect(0,0,0.9,2+rand()*5);
  }
  x.setTransform(1,0,0,1,0,0);
  for(var hl=0;hl<2600;hl++){                                /* tips catching the sun */
    x.fillStyle="rgba(186,196,116,"+(0.10+rand()*0.22)+")";
    x.fillRect(rand()*s,rand()*s,1,1.2+rand()*2.4);
  }
  x.globalCompositeOperation="multiply";                     /* shade down between the clumps */
  for(var sh2=0;sh2<230;sh2++)
    wrapBlob(rand()*s,rand()*s,s*(0.015+rand()*0.060),
      ["#7d8f66","#72855c","#88996f","#687b52"][sh2%4],0.20+rand()*0.26);
  x.globalCompositeOperation="source-over";
  /* the mower bands used to be painted in here, which tiled them every three
     feet -- a real pass of a mower is a yard wide. They are done in world
     space in the shader now. */
},512,false,function(h,s){ /* turf relief */
  for(var i=0;i<5000;i++){
    h.fillStyle=(rand()<0.5)?"rgba(255,255,255,"+(0.10+rand()*0.22)+")":"rgba(0,0,0,"+(0.10+rand()*0.22)+")";
    var a4=(rand()-0.5)*1.5, cc=Math.cos(a4), sc2=Math.sin(a4);
    h.setTransform(cc,sc2,-sc2,cc,rand()*s,rand()*s);
    h.fillRect(0,0,1+rand()*1.4,2+rand()*5);}
  h.setTransform(1,0,0,1,0,0);
});
var texGlass=mkTex(function(x,s){
  /* not a picture — a channel map the glass shader reads:
     R modulates the sky reflection (clouds), G the interior depth */
  var g=x.createLinearGradient(0,0,0,s);
  g.addColorStop(0,"rgb(230,40,0)");g.addColorStop(0.55,"rgb(190,32,0)");g.addColorStop(1,"rgb(150,24,0)");
  x.fillStyle=g;x.fillRect(0,0,s,s);
  for(var cl=0;cl<10;cl++){ /* cumulus drifting through the reflection */
    var cxp=rand()*s, cyp=s*(0.02+rand()*0.40), cr=s*(0.06+rand()*0.12);
    x.save();x.translate(cxp,cyp);x.scale(1.9,1);
    var cg=x.createRadialGradient(0,0,0,0,0,cr);
    cg.addColorStop(0,"rgba(255,0,0,"+(0.30+rand()*0.30)+")");
    cg.addColorStop(0.7,"rgba(255,0,0,"+(0.10+rand()*0.12)+")");
    cg.addColorStop(1,"rgba(255,0,0,0)");
    x.fillStyle=cg;x.fillRect(-cr,-cr,cr*2,cr*2);
    x.restore();
  }
  for(var iv=0;iv<8;iv++){ /* vague shapes inside: studs, shelves, stored things */
    x.fillStyle="rgba(0,"+(30+rand()*70|0)+",0,"+(0.25+rand()*0.3)+")";
    var ix=rand()*s, iw=s*(0.05+rand()*0.16), iy=s*(0.3+rand()*0.5);
    x.fillRect(ix,iy,iw,s-iy);
  }
  x.fillStyle="rgba(0,0,0,0.30)";x.fillRect(0,0,s*0.035,s);   /* frame contact shadow */
  x.fillStyle="rgba(0,0,0,0.30)";x.fillRect(s*0.965,0,s*0.035,s);
  x.fillStyle="rgba(0,0,0,0.34)";x.fillRect(0,0,s,s*0.04);
},256);
var texRoofMetal=mkTex(function(x,s){ /* roof pan between ribs: the ribs themselves are geometry */
  var g=x.createLinearGradient(0,0,s,0);
  g.addColorStop(0,"#c3c7ca");g.addColorStop(0.22,"#d3d6d8");g.addColorStop(0.5,"#c9cdd0");
  g.addColorStop(0.78,"#d1d4d6");g.addColorStop(1,"#c5c9cc");
  x.fillStyle=g;x.fillRect(0,0,s,s);
  for(var i=0;i<300;i++){ /* brushed streaks running down the slope */
    x.fillStyle="rgba(255,255,255,"+(rand()*0.05)+")";
    x.fillRect(rand()*s,0,1,s);}
  for(var d2=0;d2<170;d2++){
    x.fillStyle="rgba(60,66,72,"+(rand()*0.035)+")";
    x.fillRect(rand()*s,0,1,s);}
  var e1=x.createLinearGradient(0,0,s*0.14,0);                  /* broad soft shade next to each rib */
  e1.addColorStop(0,"rgba(52,58,64,0.34)");e1.addColorStop(0.4,"rgba(52,58,64,0.14)");e1.addColorStop(1,"rgba(52,58,64,0)");
  x.fillStyle=e1;x.fillRect(0,0,s*0.14,s);
  var e2=x.createLinearGradient(s,0,s-s*0.14,0);
  e2.addColorStop(0,"rgba(52,58,64,0.34)");e2.addColorStop(0.4,"rgba(52,58,64,0.14)");e2.addColorStop(1,"rgba(52,58,64,0)");
  x.fillStyle=e2;x.fillRect(s-s*0.14,0,s*0.14,s);
  [0.42,0.72].forEach(function(fx2){ /* two shallow stiffener flutes */
    var fx=s*fx2;
    x.fillStyle="rgba(255,255,255,0.28)";x.fillRect(fx-s*0.016,0,s*0.016,s);
    x.fillStyle="rgba(52,58,64,0.16)";x.fillRect(fx,0,s*0.016,s);
  });
  [[0.29,0.50],[0.88,0.50]].forEach(function(sc){ /* screws with washers, one row per 3-ft tile */
    var sx=s*sc[0], sy=s*sc[1];
    x.fillStyle="rgba(30,34,38,0.45)";
    x.beginPath();x.arc(sx+s*0.004,sy+s*0.006,s*0.0155,0,7);x.fill();
    x.fillStyle="#8d9296";x.beginPath();x.arc(sx,sy,s*0.014,0,7);x.fill();
    x.fillStyle="#c9cdd0";x.beginPath();x.arc(sx-s*0.003,sy-s*0.004,s*0.008,0,7);x.fill();
  });
},512,false,function(h,s){ /* relief: flutes, screw domes, oil-canning shimmer */
  h.fillStyle="#7a7a7a";h.fillRect(0,0,s,s);
  [0.42,0.72].forEach(function(fx2){
    var fx=s*fx2;
    h.fillStyle="rgba(255,255,255,0.14)";h.fillRect(fx-s*0.024,0,s*0.048,s);
    h.fillStyle="rgba(255,255,255,0.20)";h.fillRect(fx-s*0.012,0,s*0.024,s);
  });
  for(var oc=0;oc<7;oc++){
    var ox=rand()*s, oy=rand()*s, orr=s*(0.12+rand()*0.18);
    var og=h.createRadialGradient(ox,oy,0,ox,oy,orr);
    og.addColorStop(0,(rand()<0.5)?"rgba(0,0,0,0.08)":"rgba(255,255,255,0.08)");
    og.addColorStop(1,"rgba(0,0,0,0)");
    h.fillStyle=og;h.fillRect(ox-orr,oy-orr,orr*2,orr*2);
  }
  [[0.29,0.50],[0.88,0.50]].forEach(function(sc){
    h.fillStyle="#d4d4d4";h.beginPath();h.arc(s*sc[0],s*sc[1],s*0.013,0,7);h.fill();
  });
});
/* A RIDGE CAP IS A PLAIN BENT SHEET. It was being painted with the pan
   texture, which carries the two stiffener flutes, the dark shading that
   belongs beside a rib, and a painted screw every three feet -- so the cap
   came out fluted and seamed every nine inches, like a run of little panels
   laid end to end. A real one is smooth from gable to gable with nothing on
   it but the roll marks and the screws that hold it down, and those are real
   geometry here. */
var texRoofCap=mkTex(function(x,s){
  var g=x.createLinearGradient(0,0,s,0);                /* u runs across the cap: crown bright, edge falling off */
  g.addColorStop(0,"#d7dadc");g.addColorStop(0.30,"#d1d4d7");
  g.addColorStop(0.72,"#c7cbce");g.addColorStop(1,"#bfc3c7");
  x.fillStyle=g;x.fillRect(0,0,s,s);
  for(var i=0;i<200;i++){                               /* roll marks run the length of the ridge */
    x.fillStyle="rgba(255,255,255,"+(rand()*0.05)+")";
    x.fillRect(0,rand()*s,s,1);}
  for(var d2=0;d2<120;d2++){
    x.fillStyle="rgba(60,66,72,"+(rand()*0.032)+")";
    x.fillRect(0,rand()*s,s,1);}
},256,false,function(h,s){                              /* the faintest oil-canning, nothing more */
  h.fillStyle="#7d7d7d";h.fillRect(0,0,s,s);
  for(var oc=0;oc<5;oc++){
    var ox=rand()*s, oy=rand()*s, orr=s*(0.14+rand()*0.20);
    var og=h.createRadialGradient(ox,oy,0,ox,oy,orr);
    og.addColorStop(0,(rand()<0.5)?"rgba(0,0,0,0.06)":"rgba(255,255,255,0.06)");
    og.addColorStop(1,"rgba(0,0,0,0)");
    h.fillStyle=og;h.fillRect(ox-orr,oy-orr,orr*2,orr*2);
  }
});
var texAO=mkTex(function(x,s){ /* multiply decal: elliptical contact shadow, white at the rim */
  x.fillStyle="#ffffff";x.fillRect(0,0,s,s);
  var g=x.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  g.addColorStop(0,"#565656");g.addColorStop(0.38,"#6e6e6e");g.addColorStop(0.72,"#c9c9c9");g.addColorStop(1,"#ffffff");
  x.fillStyle=g;x.fillRect(0,0,s,s);
},256);
var texAOv=mkTex(function(x,s){ /* multiply decal: eave shadow, dark at v=0 fading out */
  var g=x.createLinearGradient(0,0,0,s);
  g.addColorStop(0,"#949494");g.addColorStop(0.45,"#d2d2d2");g.addColorStop(1,"#ffffff");
  x.fillStyle=g;x.fillRect(0,0,s,s);
},64);
/* The same idea for the corner boards, but much gentler.

   The eave shadow above can afford to be strong - it is a roof overhanging a
   wall, and in real light that IS dark. A corner board is a 1x trim board
   standing a fraction of an inch proud of the siding, so what it actually
   casts is a hairline, not the deep band the eave gradient was drawing on all
   four corners at once. Sharing one texture made every corner of the building
   look burnt.

   Starts at 78% brightness instead of 58%, and lifts to nothing sooner. */
var texAOcorner=mkTex(function(x,s){
  var g=x.createLinearGradient(0,0,0,s);
  g.addColorStop(0,"#c6c6c6");g.addColorStop(0.38,"#ececec");g.addColorStop(1,"#ffffff");
  x.fillStyle=g;x.fillRect(0,0,s,s);
},64);
/* ==== END PAINTERS ==== */
var out={};
out[TN.texSiding]=texSiding; out[TN.texMetal]=texMetal; out[TN.texTrim]=texTrim; out[TN.texFlat]=texFlat;
out[TN.texGrass]=texGrass; out[TN.texGlass]=texGlass; out[TN.texRoofMetal]=texRoofMetal; out[TN.texRoofCap]=texRoofCap;
out[TN.texAO]=texAO; out[TN.texAOv]=texAOv; out[TN.texAOcorner]=texAOcorner;
return out;
}
