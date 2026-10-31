<?php
/*
 * Amatly AI — Claude API proksisi (PHP hosting üçin; PHP 7.0+ we cURL gerek).
 *
 * Näme üçin gerek: API açary brauzere berilse, ony islendik adam alyp biler. Şonuň üçin brauzer diňe söhbeti
 * şu faýla iberýär, bu faýl bolsa açary goşup Claude API-a ugradýar we jogaby akym (stream) görnüşinde yzyna berýär.
 * Ulgam görkezmesi, gurallar we model hem şu ýerde goşulýar (../assets/ai/ai-prompt.js) — brauzer olary üýtgedip bilmeýär.
 *
 * API açaryny goýmak (birini saýlaň, ilkinjisi has ygtybarly):
 *   1) hostingiň gurşaw üýtgeýjisi: ANTHROPIC_API_KEY
 *   2) saýtyň papkasyndan bir dereje ýokarda (jemgyýetçilik papkanyň daşynda): amatly-ai-config.php
 *   3) şu papkada: ai-config.php  (ai-config.example.php faýlyny göçürip adyny üýtgediň; .htaccess ony gizleýär)
 * GET  → {"ok":true,"configured":true|false,"model":"..."}  (açary görkezmeýär; Sazlamalar sahypasy ulanýar)
 * POST → {"mode":"explain"|"tutor","messages":[...]}  →  Claude API-nyň SSE akymy
 */
declare(strict_types=1);

$LIMITS = array('messages' => 60, 'blocks' => 60, 'text' => 20000, 'tool_result' => 60000, 'total_chars' => 400000,
  'images' => 8, 'image_b64' => 7340032, 'total_b64' => 20971520, 'body' => 27262976);

function amx_json($status, $data) {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}
function amx_err($status, $type, $message) { amx_json($status, array('type' => 'error', 'error' => array('type' => $type, 'message' => $message))); }
function amx_bad($message, $status = 400, $type = 'invalid_request_error') { throw new RuntimeException(json_encode(array($status, $type, $message), JSON_UNESCAPED_UNICODE)); }

/* ---------------------------------------------------------------- sazlamalar */
$cfg = array('api_key' => '', 'model' => null, 'effort' => null, 'max_tokens' => null, 'base_url' => 'https://api.anthropic.com',
  'rate_per_10min' => 40, 'rate_per_day' => 400, 'daily_total' => 3000, 'allowed_origins' => array(), 'data_dir' => null);
foreach (array(dirname(__DIR__, 2) . '/amatly-ai-config.php', __DIR__ . '/ai-config.php') as $f) {
  if (is_file($f)) {
    $c = include $f;
    if (is_array($c)) foreach ($c as $k => $v) if ($v !== null && $v !== '') $cfg[$k] = $v;
    break;
  }
}
$envKey = getenv('ANTHROPIC_API_KEY');
if ($envKey) $cfg['api_key'] = $envKey;
$cfg['api_key'] = trim((string)$cfg['api_key']);

$promptFile = dirname(__DIR__) . '/assets/ai/ai-prompt.js';
$raw = @file_get_contents($promptFile);
$prompt = null;
if ($raw !== false) {
  $i = strpos($raw, '{'); $j = strrpos($raw, '}');
  if ($i !== false && $j !== false) $prompt = json_decode(substr($raw, $i, $j - $i + 1), true);
}
if (!is_array($prompt) || empty($prompt['system'])) amx_err(500, 'api_error', 'assets/ai/ai-prompt.js okalmady.');

/* ---------------------------------------------------------------- gelip çykyş (CORS) */
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if ($origin !== '') {
  $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';
  $oHost = parse_url($origin, PHP_URL_HOST);
  $oPort = parse_url($origin, PHP_URL_PORT);
  $same = $oHost !== null && ($oHost . ($oPort ? ':' . $oPort : '')) === $host;
  if (!$same && !in_array($origin, (array)$cfg['allowed_origins'], true)) amx_err(403, 'permission_error', 'Bu salgydan AI ulanmaga rugsat ýok.');
  if (!$same) { header('Access-Control-Allow-Origin: ' . $origin); header('Vary: Origin'); }
}
$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';
if ($method === 'OPTIONS') {
  header('Access-Control-Allow-Methods: GET, POST');
  header('Access-Control-Allow-Headers: content-type');
  http_response_code(204);
  exit;
}
if ($method === 'GET') amx_json(200, array('ok' => true, 'configured' => $cfg['api_key'] !== '', 'model' => $cfg['model'] ? $cfg['model'] : $prompt['model'], 'server' => 'php', 'curl' => function_exists('curl_init')));
if ($method !== 'POST') amx_err(405, 'invalid_request_error', 'Diňe GET we POST.');
if ($cfg['api_key'] === '') amx_err(503, 'not_configured', 'AI serwerde sazlanmady: API açary goşulmandyr (api/ai-config.php).');
if (!function_exists('curl_init')) amx_err(500, 'api_error', 'Hostingde PHP cURL giňeltmesi ýok.');

