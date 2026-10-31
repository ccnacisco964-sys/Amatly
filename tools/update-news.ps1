# Amatly.com: habarlary awtomatik almak. Çeşmeler: tools\sources.json (Turkmenportal "Bilim" + resmi RSS).
# Netije: assets\taze-pikirler\js\news-auto.js. Köne habarlar tools\news-archive.json faýlynda saklanýar.
# Suratlar (sources.json -> "images"):
#   "save" - habaryň asyl suratyny ýükläp, assets\taze-pikirler\images\habarlar\h-<id>.jpg görnüşinde saklaýar (maslahat berilýär)
#   "link" - surat çeşmäniň saýtyndan göni görkezilýär (ýüklenmeýär)
#   "off"  - surat alynmaýar, diňe Amatly.com-yň öz suratlary görkezilýär
$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
$Root = Split-Path -Parent $PSScriptRoot
$Out = Join-Path $Root 'assets\taze-pikirler\js\news-auto.js'
$Archive = Join-Path $PSScriptRoot 'news-archive.json'
$Cfg = Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'sources.json') | ConvertFrom-Json
$UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
$Keys = New-Object Text.RegularExpressions.Regex($Cfg.keywords, 'IgnoreCase')
$MaxTotal = 60
$Today = (Get-Date).Date
$ImgDir = Join-Path $Root 'assets\taze-pikirler\images\habarlar'
$ImgRel = '../assets/taze-pikirler/images/habarlar/'
$ImgMode = 'save'
if ($Cfg.images) { $ImgMode = ([string]$Cfg.images).Trim().ToLower() }
if (@('save', 'link', 'off') -notcontains $ImgMode) { $ImgMode = 'save' }
$MaxImgJobs = 25
$MaxImgBytes = 4194304
$imgJobs = 0

