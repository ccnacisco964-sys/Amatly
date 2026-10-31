<?php
/*
 * Amatly.com — hasaplar we sazlamalary enjamlaryň arasynda deňleşdirmek (PHP 7.0+; goşmaça giňeltme gerek däl).
 *
 * Näme üçin gerek: öň hasap diňe bir brauzeriň ýadynda (localStorage) saklanýardy — başga brauzerde ýa-da telefonda
 * girip bolmaýardy. Indi hasap şu serwerde saklanýar: islendik enjamda girip bolýar, sazlamalar (tema, harp ölçegi,
 * oýun rekordlary, sapaklaryň ösüşi, türgenleşik netijeleri) deňleşdirilýär. Hosting PHP-ni işletmese, saýt öňküsi ýaly
 * hasaby brauzerde saklaýar (assets/nav/account.js özi barlaýar).
 *
 * Näme saklanýar (her ulanyjy aýratyn faýlda: <maglumat papkasy>/u/<id>.php):
 *   • ulanyjy ady we parolyň PBKDF2-SHA256 hasaplamasy (16 baýt duz, 210 000 gezek) — parolyň özi saklanmaýar;
 *   • giriş belgileri (token) — diňe SHA-256 hasaplamasy; 180 gün ulanylmasa öçýär; iň köp 20 enjam;
 *   • brauzeriň localStorage-yndaky amatly* we kalkulus_* açarlary (AI açary we AI söhbetleri DÄL).
 * Faýllar «<?php … exit; ?>» bilen başlaýar: papka ýapylmadyk bolsa-da, brauzerde açylanda boş 404 görkezilýär.
 *
 * Maglumat papkasy (ilkinjisi ulanylýar):
 *   1) gurşaw üýtgeýjisi AMATLY_DATA_DIR ýa-da sazlamalarda 'account_dir' (amatly-ai-config.php / api/ai-config.php);
 *   2) saýtyň papkasyndan bir dereje ýokarda: amatly-data/  (jemgyýetçilik papkanyň daşynda — iň ygtybarly);
 *   3) şu papkada: api/.amatly-data/  (.htaccess bilen ýapylýar).
 * ÄTIÝAÇLYK NUSGA: şu papkany wagtal-wagtal göçürip saklaň — hasaplar diňe şu ýerde.
 * Sazlamalar (islege görä): 'accounts' => false — hasaplary öçürmek; 'account_allow_http' => true — HTTPS-siz rugsat
 * (diňe synag üçin: parol açyk baglanyşykda iberilýär).
 *
 * Protokol tools/account-server.mjs faýlynyň başynda ýazylan (Node wersiýasy bilen birmeňzeş).
 */
declare(strict_types=1);

$L = array('userMin' => 3, 'userMax' => 24, 'passMin' => 6, 'passMax' => 200,
  'keyMax' => 200, 'valueMax' => 100000, 'totalMax' => 1000000, 'changesMax' => 400, 'tombstonesMax' => 300,
  'tokensMax' => 20, 'tokenDays' => 180, 'failMax' => 10, 'failWindow' => 900,
  'loginPer10min' => 100, 'registerPerHour' => 40, 'registerPerDay' => 150, 'requestsPer10min' => 3000, 'body' => 2097152);
const AMX_ITER = 210000;
const AMX_GUARD = "<?php http_response_code(404); exit; ?>\n";
const AMX_WS = '/[\t\n\x0B\f\r \x{00a0}\x{1680}\x{2000}-\x{200a}\x{2028}\x{2029}\x{202f}\x{205f}\x{3000}\x{feff}]+/u';
define('AMX_JSON', JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | (defined('JSON_INVALID_UTF8_SUBSTITUTE') ? JSON_INVALID_UTF8_SUBSTITUTE : 0));

class AmxFail extends Exception {
  public $status; public $code2;
  public function __construct($status, $code, $message) { parent::__construct($message); $this->status = $status; $this->code2 = $code; }
}
function amx_send($status, $data) {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  header('X-Content-Type-Options: nosniff');
  echo json_encode($data, AMX_JSON);
  exit;
}
function amx_fail($status, $code, $message) { throw new AmxFail($status, $code, $message); }

