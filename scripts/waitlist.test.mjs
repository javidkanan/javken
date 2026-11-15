import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../dist/server/index.js";

const origin = "https://land-of-fire.example";
const environment = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_test_only",
};

function signup(channel, contact, env = environment, fields = {}) {
  return worker.fetch(new Request(origin + "/api/waitlist", {
    method: "POST",
    headers: { Accept: "application/json", Origin: origin },
    body: new URLSearchParams({
      first_name: "Nərmin",
      size: "M",
      contact_channel: channel,
      contact,
      consent: "notice-v2",
      ...fields,
    }),
  }), env);
}

test("saves both signup channels with the Supabase Data API and confirms the chosen channel", async (t) => {
  const send = t.mock.method(globalThis, "fetch", async (endpoint, options) => {
    assert.equal(endpoint.href, environment.SUPABASE_URL + "/rest/v1/waitlist?on_conflict=contact");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.apikey, environment.SUPABASE_SECRET_KEY);
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.headers.Prefer, "resolution=ignore-duplicates,return=minimal");
    return new Response(null, { status: 201 });
  });
  const email = await signup("email", "Test@Example.test", environment, {
    first_name: "  Nərmin  ",
    last_name: "  Məmmədli ",
    instagram: " @LOF.Test ",
  });
  const phone = await signup("whatsapp", "+994 (50) 123-45-67");
  assert.equal(email.status, 200);
  assert.equal(phone.status, 200);
  assert.match((await email.json()).message, /e-poçt vasitəsilə/);
  assert.match((await phone.json()).message, /WhatsApp vasitəsilə/);
  assert.deepEqual(send.mock.calls.map(({ arguments: [, options] }) => JSON.parse(options.body)), [
    {
      first_name: "Nərmin",
      last_name: "Məmmədli",
      instagram: "lof.test",
      size: "M",
      city: "Qeyd edilməyib",
      contact_type: "email",
      contact: "test@example.test",
      consent_version: "drop-001-v2",
    },
    {
      first_name: "Nərmin",
      last_name: null,
      instagram: null,
      size: "M",
      city: "Qeyd edilməyib",
      contact_type: "phone",
      contact: "+994501234567",
      consent_version: "drop-001-v2",
    },
  ]);
});

test("requires a first name and rejects invalid optional customer details before saving", async (t) => {
  const send = t.mock.method(globalThis, "fetch");
  for (const [values, field] of [
    [{ first_name: "" }, "first_name"],
    [{ first_name: "123" }, "first_name"],
    [{ first_name: "a".repeat(81) }, "first_name"],
    [{ last_name: "<invalid>" }, "last_name"],
    [{ instagram: "https://instagram.com/lof" }, "instagram"],
    [{ instagram: "@" }, "instagram"],
  ]) {
    const response = await signup("email", "test@example.test", environment, values);
    assert.equal(response.status, 422);
    assert.equal((await response.json()).field, field);
  }
  assert.equal(send.mock.callCount(), 0);
});

test("rejects invalid contact details and shows failure until Supabase saves the signup", async (t) => {
  t.mock.method(console, "error", () => {});
  const send = t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 403 }));
  assert.equal((await signup("whatsapp", "test@example.test")).status, 422);
  assert.equal((await signup("email", "test@example.test", {})).status, 503);
  assert.equal(send.mock.callCount(), 0);
  const rejected = await signup("email", "test@example.test");
  assert.equal(rejected.status, 503);
  assert.equal((await rejected.json()).ok, false);
  assert.equal(send.mock.callCount(), 1);
});

test("rejects cross-origin form posts before contacting Supabase", async (t) => {
  const send = t.mock.method(globalThis, "fetch");
  const response = await worker.fetch(new Request(origin + "/api/waitlist", {
    method: "POST",
    headers: { Accept: "application/json", Origin: "https://other.example" },
    body: new URLSearchParams({
      first_name: "Nərmin",
      size: "M",
      contact_channel: "email",
      contact: "test@example.test",
      consent: "notice-v2",
    }),
  }), environment);
  assert.equal(response.status, 403);
  assert.equal(send.mock.callCount(), 0);
});