function Get-Resp([string]$url) {
  for ($try = 1; $try -le 3; $try++) {
    try { return Invoke-WebRequest -UseBasicParsing -Uri $url -UserAgent $UA -TimeoutSec 30 }
    catch {
      if ($try -ge 3) { throw }
      Start-Sleep -Seconds (2 * $try)
    }
  }
}
function Get-Bytes([string]$url) {
  $ms = (Get-Resp $url).RawContentStream
  $ms.Position = 0
  $b = New-Object byte[] $ms.Length
  [void]$ms.Read($b, 0, $b.Length)
  return ,$b
}
function Get-Text([string]$url) {
  return [Text.Encoding]::UTF8.GetString((Get-Bytes $url)).TrimStart([char]0xFEFF)
}
function Clean([string]$s, [int]$n) {
  $s = [Net.WebUtility]::HtmlDecode([regex]::Replace($s, '<[^>]+>', ' '))
  $s = ([regex]::Replace($s, '\s+', ' ')).Trim()
  if ($n -gt 0 -and $s.Length -gt $n) { $s = $s.Substring(0, $n - 3).TrimEnd() + '...' }
  return $s
}
function Get-Cat([string]$t) {
  if ($t -match 'matemat|mathemat|algebra|geometr|математ') { return 'matematika' }
  if ($t -match 'olimpiad|olympiad|олимпиад|bäsleşik|ýaryş|competition|contest') { return 'olimpiada' }
  return 'bilim'
}
function Get-Hash([string]$s) {
  $h = [Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($s))
  return ([BitConverter]::ToString($h).Replace('-', '').ToLower()).Substring(0, 10)
}
function Get-Meta([string]$html, [string]$name) {
  foreach ($m in [regex]::Matches($html, '<meta\s(?:[^>"'']|"[^"]*"|''[^'']*'')*>', 'IgnoreCase')) {
    $tag = $m.Value
    if ($tag -match ('(?:property|name)\s*=\s*["'']' + [regex]::Escape($name) + '["'']')) {
      if ($tag -match 'content\s*=\s*"([^"]*)"') { return [Net.WebUtility]::HtmlDecode($Matches[1]) }
      if ($tag -match "content\s*=\s*'([^']*)'") { return [Net.WebUtility]::HtmlDecode($Matches[1]) }
    }
  }
  return ''
}
function Get-Node($n, [string]$name) {
  $e = $n.SelectSingleNode("*[local-name()='" + $name + "']")
  if ($e) { return $e.InnerText.Trim() } else { return '' }
}
function Get-RssImg($n) {
  foreach ($nm in @('enclosure', 'content', 'thumbnail', 'image')) {
    $e = $n.SelectSingleNode("*[local-name()='" + $nm + "']")
    if ($e) {
      $u = $e.GetAttribute('url')
      if (-not $u) { $u = $e.InnerText.Trim() }
      if ($u -match '^https?://') { return $u }
    }
  }
  return ''
}
function Find-Date([string]$html) {
  $d = Get-Meta $html 'article:published_time'
  if (-not $d -and $html -match 'datePublished\\?"\s*:\s*\\?"(\d{4}-\d{2}-\d{2})') { $d = $Matches[1] }
  if (-not $d -and $html -match '<time[^>]*datetime="(\d{4}-\d{2}-\d{2})') { $d = $Matches[1] }
  if ($d -match '^(\d{4}-\d{2}-\d{2})') { return $Matches[1] }
  return $Today.ToString('yyyy-MM-dd')
}
# Suratyň hakykatdan surat faýlydygyny ilkinji baýtlary boýunça barlaýarys
function Get-ImgExt($b) {
  if ($b.Length -lt 2000) { return '' }
  if ($b[0] -eq 0xFF -and $b[1] -eq 0xD8 -and $b[2] -eq 0xFF) { return '.jpg' }
  if ($b[0] -eq 0x89 -and $b[1] -eq 0x50 -and $b[2] -eq 0x4E -and $b[3] -eq 0x47) { return '.png' }
  if ($b[0] -eq 0x47 -and $b[1] -eq 0x49 -and $b[2] -eq 0x46) { return '.gif' }
  if ($b[0] -eq 0x52 -and $b[1] -eq 0x49 -and $b[2] -eq 0x46 -and $b[3] -eq 0x46 -and
      $b[8] -eq 0x57 -and $b[9] -eq 0x45 -and $b[10] -eq 0x42 -and $b[11] -eq 0x50) { return '.webp' }
  return ''
}
# Sahypadan surat salgylaryny tertip bilen ýygnaýar: og:image, twitter:image, image_src,
# soňra makaladaky ýüklenen suratlar (/uploads/, /storage/, /media/). Logo we nyşanlar alynmaýar.
# Otnositel salgylar doly salga öwrülýär; "/index.php/storage/..." ýaly salgylaryň arassa görnüşi hem synanylýar.
function Get-ImgCandidates([string]$html, [string]$pageUrl) {
  $raw = New-Object Collections.ArrayList
  foreach ($nm in @('og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image', 'twitter:image:src')) {
    $v = Get-Meta $html $nm
    if ($v) { [void]$raw.Add($v) }
  }
  $m = [regex]::Match($html, '<link[^>]+rel\s*=\s*["'']image_src["''][^>]*href\s*=\s*["'']([^"'']+)', 'IgnoreCase')
  if ($m.Success) { [void]$raw.Add($m.Groups[1].Value) }
  foreach ($mm in [regex]::Matches($html, '<img[^>]+src\s*=\s*["'']([^"'']+)["'']', 'IgnoreCase')) {
    $v = $mm.Groups[1].Value
    if ($v -match '(?i)/(uploads|storage|media)/' -and $v -match '(?i)\.(jpe?g|png|webp)(\?|$)') { [void]$raw.Add($v) }
    if ($raw.Count -ge 12) { break }
  }
  $out = New-Object Collections.ArrayList
  foreach ($u in $raw) {
    $u = [Net.WebUtility]::HtmlDecode(([string]$u).Trim())
    if (-not $u -or $u.StartsWith('data:')) { continue }
    try { $abs = (New-Object Uri((New-Object Uri($pageUrl)), $u)).AbsoluteUri } catch { continue }
    if ($abs -notmatch '^https?://') { continue }
    if ($abs -match '(?i)logo|favicon|apple-touch|/icons?/|sprite|avatar|placeholder|no-?image|default\.(png|jpe?g)') { continue }
    foreach ($v in @($abs, ($abs -replace '/index\.php/', '/'))) {
      if (-not $out.Contains($v)) { [void]$out.Add($v) }
    }
  }
  return ,$out
}
# Öň ýüklenen surat bar bolsa, täzeden ýüklemeýäris
function Find-SavedImg([string]$id) {
  foreach ($e in @('.jpg', '.png', '.webp', '.gif')) {
    if (Test-Path (Join-Path $ImgDir ('h-' + $id + $e))) { return $ImgRel + 'h-' + $id + $e }
  }
  return ''
}
# Dalaşgärleri birin-birin synap görýär; ilkinji hakyky surat saklanýar
function Save-Img($urls, [string]$id) {
  if ($ImgMode -eq 'off') { return '' }
  $list = @($urls | Where-Object { $_ })
  if ($list.Count -eq 0) { return '' }
  if ($ImgMode -eq 'link') { return [string]$list[0] }
  $have = Find-SavedImg $id
  if ($have) { return $have }
  if ($script:imgJobs -ge $MaxImgJobs) { return '' }
  $n = 0
  foreach ($url in $list) {
    if ($n -ge 4) { break }
    $n++
    try {
      $b = Get-Bytes ([string]$url)
      if ($b.Length -gt $MaxImgBytes) { continue }
      $ext = Get-ImgExt $b
      if (-not $ext) { continue }
      if (-not (Test-Path $ImgDir)) { [void](New-Item -ItemType Directory -Path $ImgDir -Force) }
      $name = 'h-' + $id + $ext
      [IO.File]::WriteAllBytes((Join-Path $ImgDir $name), $b)
      $script:imgJobs++
      return $ImgRel + $name
    } catch { }
  }
  return ''
}
# Arhiwden gelen obýektleri hem redaktirläp bolýan görnüşe getirýäris
function ConvertTo-Map($o) {
  if ($o -is [Collections.IDictionary]) { return $o }
  $m = [ordered]@{}
  foreach ($p in $o.PSObject.Properties) { $m[$p.Name] = $p.Value }
  if ($m['source'] -and -not ($m['source'] -is [Collections.IDictionary])) {
    $s = [ordered]@{}
    foreach ($q in $m['source'].PSObject.Properties) { $s[$q.Name] = $q.Value }
    $m['source'] = $s
  }
  return $m
}