/* ---------------------------------------------------------------- sazlamalar */
$cfg = array('account_dir' => null, 'accounts' => true, 'account_allow_http' => false);
foreach (array(dirname(__DIR__, 2) . '/amatly-ai-config.php', __DIR__ . '/ai-config.php') as $f) {
  if (is_file($f)) {
    $c = include $f;
    if (is_array($c)) foreach ($c as $k => $v) if ($v !== null && $v !== '') $cfg[$k] = $v;
    break;
  }
}
if (getenv('AMATLY_DATA_DIR')) $cfg['account_dir'] = getenv('AMATLY_DATA_DIR');

/* ---------------------------------------------------------------- kömekçiler (Node wersiýasy bilen birmeňzeş) */
function amx_clean_name($s) {
  if (!is_string($s)) return '';
  if (class_exists('Normalizer')) { $n = Normalizer::normalize($s, Normalizer::FORM_C); if (is_string($n)) $s = $n; }
  $s = preg_replace(AMX_WS, ' ', $s);
  if (!is_string($s)) return '';
  return preg_replace('/^ | $/', '', $s);
}
function amx_len($s) { return function_exists('mb_strlen') ? mb_strlen($s, 'UTF-8') : preg_match_all('/./us', $s); }
function amx_lower($s) { return function_exists('mb_strtolower') ? mb_strtolower($s, 'UTF-8') : strtolower($s); }
function amx_user_id($name) { return substr(hash('sha256', amx_lower(amx_clean_name($name))), 0, 32); }
function amx_hex($n) { return bin2hex(random_bytes($n)); }
function amx_now_ms() { return (int)floor(microtime(true) * 1000); }
function amx_check_name($name) {
  global $L;
  if (amx_len($name) < $L['userMin']) return 'Ulanyjy ady iň az 3 belgi bolmaly.';
  if (amx_len($name) > $L['userMax']) return 'Ulanyjy ady iň köp 24 belgi bolmaly.';
  if (!preg_match('/^[\p{L}\p{N}_. -]+$/u', $name)) return 'Ulanyjy adynda diňe harplar, sanlar, aralyk we _ . - bolup biler.';
  return null;
}
function amx_check_pass($p) {
  global $L;
  if (!is_string($p) || !preg_match('//u', $p) || amx_len($p) < $L['passMin']) return 'Parol iň az 6 belgi bolmaly.';
  if (amx_len($p) > $L['passMax']) return 'Parol örän uzyn (iň köp 200 belgi).';
  return null;
}
function amx_syncable($k) {
  global $L;
  return is_string($k) && $k !== '' && strlen($k) <= $L['keyMax'] && preg_match('/^(amatly|kalkulus_)/', $k) &&
    !preg_match('/^amatly_ai_(key|chat)/', $k) && !preg_match('/[\x00-\x1f\x7f]/', $k);
}
function amx_pbkdf2($pass, $saltHex, $iter) { return hash_pbkdf2('sha256', $pass, (string)hex2bin($saltHex), (int)$iter, 64, false); }
function amx_hash_pass($pass) { $salt = amx_hex(16); return array('algo' => 'pbkdf2-sha256', 'iter' => AMX_ITER, 'salt' => $salt, 'hash' => amx_pbkdf2($pass, $salt, AMX_ITER)); }
function amx_verify_pass($rec, $pass) {
  global $L;
  $p = isset($rec['pass']) && is_array($rec['pass']) ? $rec['pass'] : null;
  if (!$p || (isset($p['algo']) ? $p['algo'] : '') !== 'pbkdf2-sha256' || !is_string($pass) || amx_len($pass) > $L['passMax']) return false;
  return hash_equals((string)$p['hash'], amx_pbkdf2($pass, (string)$p['salt'], (int)$p['iter']));
}
function amx_data_size($data) {
  $n = 0;
  foreach ($data as $k => $v) if (is_array($v) && is_string($v['v'])) $n += strlen((string)$k) + strlen($v['v']);
  return $n;
}

