/* THE SUMS THE 3D PICTURE IS MADE OF: arrows in space (vectors), the grids
   of sixteen numbers that turn a point in the yard into a point on the screen
   (matrices), and the colour conversion every paint colour goes through.
   Node-safe: plain maths, no DOM, no WebGL.

   Every function here is lifted from Barnwright's 3ddesign.html with its
   arithmetic untouched, character for character, because the golden test
   compares the drawing number for number and the smallest change in the order
   of a multiplication moves the last digit:
     norm3 sub3 cross3 dot3 hexRGB  -- lines 1515-1519
     matMul matPersp matOrtho matLook -- lines 2061-2067
     srgbLin tintShade shade2       -- lines 2429, 2434-2435

   Two things worth knowing:
   * hexRGB gives screen colour 0..1 (NOT linear). srgbLin turns it into the
     linear light the shader works in (the ^2.2 every paint colour gets).
   * The matrices are column-major Float32Arrays, the order WebGL wants.
     matMul(a,b) is a times b, so view-projection = matMul(persp, view). */

export function norm3(v){var l=Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2])||1;return [v[0]/l,v[1]/l,v[2]/l];}
export function sub3(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
export function cross3(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
export function dot3(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
export function hexRGB(h){return [parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255];}

/* sRGB paint colour -> linear light, the way Barnwright's mat() does it. */
export function srgbLin(v){return Math.pow(v,2.2);}
/* A hex colour darkened (m < 1) or lightened (m > 1) in linear light, as a tint. */
export function tintShade(hex,m){var c=hexRGB(hex);return [srgbLin(c[0])*m,srgbLin(c[1])*m,srgbLin(c[2])*m];}
/* A hex colour scaled in screen colour, back out as a hex string. */
export function shade2(hex,m){var c=hexRGB(hex);function h(v){v=Math.round(v*m*255);v=Math.max(0,Math.min(255,v));return (v<16?"0":"")+v.toString(16);}return "#"+h(c[0])+h(c[1])+h(c[2]);}

/* ---------- matrices (column-major, as WebGL reads them) ---------- */
export function matMul(a,b){var o=new Float32Array(16);
  for(var r=0;r<4;r++)for(var c=0;c<4;c++){var v=0;for(var k=0;k<4;k++)v+=a[k*4+c]*b[r*4+k];o[r*4+c]=v;}return o;}
export function matPersp(fov,asp,n,f){var t=1/Math.tan(fov/2);
  return new Float32Array([t/asp,0,0,0, 0,t,0,0, 0,0,(f+n)/(n-f),-1, 0,0,2*f*n/(n-f),0]);}
export function matOrtho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0, 0,2/(t-b),0,0, 0,0,-2/(f-n),0, -(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]);}
export function matLook(eye,tgt,up){var z=norm3(sub3(eye,tgt)),x=norm3(cross3(up,z)),y=cross3(z,x);
  return new Float32Array([x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
    -dot3(x,eye),-dot3(y,eye),-dot3(z,eye),1]);}