# Öňki habarlar (arhiw): saklanan sene we düşündiriş üýtgemeýär
$known = @{}
if (Test-Path $Archive) {
  try {
    # Windows PowerShell 5.1 massiwi bir bütin hökmünde berýär: @() ulanmaýarys, foreach özi sanaýar
    $old = Get-Content -Raw -Encoding UTF8 $Archive | ConvertFrom-Json
    foreach ($o in $old) {
      if ($o.id) {
        $m = ConvertTo-Map $o
        if ($m['date'] -is [datetime]) { $m['date'] = $m['date'].ToString('yyyy-MM-dd') }
        $known[[string]$m['id']] = $m
      }
    }
  } catch { Write-Host 'Arhiw okalmady, täzeden başlaýaryn.' }
}
$fresh = @{}

function Read-Turkmenportal($src) {
  $html = Get-Text $src.url
  $found = New-Object Collections.Specialized.OrderedDictionary
  foreach ($m in [regex]::Matches($html, '<a[^>]+href="(/tm/news/\d+-[a-z0-9-]+)"[^>]*>(.*?)</a>', 'Singleline,IgnoreCase')) {
    $u = 'https://turkmenportal.com' + $m.Groups[1].Value
    $label = Clean $m.Groups[2].Value 0
    $d = $null
    if ($label -match 'Şu gün') { $d = $Today } elseif ($label -match 'Düýn') { $d = $Today.AddDays(-1) }
    # 1-nji baglanyşyk diňe surat bolsa, sene şol habaryň 2-nji baglanyşygyndan alynýar
    if ($found.Contains($u)) { if ($d -and -not $found[$u]) { $found[$u] = $d }; continue }
    $found.Add($u, $d)
  }
  if ($found.Count -eq 0) {
    foreach ($m in [regex]::Matches($html, '/tm/news/\d+-[a-z0-9-]+')) {
      $u = 'https://turkmenportal.com' + $m.Value
      if (-not $found.Contains($u)) { $found.Add($u, $null) }
    }
  }
  if ($found.Count -eq 0) { throw 'habar salgylary tapylmady (sahypanyň gurluşy üýtgän bolmagy mümkin)' }
  $i = 0
  foreach ($u in @($found.Keys)) {
    if ($i -ge [int]$src.max) { break }
    $i++
    $id = 'tp-' + [regex]::Match($u, '/news/(\d+)-').Groups[1].Value
    if ($known.ContainsKey($id)) { $fresh[$id] = $known[$id]; continue }
    try {
      $a = Get-Text $u
      $title = ((Get-Meta $a 'og:title') -replace '\s*\|\s*Turkmenportal(\.com)?\s*$', '').Trim()
      if (-not $title) { continue }
      $desc = Clean (Get-Meta $a 'og:description') 220
      if ($found[$u]) { $date = $found[$u].ToString('yyyy-MM-dd') } else { $date = Find-Date $a }
      $it = [ordered]@{ id = $id; date = $date; cat = (Get-Cat ($title + ' ' + $desc)); lang = $src.lang; title = $title; summary = $desc; source = [ordered]@{ name = $src.name; url = $u } }
      $sv = Save-Img (Get-ImgCandidates $a $u) $id
      if ($sv) { $it['image'] = $sv }
      $fresh[$id] = $it
      Write-Host ('  + ' + $title)
    } catch { Write-Host ('  ! ' + $u + ' : ' + $_.Exception.Message) }
  }
}

