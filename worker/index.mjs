import { assets, inlineScript, inlineStyle } from "./assets.mjs";

const sizes = new Set(["XS", "S", "M", "L", "XL", "XXL", "undecided"]);
const compactSizes = new Set(["S", "M", "L", "XL"]);
const databaseErrorCodes = new Set([
  "42501", "42P01", "42P10", "42703", "23502", "23503", "23505", "23514", "22P02",
  "PGRST000", "PGRST001", "PGRST002", "PGRST003", "PGRST106", "PGRST116",
  "PGRST125", "PGRST204", "PGRST205", "PGRST301", "PGRST302", "PGRST303",
]);
const securityHeaders = {
  "Content-Security-Policy": `default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com '${inlineStyle}'; font-src https://fonts.gstatic.com; script-src 'self' '${inlineScript}'; form-action 'self'; frame-ancestors 'self'; base-uri 'none'; object-src 'none'`,
  "Referrer-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
};

function result(request, status, message, field, reference) {
  const ok = status >= 200 && status < 300;
  const headers = { ...securityHeaders, "Cache-Control": "no-store" };
  if (status === 405) headers.Allow = "POST";
  if (reference) headers["X-LOF-Request-ID"] = reference;
  if (request.headers.get("Accept")?.includes("application/json")) {
    return Response.json({ ok, message, ...(field && { field }) }, { status, headers });
  }
  return new Response(`<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>LAND OF FIRE — Qeydiyyat</title><style>${assets["/styles.css"].body()}</style><main class="wrap result-page"><h2>${ok ? "Sifarişiniz qəbul edildi! 🔥" : "Qeydiyyat"}</h2><p>${message}</p><a href="/#waitlist">← Siyahıya qayıt</a></main></html>`, {
    status, headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
  });
}

async function readForm(request) {
  if (!request.body) return new URLSearchParams();
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let length = 0;
  let body = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 4096) {
      await reader.cancel();
      return null;
    }
    body += decoder.decode(value, { stream: true });
  }
  return new URLSearchParams(body + decoder.decode());
}

function normalizeContact(value) {
  if (value.length > 254) return null;
  if (/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(value)) {
    return { type: "email", value: value.toLowerCase() };
  }
  if (/^\+[0-9 ()-]+$/.test(value)) {
    const phone = value.replace(/[ ()-]/g, "");
    if (/^\+[1-9][0-9]{7,14}$/.test(phone)) return { type: "phone", value: phone };
  }
  return null;
}

function isLegacyServiceRole(key) {
  if (!/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(key)) return false;
  try {
    const payload = key.split(".")[1].replaceAll("-", "+").replaceAll("_", "/");
    return JSON.parse(atob(payload)).role === "service_role";
  } catch {
    return false;
  }
}

async function saveRegistration(env, registration) {
  const projectUrl = typeof env?.SUPABASE_URL === "string" ? env.SUPABASE_URL.trim() : "";
  const key = typeof env?.SUPABASE_SECRET_KEY === "string" ? env.SUPABASE_SECRET_KEY.trim() : "";
  const missing = [];
  if (env?.SUPABASE_URL == null || env.SUPABASE_URL === "") missing.push("SUPABASE_URL");
  if (env?.SUPABASE_SECRET_KEY == null || env.SUPABASE_SECRET_KEY === "") missing.push("SUPABASE_SECRET_KEY");
  if (missing.length) return { stage: "missing_binding", missing };

  let endpoint;
  try {
    const project = new URL(projectUrl);
    if (project.protocol !== "https:" || project.username || project.password ||
        project.pathname !== "/" || project.search || project.hash ||
        ["supabase.com", "www.supabase.com", "app.supabase.com"].includes(project.hostname)) {
      return { stage: "invalid_project_url" };
    }
    endpoint = new URL("/rest/v1/waitlist", project);
    endpoint.searchParams.set("on_conflict", "contact");
  } catch {
    return { stage: "invalid_project_url" };
  }

  const headers = {
    apikey: key,
    "Content-Type": "application/json",
    Prefer: "resolution=ignore-duplicates,return=minimal",
  };
  if (!/^sb_secret_[\w-]+$/.test(key)) {
    if (!isLegacyServiceRole(key)) return { stage: "invalid_key_type" };
    headers.Authorization = `Bearer ${key}`;
  }

  const signal = AbortSignal.timeout(8000);
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      redirect: "manual",
      headers,
      body: JSON.stringify(registration),
      signal,
    });
  } catch {
    return { stage: signal.aborted ? "upstream_timeout" : "upstream_network_error" };
  }
  if (response.ok) return null;
  const status = response.status;
  if (status >= 300 && status < 400) return { stage: "upstream_redirect", status };

  const data = await response.json().catch(() => null);
  const code = databaseErrorCodes.has(data?.code) ? data.code : undefined;
  return { stage: "upstream_rejected", status, ...(code && { code }) };
}