/* ---------------------------------------------------------------- ammar */
function amx_dir() {
  global $cfg;
  static $dir = null;
  if ($dir !== null) return $dir;
  $cands = $cfg['account_dir'] ? array($cfg['account_dir']) : array(dirname(__DIR__, 2) . '/amatly-data', __DIR__ . '/.amatly-data');
  foreach ($cands as $cand) {
    $cand = rtrim((string)$cand, '/\\');
    if (!is_dir($cand . '/u')) @mkdir($cand . '/u', 0700, true);
    if (is_dir($cand . '/u') && is_writable($cand . '/u')) { $dir = $cand; break; }
  }
  if ($dir === null) amx_fail(503, 'storage', 'Serwerde hasaplar üçin ýazyp bolýan papka ýok (api/ai-config.php: account_dir).');
  if (!is_file($dir . '/.htaccess')) @file_put_contents($dir . '/.htaccess', "Require all denied\nDeny from all\n");
  if (!is_file($dir . '/index.html')) @file_put_contents($dir . '/index.html', '');
  return $dir;
}
function amx_read($file) {
  $s = @file_get_contents($file);
  if ($s === false) return null;
  if (strpos($s, '<?php') === 0) { $i = strpos($s, "\n"); $s = $i === false ? '' : substr($s, $i + 1); }
  $d = json_decode($s, true);
  return is_array($d) ? $d : null;
}
function amx_encode($obj) {
  $j = json_encode($obj, JSON_FORCE_OBJECT | AMX_JSON);
  if (!is_string($j) || $j === '') amx_fail(500, 'server', 'Maglumaty ýazyp bolmady (JSON).');   /* köne faýl üýtgewsiz galýar */
  return AMX_GUARD . $j;
}
function amx_write($file, $obj) {
  $tmp = $file . '.tmp-' . amx_hex(4);
  if (@file_put_contents($tmp, amx_encode($obj)) === false) amx_fail(503, 'storage', 'Maglumaty ýazyp bolmady.');
  @chmod($tmp, 0600);
  if (!@rename($tmp, $file)) { @unlink($tmp); amx_fail(503, 'storage', 'Maglumaty ýazyp bolmady.'); }
}
/* bir faýl bilen bir wagtda diňe bir iş */
function amx_locked($name, $fn) {
  $fh = @fopen(amx_dir() . '/' . $name . '.lock', 'c');
  if (!$fh || !flock($fh, LOCK_EX)) amx_fail(503, 'storage', 'Maglumat papkasy gulplanmady.');
  try { return $fn(); } finally { flock($fh, LOCK_UN); fclose($fh); }
}
function amx_ufile($id) { return amx_dir() . '/u/' . $id . '.php'; }
function amx_create_user($id, $rec) {
  $body = amx_encode($rec);
  $fh = @fopen(amx_ufile($id), 'x');
  if (!$fh) { if (is_file(amx_ufile($id))) return false; amx_fail(503, 'storage', 'Hasaby ýazyp bolmady.'); }
  fwrite($fh, $body);
  fclose($fh); @chmod(amx_ufile($id), 0600);
  return true;
}

/* ---------------------------------------------------------------- çäklendirmeler (IP boýunça, berk penjireler) */
function amx_bump(&$rec, $name, $win, $now) {
  $w = (int)(floor($now / $win) * $win);
  if (!isset($rec[$name]) || !is_array($rec[$name]) || $rec[$name]['w'] !== $w) $rec[$name] = array('w' => $w, 'n' => 0);
  $rec[$name]['n']++;
  return $rec[$name]['n'];
}
function amx_limit($ip, $kind, $now) {
  global $L;
  return amx_locked('limits', function () use ($ip, $kind, $now, $L) {
    $file = amx_dir() . '/limits.php';
    $st = amx_read($file);
    if (!is_array($st)) $st = array();
    foreach ($st as $k => $v) if (!is_array($v) || !isset($v['q']['w']) || $v['q']['w'] < $now - 172800) unset($st[$k]);
    $key = sha1($ip);
    $rec = isset($st[$key]) ? $st[$key] : array();
    $msg = null;
    if (amx_bump($rec, 'q', 600, $now) > $L['requestsPer10min']) $msg = 'Haýyşlar örän köp boldy. Birnäçe minutdan täzeden synanyşyň.';
    elseif ($kind === 'login' && amx_bump($rec, 'l', 600, $now) > $L['loginPer10min']) $msg = 'Giriş synanyşyklary örän köp boldy. 10 minutdan täzeden synanyşyň.';
    elseif ($kind === 'register') {
      $h = amx_bump($rec, 'rh', 3600, $now); $d = amx_bump($rec, 'rd', 86400, $now);
      if ($h > $L['registerPerHour'] || $d > $L['registerPerDay']) $msg = 'Şu salgydan örän köp hasap açyldy. Soňrak täzeden synanyşyň.';
    }
    $st[$key] = $rec;
    amx_write($file, $st);
    return $msg;
  });
}

