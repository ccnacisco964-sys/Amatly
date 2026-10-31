(function () {
"use strict";
var __defs = {}, __cache = {};
function __req(id) {
  if (__cache[id]) return __cache[id].exports;
  var m = (__cache[id] = { exports: {} });
  __defs[id](m.exports, __req);
  return m.exports;
}

// src/scripts/modules/search-form.js
__defs["modules/search-form.js"] = function (exports, __req) {
// Gözleg formasy: Enter ýa-da 🔍 basylanda sahypa täzeden ýüklenmesin.
function  initSearchForm() {
  document.getElementById("searchForm").addEventListener("submit", function(e){ e.preventDefault(); });
}
exports.initSearchForm = initSearchForm;
};

// src/scripts/main.js
__defs["main.js"] = function (exports, __req) {
// Giriş nokady: modullary şu ýerde import edip işlet.
// Täze funksiýa goşanyňda: modules/ içinde aýry faýl döret we şu ýerde çagyr.
const { initSearchForm } = __req("modules/search-form.js");

initSearchForm();
};

__req("main.js");
})();
