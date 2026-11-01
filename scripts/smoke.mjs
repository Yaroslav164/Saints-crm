/**
 * End-to-end smoke test for the auth pipeline. Run against a started server:
 *   npm run start            # then, in another shell
 *   npm run smoke
 * Override the target with SMOKE_BASE_URL=http://localhost:3000 npm run smoke
 */
const base = process.env.SMOKE_BASE_URL ?? "http://localhost:3111";
const demo = { email: "admin@saints.com", password: "saints2026" };

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

/** Minimal cookie jar: Auth.js sets several cookies and we need to send them back. */
function createJar() {
  const store = new Map();
  return {
    absorb(response) {
      for (const line of response.headers.getSetCookie?.() ?? []) {
        const [pair] = line.split(";");
        const index = pair.indexOf("=");
        if (index < 0) continue;
        store.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
      }
    },
    header() {
      return [...store.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    has(name) {
      return store.has(name);
    },
  };
}

async function request(path, { method = "GET", jar, body, form, follow = false } = {}) {
  const headers = {};
  if (jar?.header()) headers.Cookie = jar.header();
  if (form) headers["Content-Type"] = "application/x-www-form-urlencoded";
  else if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: form ? new URLSearchParams(form).toString() : body === undefined ? undefined : JSON.stringify(body),
    redirect: follow ? "follow" : "manual",
  });
  jar?.absorb(response);
  const text = await response.text();
  return {
    status: response.status,
    location: response.headers.get("location"),
    text,
    json: (() => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    })(),
  };
}