test("checks runtime bindings and accepts legacy service_role credentials only in the server request", async (t) => {
  const jwt = (role) => ["eyJhbGciOiJIUzI1NiJ9", Buffer.from(JSON.stringify({ role })).toString("base64url"), "testsignature"].join(".");
  const log = t.mock.method(console, "error", () => {});
  const send = t.mock.method(globalThis, "fetch", async (_, options) => {
    assert.equal(options.headers.apikey, jwt("service_role"));
    assert.equal(options.headers.Authorization, "Bearer " + jwt("service_role"));
    return new Response(null, { status: 201 });
  });
  for (const [env, stage] of [
    [{ SUPABASE_SECRET_KEY: environment.SUPABASE_SECRET_KEY }, "missing_binding"],
    [{ ...environment, SUPABASE_URL: "https://supabase.com/dashboard/project/javken" }, "invalid_project_url"],
    [{ ...environment, SUPABASE_SECRET_KEY: "sb_publishable_test" }, "invalid_key_type"],
    [{ ...environment, SUPABASE_SECRET_KEY: jwt("anon") }, "invalid_key_type"],
  ]) {
    const failure = await signup("email", "test@example.test", env);
    assert.equal(failure.status, 503);
    const diagnostic = JSON.parse(log.mock.calls.at(-1).arguments[0]);
    assert.equal(diagnostic.stage, stage);
    assert.equal(diagnostic.reference, failure.headers.get("X-LOF-Request-ID"));
  }
  assert.deepEqual(JSON.parse(log.mock.calls[0].arguments[0]).missing, ["SUPABASE_URL"]);
  assert.equal(send.mock.callCount(), 0);
  assert.equal((await signup("email", "test@example.test", { ...environment, SUPABASE_SECRET_KEY: jwt("service_role") })).status, 200);
  assert.equal(send.mock.callCount(), 1);
});

test("distinguishes rejected, redirect and network requests without logging private data", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  const outcomes = [
    Response.json({ code: "42501", message: "test@example.test", details: environment.SUPABASE_SECRET_KEY }, { status: 403 }),
    Response.json({ code: "test@example.test" }, { status: 401 }),
    Response.redirect("https://example.test", 307),
    new TypeError("private upstream error"),
  ];
  t.mock.method(globalThis, "fetch", async (_, options) => {
    assert.equal(options.redirect, "manual");
    const result = outcomes.shift();
    if (result instanceof Error) throw result;
    return result;
  });
  for (const [stage, status, code] of [
    ["upstream_rejected", 403, "42501"],
    ["upstream_rejected", 401, undefined],
    ["upstream_redirect", 307, undefined],
    ["upstream_network_error", undefined, undefined],
  ]) {
    const failure = await signup("email", "test@example.test");
    assert.equal(failure.status, 503);
    const raw = log.mock.calls.at(-1).arguments[0];
    assert.doesNotMatch(raw, /example\.test|sb_secret_|private upstream error/);
    const diagnostic = JSON.parse(raw);
    assert.equal(diagnostic.stage, stage);
    assert.equal(diagnostic.status, status);
    assert.equal(diagnostic.code, code);
    assert.equal(diagnostic.reference, failure.headers.get("X-LOF-Request-ID"));
  }
});

test("records a timeout when the upstream request exceeds its deadline", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  const timeout = t.mock.method(AbortSignal, "timeout", () => AbortSignal.abort());
  t.mock.method(globalThis, "fetch", async (_, { signal }) => signal.throwIfAborted());
  const response = await signup("email", "test@example.test");
  assert.equal(response.status, 503);
  assert.equal(timeout.mock.calls[0].arguments[0], 8000);
  assert.equal(JSON.parse(log.mock.calls[0].arguments[0]).stage, "upstream_timeout");
});

test("serves the current price and share metadata without exposing backend configuration", async () => {
  const page = await worker.fetch(new Request(origin), environment);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /85 AZN əvəzinə 59 AZN, 30,6 faiz endirim/);
  assert.doesNotMatch(html, /120 AZN|class="product-info"|Qaytarma|100% pambıq/);
  assert.ok(html.includes(`<meta property="og:url" content="${origin}/">`));
  assert.ok(html.includes(`<meta property="og:image" content="${origin}/sweatshirt.jpg">`));
  assert.ok(!html.includes(environment.SUPABASE_SECRET_KEY));
  assert.equal((await worker.fetch(new Request(origin + "/supabase/setup.sql"), environment)).status, 404);
});
