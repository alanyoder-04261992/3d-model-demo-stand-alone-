/* GETTING A 3D DRAWING SURFACE FROM THE BROWSER (a WebGL context), and
   turning shader text into a working program. Browser file.

   createContext(canvas, { note }) -> { gl, off }
     Asks for WebGL with Barnwright's settings (3ddesign.html 1402-1427):
       antialias on; alpha ON -- the canvas is see-through and the CSS
       gradient behind it is the backdrop, so it must never clear to an
       opaque colour; preserveDrawingBuffer OFF -- which is why a snapshot
       must draw and read the picture in the same task (engine/snapshot.js).
     WHEN WEBGL IS BLOCKED (older phones, some in-app browsers) the page must
     not crash: the canvas is hidden, a short note goes in its place, and a
     harmless stand-in absorbs every drawing call, so the form, the live price
     and the Send button keep working. `off` is then true (Barnwright set
     window.__WEBGL_OFF; this hands the flag back instead of setting a global).

   mkShader / mkProg -- compile and link, throwing the driver's message on
     failure. mkProg takes the attribute slots to fix BEFORE linking
     ({aP:0, aN:1, aUV:2, aStage:3}), so the two programs (the picture and the
     shadow) read the same buffer layout from the same slots.

   The shader extension OES_standard_derivatives (the siding's relief) must be
   asked for BEFORE the fragment shader is compiled; the renderer does that. */

export var WEBGL_OFF_NOTE="3D preview isn’t available on this browser — you can still design and send your quote below.";

export function createContext(canvas, opts){
  opts=opts||{};
  var gl=canvas.getContext("webgl",{antialias:true,alpha:true,preserveDrawingBuffer:false});
  if(!gl) gl=canvas.getContext("experimental-webgl",{antialias:true,alpha:true,preserveDrawingBuffer:false});
  if(gl) return { gl:gl, off:false };
  /* H9: WebGL is blocked. Don't crash the page -- hide the 3D view and let a
     harmless stub absorb every gl.* call. */
  try{ canvas.style.display="none"; }catch(e){}
  try{ var _wkNote=document.createElement("div"); _wkNote.style.cssText="text-align:center;color:#8a97a3;font-size:13px;padding:22px 20px"; _wkNote.textContent=opts.note||WEBGL_OFF_NOTE; canvas.parentNode&&canvas.parentNode.insertBefore(_wkNote,canvas); }catch(e){}
  if(typeof Proxy!=="undefined"){
    var _glStub=new Proxy(function(){},{
      get:function(t,p){
        if(p===Symbol.toPrimitive)return function(){return 0;};
        if(p==="valueOf")return function(){return 0;};
        if(p==="toString"||p===Symbol.toStringTag)return function(){return "";};
        if(typeof p==="symbol")return undefined;
        return _glStub;
      },
      apply:function(){return _glStub;}
    });
    gl=_glStub;
  } else {
    gl={}; var _f=function(){return gl;};
    "createShader shaderSource compileShader getShaderParameter getShaderInfoLog createProgram attachShader linkProgram getProgramParameter getProgramInfoLog useProgram createBuffer bindBuffer bufferData enableVertexAttribArray vertexAttribPointer getAttribLocation getUniformLocation uniform1f uniform2f uniform3f uniform3fv uniform4f uniformMatrix4fv uniform1i createTexture bindTexture texImage2D texParameteri generateMipmap activeTexture createFramebuffer bindFramebuffer framebufferTexture2D renderbufferStorage bindRenderbuffer createRenderbuffer framebufferRenderbuffer viewport clearColor clear enable disable depthFunc blendFunc blendFuncSeparate drawArrays drawElements getExtension getParameter deleteProgram deleteShader deleteTexture deleteFramebuffer pixelStorei cullFace frontFace clearDepth depthMask colorMask polygonOffset lineWidth scissor readPixels".split(" ").forEach(function(n){ gl[n]=_f; });
    /* calls Barnwright's list missed (three it used itself, two this engine
       adds); without them a very old browser would throw here instead of
       carrying on without 3D */
    "checkFramebufferStatus texParameterf deleteBuffer bindAttribLocation uniform4fv".split(" ").forEach(function(n){ gl[n]=_f; });
  }
  return { gl:gl, off:true };
}

export function mkShader(gl,t,src){var sh=gl.createShader(t);gl.shaderSource(sh,src);gl.compileShader(sh);
  if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));return sh;}
export function mkProg(gl,vs,fs,attribs){var p=gl.createProgram();gl.attachShader(p,mkShader(gl,gl.VERTEX_SHADER,vs));
  gl.attachShader(p,mkShader(gl,gl.FRAGMENT_SHADER,fs));
  if(attribs)Object.keys(attribs).forEach(function(n){gl.bindAttribLocation(p,attribs[n],n);});
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
