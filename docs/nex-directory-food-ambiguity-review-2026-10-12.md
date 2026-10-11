# NEX Directory · Food ambiguity review · 2026-10-12

**Subject set**: 115 `nex.food_business` rows (country=ID) whose approved candidates were refused by `precheckHandoff` with `resolver_ambiguous`.
**Mechanism**: name + city match against `nex.business_canonical` (VERIFIED/OWNER_CLAIMED/OWNER_VERIFIED), haversine distance from candidate coordinates to each match.
**No DB writes made.**

## Bucket distribution

| Bucket | Count | Recommendation |
|---|---|---|
| singleton | 46 | approve as new canonical (safe) |
| likely_new_branch | 19 | approve as new canonical (chain branch > 2 km from any existing) |
| duplicate_strong | 37 | merge into existing canonical (< 100 m, same name) |
| duplicate_candidate | 3 | needs-human (100–500 m window) |
| unclear | 10 | needs-human (500 m–2 km window) |
| cannot_geo | 0 | needs-human (no coordinates) |

## Per-candidate detail · top 20 per bucket

### singleton (46)

| Name | City | Nearest existing (m) | Existing count | Recommendation |
|---|---|---|---|---|
| Bird house | Surabaya | — | 0 | approve as new canonical (safe) |
| Bintang Lestari Chinese Food | Jakarta | — | 0 | approve as new canonical (safe) |
| Mr. Big Tummy | Surabaya | — | 0 | approve as new canonical (safe) |
| Warung Cahaya (Crispy Pork) | Denpasar | — | 0 | approve as new canonical (safe) |
| Satu Meja | Jakarta | — | 0 | approve as new canonical (safe) |
| Rawon Sedap Jelambar | Jakarta | — | 0 | approve as new canonical (safe) |
| Toko Kopi TUKU - Kemang | Jakarta | — | 0 | approve as new canonical (safe) |
| Toko Kopi TUKU - Cinere | Jakarta | — | 0 | approve as new canonical (safe) |
| Madam Lee | Jakarta | — | 0 | approve as new canonical (safe) |
| Sasty | Surabaya | — | 0 | approve as new canonical (safe) |
| Toko Kopi TUKU - Karang Tengah | Jakarta | — | 0 | approve as new canonical (safe) |
| Toko Kopi TUKU - Pondok Indah | Jakarta | — | 0 | approve as new canonical (safe) |
| Toko Kopi TUKU - JDC | Jakarta | — | 0 | approve as new canonical (safe) |
| Toko Kopi TUKU - Cirendeu | Jakarta | — | 0 | approve as new canonical (safe) |
| Maja Sunset Lounge | Kuta | — | 0 | approve as new canonical (safe) |
| Toko Kopi TUKU - Kemanggisan | Jakarta | — | 0 | approve as new canonical (safe) |
| Sushi Tei | Denpasar | — | 0 | approve as new canonical (safe) |
| Sushi Tei | Denpasar | — | 0 | approve as new canonical (safe) |
| Chuan wei | Surabaya | — | 0 | approve as new canonical (safe) |
| Toko Kopi TUKU - Blok M | Jakarta | — | 0 | approve as new canonical (safe) |

### likely_new_branch (19)

| Name | City | Nearest existing (m) | Existing count | Recommendation |
|---|---|---|---|---|
| KFC | Jakarta | 5914 | 58 | approve as new canonical (likely chain branch) |
| Richeese Factory | Jakarta | 9743 | 12 | approve as new canonical (likely chain branch) |
| Richeese Factory | Jakarta | 3179 | 12 | approve as new canonical (likely chain branch) |
| Burjo Borneo | Yogyakarta | 2700 | 1 | approve as new canonical (likely chain branch) |
| Burjo Borneo | Yogyakarta | 2810 | 1 | approve as new canonical (likely chain branch) |
| Bakmi GM | Jakarta | 4439 | 7 | approve as new canonical (likely chain branch) |
| Pizza Hut Delivery | Jakarta | 5236 | 10 | approve as new canonical (likely chain branch) |
| Pizza Hut | Surabaya | 2617 | 7 | approve as new canonical (likely chain branch) |
| Biggby Coffee | Jakarta | 12153 | 1 | approve as new canonical (likely chain branch) |
| Biggby Coffee | Jakarta | 6498 | 1 | approve as new canonical (likely chain branch) |
| Biggby Coffee | Jakarta | 14143 | 1 | approve as new canonical (likely chain branch) |
| McDonald's | Surabaya | 3465 | 8 | approve as new canonical (likely chain branch) |
| McDonald's | Jakarta | 2693 | 49 | approve as new canonical (likely chain branch) |
| Kopi Kiosk - Coffee Hut | Denpasar | 2285 | 1 | approve as new canonical (likely chain branch) |
| Burger King | Jakarta | 5062 | 16 | approve as new canonical (likely chain branch) |
| Burger King | Jakarta | 3457 | 16 | approve as new canonical (likely chain branch) |
| McDonald's | Denpasar | 3865 | 8 | approve as new canonical (likely chain branch) |
| Sushi Tei | Jakarta | 2496 | 4 | approve as new canonical (likely chain branch) |
| Loving Hut | Jakarta | 10712 | 1 | approve as new canonical (likely chain branch) |

### duplicate_strong (37)