/* ---------------------------------------------------------------- haýyşy barlamak */
$len = isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : 0;
if ($len > $LIMITS['body']) amx_err(413, 'request_too_large', 'Haýyş örän uly.');
$rawBody = (string)file_get_contents('php://input');
$body = json_decode($rawBody, true);
$bodyObj = json_decode($rawBody);            // gural girizmeleri üçin: boş {} obýekt bolup galmaly
if (!is_array($body) || !is_object($bodyObj)) amx_err(400, 'invalid_request_error', 'JSON nädogry.');

$toolNames = array();
foreach ($prompt['tools'] as $t) $toolNames[] = $t['name'];
$chars = 0; $images = 0; $b64 = 0;

function amx_str($v, $max, $what, &$chars, $total) {
  if (!is_string($v)) amx_bad($what . ' tekst bolmaly');
  $n = function_exists('mb_strlen') ? mb_strlen($v, 'UTF-8') : strlen($v);
  if ($n > $max) amx_bad($what . ' örän uzyn', 413, 'request_too_large');
  $chars += $n;
  if ($chars > $total) amx_bad('Söhbet örän uzyn — täze söhbet açyň.', 413, 'request_too_large');
  return $v;
}

try {
  $messages = isset($body['messages']) ? $body['messages'] : null;
  if (!is_array($messages) || count($messages) === 0) amx_bad('messages boş');
  if (count($messages) > $LIMITS['messages']) amx_bad('Söhbet örän uzyn — täze söhbet açyň.', 413, 'request_too_large');
  $clean = array();
  $mObjs = isset($bodyObj->messages) && is_array($bodyObj->messages) ? $bodyObj->messages : array();
  foreach (array_values($messages) as $i => $m) {
    if (!is_array($m) || !isset($m['role']) || ($m['role'] !== 'user' && $m['role'] !== 'assistant')) amx_bad("messages[$i].role nädogry");
    $role = $m['role'];
    $content = isset($m['content']) ? $m['content'] : null;
    if (is_string($content)) { $clean[] = array('role' => $role, 'content' => amx_str($content, $LIMITS['text'], 'Habar', $chars, $LIMITS['total_chars'])); continue; }
    if (!is_array($content) || count($content) === 0 || count($content) > $LIMITS['blocks']) amx_bad("messages[$i].content nädogry");
    $blocks = array();
    foreach (array_values($content) as $k => $b) {
      $type = is_array($b) && isset($b['type']) ? $b['type'] : '';
      if ($type === 'text') { $blocks[] = array('type' => 'text', 'text' => amx_str(isset($b['text']) ? $b['text'] : null, $LIMITS['text'], 'Tekst', $chars, $LIMITS['total_chars'])); continue; }
      if ($role === 'user' && $type === 'image') {
        $s = isset($b['source']) && is_array($b['source']) ? $b['source'] : array();
        $mt = isset($s['media_type']) ? $s['media_type'] : '';
        $data = isset($s['data']) ? $s['data'] : null;
        if ((isset($s['type']) ? $s['type'] : '') !== 'base64' || !in_array($mt, array('image/jpeg', 'image/png', 'image/gif', 'image/webp'), true) || !is_string($data) || !preg_match('#^[A-Za-z0-9+/=\r\n]+$#', $data)) amx_bad('Surat nädogry');
        if (strlen($data) > $LIMITS['image_b64']) amx_bad('Surat örän uly', 413, 'request_too_large');
        $images++; $b64 += strlen($data);
        if ($images > $LIMITS['images'] || $b64 > $LIMITS['total_b64']) amx_bad('Suratlar örän köp ýa-da uly — täze söhbet açyň.', 413, 'request_too_large');
        $blocks[] = array('type' => 'image', 'source' => array('type' => 'base64', 'media_type' => $mt, 'data' => $data));
        continue;
      }
      if ($role === 'user' && $type === 'tool_result') {
        $id = isset($b['tool_use_id']) ? $b['tool_use_id'] : null;
        if (!is_string($id) || strlen($id) > 120) amx_bad('tool_use_id nädogry');
        $rc = isset($b['content']) ? $b['content'] : null;
        if (is_string($rc)) $rcClean = amx_str($rc, $LIMITS['tool_result'], 'Guralyň netijesi', $chars, $LIMITS['total_chars']);
        elseif (is_array($rc)) {
          $rcClean = array();
          foreach ($rc as $c) {
            if (!is_array($c) || (isset($c['type']) ? $c['type'] : '') !== 'text') amx_bad('Guralyň netijesi diňe tekst bolup biler');
            $rcClean[] = array('type' => 'text', 'text' => amx_str(isset($c['text']) ? $c['text'] : null, $LIMITS['tool_result'], 'Guralyň netijesi', $chars, $LIMITS['total_chars']));
          }
        } else amx_bad('Guralyň netijesi nädogry');
        $r = array('type' => 'tool_result', 'tool_use_id' => $id, 'content' => $rcClean);
        if (isset($b['is_error']) && $b['is_error'] === true) $r['is_error'] = true;
        $blocks[] = $r;
        continue;
      }
      if ($role === 'assistant' && $type === 'tool_use') {
        $id = isset($b['id']) ? $b['id'] : null; $name = isset($b['name']) ? $b['name'] : null; $input = isset($b['input']) ? $b['input'] : null;
        $inObj = isset($mObjs[$i]->content[$k]->input) ? $mObjs[$i]->content[$k]->input : null;
        if (!is_string($id) || strlen($id) > 120 || !in_array($name, $toolNames, true) || !is_array($input) || !is_object($inObj)) amx_bad('tool_use nädogry');
        amx_str(json_encode($inObj, JSON_UNESCAPED_UNICODE), $LIMITS['tool_result'], 'Guralyň girizmesi', $chars, $LIMITS['total_chars']);
        $blocks[] = array('type' => 'tool_use', 'id' => $id, 'name' => $name, 'input' => $inObj);
        continue;
      }
      if ($role === 'assistant' && $type === 'thinking') {
        if (!isset($b['signature']) || !is_string($b['signature'])) amx_bad('thinking blogunda signature ýok');
        $blocks[] = array('type' => 'thinking', 'thinking' => amx_str(isset($b['thinking']) ? $b['thinking'] : '', 200000, 'Thinking', $chars, $LIMITS['total_chars'] + 200000), 'signature' => $b['signature']);
        continue;
      }
      if ($role === 'assistant' && $type === 'redacted_thinking') {
        if (!isset($b['data']) || !is_string($b['data'])) amx_bad('redacted_thinking nädogry');
        $blocks[] = array('type' => 'redacted_thinking', 'data' => $b['data']);
        continue;
      }
      amx_bad('Rugsat berilmedik blok: ' . substr((string)$type, 0, 40));
    }
    $clean[] = array('role' => $role, 'content' => $blocks);
  }
  if ($clean[0]['role'] !== 'user') amx_bad('Söhbet ulanyjynyň habary bilen başlamaly');
  if ($clean[count($clean) - 1]['role'] !== 'user') amx_bad('Söhbet ulanyjynyň habary bilen gutarmaly');
} catch (RuntimeException $e) {
  $d = json_decode($e->getMessage(), true);
  amx_err($d[0], $d[1], $d[2]);
}

