# LAND OF FIRE · GitHub + Supabase

GitHub kodu saxlayır, Cloudflare Workers saytı yayımlayır, Supabase qeydiyyatları saxlayır.

## 1. Supabase

1. [Supabase Dashboard](https://supabase.com/dashboard) → **New project**. Layihənin adını `land-of-fire` yaz.
2. Layihədə **SQL Editor → New query** aç. `supabase/setup.sql` faylının bütün mətnini ora yapışdır və **Run** bas. `waitlist` cədvəli **Table Editor** bölməsində görünəcək.
3. **Connect** bölməsindən **Project URL** dəyərini götür. Məsələn, `https://abcxyz.supabase.co`.
4. **Settings → API Keys → Secret keys** bölməsində bu sayt üçün yeni açar yarat və `sb_secret_…` dəyərini götür. Onu yalnız Cloudflare Worker-in **Variables and Secrets** bölməsində saxla.

## 2. GitHub

1. [GitHub-da yeni repozitoriya yarat](https://github.com/new), adını `land-of-fire-drop-001` yaz və ilkin README ilə yarat.
2. Repozitoriyanın **Code** səhifəsində **Add file → Upload files** seç. Paketdən çıxardığın qovluğun **içindəki fayl və qovluqları** yüklə. `wrangler.jsonc`, `package.json`, `source`, `worker`, `scripts` və `supabase` repozitoriyanın əsas səviyyəsində olmalıdır.
3. **Commit changes** bas. Kod hər kəsə görünməlidirsə GitHub-da **Public** seç. Saytın ziyarətçilərə açıq olması üçün repozitoriyanı ictimai etməyə ehtiyac yoxdur.

## 3. Cloudflare

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages → Create application → GitHub**. GitHub hesabını bağla və `land-of-fire-drop-001` repozitoriyasını seç.
2. Worker adı `land-of-fire-drop-001`, production branch `main`, root directory `/` olsun. **Build command** boş qala bilər. Layihə build əmrini öz konfiqurasiyasında saxlayır. **Deploy command** üçün `npx wrangler deploy` yaz və **Save and Deploy** bas.
3. Worker-də **Settings → Variables and Secrets → Add** seç. Bu iki dəyəri əlavə et:

   | Növ | Ad | Dəyər |
   | --- | --- | --- |
   | Text | `SUPABASE_URL` | Supabase Project URL |
   | Secret | `SUPABASE_SECRET_KEY` | `sb_secret_…` |

4. Dəyişiklikləri **Deploy** ilə tətbiq et. Worker-in `workers.dev` linkini aç.

## 4. Formanı yoxla

1. Bir e-poçt və bir WhatsApp sınaq qeydiyyatı göndər.
2. Supabase **Table Editor → waitlist** bölməsində iki yeni sətri, ölçünü və əlaqə məlumatını yoxla.
3. Qeydiyyat alınmırsa Cloudflare-də iki dəyişənin adını və dəyərlərini, Supabase-də isə `setup.sql` sorğusunun uğurla bitdiyini yoxla.

Köhnə ChatGPT Sites linkində toplanan qeydlər D1-də saxlanılır. Onları köçürmək lazımdırsa, CSV-ni Supabase-ə məxfi şəkildə idxal et. Yeni sifarişlər üçün müştərilərə Worker linkini göndər.

Yerli kod yoxlaması üçün Node.js 24 və ya daha yeni versiya ilə `npm test` işlət.
