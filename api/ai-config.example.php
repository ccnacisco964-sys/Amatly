<?php
/*
 * Amatly AI sazlamalary (nusga).
 *
 * 1) Şu faýly göçürip, adyny ai-config.php ediň (şu papkada).
 *    Has ygtybarly ýol: faýly saýtyň papkasyndan bir dereje ýokarda (public_html-iň daşynda) amatly-ai-config.php adyna goýuň.
 * 2) api_key-e Anthropic Console-dan (https://console.anthropic.com → API Keys) alan açaryňyzy ýazyň.
 * 3) Saýty açyp, Sazlamalar → Amatly AI → «Barla» düwmesine basyň.
 *
 * Şu faýly hasaplar hem okaýar (api/account.php): aşakdaky 'account_*' sazlamalary islege görä.
 * Bu faýl brauzere görkezilmeýär: PHP ony işledýär, .htaccess bolsa göni açylmagyny gadagan edýär.
 * DIKKAT: hostingiňiz PHP-ni işletmeýän bolsa (GitHub Pages, Netlify ýaly diňe statik), açary bu ýere ýazmaň —
 * onda Sazlamalardaky «öz açaryňyz» ýoluny ulanyň.
 */
return array(
  'api_key'        => '',                    // 'sk-ant-...'
  'model'          => 'claude-sonnet-5-5',   // has arzan: 'claude-haiku-5-5'; has güýçli: 'claude-opus-5-5'
  'effort'         => 'medium',              // 'low' — has çalt we arzan, 'high' — has çuň pikirlenýär
  'max_tokens'     => 8000,                  // bir jogabyň iň uly ölçegi (pikirlenmek hem şuňa girýär)
  'rate_per_10min' => 40,                    // bir IP salgydan 10 minutda iň köp haýyş
  'rate_per_day'   => 400,                   // bir IP salgydan günde iň köp haýyş
  'daily_total'    => 3000,                  // ähli ulanyjylardan günde iň köp haýyş (çykdajy goragy)
  'allowed_origins'=> array(),               // başga domenden ulanmaga rugsat, mysal: array('https://www.amatly.com')

  // Hasaplar (api/account.php) — bu setirler hökman däl:
  // 'account_dir'      => '/home/ulanyjy/amatly-data',  // hasaplaryň bukjasy (deslapky: saýtyň bukjasyndan bir dereje ýokarda amatly-data)
  // 'accounts'         => false,                        // hasaplary serwerde saklamazlyk (onda hasap diňe brauzerde)
  // 'account_allow_http' => true,                       // HTTPS-siz rugsat — DIŇE synag üçin (parol açyk baglanyşykda gider)
);