/* ---------------------------------------------------------------- tokenler */
function amx_new_token(&$rec, $id, $label) {
  global $L;
  $secret = amx_hex(32); $t = time();
  if (!isset($rec['tokens']) || !is_array($rec['tokens'])) $rec['tokens'] = array();
  $lab = function_exists('mb_substr') ? mb_substr((string)$label, 0, 80, 'UTF-8') : substr((string)$label, 0, 80);
  $rec['tokens'][hash('sha256', $secret)] = array('c' => $t, 'u' => $t, 'n' => $lab);
  uasort($rec['tokens'], function ($a, $b) { return $b['u'] - $a['u']; });
  $rec['tokens'] = array_slice($rec['tokens'], 0, $L['tokensMax'], true);
  return $id . '.' . $secret;
}
function amx_prune_tokens(&$rec, $now) {
  global $L;
  foreach ((array)$rec['tokens'] as $k => $v) if (!is_array($v) || $now - $v['u'] > $L['tokenDays'] * 86400) unset($rec['tokens'][$k]);
}
function amx_parse_token($tok) {
  if (!is_string($tok) || !preg_match('/^([0-9a-f]{32})\.([0-9a-f]{64})$/', $tok, $m)) amx_fail(401, 'bad_token', 'Hasaba täzeden giriň.');
  return array($m[1], hash('sha256', $m[2]));
}
/* token bilen işlemek: ulanyjy faýly gulplanýar; $fn($rec, $id, $dirty) — $rec üýtgese $dirty = true */
function amx_with_token($tok, $fn) {
  global $L;
  list($id, $th) = amx_parse_token($tok);
  return amx_locked('u-' . $id, function () use ($id, $th, $fn, $L) {
    $rec = amx_read(amx_ufile($id));
    $now = time();
    if (!$rec || !isset($rec['tokens'][$th]) || $now - $rec['tokens'][$th]['u'] > $L['tokenDays'] * 86400)
      amx_fail(401, 'bad_token', 'Hasaba täzeden giriň (giriş möhleti geçdi ýa-da parol üýtgedildi).');
    $dirty = false;
    if ($now - $rec['tokens'][$th]['u'] > 3600) { $rec['tokens'][$th]['u'] = $now; $dirty = true; }
    $out = $fn($rec, $id, $dirty);
    if (is_array($out) && isset($out['__delete'])) { @unlink(amx_ufile($id)); return $out['result']; }
    if ($dirty) amx_write(amx_ufile($id), $rec);
    return $out;
  });
}

