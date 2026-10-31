/* Sazlamalar sahypasynyň skripti (faýla ýatda saklamak / dikeltmek: amatly* sazlamalary we Kalkulus kursunyň ösüşi kalkulus_*; AI açary we söhbetler faýla goşulmaýar) */
(function(){"use strict";var P=window.AmatlyPrefs;if(!P)return;
function $(s){return document.querySelector(s)}function $$(s){return[].slice.call(document.querySelectorAll(s))}
var tm=0;function toast(t){var e=$("#setToast");e.textContent=t;e.hidden=false;clearTimeout(tm);tm=setTimeout(function(){e.hidden=true},2200)}
var NM={t:"theme",f:"fs",m:"mo"},MSG={t:"Tema üýtgedildi",f:"Harp ölçegi üýtgedildi",m:"Animasiýa sazlamasy üýtgedildi"};
function keys(re){try{return Object.keys(localStorage).filter(function(k){return re.test(k)})}catch(e){return[]}}
function wipe(re){keys(re).forEach(function(k){try{localStorage.removeItem(k)}catch(e){}})}
function stats(){var r=[];try{r=JSON.parse(localStorage.getItem("amatly_recent")||"[]")}catch(e){}
$("#nRecent").textContent=r.length;$("#nGames").textContent=keys(/^amatly[:-]/).length}
function sync(){Object.keys(NM).forEach(function(k){var v=P.get(k);$$("input[name="+NM[k]+"]").forEach(function(i){i.checked=i.value===v})});stats()}
function ask(q){var d=$("#dlg");if(!d.showModal)return Promise.resolve(confirm(q));
return new Promise(function(ok){$("#dlgTxt").textContent=q;d.returnValue="";d.addEventListener("close",function(){ok(d.returnValue==="yes")},{once:true});d.showModal()})}
Object.keys(NM).forEach(function(k){$$("input[name="+NM[k]+"]").forEach(function(i){i.addEventListener("change",function(){P.set(k,i.value);toast(MSG[k])})})});
$("#clrRecent").onclick=function(){wipe(/^amatly_recent$/);stats();toast("Soňky açylanlar arassalandy")};
$("#clrGames").onclick=function(){ask("Oýun rekordlary we öwreniş derejesi pozulsynmy?").then(function(y){if(y){wipe(/^amatly[:-]/);stats();toast("Oýun netijeleri arassalandy")}})};
$("#resetAll").onclick=function(){ask("Ähli sazlamalar asyl ýagdaýa getirilsinmi?").then(function(y){if(y){P.reset();sync();toast("Sazlamalar dikeldildi")}})};
$("#exp").onclick=function(){var o={};keys(/^(amatly|kalkulus_)/).filter(function(k){return!/^amatly_ai_(key|chat)/.test(k)}).forEach(function(k){o[k]=localStorage.getItem(k)});
var a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(o,null,2)],{type:"application/json"}));a.download="amatly-sazlamalar.json";a.click();
setTimeout(function(){URL.revokeObjectURL(a.href)},500);toast("Faýl ýatda saklandy")};
$("#impBtn").onclick=function(){$("#imp").click()};
$("#imp").onchange=function(e){var f=e.target.files[0];if(!f)return;var r=new FileReader();
r.onload=function(){try{var o=JSON.parse(r.result),n=0;Object.keys(o).forEach(function(k){if(/^(amatly|kalkulus_)/.test(k)&&!/^amatly_ai_key/.test(k)&&typeof o[k]==="string"){localStorage.setItem(k,o[k]);n++}});P.apply();sync();toast(n?"Sazlamalar dikeldildi":"Faýlda sazlama ýok")}catch(x){toast("Faýl nädogry")}};
r.readAsText(f);e.target.value=""};
document.addEventListener("amatly-sync",function(){P.apply();sync()});   /* başga enjamdan täze sazlama geldi (assets/nav/account.js) */
sync();
})();
