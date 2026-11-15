# LAND OF FIRE · javken

[Mövcud GitHub repozitoriyası](https://github.com/javidkanan/javken) · [Canlı sayt](https://javken.landoffire.workers.dev/)

## Forma yeniləməsini yayımla

1. [Supabase Dashboard](https://supabase.com/dashboard) → **javken → SQL Editor → New query** aç. ZIP-dəki `supabase/add_customer_details.sql` faylının mətnini ora yapışdır və **Run** bas. Skript mövcud `waitlist` cədvəlinə üç sütun əlavə edir, əvvəlki sifarişləri və RLS icazələrini qoruyur. Bu addımı GitHub commit-indən əvvəl et.

2. GitHub-dakı mövcud `javken` repozitoriyasında bu faylları eyni yollarda yenilə və `main` budağına commit et.

   - `source/index.html`
   - `source/styles.css`
   - `source/app.js`
   - `worker/index.mjs`
   - `scripts/waitlist.test.mjs`
   - `supabase/add_customer_details.sql`
   - `README.md`

3. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages → javken → Deployments** bölməsində yeni commit-in yayımlandığını yoxla. Canlı formadan yeni sınaq göndər və **Supabase → Table Editor → waitlist** bölməsində `first_name`, `last_name`, `instagram` və `size` sütunlarına bax.

Ad tələb olunur. Soyad və Instagram boş qala bilər. Instagram adı `@` işarəsi olmadan saxlanır. Təkrar göndəriş mövcud sətri yeniləmir, ona görə yeni sahələri əvvəllər qeydiyyatdan keçməmiş əlaqə ünvanı ilə yoxla. Sıfırdan quraşdırma zamanı əvvəl `supabase/setup.sql`, sonra `supabase/add_customer_details.sql` faylını işlə.

## Canlı göndəriş yenə alınmasa

Cloudflare → **Workers & Pages → javken → Observability → Logs** bölməsində `waitlist_save_failed` hadisəsini axtar. Orada `PGRST204` görünürsə, bu yeniləmənin SQL faylının Cloudflare-də bağlı olan Supabase layihəsində işləndiyini yoxla. SQL faylı Data API-nin sxem keşini də yeniləyir. [PostgREST sxem keşi](https://docs.postgrest.org/en/stable/references/schema_cache.html)

Yerli yoxlama üçün Node.js 24 və ya daha yeni versiya ilə `npm test` işlət. Bu testlər Supabase cavablarını simulyasiya edir. Canlı bağlantını yuxarıdakı iki qeydiyyatla təsdiqlə.