/* ---------------------------------------------------------------- işler */
function amx_register($b, $ip, $ua) {
  $name = amx_clean_name(isset($b['username']) ? $b['username'] : null);
  $bad = amx_check_name($name);
  if ($bad === null) $bad = amx_check_pass(isset($b['password']) ? $b['password'] : null);
  if ($bad !== null) amx_fail(400, 'invalid', $bad);
  $lim = amx_limit($ip, 'register', time());
  if ($lim !== null) amx_fail(429, 'rate_limit', $lim);
  $id = amx_user_id($name);
  $now = new DateTime('now', new DateTimeZone('UTC'));
  $rec = array('v' => 1, 'username' => $name, 'created' => $now->format('Y-m-d\TH:i:s.v\Z'), 'epoch' => amx_hex(8), 'rev' => 0,
    'pass' => amx_hash_pass($b['password']), 'tokens' => array(), 'data' => array(), 'fails' => array());
  $token = amx_new_token($rec, $id, $ua);
  if (!amx_create_user($id, $rec)) amx_fail(409, 'taken', 'Bu at eýýäm bar. Başga at saýlaň ýa-da «Girmek» bölümine geçiň.');
  return array(201, array('ok' => true, 'username' => $name, 'token' => $token, 'epoch' => $rec['epoch'], 'rev' => 0));
}
function amx_login($b, $ip, $ua) {
  global $L;
  $name = amx_clean_name(isset($b['username']) ? $b['username'] : null);
  $pass = isset($b['password']) ? $b['password'] : null;
  if ($name === '' || !is_string($pass) || $pass === '') amx_fail(400, 'invalid', 'Ulanyjy adyny we paroly ýazyň.');
  $now = time();
  $lim = amx_limit($ip, 'login', $now);
  if ($lim !== null) amx_fail(429, 'rate_limit', $lim);
  $id = amx_user_id($name); $ipk = substr(sha1($ip), 0, 16);
  return amx_locked('u-' . $id, function () use ($id, $ipk, $pass, $now, $ua, $L) {
    $rec = amx_read(amx_ufile($id));
    if (!$rec) { amx_pbkdf2(substr($pass, 0, 800), str_repeat('ab', 16), AMX_ITER); amx_fail(401, 'bad_credentials', 'Ulanyjy ady ýa-da parol nädogry.'); }
    if (!isset($rec['fails']) || !is_array($rec['fails'])) $rec['fails'] = array();
    foreach ($rec['fails'] as $k => $f) if (!is_array($f) || $now - $f['w'] > $L['failWindow']) unset($rec['fails'][$k]);
    if (isset($rec['fails'][$ipk]) && $rec['fails'][$ipk]['n'] >= $L['failMax']) amx_fail(429, 'locked', 'Nädogry parol örän köp ýazyldy. 15 minutdan täzeden synanyşyň.');
    if (!amx_verify_pass($rec, $pass)) {
      if (!isset($rec['fails'][$ipk])) $rec['fails'][$ipk] = array('w' => $now, 'n' => 0);
      $rec['fails'][$ipk]['n']++;
      if (count($rec['fails']) > 50) { reset($rec['fails']); unset($rec['fails'][key($rec['fails'])]); }
      amx_write(amx_ufile($id), $rec);
      amx_fail(401, 'bad_credentials', 'Ulanyjy ady ýa-da parol nädogry.');
    }
    unset($rec['fails'][$ipk]);
    if ((int)$rec['pass']['iter'] < AMX_ITER) $rec['pass'] = amx_hash_pass($pass);
    amx_prune_tokens($rec, $now);
    $token = amx_new_token($rec, $id, $ua);
    amx_write(amx_ufile($id), $rec);
    return array(200, array('ok' => true, 'username' => $rec['username'], 'token' => $token, 'epoch' => $rec['epoch'], 'rev' => (int)$rec['rev']));
  });
}
function amx_logout($b) {
  try { list($id, $th) = amx_parse_token(isset($b['token']) ? $b['token'] : null); } catch (AmxFail $e) { return array(200, array('ok' => true)); }
  $all = isset($b['all']) && $b['all'] === true;
  amx_locked('u-' . $id, function () use ($id, $th, $all) {
    $rec = amx_read(amx_ufile($id));
    if (!$rec || !isset($rec['tokens'][$th])) return;
    if ($all) $rec['tokens'] = array(); else unset($rec['tokens'][$th]);
    amx_write(amx_ufile($id), $rec);
  });
  return array(200, array('ok' => true));
}
function amx_me($b) {
  return array(200, amx_with_token(isset($b['token']) ? $b['token'] : null, function (&$rec, $id, &$dirty) {
    $keys = 0;
    foreach ((array)$rec['data'] as $x) if (is_array($x) && $x['v'] !== null) $keys++;
    return array('ok' => true, 'username' => $rec['username'], 'created' => $rec['created'], 'epoch' => $rec['epoch'], 'rev' => (int)$rec['rev'],
      'devices' => count((array)$rec['tokens']), 'keys' => $keys, 'bytes' => amx_data_size((array)$rec['data']));
  }));
}
function amx_sync($b, $bObj) {
  global $L;
  $ch = isset($b['changes']) ? $b['changes'] : array();
  $chObj = isset($bObj->changes) ? $bObj->changes : null;
  if ($ch === null) $ch = array();
  if (!is_array($ch) || ($chObj !== null && !($chObj instanceof stdClass))) amx_fail(400, 'invalid', 'changes nädogry.');
  if (count($ch) > $L['changesMax']) amx_fail(413, 'too_many', 'Bir gezekde örän köp üýtgeşiklik.');
  foreach ($ch as $k => $c) {
    $k = (string)$k;
    $short = function_exists('mb_substr') ? mb_substr($k, 0, 60, 'UTF-8') : substr($k, 0, 60);
    if (!amx_syncable($k)) amx_fail(400, 'invalid', 'Rugsat berilmedik açar: ' . $short);
    if (!is_array($c) || !array_key_exists('v', $c) || ($c['v'] !== null && !is_string($c['v'])) || !isset($c['t']) || !(is_int($c['t']) || is_float($c['t'])) || !is_finite((float)$c['t']))
      amx_fail(400, 'invalid', 'Üýtgeşiklik nädogry: ' . $short);
    if (is_string($c['v']) && strlen($c['v']) > $L['valueMax']) amx_fail(413, 'quota', 'Bir sazlama örän uly: ' . $short);
  }
  return array(200, amx_with_token(isset($b['token']) ? $b['token'] : null, function (&$rec, $id, &$dirty) use ($b, $ch, $L) {
    if (!isset($rec['data']) || !is_array($rec['data'])) $rec['data'] = array();
    $since = isset($b['since']) && is_int($b['since']) && $b['since'] > 0 ? $b['since'] : 0;
    if (!isset($b['epoch']) || $b['epoch'] !== $rec['epoch'] || $since > (int)$rec['rev']) $since = 0;
    $nowMs = amx_now_ms(); $stale = array(); $next = $rec['data']; $rev = (int)$rec['rev']; $changed = false;
    foreach ($ch as $k => $c) {
      $k = (string)$k;
      $t = (int)max(0, min(floor((float)$c['t']), $nowMs));
      $cur = isset($next[$k]) && is_array($next[$k]) ? $next[$k] : null;
      if ($cur !== null && $cur['t'] > $t) { $stale[$k] = true; continue; }
      if ($cur !== null ? $cur['v'] === $c['v'] : $c['v'] === null) continue;
      $next[$k] = array('v' => $c['v'], 't' => $t, 'r' => ++$rev); $changed = true;
    }
    if ($changed) {
      if (amx_data_size($next) > $L['totalMax']) amx_fail(413, 'quota', 'Hasabyňyzyň sazlamalary örän köp (1 MB-dan uly). Sazlamalar sahypasynda köne oýun ýa-da sapak maglumatlaryny arassalaň.');
      $tomb = array();
      foreach ($next as $k => $x) if ($x['v'] === null) $tomb[$k] = $x['r'];
      asort($tomb);
      $drop = count($tomb) - $L['tombstonesMax'];
      foreach ($tomb as $k => $r) { if ($drop-- <= 0) break; unset($next[$k]); }
      $rec['data'] = $next; $rec['rev'] = $rev; $dirty = true;
    }
    $out = new stdClass();
    foreach ($rec['data'] as $k => $x) if (($x['r'] > $since && !array_key_exists($k, $ch)) || isset($stale[$k])) $out->{(string)$k} = $x['v'];
    return array('ok' => true, 'epoch' => $rec['epoch'], 'rev' => (int)$rec['rev'], 'full' => $since === 0, 'changes' => $out);
  }));
}
function amx_password($b, $ua) {
  $bad = amx_check_pass(isset($b['new_password']) ? $b['new_password'] : null);
  if ($bad !== null) amx_fail(400, 'invalid', str_replace('Parol', 'Täze parol', $bad));
  return array(200, amx_with_token(isset($b['token']) ? $b['token'] : null, function (&$rec, $id, &$dirty) use ($b, $ua) {
    if (!amx_verify_pass($rec, isset($b['password']) ? $b['password'] : null)) amx_fail(401, 'bad_password', 'Häzirki parol nädogry.');
    $rec['pass'] = amx_hash_pass($b['new_password']);
    $rec['tokens'] = array();
    $token = amx_new_token($rec, $id, $ua);
    $dirty = true;
    return array('ok' => true, 'token' => $token);
  }));
}
function amx_delete($b) {
  return array(200, amx_with_token(isset($b['token']) ? $b['token'] : null, function (&$rec, $id, &$dirty) use ($b) {
    if (!amx_verify_pass($rec, isset($b['password']) ? $b['password'] : null)) amx_fail(401, 'bad_password', 'Parol nädogry.');
    return array('__delete' => true, 'result' => array('ok' => true));
  }));
}

