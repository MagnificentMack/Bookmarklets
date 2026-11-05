(function(){
if(window.__fluid){window.__fluid.rerun();return}
var USE_SCREEN=true;
var FORCE=1;
var FRICTION=.15;
var VISC=0;
var VORT=8;
var G=window.__fluid={rerun:function(){},quit:function(){},stream:null,video:null};
var W=innerWidth,H=innerHeight,lastErr='',cur=null;
function pageBg(){var b=getComputedStyle(document.body).backgroundColor;if(!b||b==='rgba(0, 0, 0, 0)')b=getComputedStyle(document.documentElement).backgroundColor;if(!b||b==='rgba(0, 0, 0, 0)')b='#ffffff';return b}
function stopStream(){try{if(G.stream)G.stream.getTracks().forEach(function(t){t.stop()})}catch(e){}G.stream=null;G.video=null}
function fail(m){stopStream();if(window.__fluid===G)delete window.__fluid;alert('Fluid Page: '+m)}

async function liveVideo(){
var S=G.stream;
if(S&&S.getVideoTracks()[0]&&S.getVideoTracks()[0].readyState==='live')return G.video;
var dpr=window.devicePixelRatio||1;
var st=await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:'browser',width:{ideal:Math.round(innerWidth*dpr)},height:{ideal:Math.round(innerHeight*dpr)},frameRate:{ideal:30}},audio:false,preferCurrentTab:true,selfBrowserSurface:'include',surfaceSwitching:'exclude',monitorTypeSurfaces:'exclude'});
var v=document.createElement('video');v.muted=true;v.playsInline=true;v.srcObject=st;
await v.play();
st.getVideoTracks()[0].addEventListener('ended',function(){if(G.stream===st){G.stream=null;G.video=null}});
await new Promise(function(r){var d=false;function f(){if(!d){d=true;r()}}if(v.requestVideoFrameCallback)v.requestVideoFrameCallback(f);setTimeout(f,1200)});
G.stream=st;G.video=v;return v}
function grabFrame(v){
var vw=v.videoWidth,vh=v.videoHeight;if(!vw||!vh)return null;
var k=Math.min(1,2560/Math.max(vw,vh)),c=document.createElement('canvas');
c.width=Math.round(vw*k);c.height=Math.round(vh*k);
c.getContext('2d').drawImage(v,0,0,c.width,c.height);return c}
async function screenShot(){
if(!USE_SCREEN||!navigator.mediaDevices||!navigator.mediaDevices.getDisplayMedia)return null;
try{var c=grabFrame(await liveVideo());stopStream();return c}catch(e){stopStream();return null}}

