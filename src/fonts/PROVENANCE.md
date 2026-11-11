# Bundled font provenance

These files replace the `next/font/google` download. They are the woff2 files
Google Fonts returned on 8 Nov 2026 for the same CSS2 requests Next.js 16.4
makes from `src/app/layout.tsx`, using the Chrome/104 user agent in
`next/dist/compiled/@next/font/dist/google/fetch-resource.js`.

A replay of those four responses contained 81 `src` URLs, and every one ended
in `.woff2`. The production loader crash (`exec(...)[1]` on a URL with no font
extension) was not present in this response. The files are vendored so the
build no longer depends on that response.

The existing declarations request normal style and explicit weights, not a
variable-axis range. Fraunces, IBM Plex Sans, and Manrope still arrive as
weight-axis variable files, and the CSS points at the same file once per
requested weight, which is what Google's stylesheet does. IBM Plex Mono arrives
as one static file per weight. IBM Plex Sans keeps `font-stretch: 100%`.

Subsets in the stylesheet, all of which are bundled:

| Family | Subsets |
| --- | --- |
| Fraunces | vietnamese, latin-ext, latin |
| IBM Plex Sans | cyrillic-ext, cyrillic, greek, vietnamese, latin-ext, latin |
| IBM Plex Mono | cyrillic-ext, cyrillic, vietnamese, latin-ext, latin |
| Manrope | cyrillic-ext, cyrillic, greek, vietnamese, latin-ext, latin |

Fallback metrics are the values `calculateSizeAdjustValues` in Next 16.4.0
returns for these families: Fraunces 84.71 / 22.09 / 0 / 115.45 on Times New
Roman, IBM Plex Sans 101.32 / 27.18 / 0 / 101.17 on Arial, IBM Plex Mono 76.16 /
20.43 / 0 / 134.59 on Arial, Manrope 103.31 / 29.07 / 0 / 103.19 on Arial.

## Licenses

All three families are SIL Open Font License 1.1. The license files are the
upstream texts and must stay with the fonts.