/* ---------------------------------------------------------------- çäklendirme (IP boýunça we umumy günlük) */
$dir = null;
foreach (array($cfg['data_dir'], sys_get_temp_dir() . '/amatly-ai', __DIR__ . '/.ai-data') as $cand) {
  if (!$cand) continue;
  if (!is_dir($cand)) @mkdir($cand, 0700, true);
  if (is_dir($cand) && is_writable($cand)) { $dir = $cand; break; }
}
if ($dir === __DIR__ . '/.ai-data' && !is_file($dir . '/.htaccess')) @file_put_contents($dir . '/.htaccess', "Require all denied\nDeny from all\n");
if ($dir !== null) {
  $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
  $now = time(); $day = gmdate('Y-m-d');
  $fh = @fopen($dir . '/limits.json', 'c+');
  if ($fh && flock($fh, LOCK_EX)) {
    $st = json_decode((string)stream_get_contents($fh), true);
    if (!is_array($st) || !isset($st['day']) || $st['day'] !== $day) $st = array('day' => $day, 'total' => 0, 'ips' => array());
    $key = sha1($ip);
    $rec = isset($st['ips'][$key]) ? $st['ips'][$key] : array('t' => array(), 'n' => 0);
    $rec['t'] = array_values(array_filter($rec['t'], function ($x) use ($now) { return $now - $x < 600; }));
    $msg = null;
    if ($st['total'] >= (int)$cfg['daily_total']) $msg = 'Saýtyň AI üçin günlük çägi doldy. Ertir täzeden synanyşyň.';
    elseif ($rec['n'] >= (int)$cfg['rate_per_day']) $msg = 'Şu gün üçin AI haýyşlaryňyzyň çägi doldy. Ertir täzeden synanyşyň.';
    elseif (count($rec['t']) >= (int)$cfg['rate_per_10min']) $msg = 'Haýyşlar örän köp boldy. Birnäçe minutdan täzeden synanyşyň.';
    if ($msg === null) { $rec['t'][] = $now; $rec['n']++; $st['total']++; $st['ips'][$key] = $rec; }
    ftruncate($fh, 0); rewind($fh); fwrite($fh, json_encode($st)); fflush($fh);
    flock($fh, LOCK_UN); fclose($fh);
    if ($msg !== null) amx_err(429, 'rate_limit', $msg);
  } elseif ($fh) fclose($fh);
}

