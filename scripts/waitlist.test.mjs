import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../dist/server/index.js";

const origin = "https://land-of-fire.example";
const environment = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_test_only",
};

function signup(channel, contact, env = environment) {
  return worker.fetch(new Request(origin + "/api/waitlist", {
    method: "POST",
    headers: { Accept: "application/json", Origin: origin },
    body: new URLSearchParams({
      size: "M",
      contact_channel: channel,
      contact,
      consent: "notice-v2",
    }),
  }), env);
}

test("saves both signup channels with the Supabase Data API and confirms the chosen channel", async (t) => {
  const send = t.mock.method(globalThis, "fetch", async (endpoint, options) => {
    assert.equal(endpoint.href, environment.SUPABASE_URL + "/rest/v1/waitlist?on_conflict=contact");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.apikey, environment.SUPABASE_SECRET_KEY);
    assert.equal(options.headers.Prefer, "resolution=ignore-duplicates,return=minimal");
    return new Response(null, { status: 201 });
  });
  const email = await signup("email", "Test@Example.test");
  const phone = await signup("whatsapp", "+994 (50) 123-45-67");
  assert.equal(email.status, 200);
  assert.equal(phone.status, 200);
  assert.match((await email.json()).message, /e-poçt vasitəsilə/);
  assert.match((await phone.json()).message, /WhatsApp vasitəsilə/);
  assert.deepEqual(send.mock.calls.map(({ arguments: [, options] }) => JSON.parse(options.body)), [
    {
      size: "M",
      city: "Qeyd edilməyib",
      contact_type: "email",
      contact: "test@example.test",
      consent_version: "drop-001-v2",
    },
    {
      size: "M",
      city: "Qeyd edilməyib",
      contact_type: "phone",
      contact: "+994501234567",
      consent_version: "drop-001-v2",
    },
  ]);
});

test("rejects invalid contact details and shows failure until Supabase saves the signup", async (t) => {
  const send = t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 403 }));
  assert.equal((await signup("whatsapp", "test@example.test")).status, 422);
  assert.equal((await signup("email", "test@example.test", {})).status, 503);
  assert.equal(send.mock.callCount(), 0);
  const rejected = await signup("email", "test@example.test");
  assert.equal(rejected.status, 503);
  assert.equal((await rejected.json()).ok, false);
  assert.equal(send.mock.callCount(), 1);
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