| Family | Copyright | License file | Upstream license |
| --- | --- | --- | --- |
| Fraunces | Copyright 2018 The Fraunces Project Authors (https://github.com/undercasetype/Fraunces) | `OFL-fraunces.txt` | https://github.com/google/fonts/blob/main/ofl/fraunces/OFL.txt |
| IBM Plex Sans and IBM Plex Mono | Copyright 2017 IBM Corp. Reserved font name "Plex". | `OFL-ibm-plex.txt` | https://github.com/IBM/plex/blob/master/LICENSE.txt |
| Manrope | Copyright 2018 The Manrope Project Authors (https://github.com/googlefonts/manrope) | `OFL-manrope.txt` | https://github.com/google/fonts/blob/main/ofl/manrope/OFL.txt |

## CSS requests

User agent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36`

| Family | CSS2 URL |
| --- | --- |
| Fraunces | `https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700;800&display=swap` |
| IBM Plex Sans | `https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap` |
| IBM Plex Mono | `https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600;700&display=swap` |
| Manrope | `https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap` |

## Files

Hashes are SHA-256 of the bytes in `public/fonts/`. `src/fonts/manifest.json` is the same list, and the font test checks every file against it.

| Family | Subset | Weights | File | Bytes | SHA-256 | Source |
| --- | --- | --- | --- | --- | --- | --- |
| Fraunces | vietnamese | 500, 600, 700, 800 | `fraunces-vietnamese.woff2` | 11536 | `250cc2966c658fb6d336731de9d82a8129025e9839c20c253bbc477852f6cf4f` | https://fonts.gstatic.com/s/fraunces/v38/6NUu8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib14c0qv8oRcTnaIM.woff2 |
| Fraunces | latin-ext | 500, 600, 700, 800 | `fraunces-latin-ext.woff2` | 33640 | `f1451edd6434085c4f9f3a8b4a674182dd7d6acccf53bfced19fd167f0705a06` | https://fonts.gstatic.com/s/fraunces/v38/6NUu8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib14c1qv8oRcTnaIM.woff2 |
| Fraunces | latin | 500, 600, 700, 800 | `fraunces-latin.woff2` | 36560 | `88e17be075f1be50ab67b057b99e3701b828f44ed28f9452df6c02645bb0cba9` | https://fonts.gstatic.com/s/fraunces/v38/6NUu8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib14c7qv8oRcTn.woff2 |
| IBM Plex Sans | cyrillic-ext | 400, 500, 600, 700 | `ibm-plex-sans-cyrillic-ext.woff2` | 19684 | `c01b3de8c8058462caadd044a6b874a9f4d7098d7d71d6c70e6a278096b8640e` | https://fonts.gstatic.com/s/ibmplexsans/v23/zYXzKVElMYYaJe8bpLHnCwDKr932-G7dytD-Dmu1syxTKYbSB4ZhRNU.woff2 |
| IBM Plex Sans | cyrillic | 400, 500, 600, 700 | `ibm-plex-sans-cyrillic.woff2` | 25408 | `5bac72520e0a9a5669e08b15fa1e15be6f4da74aa0b2d4315a97c11e1465120a` | https://fonts.gstatic.com/s/ibmplexsans/v23/zYXzKVElMYYaJe8bpLHnCwDKr932-G7dytD-Dmu1syxaKYbSB4ZhRNU.woff2 |
| IBM Plex Sans | greek | 400, 500, 600, 700 | `ibm-plex-sans-greek.woff2` | 16296 | `a29d4e6345cdb7e2b6daabf4961a6dcafcbc7ed1eac26186ca4a004cd32d64d8` | https://fonts.gstatic.com/s/ibmplexsans/v23/zYXzKVElMYYaJe8bpLHnCwDKr932-G7dytD-Dmu1syxdKYbSB4ZhRNU.woff2 |
| IBM Plex Sans | vietnamese | 400, 500, 600, 700 | `ibm-plex-sans-vietnamese.woff2` | 9612 | `526a4dd36c3af41f73a623e852302d8947d7fd4c00ee3026d82ef1f24a412fcd` | https://fonts.gstatic.com/s/ibmplexsans/v23/zYXzKVElMYYaJe8bpLHnCwDKr932-G7dytD-Dmu1syxRKYbSB4ZhRNU.woff2 |
| IBM Plex Sans | latin-ext | 400, 500, 600, 700 | `ibm-plex-sans-latin-ext.woff2` | 25868 | `ae1d854fefa1167a79071f1afe01d4d51b60c5840c1be36dd74bd5fe7375b405` | https://fonts.gstatic.com/s/ibmplexsans/v23/zYXzKVElMYYaJe8bpLHnCwDKr932-G7dytD-Dmu1syxQKYbSB4ZhRNU.woff2 |
| IBM Plex Sans | latin | 400, 500, 600, 700 | `ibm-plex-sans-latin.woff2` | 40240 | `056e4e2459f57a0033c8c9c844ff19d6e42ac8602027803d4345823bcc939818` | https://fonts.gstatic.com/s/ibmplexsans/v23/zYXzKVElMYYaJe8bpLHnCwDKr932-G7dytD-Dmu1syxeKYbSB4Zh.woff2 |
| IBM Plex Mono | cyrillic-ext | 500 | `ibm-plex-mono-cyrillic-ext-500.woff2` | 4336 | `311098be73eac339128f0b5a6e33d72645b6f87488541fdf467c402152d297fd` | https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3twJwl1FgsAXHNlYzg.woff2 |
| IBM Plex Mono | cyrillic | 500 | `ibm-plex-mono-cyrillic-500.woff2` | 5500 | `d524dc8ff6dbf7ed69772f3b2ff4affaf5a89b5762b270e36c3f21da0d4e39f5` | https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3twJwlRFgsAXHNlYzg.woff2 |
| IBM Plex Mono | vietnamese | 500 | `ibm-plex-mono-vietnamese-500.woff2` | 4036 | `b2529fba93fd07a50ffb8fc3d103eb04b0c298d4f6564d2833c44fde286de7e4` | https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3twJwl9FgsAXHNlYzg.woff2 |
| IBM Plex Mono | latin-ext | 500 | `ibm-plex-mono-latin-ext-500.woff2` | 8848 | `77f03e26f981c582bdba3a7abed4baa2d3149211c01366bb3ab3ba7622ec4ae5` | https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3twJwl5FgsAXHNlYzg.woff2 |
| IBM Plex Mono | latin | 500 | `ibm-plex-mono-latin-500.woff2` | 10060 | `a76f53ca6612e7b3828eec2311098675b7f9849ae4169a8bcef6302aec02a6c0` | https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3twJwlBFgsAXHNk.woff2 |
| IBM Plex Mono | cyrillic-ext | 600 | `ibm-plex-mono-cyrillic-ext-600.woff2` | 4320 | `f746246b6b0b641f99d9e26e0bf4e42197bde692126857857f0195a94362d52a` | https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3vAOwl1FgsAXHNlYzg.woff2 |
| IBM Plex Mono | cyrillic | 600 | `ibm-plex-mono-cyrillic-600.woff2` | 5548 | `b814a03d7e57b0626a906f76911b9361d173a1aabc5544c40f72d6a35a1e4940` | https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3vAOwlRFgsAXHNlYzg.woff2 |
| IBM Plex Mono | vietnamese | 600 | `ibm-plex-mono-vietnamese-600.woff2` | 4116 | `69744cabbccc9faf77516ce9b744361e1e6be7f8081400006035a153797d2965` | https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3vAOwl9FgsAXHNlYzg.woff2 |
| IBM Plex Mono | latin-ext | 600 | `ibm-plex-mono-latin-ext-600.woff2` | 8960 | `1b6b18fd0fd240bc6d5850f4df621484722d4b5d3650ebdd1e3a8bbd81c75854` | https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3vAOwl5FgsAXHNlYzg.woff2 |
| IBM Plex Mono | latin | 600 | `ibm-plex-mono-latin-600.woff2` | 10120 | `ad4580d8cb4b5f627c2d18457656732f7f7b070f7837fbc380e08054157e6f6c` | https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3vAOwlBFgsAXHNk.woff2 |
| IBM Plex Mono | cyrillic-ext | 700 | `ibm-plex-mono-cyrillic-ext-700.woff2` | 4344 | `c7fa87a1d7be5a6f94a1039b4c43d8ac2e8af035280dabcc5734d0da9f6afcf2` | https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3pQPwl1FgsAXHNlYzg.woff2 |
| IBM Plex Mono | cyrillic | 700 | `ibm-plex-mono-cyrillic-700.woff2` | 5540 | `bb7642ad6085595ee4d28c89965450943c78e9772403e79e655d4e347a293d12` | https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3pQPwlRFgsAXHNlYzg.woff2 |
| IBM Plex Mono | vietnamese | 700 | `ibm-plex-mono-vietnamese-700.woff2` | 4064 | `429a912c8121ee6755458dc215abed11c9e783d6ce0fea883f699823bdd0a62a` | https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3pQPwl9FgsAXHNlYzg.woff2 |
| IBM Plex Mono | latin-ext | 700 | `ibm-plex-mono-latin-ext-700.woff2` | 8748 | `099842414ddad0cb366cf984641b14e75c01a2c6e3f42fa13a6e89d1f4c3fc20` | https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3pQPwl5FgsAXHNlYzg.woff2 |
| IBM Plex Mono | latin | 700 | `ibm-plex-mono-latin-700.woff2` | 10128 | `9e1455e6e9c5866f607e464fffb7855486dcf575b7e69b83a3d234e587fce41b` | https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3pQPwlBFgsAXHNk.woff2 |
| Manrope | cyrillic-ext | 400, 500, 600, 700, 800 | `manrope-cyrillic-ext.woff2` | 2584 | `347c589d57130c68f9829c2cd24969eed590328078ff921ca6000a56e5a2cc84` | https://fonts.gstatic.com/s/manrope/v23/xn7gYHE41ni1AdIRggqxSvfedN62Zw.woff2 |
| Manrope | cyrillic | 400, 500, 600, 700, 800 | `manrope-cyrillic.woff2` | 14368 | `93bef303b8220d2f59dbe8db119891c9f38d94f48a26d373c28256fb2b50cba7` | https://fonts.gstatic.com/s/manrope/v23/xn7gYHE41ni1AdIRggOxSvfedN62Zw.woff2 |
| Manrope | greek | 400, 500, 600, 700, 800 | `manrope-greek.woff2` | 9308 | `6b478f45d63e18352735fd427e92ae4704800a998ec3337c01b59e4f6ef87d44` | https://fonts.gstatic.com/s/manrope/v23/xn7gYHE41ni1AdIRggSxSvfedN62Zw.woff2 |
| Manrope | vietnamese | 400, 500, 600, 700, 800 | `manrope-vietnamese.woff2` | 8356 | `ddbf28cebf2fbbf800d307f020689bed6d1a96c5a22aed50fee23bf7de80d0f1` | https://fonts.gstatic.com/s/manrope/v23/xn7gYHE41ni1AdIRggixSvfedN62Zw.woff2 |
| Manrope | latin-ext | 400, 500, 600, 700, 800 | `manrope-latin-ext.woff2` | 15212 | `27eccb1f8944bc26f6511601bac9284786feb5e5bbb0c8035ff09ac63aaf7c52` | https://fonts.gstatic.com/s/manrope/v23/xn7gYHE41ni1AdIRggmxSvfedN62Zw.woff2 |
| Manrope | latin | 400, 500, 600, 700, 800 | `manrope-latin.woff2` | 24436 | `8bd97e6bbbc1f602a8f791530eed1064c9a357d5731bbc76e3fc587fb068728f` | https://fonts.gstatic.com/s/manrope/v23/xn7gYHE41ni1AdIRggexSvfedN4.woff2 |