function Read-Rss($src) {
  $x = New-Object Xml.XmlDocument
  $x.LoadXml((Get-Text $src.url))
  $i = 0
  foreach ($n in $x.SelectNodes("//*[local-name()='item' or local-name()='entry']")) {
    if ($i -ge [int]$src.max) { break }
    $title = Clean (Get-Node $n 'title') 0
    $link = Get-Node $n 'link'
    if (-not $link) { $ln = $n.SelectSingleNode("*[local-name()='link']"); if ($ln) { $link = $ln.GetAttribute('href') } }
    if (-not $title -or -not $link) { continue }
    if ($src.urlContains -and $link.IndexOf([string]$src.urlContains) -lt 0) { continue }
    $desc = Get-Node $n 'description'
    if (-not $desc) { $desc = Get-Node $n 'summary' }
    $desc = Clean $desc 220
    if ($src.filter -and -not $Keys.IsMatch($title + ' ' + $desc)) { continue }
    $i++
    $id = $src.id + '-' + (Get-Hash $link)
    if ($known.ContainsKey($id)) { $fresh[$id] = $known[$id]; continue }
    $ds = Get-Node $n 'pubDate'
    if (-not $ds) { $ds = Get-Node $n 'published' }
    if (-not $ds) { $ds = Get-Node $n 'updated' }
    try { $date = [DateTimeOffset]::Parse($ds, [Globalization.CultureInfo]::InvariantCulture).ToString('yyyy-MM-dd') } catch { $date = $Today.ToString('yyyy-MM-dd') }
    $it = [ordered]@{ id = $id; date = $date; cat = (Get-Cat ($title + ' ' + $desc)); lang = $src.lang; title = $title; summary = $desc; source = [ordered]@{ name = $src.name; url = $link } }
    $im = Get-RssImg $n
    if ($im) { $sv = Save-Img @($im, ($im -replace '/index\.php/', '/')) $id; if ($sv) { $it['image'] = $sv } }
    $fresh[$id] = $it
    Write-Host ('  + ' + $title)
  }
}

foreach ($src in $Cfg.sources) {
  Write-Host ($src.name + ' ...')
  try {
    if ($src.type -eq 'turkmenportal') { Read-Turkmenportal $src }
    elseif ($src.type -eq 'rss') { Read-Rss $src }
    else { Write-Host ('  ! näbelli görnüş: ' + $src.type) }
  } catch { Write-Host ('  ! ' + $src.name + ' : ' + $_.Exception.Message) }
}

# Arhiwdäki ýöne bu gezek tapylmadyk habarlar hem galýar (iň köp $MaxTotal)
foreach ($k in $known.Keys) { if (-not $fresh.ContainsKey($k)) { $fresh[$k] = $known[$k] } }