async function main() {
  // 1. Anonymous visit to the protected dashboard.
  const anon = await request("/", { jar: createJar() });
  check(
    "GET / anonymous is redirected to the login page",
    anon.status === 307 && anon.location?.includes("/auth/login"),
    `status ${anon.status}, location ${anon.location ?? "none"}`,
  );

  // 1b. A forged cookie passes the proxy's presence check, but the server-side
  // session read must reject it AND still redirect: no seeded data may leak, and
  // the dynamic half has to produce a real redirect instead of an errored stream.
  const fakeJar = { header: () => "authjs.session-token=not-a-real-token", absorb() {}, has: () => false };
  const forged = await request("/", { jar: fakeJar });
  check(
    "Forged session cookie leaks no bundle data",
    !forged.text.includes("Dating US - Smartlink - Video v2"),
    `status ${forged.status}`,
  );
  check(
    "Forged session cookie gets a streamed redirect instead of an errored render",
    forged.text.includes("NEXT_REDIRECT") && forged.text.includes("animate-pulse"),
    `status ${forged.status}`,
  );
  // Auth.js redirects server components to its built-in "/login"; next.config.ts
  // maps that onto the real screen, so following it must end on the sign-in form.
  const alias = await request("/login", { jar: fakeJar });
  const aliasTarget = await request("/auth/login", { jar: fakeJar });
  check(
    "The /login redirect target resolves to the sign-in page",
    [307, 308].includes(alias.status) &&
      (alias.location ?? "").includes("/auth/login") &&
      aliasTarget.status === 200 &&
      aliasTarget.text.includes("Sign in"),
    `status ${alias.status}, location ${alias.location ?? "none"}, then ${aliasTarget.status}`,
  );

  // 2. Auth pages render.
  const login = await request("/auth/login");
  check("GET /auth/login renders the form", login.status === 200 && login.text.includes("Sign in"), `status ${login.status}`);

  const register = await request("/auth/register");
  check("GET /auth/register renders the form", register.status === 200 && register.text.includes("Create an account"), `status ${register.status}`);

  // 3. Registration API: new account, then a duplicate must conflict.
  const email = `smoke-${Date.now()}@saints.com`;
  const created = await request("/api/auth/register", {
    method: "POST",
    body: { name: "Smoke Tester", email, password: "saints2026" },
  });
  check("POST /api/auth/register creates a buyer", created.status === 200 && created.json?.data?.role === "USER", `status ${created.status}`);

  const duplicate = await request("/api/auth/register", {
    method: "POST",
    body: { name: "Smoke Tester", email, password: "saints2026" },
  });
  check("POST /api/auth/register rejects a duplicate email", duplicate.status === 409, `status ${duplicate.status}`);

  const invalid = await request("/api/auth/register", {
    method: "POST",
    body: { name: "X", email: "not-an-email", password: "short" },
  });
  check(
    "POST /api/auth/register validates the payload",
    invalid.status === 422 && Boolean(invalid.json?.error?.fields),
    `status ${invalid.status}`,
  );

  // 4. NextAuth credentials flow: CSRF token, then the callback that mints the session cookie.
  const jar = createJar();
  const csrf = await request("/api/auth/csrf", { jar });
  const token = csrf.json?.csrfToken;
  check("GET /api/auth/csrf returns a token", Boolean(token), `status ${csrf.status}`);

  const callback = await request("/api/auth/callback/credentials", {
    method: "POST",
    jar,
    form: { csrfToken: token ?? "", email: demo.email, password: demo.password, json: "true" },
  });
  check("POST /api/auth/callback/credentials mints a session cookie", jar.has("authjs.session-token"), `status ${callback.status}`);

  const session = await request("/api/auth/session", { jar });
  check(
    "GET /api/auth/session exposes the admin role",
    session.json?.user?.role === "ADMIN" && Boolean(session.json?.user?.id),
    JSON.stringify(session.json?.user ?? {}),
  );

  const authed = await request("/", { jar });
  check("GET / authenticated renders the dashboard", authed.status === 200 && authed.text.includes("Dashboard"), `status ${authed.status}`);

  // 4b. Stage 2: the app shell and the dashboard widgets must be in the markup.
  const shellExpectations = [
    ["sidebar brand", "AFF SAINTS"],
    ["nav item Analytics", "Analytics"],
    ["status widget", "In testing"],
    ["month profit widget", "Profit /"],
    ["line chart card", "Profit by day"],
    ["pie chart card", "Bundles by status"],
    ["top bundles card", "Top 5 by ROI"],
    ["signed-in identity", demo.email],
  ];
  for (const [name, needle] of shellExpectations) {
    check(`Dashboard markup contains ${name}`, authed.text.includes(needle), needle);
  }
  // Charts and the top list are fed from the database. Recharts only draws on the
  // client, so what proves the data reached the page is (a) a real bundle name in
  // the server-rendered top-5 list and (b) one serialized point per day in the
  // flight payload — React escapes the quotes there, hence the \" form.
  const serializedPoints = authed.text.split('\\"profit\\":').length - 1;
  check(
    "Dashboard serializes the daily profit series",
    serializedPoints >= 25,
    `${serializedPoints} points (expected >= 25 for a ${30}-day window)`,
  );
  const topBundleName = (authed.text.match(/(Dating US|Crypto DE|Gambling CA|Nutra FR|E-commerce UK) - [^<"]+/) ?? [])[0];
  check("Dashboard renders real bundles in the top-5 list", Boolean(topBundleName), topBundleName ?? "no seeded bundle name in markup");

  // React splits "Planned for {stage}" into two text nodes with a <!-- --> marker,
  // so match on the single-node fragments instead of the full phrase.
  for (const [path, needles] of [
    ["/bundles", ["Bundles", "stage 3", "TanStack Table"]],
    ["/analytics", ["Analytics", "stage 6", "Profit by buyer"]],
    ["/settings", ["Settings", "stage 6", "Offers CRUD"]],
  ]) {
    const page = await request(path, { jar });
    const missing = needles.filter((needle) => !page.text.includes(needle));
    check(`GET ${path} renders inside the shell`, page.status === 200 && missing.length === 0, `status ${page.status}, missing ${missing.join(", ") || "nothing"}`);
  }

  const anonBundles = await request("/bundles", { jar: createJar() });
  check(
    "Anonymous GET /bundles is redirected with the original path",
    anonBundles.status === 307 && (anonBundles.location ?? "").includes("/auth/login") && anonBundles.location?.includes("from=%2Fbundles"),
    `status ${anonBundles.status}, location ${anonBundles.location ?? "none"}`,
  );

  const authedLogin = await request("/auth/login", { jar });
  check(
    "Sign-in page stays reachable with a session cookie (no proxy bounce → no loop with a stale token)",
    authedLogin.status === 200 && authedLogin.text.includes("Sign in"),
    `status ${authedLogin.status}, location ${authedLogin.location ?? "none"}`,
  );

  // 5. Wrong password must not produce a session.
  const badJar = createJar();
  await request("/api/auth/csrf", { jar: badJar });
  const bad = await request("/api/auth/callback/credentials", {
    method: "POST",
    jar: badJar,
    form: { csrfToken: (await request("/api/auth/csrf", { jar: badJar })).json?.csrfToken ?? "", email: demo.email, password: "wrong-password", json: "true" },
  });
  check("Wrong password does not create a session", !badJar.has("authjs.session-token"), `status ${bad.status}`);

  // 6. Registration is deliberately public — unlike every other endpoint, which
  // will require a session through lib/dal.ts.
  const publicEmail = `smoke-public-${Date.now()}@saints.com`;
  const anonApi = await request("/api/auth/register", {
    method: "POST",
    body: { name: "Smoke Public", email: publicEmail, password: "saints2026" },
  });
  check("Registration endpoint works without a session", anonApi.status === 200, `status ${anonApi.status}`);
}

main()
  .then(() => {
    console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
    process.exitCode = failures ? 1 : 0;
  })
  .catch((error) => {
    console.error("Smoke run crashed:", error.message);
    process.exitCode = 1;
  });