function domCapture(){return new Promise(function(res){
var tried=false;
function rebuild(){if(tried)return;tried=true;try{domShot(function(c,err){lastErr=err||'';res(c)})}catch(e){lastErr=String(e);res(null)}}
var t=setTimeout(rebuild,4500);
function go(){html2canvas(document.documentElement,{x:scrollX,y:scrollY,width:W,height:H,scale:1,useCORS:true,logging:false,backgroundColor:pageBg()}).then(function(c){if(tried)return;tried=true;clearTimeout(t);res(c)},rebuild)}
try{
if(window.html2canvas)go();
else{var s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';s.onload=go;s.onerror=rebuild;document.head.appendChild(s)}
}catch(e){rebuild()}
})}

async function launch(){
W=innerWidth;H=innerHeight;
var shot=await screenShot();
if(!shot)shot=await domCapture();
if(!shot)return fail('could not capture this page'+(lastErr?' ('+lastErr+')':'')+'.');
start(shot)}
launch().catch(function(e){fail(String(e))});

function domShot(cb){
var done=false;
function fin(c,err){if(done)return;done=true;cb(c,err)}
var P='display,position,top,left,right,bottom,width,height,min-width,min-height,max-width,max-height,margin-top,margin-right,margin-bottom,margin-left,padding-top,padding-right,padding-bottom,padding-left,border-top-width,border-right-width,border-bottom-width,border-left-width,border-top-style,border-right-style,border-bottom-style,border-left-style,border-top-color,border-right-color,border-bottom-color,border-left-color,border-top-left-radius,border-top-right-radius,border-bottom-right-radius,border-bottom-left-radius,box-sizing,color,background-color,opacity,overflow-x,overflow-y,visibility,z-index,float,clear,font-family,font-size,font-weight,font-style,line-height,letter-spacing,word-spacing,text-align,text-transform,text-decoration-line,text-indent,text-overflow,white-space,word-break,overflow-wrap,vertical-align,flex-direction,flex-wrap,flex-grow,flex-shrink,flex-basis,align-items,align-self,align-content,justify-content,row-gap,column-gap,grid-template-columns,grid-template-rows,grid-column-start,grid-column-end,grid-row-start,grid-row-end,order,transform,transform-origin,box-shadow,text-shadow,list-style-type,list-style-position,object-fit,object-position,fill,stroke,background-clip,-webkit-background-clip,-webkit-text-fill-color,background-size,background-position-x,background-position-y,background-repeat,filter,mix-blend-mode'.split(',');
var SP='fill,stroke,stroke-width,stroke-linecap,stroke-linejoin,stroke-dasharray,opacity,fill-opacity,stroke-opacity,fill-rule,clip-rule,color,display,visibility,font-family,font-size,font-weight,text-anchor,stop-color,stop-opacity'.split(',');
var skip=/^(SCRIPT|STYLE|LINK|NOSCRIPT|TEMPLATE|META|HEAD|TITLE|BASE|SOURCE|TRACK)$/;
var bad=/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g;
var jobs=[],fams={},cache={},NS='http://www.w3.org/2000/svg';
function tmo(p,ms){return Promise.race([p,new Promise(function(r){setTimeout(function(){r(null)},ms)})])}
function sty(cs){var s='';for(var i=0;i<P.length;i++){var v=cs.getPropertyValue(P[i]);if(v)s+=P[i]+':'+v+';'}var bi=cs.backgroundImage;if(/gradient/.test(bi)&&!/url\(/.test(bi))s+='background-image:'+bi+';';fams[cs.fontFamily]=1;return s}
function ssty(cs){var s='';for(var i=0;i<SP.length;i++){var v=cs.getPropertyValue(SP[i]);if(v)s+=SP[i]+':'+v+';'}return s}
function pic(n,w,h){try{w=Math.max(1,Math.round(w));h=Math.max(1,Math.round(h));var c=document.createElement('canvas');c.width=w;c.height=h;var x=c.getContext('2d');var big=w*h>160000;if(big){x.fillStyle='#fff';x.fillRect(0,0,w,h)}x.drawImage(n,0,0,w,h);return c.toDataURL(big?'image/jpeg':'image/png',.85)}catch(e){return null}}
function remote(url,w,h){
if(/^data:/.test(url))return Promise.resolve(url);
var key=url+'|'+(w|0)+'x'+(h|0);
return cache[key]||(cache[key]=tmo(new Promise(function(res){
function size(i){var nw=i.naturalWidth||w||300,nh=i.naturalHeight||h||150;if(w&&h)return [w,h];var k=Math.min(1,1000/Math.max(nw,nh));return [nw*k,nh*k]}
function viaFetch(){fetch(url,{mode:'cors',cache:'reload',credentials:'omit'}).then(function(r){if(!r.ok)throw 0;return r.blob()}).then(function(b){var u=URL.createObjectURL(b),i=new Image();i.onload=function(){var z=size(i);res(pic(i,z[0],z[1]));URL.revokeObjectURL(u)};i.onerror=function(){res(null)};i.src=u}).catch(function(){res(null)})}
var i=new Image();i.crossOrigin='anonymous';
i.onload=function(){var z=size(i),d=pic(i,z[0],z[1]);d?res(d):viaFetch()};
i.onerror=viaFetch;
i.src=url}),7000))}
function svgc(o,d){
var tn=o.tagName.toLowerCase();
if(tn==='script'||tn==='style'||d>40)return null;
var c=o.cloneNode(false);
c.setAttribute('style',ssty(getComputedStyle(o)));
for(var k=o.firstChild;k;k=k.nextSibling){
if(k.nodeType===3)c.appendChild(document.createTextNode(k.nodeValue.replace(bad,'')));
else if(k.nodeType===1){var g=svgc(k,d+1);if(g)c.appendChild(g)}}
return c}
function pseudo(n,w,cs0){
var ps=getComputedStyle(n,w),ct=ps.content;
if(!ct||ct==='none'||ct==='normal'||/^(url|counter|attr)/.test(ct)||ps.display==='none')return null;
var m=/^"([\s\S]*)"$/.exec(ct)||/^'([\s\S]*)'$/.exec(ct);
if(!m)return null;
var e=document.createElement('span');
e.setAttribute('style',sty(ps));
if(m[1])e.appendChild(document.createTextNode(m[1].replace(/\\"/g,'"').replace(bad,'')));
return e}
function cp(n){try{return cp2(n)}catch(e){return null}}
function cp2(n){
if(n.nodeType===3)return document.createTextNode(n.nodeValue.replace(bad,''));
if(n.nodeType!==1||skip.test(n.tagName))return null;
var cs=getComputedStyle(n);
if(cs.display==='none')return null;
var r=n.getBoundingClientRect(),t=n.tagName.toLowerCase(),e,st=sty(cs);
if(cs.position==='sticky')st+='position:fixed;top:'+r.top+'px;left:'+r.left+'px;';
if(n instanceof SVGElement){
if(t!=='svg')return null;
e=svgc(n,0);if(!e)return null;
e.setAttribute('width',r.width);e.setAttribute('height',r.height);e.setAttribute('style',st+ssty(cs));return e}
try{e=document.createElement(t)}catch(x){e=document.createElement('div')}
var off=r.width>0&&r.height>0&&(r.bottom<0||r.top>H||r.right<0||r.left>W);
if(off){e.setAttribute('style',st);return e}
if(t==='img'){
var src=n.currentSrc||n.src,d=(n.complete&&n.naturalWidth)?pic(n,r.width,r.height):null;
e=document.createElement('img');e.setAttribute('style',st);
if(d)e.setAttribute('src',d);
else if(src)(function(e,st){jobs.push(remote(src,r.width,r.height).then(function(dd){if(dd)e.setAttribute('src',dd);else e.setAttribute('style',st+'background-color:rgba(128,128,128,.3);')}))})(e,st);
else e.setAttribute('style',st+'background-color:rgba(128,128,128,.3);');
return e}
if(t==='canvas'){
var cd=pic(n,r.width,r.height);
if(cd){e=document.createElement('img');e.setAttribute('src',cd);e.setAttribute('style',st)}
else{e=document.createElement('div');e.setAttribute('style',st+'background-color:rgba(128,128,128,.3);')}
return e}
if(t==='video'||t==='iframe'||t==='object'||t==='embed'){e=document.createElement('div');e.setAttribute('style',st+'background-color:rgba(128,128,128,.3);');return e}
e.setAttribute('style',st);
var bi=cs.backgroundImage,um=/url\(\s*["']?([^"')]+)["']?\s*\)/.exec(bi);
if(um&&!/gradient/.test(bi))(function(e){jobs.push(remote(new URL(um[1],location.href).href,0,0).then(function(dd){if(dd)e.setAttribute('style',e.getAttribute('style')+'background-image:url("'+dd+'");')}))})(e);
if(t==='input'){e.setAttribute('type',n.type||'text');e.setAttribute('value',n.value);if(n.checked)e.setAttribute('checked','checked');return e}
if(t==='textarea'){e.appendChild(document.createTextNode(n.value.replace(bad,'')));return e}
if(t==='select'){e=document.createElement('div');e.setAttribute('style',st);e.appendChild(document.createTextNode((n.selectedOptions[0]||{}).text||''));return e}
var b4=pseudo(n,'::before');if(b4)e.appendChild(b4);
for(var c=n.firstChild;c;c=c.nextSibling){var k=cp(c);if(k)e.appendChild(k)}
var af=pseudo(n,'::after');if(af)e.appendChild(af);
return e}

function b64(buf){var u=new Uint8Array(buf),s='';for(var i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s)}
function fonts(){
var fam={};
Object.keys(fams).forEach(function(k){k.split(',').forEach(function(f){f=f.trim().replace(/^["']|["']$/g,'').toLowerCase();if(f)fam[f]=1})});
var blocks=[],pend=[];
function add(txt,base){(txt.match(/@font-face\s*\{[^}]*\}/g)||[]).forEach(function(b){blocks.push([b,base])})}
function walk(rules,base){for(var i=0;i<rules.length;i++){var r=rules[i];if(r.type===5)blocks.push([r.cssText,base]);else if(r.type===3){try{walk(r.styleSheet.cssRules,r.styleSheet.href||base)}catch(e){}}else if(r.cssRules){try{walk(r.cssRules,base)}catch(e){}}}}
for(var i=0;i<document.styleSheets.length;i++){(function(ss){
var base=ss.href||location.href;
try{walk(ss.cssRules,base)}
catch(e){if(ss.href)pend.push(tmo(fetch(ss.href,{mode:'cors',credentials:'omit'}).then(function(r){return r.text()}).then(function(t){add(t,base)}).catch(function(){}),6000))}
})(document.styleSheets[i])}
return Promise.all(pend).then(function(){
var out=[],total=0,n=0;
blocks.forEach(function(bb){
var b=bb[0],base=bb[1];
var fm=/font-family\s*:\s*([^;]+)/.exec(b);if(!fm)return;
var raw=fm[1].trim(),nm=raw.replace(/^["']|["']$/g,'').toLowerCase();
if(!fam[nm]||n>=40)return;
var re=/url\(\s*["']?([^"')]+)["']?\s*\)(?:\s*format\(\s*["']?([^"')]+)["']?\s*\))?/g,m,best=null;
while((m=re.exec(b))){var f=(m[2]||'').toLowerCase();if(/eot|svg/.test(f))continue;if(!best||/woff2/.test(f))best=[m[1],f]}
if(!best)return;
n++;
var desc='';['font-weight','font-style','font-stretch','unicode-range'].forEach(function(p){var q=new RegExp(p+'\\s*:\\s*([^;]+)').exec(b);if(q)desc+=p+':'+q[1]+';'});
var u;try{u=new URL(best[0],base).href}catch(e){return}
out.push(tmo(fetch(u,{mode:'cors',credentials:'omit'}).then(function(r){if(!r.ok)throw 0;return r.arrayBuffer()}).then(function(buf){
total+=buf.byteLength;if(total>6000000)return '';
var f=best[1],mime=/woff2/.test(f)?'font/woff2':/woff/.test(f)?'font/woff':/open/.test(f)?'font/otf':'font/ttf';
return '@font-face{font-family:'+raw+';src:url(data:'+mime+';base64,'+b64(buf)+');'+desc+'}'}).catch(function(){return ''}),8000))});
return Promise.all(out).then(function(a){return a.filter(Boolean).join('\n')})})}

var root=cp(document.body||document.documentElement);
Promise.all([Promise.all(jobs),fonts().catch(function(){return ''})]).then(function(res){
var css=res[1]||'';
var wrap=document.createElement('div');
wrap.setAttribute('style','position:relative;width:'+W+'px;height:'+H+'px;overflow:hidden;background:'+pageBg());
if(css){var stl=document.createElement('style');stl.appendChild(document.createTextNode(css));wrap.appendChild(stl)}
var inner=document.createElement('div');
inner.setAttribute('style','position:absolute;left:'+(-scrollX)+'px;top:'+(-scrollY)+'px;width:'+W+'px');
if(root)inner.appendChild(root);
wrap.appendChild(inner);
var svg;
try{svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'"><foreignObject x="0" y="0" width="100%" height="100%">'+new XMLSerializer().serializeToString(wrap)+'</foreignObject></svg>'}catch(e){return fin(null,'serialize: '+e)}
var blobTried=false;
function ok(im){
try{var c=document.createElement('canvas');c.width=W;c.height=H;var x=c.getContext('2d');x.drawImage(im,0,0);
setTimeout(function(){try{x.clearRect(0,0,W,H);x.drawImage(im,0,0);x.getImageData(0,0,1,1);fin(c)}catch(e){fin(null,'tainted canvas')}},250)}
catch(e){fin(null,'draw failed')}}
var im=new Image();
im.onload=function(){ok(im)};
im.onerror=function(){
if(blobTried)return fin(null,'image blocked');
blobTried=true;
try{im.src=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}))}catch(e){fin(null,'blob: '+e)}};
im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)
}).catch(function(e){fin(null,String(e))})
}

function start(shot){
var CW=shot.width||W,CH=shot.height||H,busy=false;
var cv=document.createElement('canvas');cv.width=CW;cv.height=CH;
cv.style.cssText='position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:2147483646;touch-action:none;cursor:grab;background:#fff';
var gl=cv.getContext('webgl2',{alpha:false,antialias:false});
if(!gl)return fail('WebGL2 is not supported in this browser.');
if(!gl.getExtension('EXT_color_buffer_float')&&!gl.getExtension('EXT_color_buffer_half_float'))return fail('Float render targets unsupported.');
gl.getExtension('OES_texture_float_linear');
var SH=160,SW=Math.max(2,Math.round(SH*CW/CH));
var simTS=[1/SW,1/SH];
var vs='#version 300 es\nout vec2 v;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);v=p;gl_Position=vec4(p*2.-1.,0,1);}';
var pre='#version 300 es\nprecision highp float;in vec2 v;out vec4 o;';
function sh(t,src){var x=gl.createShader(t);gl.shaderSource(x,src);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(x);return x}
function prog(fs){var p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,pre+fs));gl.linkProgram(p);return p}
var P={
copy:prog('uniform sampler2D uT;void main(){o=vec4(texture(uT,v).rgb,1);}'),
mul:prog('uniform sampler2D uT;uniform float k;void main(){o=texture(uT,v)*k;}'),
advect:prog('uniform sampler2D uV,uS;uniform vec2 ts;uniform float dt,d;void main(){vec2 c=v-dt*texture(uV,v).xy*ts;o=texture(uS,c)/(1.+d*dt);o.a=1.;}'),
splat:prog('uniform sampler2D uT;uniform vec2 p;uniform vec3 c;uniform float r,ar;void main(){vec2 d=v-p;d.x*=ar;o=vec4(texture(uT,v).xyz+c*exp(-dot(d,d)/r),1);}'),
div:prog('uniform sampler2D uV;uniform vec2 ts;void main(){float L=texture(uV,v-vec2(ts.x,0)).x,R=texture(uV,v+vec2(ts.x,0)).x,T=texture(uV,v+vec2(0,ts.y)).y,B=texture(uV,v-vec2(0,ts.y)).y;o=vec4(.5*(R-L+T-B),0,0,1);}'),
jac:prog('uniform sampler2D uP,uD;uniform vec2 ts;void main(){float L=texture(uP,v-vec2(ts.x,0)).x,R=texture(uP,v+vec2(ts.x,0)).x,T=texture(uP,v+vec2(0,ts.y)).x,B=texture(uP,v-vec2(0,ts.y)).x;o=vec4((L+R+T+B-texture(uD,v).x)*.25,0,0,1);}'),
curl:prog('uniform sampler2D uV;uniform vec2 ts;void main(){float L=texture(uV,v-vec2(ts.x,0)).y,R=texture(uV,v+vec2(ts.x,0)).y,T=texture(uV,v+vec2(0,ts.y)).x,B=texture(uV,v-vec2(0,ts.y)).x;o=vec4(.5*(R-L-T+B),0,0,1);}'),
vort:prog('uniform sampler2D uV,uC;uniform vec2 ts;uniform float k,dt;void main(){float L=texture(uC,v-vec2(ts.x,0)).x,R=texture(uC,v+vec2(ts.x,0)).x,T=texture(uC,v+vec2(0,ts.y)).x,B=texture(uC,v-vec2(0,ts.y)).x,C=texture(uC,v).x;vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L));f/=length(f)+1e-4;f*=k*C;f.y*=-1.;vec2 u0=texture(uV,v).xy;f*=smoothstep(3.,10.,length(u0));vec2 u=u0+f*dt;o=vec4(clamp(u,-500.,500.),0,1);}'),
calm:prog('uniform sampler2D uV;uniform float dt;void main(){vec2 u=texture(uV,v).xy;float s=length(u);u*=smoothstep(1.,3.,s)/(1.+dt*3./(1.+.1*s));o=vec4(u,0,1);}'),
advd:prog('uniform sampler2D uV,uS;uniform vec2 ts,sz;uniform float dt;void main(){vec2 p=v-dt*texture(uV,v).xy*ts;vec2 pos=p*sz;vec2 c=floor(pos-.5)+.5;vec2 f=pos-c;vec2 w0=f*(-.5+f*(1.-.5*f));vec2 w1=1.+f*f*(-2.5+1.5*f);vec2 w2=f*(.5+f*(2.-1.5*f));vec2 w3=f*f*(-.5+.5*f);vec2 w12=w1+w2;vec2 o12=w2/w12;vec2 t0=(c-1.)/sz,t3=(c+2.)/sz,t12=(c+o12)/sz;vec4 r=texture(uS,vec2(t0.x,t0.y))*w0.x*w0.y+texture(uS,vec2(t12.x,t0.y))*w12.x*w0.y+texture(uS,vec2(t3.x,t0.y))*w3.x*w0.y+texture(uS,vec2(t0.x,t12.y))*w0.x*w12.y+texture(uS,vec2(t12.x,t12.y))*w12.x*w12.y+texture(uS,vec2(t3.x,t12.y))*w3.x*w12.y+texture(uS,vec2(t0.x,t3.y))*w0.x*w3.y+texture(uS,vec2(t12.x,t3.y))*w12.x*w3.y+texture(uS,vec2(t3.x,t3.y))*w3.x*w3.y;vec4 a=texture(uS,c/sz),b=texture(uS,(c+vec2(1,0))/sz),d=texture(uS,(c+vec2(0,1))/sz),e=texture(uS,(c+1.)/sz);r=clamp(r,min(min(a,b),min(d,e)),max(max(a,b),max(d,e)));o=vec4(r.rgb,1);}'),
visc:prog('uniform sampler2D uX,uB;uniform vec2 ts;uniform float a;void main(){vec2 L=texture(uX,v-vec2(ts.x,0)).xy,R=texture(uX,v+vec2(ts.x,0)).xy,T=texture(uX,v+vec2(0,ts.y)).xy,B=texture(uX,v-vec2(0,ts.y)).xy;o=vec4((L+R+T+B+a*texture(uB,v).xy)/(4.+a),0,1);}'),
grad:prog('uniform sampler2D uP,uV;uniform vec2 ts;void main(){float L=texture(uP,v-vec2(ts.x,0)).x,R=texture(uP,v+vec2(ts.x,0)).x,T=texture(uP,v+vec2(0,ts.y)).x,B=texture(uP,v-vec2(0,ts.y)).x;o=vec4(texture(uV,v).xy-vec2(R-L,T-B)*.5,0,1);}')
};
function fbo(w,h){
var t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,w,h,0,gl.RGBA,gl.HALF_FLOAT,null);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
var f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);
gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
return {t:t,f:f,w:w,h:h}}
function dbl(w,h){var a=fbo(w,h),b=fbo(w,h);return {get r(){return a},get w(){return b},swap:function(){var x=a;a=b;b=x}}}
var vel=dbl(SW,SH),vt=dbl(SW,SH),prs=dbl(SW,SH),dvg=fbo(SW,SH),crl=fbo(SW,SH),dye=dbl(CW,CH);
function run(p,u,tg){
gl.useProgram(p);var unit=0;
for(var k in u){var loc=gl.getUniformLocation(p,k),x=u[k];
if(typeof x==='number')gl.uniform1f(loc,x);
else if(Array.isArray(x)){if(x.length===2)gl.uniform2f(loc,x[0],x[1]);else gl.uniform3f(loc,x[0],x[1],x[2])}
else{gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,x);gl.uniform1i(loc,unit++)}}
if(tg){gl.bindFramebuffer(gl.FRAMEBUFFER,tg.f);gl.viewport(0,0,tg.w,tg.h)}
else{gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,CW,CH)}
gl.drawArrays(gl.TRIANGLES,0,3)}
var pt=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,pt);
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,shot);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
run(P.copy,{uT:pt},dye.r);run(P.copy,{uT:pt},dye.w);
document.body.appendChild(cv);
var down=false,lx=0,ly=0,q=[],alive=true,last=null,raf;
function pos(e){var r=cv.getBoundingClientRect();return [(e.clientX-r.left)/r.width,1-(e.clientY-r.top)/r.height]}
cv.onpointerdown=function(e){down=true;cv.setPointerCapture(e.pointerId);var p=pos(e);lx=p[0];ly=p[1];cv.style.cursor='grabbing'};
cv.onpointermove=function(e){if(!down)return;var p=pos(e);q.push([p[0],p[1],p[0]-lx,p[1]-ly]);lx=p[0];ly=p[1]};
cv.onpointerup=cv.onpointercancel=function(){down=false;cv.style.cursor='grab'};
cv.onwheel=function(e){e.preventDefault()};
function key(e){if(e.key==='Escape')quit(false)}
addEventListener('keydown',key,true);
function quit(keep){
if(!alive)return;
alive=false;
cancelAnimationFrame(raf);removeEventListener('keydown',key,true);
try{cv.remove()}catch(e){}
var ext=gl.getExtension('WEBGL_lose_context');if(ext)ext.loseContext();
if(!keep){stopStream();if(cur===me)cur=null;if(window.__fluid===G)delete window.__fluid}}
function flowReset(){[vel.r,vel.w,prs.r,prs.w].forEach(function(f){gl.bindFramebuffer(gl.FRAMEBUFFER,f.f);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT)})}
async function rerun(){
if(busy||!alive)return;
busy=true;
try{flowReset()}
finally{busy=false}}
var me={quit:quit};
cur=me;G.rerun=rerun;G.quit=function(){quit(false)};
function frame(now){
if(!alive)return;
var dt=last==null?.016:Math.max(0,Math.min((now-last)/1000,.033));last=now;
while(q.length){var s=q.shift();
var dxc=s[2]*SW,dyc=s[3]*SH,dc=Math.sqrt(dxc*dxc+dyc*dyc),k=FORCE*(5+3*Math.min(dc,12));
run(P.splat,{uT:vel.r.t,p:[s[0],s[1]],c:[dxc*k,dyc*k,0],r:.0012,ar:CW/CH},vel.w);vel.swap()}
run(P.advect,{uV:vel.r.t,uS:vel.r.t,ts:simTS,dt:dt,d:FRICTION},vel.w);vel.swap();
if(VISC>0){var al=1/(VISC*dt+1e-6);run(P.copy,{uT:vel.r.t},vt.r);for(var j=0;j<10;j++){run(P.visc,{uX:vt.r.t,uB:vel.r.t,ts:simTS,a:al},vt.w);vt.swap()}run(P.copy,{uT:vt.r.t},vel.w);vel.swap()}
if(VORT>0){run(P.curl,{uV:vel.r.t,ts:simTS},crl);run(P.vort,{uV:vel.r.t,uC:crl.t,ts:simTS,k:VORT,dt:dt},vel.w);vel.swap()}
run(P.div,{uV:vel.r.t,ts:simTS},dvg);
run(P.mul,{uT:prs.r.t,k:.8},prs.w);prs.swap();
for(var i=0;i<25;i++){run(P.jac,{uP:prs.r.t,uD:dvg.t,ts:simTS},prs.w);prs.swap()}
run(P.grad,{uP:prs.r.t,uV:vel.r.t,ts:simTS},vel.w);vel.swap();
run(P.calm,{uV:vel.r.t,dt:dt},vel.w);vel.swap();
run(P.advd,{uV:vel.r.t,uS:dye.r.t,ts:simTS,dt:dt,sz:[CW,CH]},dye.w);dye.swap();
run(P.copy,{uT:dye.r.t},null);
raf=requestAnimationFrame(frame)}
raf=requestAnimationFrame(frame);
return me
}
})();