| Name | City | Nearest existing (m) | Existing count | Recommendation |
|---|---|---|---|---|
| Pasar Imogiri | Yogyakarta | 34 | 1 | merge into canonical 74ce9bca-9b73-4b87-a499-6d23dee48f42 |
| Rumah Dahar (Spesial Nasi Langgi) | Yogyakarta | 0 | 1 | merge into canonical 3d4feb8b-6ee1-4e42-8f85-011a89811eb3 |
| Warung Makan | Gorontalo | 35 | 22 | merge into canonical 8dc862ac-e2c9-4a17-bc59-5461b17d2f92 |
| Parc C Coffe & Eatery | Bandung | 15 | 1 | merge into canonical 5d5665ad-51a4-4557-a89e-d0cd770f8139 |
| Hero Cofee Shop | Semarang | 20 | 1 | merge into canonical b13be78e-dd1a-430b-863a-958ad3cebc09 |
| Fat Tony's | Denpasar | 36 | 1 | merge into canonical d8e58143-55da-41f1-b490-7afd2ac2b082 |
| Bakwan Kawi 'DekNuna' | Yogyakarta | 0 | 1 | merge into canonical 722da0a0-c655-41d6-b34c-1fcba27d3f16 |
| Pasar Rogobangsan | Sleman | 23 | 1 | merge into canonical 568dc76b-2078-4a67-90a5-897a1ae187b6 |
| Rumah Makan "Kondang Jaya" | Yogyakarta | 0 | 1 | merge into canonical 068230b9-7c89-4a00-8382-0857f13f9307 |
| The Spicy Coconut | Denpasar | 45 | 1 | merge into canonical dbd8c0a0-1858-40b7-ac08-2065cf41d734 |
| Bakmi GM | Jakarta | 15 | 7 | merge into canonical 2f66deec-ebd4-4120-bbbb-c12668e04f3f |
| warung | Semarang | 28 | 5 | merge into canonical d2f20b7b-c433-483c-8836-d84ecc58eaaa |
| pemotongan ayam | Solo | 42 | 1 | merge into canonical 18391fa3-894b-4805-bf63-3a61e1bbcf47 |
| warung sate ayam “pak kromo” (chicken satay) | Yogyakarta | 0 | 1 | merge into canonical 3787365e-7b42-4542-932e-a04cd3179d09 |
| Pasar Desa Jamuskauman | Sleman | 32 | 1 | merge into canonical e356818b-00c6-4065-9981-76d4042c8213 |
| McDonald's | Surabaya | 1 | 8 | merge into canonical 6ec6afb8-e65a-4304-ba57-1a30a6b377f6 |
| Chicken Run | Denpasar | 26 | 2 | merge into canonical 270f794b-0026-427b-a49b-1d0d53c0a092 |
| Lawas Café | Yogyakarta | 0 | 1 | merge into canonical 6a100ce4-abeb-4504-954d-85604f35327c |
| Pasar Kliwon/Ngasem/Kranggan | Kulon Progo | 24 | 1 | merge into canonical e82f93c0-eb33-40ce-85fc-2d73dea76661 |
| Kopi Ampirono | Kulon Progo | 29 | 1 | merge into canonical b8672417-c7f9-42e5-a225-44fbe97ce47e |

### duplicate_candidate (3)

| Name | City | Nearest existing (m) | Existing count | Recommendation |
|---|---|---|---|---|
| Starbucks | Denpasar | 114 | 17 | needs-human (possibly same business, possibly adjacent branch) |
| Paradise Kitchen Chinese Food | Jakarta | 300 | 1 | needs-human (possibly same business, possibly adjacent branch) |
| Bu Luluk - Ayam Kampung Kremes & Jamur | Jakarta | 310 | 1 | needs-human (possibly same business, possibly adjacent branch) |

### unclear (10)

| Name | City | Nearest existing (m) | Existing count | Recommendation |
|---|---|---|---|---|
| Pizza Hut | Jakarta | 1441 | 27 | needs-human (could be close branch, could be duplicate) |
| Pizza Hut | Jakarta | 1766 | 27 | needs-human (could be close branch, could be duplicate) |
| Starbucks | Denpasar | 1078 | 17 | needs-human (could be close branch, could be duplicate) |
| Starbucks | Denpasar | 1012 | 17 | needs-human (could be close branch, could be duplicate) |
| Burjo Borneo | Yogyakarta | 1891 | 1 | needs-human (could be close branch, could be duplicate) |
| Burjo Borneo | Yogyakarta | 1082 | 1 | needs-human (could be close branch, could be duplicate) |
| Burjo Borneo | Yogyakarta | 1531 | 1 | needs-human (could be close branch, could be duplicate) |
| Starbucks | Surabaya | 620 | 25 | needs-human (could be close branch, could be duplicate) |
| Domino's | Jakarta | 1119 | 17 | needs-human (could be close branch, could be duplicate) |
| HokBen | Jakarta | 1663 | 19 | needs-human (could be close branch, could be duplicate) |

## Artifact paths

- JSONL (full evidence per candidate): `data/nex-canonical/pass4-food-ambiguity-review.jsonl`
- This document: `docs/nex-directory-food-ambiguity-review-2026-10-12.md`
- Allowlist file: `data/nex-canonical/pass4-allowlist-food-115.txt`
- Pipeline refusal log (precheck_blocked): `data/nex-canonical/pass4-write-result.txt`