/* ---------------------------------------------------------------- Claude API-a ugratmak */
$mode = isset($body['mode']) && $body['mode'] === 'tutor' ? 'tutor' : 'explain';
$cap = $cfg['max_tokens'] ? (int)$cfg['max_tokens'] : (isset($prompt['max_tokens']) ? (int)$prompt['max_tokens'] : 8000);
$want = isset($body['max_tokens']) ? (int)$body['max_tokens'] : 0;
$payload = array(
  'model' => $cfg['model'] ? $cfg['model'] : $prompt['model'],
  'max_tokens' => $want > 0 ? max(256, min($cap, $want)) : $cap,
  'system' => array(array('type' => 'text', 'text' => $prompt['system'] . "\n\n" . (isset($prompt['modes'][$mode]) ? $prompt['modes'][$mode] : ''), 'cache_control' => array('type' => 'ephemeral'))),
  'tools' => $prompt['tools'],
  'messages' => $clean,
  'stream' => true
);
$effort = $cfg['effort'] ? $cfg['effort'] : (isset($prompt['effort']) ? $prompt['effort'] : null);
if ($effort) $payload['output_config'] = array('effort' => $effort);

@ini_set('zlib.output_compression', '0');
@ini_set('output_buffering', '0');
@ini_set('implicit_flush', '1');
while (ob_get_level() > 0) @ob_end_flush();
if (function_exists('apache_setenv')) @apache_setenv('no-gzip', '1');
@set_time_limit(300);

$status = 0; $ctype = ''; $started = false;
$ch = curl_init(rtrim((string)$cfg['base_url'], '/') . '/v1/messages');
curl_setopt_array($ch, array(
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => array('content-type: application/json', 'x-api-key: ' . $cfg['api_key'], 'anthropic-version: 2023-06-01', 'accept: text/event-stream'),
  CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
  CURLOPT_CONNECTTIMEOUT => 20,
  CURLOPT_TIMEOUT => 300,
  CURLOPT_HEADERFUNCTION => function ($ch, $h) use (&$status, &$ctype) {
    if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) $status = (int)$m[1];
    elseif (stripos($h, 'content-type:') === 0) $ctype = trim(substr($h, 13));
    return strlen($h);
  },
  CURLOPT_WRITEFUNCTION => function ($ch, $chunk) use (&$status, &$ctype, &$started) {
    if (!$started) {
      $started = true;
      http_response_code($status ? $status : 502);
      header('Content-Type: ' . ($ctype !== '' ? $ctype : 'application/json; charset=utf-8'));
      header('Cache-Control: no-cache');
      header('X-Accel-Buffering: no');
    }
    echo $chunk;
    @flush();
    return connection_aborted() ? 0 : strlen($chunk);
  }
));
$ok = curl_exec($ch);
$errno = curl_errno($ch);
$error = curl_error($ch);
curl_close($ch);
if (!$started) {
  if ($ok === false || $errno) amx_err(502, 'api_error', 'Claude API bilen baglanyşyk bolmady: ' . $error);
  amx_err($status ? $status : 502, 'api_error', 'Claude API-dan boş jogap geldi.');
}