/* ---------------------------------------------------------------- haýyş */
try {
  $method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';
  $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
  if ($origin !== '') {
    $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';
    $oHost = parse_url($origin, PHP_URL_HOST); $oPort = parse_url($origin, PHP_URL_PORT);
    if ($oHost === null || $oHost === false || ($oHost . ($oPort ? ':' . $oPort : '')) !== $host) amx_fail(403, 'origin', 'Bu salgydan rugsat ýok.');
  }
  if ($method === 'OPTIONS') { http_response_code(204); exit; }
  $remote = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
  $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443) ||
    (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower($_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https');
  $local = $remote === '127.0.0.1' || $remote === '::1';
  $enabled = $cfg['accounts'] !== false && $cfg['accounts'] !== 0 && $cfg['accounts'] !== '0';
  if ($method === 'GET') {
    /* ýazyp bolýan papka ýok bolsa, brauzer hasaby öňküsi ýaly özünde saklaýar */
    $storage = true;
    if ($enabled) { try { amx_dir(); } catch (AmxFail $e) { $storage = false; } }
    amx_send(200, array('ok' => true, 'accounts' => $enabled && $storage, 'storage' => $storage, 'server' => 'php', 'protocol' => 1, 'secure' => $https || $local,
    'limits' => array('user' => array($L['userMin'], $L['userMax']), 'pass' => array($L['passMin'], $L['passMax']), 'bytes' => $L['totalMax'])));
  }
  if ($method !== 'POST') amx_fail(405, 'method', 'Diňe GET we POST.');
  if (!$enabled) amx_fail(503, 'disabled', 'Serwerde hasaplar öçürilen.');
  if (!$https && !$local && $cfg['account_allow_http'] !== true) amx_fail(403, 'https', 'Hasap üçin howpsuz baglanyşyk (HTTPS) gerek.');
  $ctype = isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : (isset($_SERVER['HTTP_CONTENT_TYPE']) ? $_SERVER['HTTP_CONTENT_TYPE'] : '');
  if (!preg_match('#^application/json\b#i', $ctype)) amx_fail(415, 'invalid', 'Content-Type: application/json gerek.');
  if ((isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : 0) > $L['body']) amx_fail(413, 'too_large', 'Haýyş örän uly.');
  $raw = (string)file_get_contents('php://input', false, null, 0, $L['body'] + 1);
  if (strlen($raw) > $L['body']) amx_fail(413, 'too_large', 'Haýyş örän uly.');
  $b = json_decode($raw, true); $bObj = json_decode($raw);
  if (!is_array($b) || !is_object($bObj)) amx_fail(400, 'invalid', 'JSON nädogry.');
  $action = isset($b['action']) && is_string($b['action']) ? $b['action'] : '';
  if (!in_array($action, array('register', 'login', 'logout', 'me', 'sync', 'password', 'delete'), true))
    amx_fail(400, 'invalid', 'Näbelli iş: ' . substr(is_scalar(isset($b['action']) ? $b['action'] : '') ? (string)$b['action'] : '', 0, 40));
  $ua = isset($_SERVER['HTTP_USER_AGENT']) ? substr((string)preg_replace('/[^\x20-\x7e]/', '', (string)$_SERVER['HTTP_USER_AGENT']), 0, 200) : '';
  if ($action !== 'register' && $action !== 'login') {
    $lim = amx_limit($remote, 'other', time());
    if ($lim !== null) amx_fail(429, 'rate_limit', $lim);
  }
  switch ($action) {
    case 'register': $r = amx_register($b, $remote, $ua); break;
    case 'login': $r = amx_login($b, $remote, $ua); break;
    case 'logout': $r = amx_logout($b); break;
    case 'me': $r = amx_me($b); break;
    case 'sync': $r = amx_sync($b, $bObj); break;
    case 'password': $r = amx_password($b, $ua); break;
    default: $r = amx_delete($b);
  }
  amx_send($r[0], $r[1]);
} catch (AmxFail $e) {
  amx_send($e->status, array('ok' => false, 'error' => $e->code2, 'message' => $e->getMessage()));
} catch (Throwable $e) {
  error_log('Amatly hasap: ' . $e->getMessage());
  amx_send(500, array('ok' => false, 'error' => 'server', 'message' => 'Serwerde näsazlyk ýüze çykdy.'));
}