# Suratsyz habarlara asyl sahypadan surat alýarys; ýitirilen faýllar hem täzeden alynýar
if ($ImgMode -eq 'off') {
  foreach ($k in @($fresh.Keys)) { if ($fresh[$k].Contains('image')) { $fresh[$k].Remove('image') } }
} else {
  Write-Host 'Suratlar ...'
  $tries = 0
  $noImg = [ordered]@{}
  foreach ($k in @($fresh.Keys)) {
    $it = $fresh[$k]
    $cur = ''
    if ($it.Contains('image')) { $cur = [string]$it['image'] }
    if ($cur -and -not $cur.StartsWith('http')) {
      if (Test-Path (Join-Path $ImgDir (Split-Path $cur -Leaf))) { continue }
      $it.Remove('image')
      $cur = ''
    }
    if ($cur) {
      if ($ImgMode -eq 'link') { continue }
      $sv = Save-Img @($cur, ($cur -replace '/index\.php/', '/')) $k   # "link"-den "save"-a geçilse, ýükläp alýarys
      if ($sv) { $it['image'] = $sv } else { $it.Remove('image') }
      continue
    }
    if ($ImgMode -eq 'save') {
      $have = Find-SavedImg $k
      if ($have) { $it['image'] = $have; continue }
    }
    if ($tries -ge $MaxImgJobs -or $script:imgJobs -ge $MaxImgJobs) { $noImg[$k] = 'indiki gezek synanyşylar'; continue }
    $u = ''
    if ($it['source']) { $u = [string]$it['source']['url'] }
    if ($u -notmatch '^https?://') { $noImg[$k] = 'çeşme salgysy ýok'; continue }
    $tries++
    try { $html = Get-Text $u } catch { $noImg[$k] = 'habaryň sahypasy açylmady'; continue }
    $c = Get-ImgCandidates $html $u
    if ($c.Count -eq 0) { $noImg[$k] = 'sahypada surat ýok'; continue }
    $sv = Save-Img $c $k
    if ($sv) { $it['image'] = $sv; Write-Host ('  + surat: ' + $it['title']) }
    else { $noImg[$k] = 'surat faýly ýüklenmedi' }
  }
}

# Dürli çeşmeden gelen bir hili sözbaşyly habary bir gezek goşýarys
$seenTitles = @{}
$uniq = New-Object Collections.ArrayList
foreach ($it in ($fresh.Values | Sort-Object -Property @{ Expression = { $_.date }; Descending = $true })) {
  $tk = ([regex]::Replace(([string]$it.title).ToLower(), '[^\p{L}\p{N}]+', ' ')).Trim()
  if ($seenTitles.ContainsKey($tk)) { continue }
  $seenTitles[$tk] = 1
  [void]$uniq.Add($it)
}
$final = @($uniq | Select-Object -First $MaxTotal)
if ($final.Count -eq 0) { throw 'Hiç bir habar alynmady. Internet baglanyşygyny barlaň.' }

# Ulanylmaýan ýüklenen suratlary pozýarys (diňe h- bilen başlaýanlar; Amatly.com-yň suratlaryna degmeýäris)
if (Test-Path $ImgDir) {
  $used = @{}
  foreach ($it in $final) { if ($it.Contains('image')) { $used[[string](Split-Path ([string]$it['image']) -Leaf)] = 1 } }
  foreach ($f in @(Get-ChildItem -Path $ImgDir -Filter 'h-*' -File -ErrorAction SilentlyContinue)) {
    if (-not $used.ContainsKey($f.Name)) { Remove-Item $f.FullName -Force -ErrorAction SilentlyContinue }
  }
}

$json = ConvertTo-Json -InputObject $final -Depth 4
$utf8 = New-Object Text.UTF8Encoding $false
[IO.File]::WriteAllText($Archive, $json, $utf8)
$stamp = Get-Date -Format 's'
$text = '/* Awtomatik döredildi: tools\habarlary-tazele.bat. Elde üýtgetmäň. */' + "`r`n" + 'window.AMATLY_NEWS_AUTO = ' + $json + ';' + "`r`n" + 'window.AMATLY_NEWS_UPDATED = "' + $stamp + '";' + "`r`n"
[IO.File]::WriteAllText($Out, $text, $utf8)
$miss = @($final | Where-Object { -not $_.Contains('image') })
if ($ImgMode -ne 'off' -and $miss.Count -gt 0) {
  Write-Host ''
  Write-Host ('Suraty tapylmadyk habarlar (' + $miss.Count + '): olarda Amatly.com-yň öz suraty görkezilýär.')
  foreach ($it in $miss) {
    $why = 'sebäbi näbelli'
    if ($noImg -and $noImg.Contains([string]$it['id'])) { $why = $noImg[[string]$it['id']] }
    $t = [string]$it['title']; if ($t.Length -gt 70) { $t = $t.Substring(0, 67) + '...' }
    Write-Host ('  - ' + $t + '  [' + $why + ']')
  }
}
Write-Host ''
Write-Host ('Taýýar: ' + $final.Count + ' habar, ' + $imgJobs + ' täze surat. Sahypany täzeläň (Ctrl+F5).')