async function submit(request, env, url) {
  if (request.method !== "POST") return result(request, 405, "Bu ünvan qeydiyyat göndərmək üçündür.");
  const origin = request.headers.get("Origin");
  if (request.headers.get("Sec-Fetch-Site") === "cross-site" || (origin && origin !== url.origin)) {
    return result(request, 403, "Qeydiyyatı LAND OF FIRE səhifəsindən göndər.");
  }
  if (request.headers.get("Content-Type")?.split(";")[0].trim() !== "application/x-www-form-urlencoded") {
    return result(request, 415, "Qeydiyyatı səhifədəki forma ilə göndər.");
  }
  if (Number(request.headers.get("Content-Length")) > 4096) {
    return result(request, 413, "Forma məlumatları çox uzundur.");
  }
  const data = await readForm(request);
  if (!data) return result(request, 413, "Forma məlumatları çox uzundur.");
  if (data.get("website")) return result(request, 400, "Qeydiyyatı göndərmək mümkün olmadı.");

  const size = data.get("size");
  const city = data.get("city")?.normalize("NFC").trim().replace(/\s+/g, " ") ?? "";
  const contact = normalizeContact(data.get("contact")?.trim() ?? "");
  const channel = data.get("contact_channel");
  const compact = data.get("consent") === "notice-v2";
  if (!(compact ? compactSizes : sizes).has(size)) return result(request, 422, "Siyahıdan ölçünü seç.", "size");
  if ((!compact || city) && (city.length < 2 || city.length > 80 || !/^[\p{L}\p{M}][\p{L}\p{M}\p{N} .’'()-]*$/u.test(city))) {
    return result(request, 422, "Şəhər və ya rayonun adını yaz.", "city");
  }
  if (channel === "email" && contact?.type !== "email") {
    return result(request, 422, "Düzgün e-poçt ünvanı yaz. Məsələn, ad@example.com.", "contact");
  }
  if (channel === "whatsapp" && (contact?.type !== "phone" || !/^\+994\d{9}$/.test(contact.value))) {
    return result(request, 422, "WhatsApp nömrəsini +994 və 9 rəqəmlə yaz.", "contact");
  }
  if (!contact || (channel !== null && channel !== "email" && channel !== "whatsapp")) {
    return result(request, 422, "Düzgün e-poçt ünvanı və ya ölkə kodlu telefon nömrəsi yaz.", "contact");
  }
  if (!compact && data.get("consent") !== "yes") return result(request, 422, "Davam etmək üçün razılıq xanasını işarələ.", "consent");

  const failure = await saveRegistration(env, {
    size,
    city: city || "Qeyd edilməyib",
    contact_type: contact.type,
    contact: contact.value,
    consent_version: compact ? "drop-001-v2" : "drop-001-v1",
  });
  if (failure) {
    const reference = crypto.randomUUID();
    // Log only controlled diagnostics. Never log the request, key or upstream body.
    console.error(JSON.stringify({ event: "waitlist_save_failed", reference, ...failure }));
    return result(request, 503, "Qeydiyyatı saxlamaq mümkün olmadı. Bir az sonra yenidən cəhd et.", undefined, reference);
  }
  const contactMethod = contact.type === "email" ? "e-poçt" : "WhatsApp";
  return result(request, 200, `LAND OF FIRE komandası tezliklə sizinlə ${contactMethod} vasitəsilə əlaqə saxlayacaq. Hələlik ödəniş etməyinizə ehtiyac yoxdur.`);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/waitlist") return submit(request, env, url);
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    if (!Object.hasOwn(assets, path)) {
      return new Response("Səhifə tapılmadı.", { status: 404, headers: securityHeaders });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { ...securityHeaders, Allow: "GET, HEAD" } });
    }
    const asset = assets[path];
    const headers = {
      ...securityHeaders,
      "Content-Type": asset.type,
      "Cache-Control": asset.type.startsWith("image/") ? "public, max-age=3600" : "no-cache",
    };
    if (request.method === "HEAD") return new Response(null, { headers });
    const body = asset.body();
    if (path !== "/index.html") return new Response(body, { headers });
    const page = body.replace(
      /(<meta property="og:(?:url|image)" content=")https?:\/\/[^/"]+/g,
      (_, prefix) => prefix + url.origin,
    );
    return new Response(page, { headers });
  },
};
