/* Amatly.com — tema we sazlamalar (ähli sahypada iň ozal ýüklenýär) */
(function(){"use strict";
var d=document.documentElement,K={t:"amatly_theme",f:"amatly_fs",m:"amatly_motion"},D={t:"dark",f:"md",m:"auto"};
function rd(k){try{return localStorage.getItem(K[k])||D[k]}catch(e){return D[k]}}
function wr(k,v){try{localStorage.setItem(K[k],v)}catch(e){}}
var mq=window.matchMedia?matchMedia("(prefers-color-scheme: dark)"):null,rm=window.matchMedia?matchMedia("(prefers-reduced-motion: reduce)"):null;
function apply(){var t=rd("t");d.setAttribute("data-theme",t==="auto"?(mq&&mq.matches?"dark":"light"):(t==="light"?"light":"dark"));
d.setAttribute("data-theme-pref",t);d.setAttribute("data-fs",rd("f"));var mo=rd("m");d.setAttribute("data-motion",mo==="auto"?(rm&&rm.matches?"reduce":"full"):mo);}
apply();
if(rm){if(rm.addEventListener)rm.addEventListener("change",apply);else if(rm.addListener)rm.addListener(apply);}
if(mq){if(mq.addEventListener)mq.addEventListener("change",apply);else if(mq.addListener)mq.addListener(apply);}
window.AmatlyPrefs={get:rd,set:function(k,v){wr(k,v);apply();},reset:function(){try{Object.keys(K).forEach(function(k){localStorage.removeItem(K[k])})}catch(e){}apply();},apply:apply};
document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest("[data-theme-toggle]");if(!b)return;e.preventDefault();
window.AmatlyPrefs.set("t",d.getAttribute("data-theme")==="dark"?"light":"dark");});
})();
