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
    contentType: response.headers.get("content-type"),
    disposition: response.headers.get("content-disposition"),
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

/** Signs in through the same REST flow a browser uses and returns a cookie jar.
 * Named `signInSession` because `login` is taken by a local variable in main(). */
async function signInSession(email, password) {
  const session = createJar();
  const csrf = await request("/api/auth/csrf", { jar: session });
  await request("/api/auth/callback/credentials", {
    method: "POST",
    jar: session,
    form: { csrfToken: csrf.json?.csrfToken ?? "", email, password, json: "true" },
  });
  return session;
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
    // The list screen is real since stage 3: its server shell carries the filter
    // bar and the loading state, while the rows arrive over the API.
    ["/bundles", ["Bundles", "Export CSV", "Import CSV", "New bundle", "Loading bundles", "Search by name"]],
    // Stage 6 replaced both placeholders with screens that read their own queries, so what
    // proves the shell arrived is the period control and the tab strip, not a number.
    ["/analytics", ["Analytics", "Profit by buyer", "Offer performance", "From idea to scale", "Top bundles for the period", "30 days"]],
    ["/settings", ["Settings", "Offers", "GEOs", "Tags", "Buyers", "Alerts", "New offer"]],
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

  // 7. Bundle list API: filters, sorting (including the derived columns),
  // pagination, validation and the CSV export.
  const anonList = await request("/api/bundles");
  check(
    "GET /api/bundles without a session is answered with 401 JSON",
    anonList.status === 401 && Boolean(anonList.json?.error?.message),
    `status ${anonList.status}, content-type ${anonList.contentType}`,
  );

  const list = await request("/api/bundles", { jar });
  const all = list.json?.data;
  check(
    "GET /api/bundles returns the seeded page",
    list.status === 200 && all?.items?.length === 20 && all.total === 20 && all.pageCount === 1,
    `status ${list.status}, total ${all?.total}`,
  );

  const statusFiltered = await request("/api/bundles?status=PROFIT", { jar });
  const statusSet = new Set((statusFiltered.json?.data?.items ?? []).map((item) => item.status));
  check(
    "status filter narrows to one status",
    statusFiltered.json?.data?.total === 5 && statusSet.size === 1 && statusSet.has("PROFIT"),
    `total ${statusFiltered.json?.data?.total}`,
  );

  const searched = await request("/api/bundles?search=crypto", { jar });
  const searchedItems = searched.json?.data?.items ?? [];
  check(
    "search matches the name case-insensitively",
    searchedItems.length > 0 && searchedItems.every((item) => item.name.toLowerCase().includes("crypto")),
    `${searchedItems.length} rows`,
  );

  const secondPage = await request("/api/bundles?pageSize=5&page=2", { jar });
  check(
    "pagination slices the same total",
    secondPage.json?.data?.items?.length === 5 && secondPage.json?.data?.total === 20 && secondPage.json?.data?.pageCount === 4,
    `pageCount ${secondPage.json?.data?.pageCount}`,
  );

  const roiSorted = await request("/api/bundles?sort=roi&order=desc&pageSize=100", { jar });
  const rois = (roiSorted.json?.data?.items ?? []).map((item) => item.roi);
  check(
    "sorting by the derived ROI is applied server-side",
    rois.length === 20 && rois.every((value, index) => index === 0 || rois[index - 1] >= value),
    `top ${rois[0]}%, bottom ${rois.at(-1)}%`,
  );

  const band = await request("/api/bundles?roiMin=0&pageSize=100", { jar });
  const bandItems = band.json?.data?.items ?? [];
  check("the ROI band filter keeps only profitable bundles", bandItems.length > 0 && bandItems.every((item) => item.roi >= 0), `${bandItems.length} of 20`);

  const badFilter = await request("/api/bundles?status=NOT_A_STATUS", { jar });
  check("an unknown status value is rejected", badFilter.status === 422, `status ${badFilter.status}`);

  const stalePage = await request("/api/bundles?page=99", { jar });
  check(
    "a page past the end is clamped instead of returning an empty list",
    stalePage.json?.data?.page === 1 && stalePage.json?.data?.items?.length === 20,
    `page ${stalePage.json?.data?.page}, ${stalePage.json?.data?.items?.length} rows`,
  );

  const csv = await request("/api/bundles/export?pageSize=100", { jar });
  const csvLines = csv.text.trim().split(/\r?\n/);
  check(
    "CSV export downloads every matching row as a file",
    csv.status === 200 &&
      csv.contentType?.startsWith("text/csv") &&
      csv.disposition?.includes("attachment") &&
      csvLines.length === 21 &&
      csvLines[0].includes("ROI %"),
    `${csvLines.length} lines, ${csv.contentType}`,
  );
  check("CSV export requires a session", (await request("/api/bundles/export")).status === 401, "");

  // 8. Ownership. A buyer sees the whole team list but may only change their own rows.
  const buyer = await signInSession("ivanov@saints.com", "saints2026");
  const mineItems = (await request("/api/bundles?mine=1&pageSize=100", { jar: buyer })).json?.data?.items ?? [];
  const ownId = mineItems[0]?.id;
  const foreign = (all?.items ?? []).find((item) => item.buyer.id !== mineItems[0]?.buyer?.id);
  check(
    "mine=1 returns only the signed-in buyer's bundles",
    mineItems.length > 0 && mineItems.every((item) => item.buyer.id === mineItems[0].buyer.id),
    `${mineItems.length} of ${all?.total}`,
  );
  check("there is a foreign bundle to test the denial on", Boolean(foreign) && Boolean(ownId), foreign?.name ?? "none");

  const denied = await request("/api/bundles/bulk", {
    method: "POST",
    jar: buyer,
    body: { action: "status", ids: [foreign?.id], status: "SCALE" },
  });
  check(
    "a bulk change touching only foreign bundles reports skipped",
    denied.status === 200 && denied.json?.data?.affected === 0 && denied.json?.data?.skipped === 1,
    JSON.stringify(denied.json?.data ?? denied.json?.error),
  );

  const afterDenied = await request("/api/bundles?pageSize=100", { jar });
  const foreignRow = (afterDenied.json?.data?.items ?? []).find((item) => item.id === foreign?.id);
  check("the foreign bundle kept its status", foreignRow?.status === foreign?.status, foreignRow?.status ?? "missing");

  const forbiddenDelete = await request("/api/bundles/bulk", {
    method: "POST",
    jar: buyer,
    body: { action: "delete", ids: [ownId] },
  });
  check("only an admin may delete bundles", forbiddenDelete.status === 403, `status ${forbiddenDelete.status}`);

  // Round trip on the buyer's own row, reverted afterwards so the demo data stays as seeded.
  const own = mineItems.find((item) => item.status === "TESTING") ?? mineItems[0];
  const nextStatus = own.status === "TESTING" ? "LOSS" : "TESTING";
  const changed = await request("/api/bundles/bulk", {
    method: "POST",
    jar: buyer,
    body: { action: "status", ids: [own.id], status: nextStatus },
  });
  const afterChange = (await request("/api/bundles?pageSize=100", { jar })).json?.data?.items?.find((item) => item.id === own.id);
  const reverted = await request("/api/bundles/bulk", {
    method: "POST",
    jar: buyer,
    body: { action: "status", ids: [own.id], status: own.status },
  });
  check(
    "a bulk status change applies to your own bundle and reverts",
    changed.json?.data?.affected === 1 && afterChange?.status === nextStatus && reverted.json?.data?.affected === 1,
    `${changed.json?.data?.affected} → ${afterChange?.status} → ${reverted.json?.data?.affected}`,
  );

  const single = await request(`/api/bundles/${own.id}/status`, { method: "PATCH", jar: buyer, body: { status: "PROFIT" } });
  const singleRevert = await request(`/api/bundles/${own.id}/status`, { method: "PATCH", jar: buyer, body: { status: own.status } });
  check(
    "PATCH /api/bundles/[id]/status works for the owner",
    single.status === 200 && single.json?.data?.status === "PROFIT" && singleRevert.status === 200,
    `status ${single.status}`,
  );

  const anonBulk = await request("/api/bundles/bulk", { method: "POST", body: { action: "archive", ids: [ownId] } });
  check("the bulk endpoint requires a session", anonBulk.status === 401, `status ${anonBulk.status}`);

  const badBulk = await request("/api/bundles/bulk", { method: "POST", jar, body: { action: "nonsense", ids: [] } });
  check("an unknown bulk action is rejected", badBulk.status === 422, `status ${badBulk.status}`);

  // 9. The dashboard aggregates are cached (`use cache` + cacheLife), so prove the
  // invalidation works: a status change must be reflected on the very next load.
  const testingCount = (html) => {
    const match = /In testing[\s\S]{0,220}?>(\d+)</.exec(html);
    return match ? Number.parseInt(match[1], 10) : NaN;
  };
  const before = testingCount((await request("/", { jar })).text);
  const idea = (await request("/api/bundles?status=IDEA&pageSize=1", { jar })).json?.data?.items?.[0];
  await request("/api/bundles/bulk", { method: "POST", jar, body: { action: "status", ids: [idea?.id], status: "TESTING" } });
  const during = testingCount((await request("/", { jar })).text);
  await request("/api/bundles/bulk", { method: "POST", jar, body: { action: "status", ids: [idea?.id], status: "IDEA" } });
  const after = testingCount((await request("/", { jar })).text);
  check(
    "cached dashboard is invalidated by a status change",
    Number.isFinite(before) && during === before + 1 && after === before,
    `${before} → ${during} → ${after} (expected ${before} → ${before + 1} → ${before})`,
  );

  // 10. Create and edit API (stage 4). The bundle created here is deleted again at
  // the end of the block, so a smoke run leaves the seeded dataset as it was.
  const sample = all?.items?.[0];
  const newBundle = {
    name: `Smoke bundle ${Date.now()}`,
    offerId: sample?.offer.id,
    angle: "Temporary bundle created by the smoke run",
    creative: "",
    geoIds: [sample?.geos[0]?.id],
    status: "TESTING",
    budgetPlanned: 400,
    budgetSpent: 200,
    revenue: 300,
    clicks: 5000,
    conversions: 25,
    notes: "",
    tagIds: [],
  };

  const anonCreate = await request("/api/bundles", { method: "POST", body: newBundle });
  check("POST /api/bundles requires a session", anonCreate.status === 401, `status ${anonCreate.status}`);

  const bundleCreate = await request("/api/bundles", { method: "POST", jar: buyer, body: newBundle });
  const bundleDraft = bundleCreate.json?.data;
  check(
    "a buyer creates a bundle they own, with derived metrics",
    bundleCreate.status === 200 &&
      bundleDraft?.buyer?.id === mineItems[0]?.buyer?.id &&
      bundleDraft?.roi === 50 &&
      bundleDraft?.cr === 0.5,
    `status ${bundleCreate.status}, roi ${bundleDraft?.roi}, cr ${bundleDraft?.cr}`,
  );

  const badCreate = await request("/api/bundles", {
    method: "POST",
    jar: buyer,
    body: { ...newBundle, clicks: 2, conversions: 10 },
  });
  check(
    "create rejects conversions above clicks",
    badCreate.status === 422 && Boolean(badCreate.json?.error?.fields?.conversions),
    `status ${badCreate.status}`,
  );

  const updated = await request(`/api/bundles/${bundleDraft?.id}`, {
    method: "PUT",
    jar: buyer,
    body: { budgetSpent: 500, revenue: 800 },
  });
  check(
    "a partial update recomputes metrics and leaves the rest intact",
    updated.status === 200 &&
      updated.json?.data?.roi === 60 &&
      updated.json?.data?.profit === 300 &&
      updated.json?.data?.clicks === 5000 &&
      updated.json?.data?.conversions === 25 &&
      updated.json?.data?.status === "TESTING",
    `status ${updated.status}, roi ${updated.json?.data?.roi}, clicks ${updated.json?.data?.clicks}, status ${updated.json?.data?.status}`,
  );

  const emptyPatch = await request(`/api/bundles/${bundleDraft?.id}`, { method: "PUT", jar: buyer, body: {} });
  check("an empty patch is rejected", emptyPatch.status === 422, `status ${emptyPatch.status}`);

  const foreignUpdate = await request(`/api/bundles/${foreign?.id}`, { method: "PUT", jar: buyer, body: { name: "hijacked" } });
  check("a buyer cannot edit someone else's bundle", foreignUpdate.status === 403, `status ${foreignUpdate.status}`);

  const otherBuyer = (afterDenied.json?.data?.items ?? []).find((item) => item.buyer.id !== mineItems[0]?.buyer?.id);
  const reassign = await request(`/api/bundles/${bundleDraft?.id}`, {
    method: "PUT",
    jar: buyer,
    body: { userId: otherBuyer?.buyer.id },
  });
  check("a buyer cannot reassign a bundle", reassign.status === 403, `status ${reassign.status}`);

  const adminReassign = await request(`/api/bundles/${bundleDraft?.id}`, {
    method: "PUT",
    jar,
    body: { userId: otherBuyer?.buyer.id },
  });
  check(
    "an admin can reassign a bundle",
    adminReassign.status === 200 && adminReassign.json?.data?.buyer?.id === otherBuyer?.buyer.id,
    `status ${adminReassign.status}`,
  );

  // 11. The detail page and its feed (stage 5). Everything below runs on the smoke
  // bundle created above and is deleted with it, so a run leaves no comment behind.
  const detailId = bundleDraft?.id;
  const anonDetail = await request(`/api/bundles/${detailId}`);
  check("GET /api/bundles/[id] requires a session", anonDetail.status === 401, `status ${anonDetail.status}`);

  const detail = await request(`/api/bundles/${detailId}`, { jar });
  const feed = detail.json?.data;
  check(
    "GET /api/bundles/[id] returns the row with its logged history",
    detail.status === 200 &&
      feed?.id === detailId &&
      Array.isArray(feed?.activity) &&
      feed?.activity.some((entry) => entry.kind === "change" && entry.field === "bundle") &&
      feed?.activity.some((entry) => entry.kind === "change" && entry.field === "budgetSpent"),
    `${feed?.activity?.length} entries`,
  );

  check(
    "the detail payload carries what the page draws: permissions and the daily series",
    feed?.permissions?.canManage === true && feed?.permissions?.canDelete === true && Array.isArray(feed?.daily),
    JSON.stringify(feed?.permissions ?? {}),
  );

  const foreignDetail = await request(`/api/bundles/${detailId}`, { jar: buyer });
  check(
    "after an admin's reassignment the previous owner reads it, and it is read-only for them",
    foreignDetail.json?.data?.permissions?.canManage === false &&
      foreignDetail.json?.data?.permissions?.canDelete === false,
    JSON.stringify(foreignDetail.json?.data?.permissions ?? {}),
  );

  const missing = await request("/api/bundles/no-such-bundle-id", { jar });
  check("GET /api/bundles/[id] answers 404 for an unknown id", missing.status === 404, `status ${missing.status}`);

  const anonComment = await request(`/api/bundles/${detailId}/comments`, { method: "POST", body: { text: "hello" } });
  check("POST /api/bundles/[id]/comments requires a session", anonComment.status === 401, `status ${anonComment.status}`);

  const emptyComment = await request(`/api/bundles/${detailId}/comments`, { method: "POST", jar, body: { text: "   " } });
  check(
    "a blank comment is rejected with a field message",
    emptyComment.status === 422 && Boolean(emptyComment.json?.error?.fields?.text),
    `status ${emptyComment.status}`,
  );

  const note = `Smoke note ${Date.now()} — keep the lander under review`;
  const commented = await request(`/api/bundles/${detailId}/comments`, {
    method: "POST",
    jar: buyer,
    body: { text: note },
  });
  check(
    "a team member can comment on someone else's bundle",
    commented.status === 200 &&
      commented.json?.data?.text === note &&
      commented.json?.data?.author?.label === "Ivan Ivanov",
    `status ${commented.status}, author ${commented.json?.data?.author?.label}`,
  );

  const afterComment = await request(`/api/bundles/${detailId}`, { jar });
  const entries = afterComment.json?.data?.activity ?? [];
  check(
    "the comment joins the feed in chronological order",
    entries.some((entry) => entry.kind === "comment" && entry.text === note) &&
      entries.every((entry, index) => index === 0 || entries[index - 1].at <= entry.at),
    `${entries.length} entries`,
  );

  const moved = await request(`/api/bundles/${detailId}/status`, { method: "PATCH", jar, body: { status: "PROFIT" } });
  const afterMove = await request(`/api/bundles/${detailId}`, { jar });
  check(
    "a status change reaches the feed as one field change with the old and new value",
    moved.status === 200 &&
      (afterMove.json?.data?.activity ?? []).some(
        (entry) =>
          entry.kind === "change" && entry.field === "status" && entry.oldValue === "TESTING" && entry.newValue === "PROFIT",
      ),
    `status ${moved.status}`,
  );

  await request("/api/bundles/bulk", { method: "POST", jar, body: { action: "archive", ids: [detailId] } });
  const afterArchive = await request(`/api/bundles/${detailId}`, { jar });
  check(
    "archiving is logged too, so the feed explains why a row left the working list",
    (afterArchive.json?.data?.activity ?? []).some(
      (entry) => entry.kind === "change" && entry.field === "isArchived" && entry.newValue === "true",
    ),
    `${(afterArchive.json?.data?.activity ?? []).length} entries`,
  );

  // 11b. Dictionaries (stage 6). Rows created here are deleted again, and every seeded
  // row the block touches is put back the way it was, so the run stays self-cleaning.
  const stamp = Date.now();
  const offerName = `Smoke offer ${stamp}`;
  // Deliberately not a superstring of `offerName`, so "the old name is gone" can be
  // asserted with a plain substring check on the page payload.
  const renamedOffer = `Renamed smoke offer ${stamp}`;

  const anonOffers = await request("/api/offers");
  check("GET /api/offers requires a session", anonOffers.status === 401, `status ${anonOffers.status}`);

  const buyerRead = await request("/api/offers", { jar: buyer });
  check(
    "a buyer may read the dictionaries the form is built from",
    buyerRead.status === 200 && Array.isArray(buyerRead.json?.data),
    `status ${buyerRead.status}`,
  );

  const buyerWrite = await request("/api/offers", { method: "POST", jar: buyer, body: { name: `Not yours ${stamp}` } });
  check("only an admin writes a shared dictionary", buyerWrite.status === 403, `status ${buyerWrite.status}`);

  const shortOffer = await request("/api/offers", { method: "POST", jar, body: { name: "x" } });
  check(
    "an offer name is validated on the server",
    shortOffer.status === 422 && Boolean(shortOffer.json?.error?.fields?.name),
    `status ${shortOffer.status}`,
  );

  const madeOffer = await request("/api/offers", { method: "POST", jar, body: { name: offerName, payoutUSD: 40, network: "Smoke" } });
  const offerId = madeOffer.json?.data?.id;
  check(
    "POST /api/offers creates an active row with no bundles yet",
    madeOffer.status === 200 &&
      madeOffer.json?.data?.isActive === true &&
      madeOffer.json?.data?.bundleCount === 0 &&
      madeOffer.json?.data?.payoutUSD === 40,
    `status ${madeOffer.status}`,
  );

  const dupeOffer = await request("/api/offers", { method: "POST", jar, body: { name: offerName } });
  check("an offer name stays unique", dupeOffer.status === 409, `status ${dupeOffer.status}`);

  // Filter options are cached under `facets`, so a new dictionary row must be visible on
  // the very next render of /bundles — the same contract the dashboard tag has.
  const facetsAfterCreate = await request("/bundles", { jar });
  check(
    "a new offer reaches the cached filter options at once",
    facetsAfterCreate.text.includes(offerName),
    "looked for the offer name in the /bundles payload",
  );

  const emptyOfferPatch = await request(`/api/offers/${offerId}`, { method: "PUT", jar, body: {} });
  check("an empty offer patch is rejected", emptyOfferPatch.status === 422, `status ${emptyOfferPatch.status}`);

  // The `.partial()` trap again: a partial built over a defaulted field would turn this
  // into a full payload and blank the columns the admin never touched.
  const deactivated = await request(`/api/offers/${offerId}`, { method: "PUT", jar, body: { isActive: false } });
  check(
    "PUT /api/offers/[id] changes only the field it was sent",
    deactivated.status === 200 &&
      deactivated.json?.data?.isActive === false &&
      deactivated.json?.data?.name === offerName &&
      deactivated.json?.data?.payoutUSD === 40,
    JSON.stringify(deactivated.json?.data ?? deactivated.json?.error),
  );

  const facetsAfterDeactivate = await request("/bundles", { jar });
  check(
    "a deactivated offer leaves the filter options while the row stays",
    !facetsAfterDeactivate.text.includes(offerName) && (await request("/api/offers", { jar })).text?.includes(offerName),
    "checked both the page and the dictionary list",
  );

  const renamedRow = await request(`/api/offers/${offerId}`, { method: "PUT", jar, body: { name: renamedOffer, isActive: true } });
  const facetsAfterRename = await request("/bundles", { jar });
  check(
    "a rename invalidates the cached facets in both directions",
    renamedRow.status === 200 &&
      facetsAfterRename.text.includes(renamedOffer) &&
      !facetsAfterRename.text.includes(offerName),
    "looked for the new name and the absence of the old one",
  );

  const seededOfferInUse = (await request("/api/offers", { jar })).json?.data?.find((offer) => offer.bundleCount > 0);
  const refuseDelete = await request(`/api/offers/${seededOfferInUse?.id}`, { method: "DELETE", jar });
  check(
    "an offer that bundles still use cannot be deleted",
    refuseDelete.status === 409 && (refuseDelete.json?.error?.message ?? "").includes("deactivate"),
    `status ${refuseDelete.status}`,
  );

  const madeGeo = await request("/api/geos", { method: "POST", jar, body: { code: "qa", name: "Smoke Land" } });
  const geoId = madeGeo.json?.data?.id;
  check(
    "a GEO code is normalised to upper case",
    madeGeo.status === 200 && madeGeo.json?.data?.code === "QA",
    `status ${madeGeo.status}, code ${madeGeo.json?.data?.code}`,
  );

  const badGeo = await request("/api/geos", { method: "POST", jar, body: { code: "UNITED", name: "Too long" } });
  check("a GEO code must be two or three letters", badGeo.status === 422, `status ${badGeo.status}`);

  const renamedGeo = await request(`/api/geos/${geoId}`, { method: "PUT", jar, body: { name: "Smoke Land II" } });
  check(
    "a GEO keeps its code when only the name is sent",
    renamedGeo.json?.data?.code === "QA" && renamedGeo.json?.data?.name === "Smoke Land II",
    JSON.stringify(renamedGeo.json?.data ?? renamedGeo.json?.error),
  );

  const bundleGeos = (await request(`/api/bundles/${detailId}`, { jar })).json?.data?.geos ?? [];
  await request(`/api/bundles/${detailId}`, {
    method: "PUT",
    jar,
    body: { geoIds: [...bundleGeos.map((geo) => geo.id), geoId] },
  });
  const removedGeo = await request(`/api/geos/${geoId}`, { method: "DELETE", jar });
  const bundleAfterGeoGone = await request(`/api/bundles/${detailId}`, { jar });
  check(
    "deleting a GEO unlinks it, reports the count and keeps the bundle",
    removedGeo.status === 200 &&
      removedGeo.json?.data?.unlinked === 1 &&
      (bundleAfterGeoGone.json?.data?.geos ?? []).length === bundleGeos.length,
    JSON.stringify(removedGeo.json?.data ?? removedGeo.json?.error),
  );

  const badTag = await request("/api/tags", { method: "POST", jar, body: { name: `nope-${stamp}`, color: "red" } });
  check(
    "a tag colour must be a hex value",
    badTag.status === 422 && Boolean(badTag.json?.error?.fields?.color),
    `status ${badTag.status}`,
  );

  const madeTag = await request("/api/tags", { method: "POST", jar, body: { name: `smoke-${stamp}`, color: "#123456" } });
  const tagId = madeTag.json?.data?.id;
  const recoloredTag = await request(`/api/tags/${tagId}`, { method: "PUT", jar, body: { color: "#abcdef" } });
  check(
    "a tag keeps its name when only the colour is sent",
    madeTag.status === 200 && recoloredTag.json?.data?.name === `smoke-${stamp}` && recoloredTag.json?.data?.color === "#abcdef",
    JSON.stringify(recoloredTag.json?.data ?? recoloredTag.json?.error),
  );

  const removedTag = await request(`/api/tags/${tagId}`, { method: "DELETE", jar });
  check("an unused tag is removable", removedTag.status === 200 && removedTag.json?.data?.unlinked === 0, `status ${removedTag.status}`);

  const removedOffer = await request(`/api/offers/${offerId}`, { method: "DELETE", jar });
  check(
    "an offer nothing uses is removable and the facet cache forgets it",
    removedOffer.status === 200 &&
      removedOffer.json?.data?.label === renamedOffer &&
      !(await request("/bundles", { jar })).text.includes(renamedOffer),
    `status ${removedOffer.status}`,
  );

  const anonUsers = await request("/api/users");
  check("GET /api/users requires a session", anonUsers.status === 401, `status ${anonUsers.status}`);

  const buyerUsers = await request("/api/users", { jar: buyer });
  check("a buyer cannot read the account list", buyerUsers.status === 403, `status ${buyerUsers.status}`);

  const users = (await request("/api/users", { jar })).json?.data ?? [];
  const seededEmails = ["admin@saints.com", "ivanov@saints.com", "petrov@saints.com", "sidorov@saints.com"];
  const seeded = users.filter((row) => seededEmails.includes(row.email));
  check(
    "the account list carries roles and marks the caller's own row",
    seeded.length === 4 &&
      seeded.filter((row) => row.role === "ADMIN").length === 1 &&
      users.filter((row) => row.isSelf).length === 1,
    `${users.length} accounts, ${seeded.length} seeded`,
  );

  const selfDemote = await request(`/api/users/${users.find((row) => row.isSelf)?.id}`, { method: "PUT", jar, body: { role: "USER" } });
  check("an admin cannot strip their own access", selfDemote.status === 400, `status ${selfDemote.status}`);

  const busyUserId = mineItems[0]?.buyer?.id;
  const deleteBusy = await request(`/api/users/${busyUserId}`, { method: "DELETE", jar });
  check(
    "an account that still owns bundles cannot be deleted",
    deleteBusy.status === 409 && (deleteBusy.json?.error?.message ?? "").includes("reassign"),
    `status ${deleteBusy.status}`,
  );

  const takenEmail = await request(`/api/users/${busyUserId}`, { method: "PUT", jar, body: { email: "petrov@saints.com" } });
  check("an account email stays unique", takenEmail.status === 409, `status ${takenEmail.status}`);

  // The two accounts this run registered own nothing, so they are removable — which both
  // covers the happy delete path and stops the demo team growing on every run.
  const smokeAccounts = [created.json?.data?.id, anonApi.json?.data?.id].filter(Boolean);
  const removedStatuses = [];
  for (const accountId of smokeAccounts) {
    removedStatuses.push((await request(`/api/users/${accountId}`, { method: "DELETE", jar })).status);
  }
  check(
    "an account that owns nothing is removable",
    smokeAccounts.length === 2 &&
      removedStatuses.every((status) => status === 200) &&
      (await request("/api/users", { jar })).json?.data?.length === users.length - smokeAccounts.length,
    `${removedStatuses.join("/")} of ${smokeAccounts.length}, was ${users.length} accounts`,
  );

  const renamedBuyer = await request(`/api/users/${busyUserId}`, { method: "PUT", jar, body: { name: "Renamed Buyer" } });
  const facetsAfterBuyerRename = await request("/bundles", { jar });
  check(
    "a renamed buyer reaches the cached filter options",
    renamedBuyer.status === 200 &&
      facetsAfterBuyerRename.text.includes("Renamed Buyer") &&
      !facetsAfterBuyerRename.text.includes("Ivan Ivanov"),
    "looked for the new name and the absence of the old one",
  );
  await request(`/api/users/${busyUserId}`, { method: "PUT", jar, body: { name: "Ivan Ivanov" } });

  // `authorize()` refuses a disabled account, which is what makes the row meaningful —
  // without it "disable" would be a badge and nothing more.
  const disabledBuyer = await request(`/api/users/${busyUserId}`, { method: "PUT", jar, body: { isActive: false } });
  const rejectedSignIn = await signInSession("ivanov@saints.com", "saints2026");
  check(
    "a disabled account cannot start a session",
    disabledBuyer.status === 200 && disabledBuyer.json?.data?.isActive === false && !rejectedSignIn.has("authjs.session-token"),
    `status ${disabledBuyer.status}`,
  );
  await request(`/api/users/${busyUserId}`, { method: "PUT", jar, body: { isActive: true } });
  const restoredSignIn = await signInSession("ivanov@saints.com", "saints2026");
  check(
    "re-enabling the account lets it sign in again",
    restoredSignIn.has("authjs.session-token"),
    "the buyer jar used above is a separate session",
  );

  const buyerThreshold = await request("/api/settings", { jar: buyer });
  check("a buyer may read the alert threshold", buyerThreshold.status === 200 && Number.isFinite(buyerThreshold.json?.data?.roiAlertThreshold), `status ${buyerThreshold.status}`);

  const buyerThresholdWrite = await request("/api/settings", { method: "PUT", jar: buyer, body: { roiAlertThreshold: -50 } });
  check("only an admin moves the alert threshold", buyerThresholdWrite.status === 403, `status ${buyerThresholdWrite.status}`);

  const outOfRange = await request("/api/settings", { method: "PUT", jar, body: { roiAlertThreshold: 5000 } });
  check("the threshold is bounded", outOfRange.status === 422, `status ${outOfRange.status}`);

  const savedThreshold = await request("/api/settings", { method: "PUT", jar, body: { roiAlertThreshold: -35 } });
  const readBackThreshold = await request("/api/settings", { jar });
  check(
    "PUT /api/settings stores the value and answers with what it kept",
    savedThreshold.json?.data?.roiAlertThreshold === -35 && readBackThreshold.json?.data?.roiAlertThreshold === -35,
    JSON.stringify(savedThreshold.json?.data ?? savedThreshold.json?.error),
  );
  await request("/api/settings", { method: "PUT", jar, body: { roiAlertThreshold: -20 } });

  const settingsPage = await request("/settings", { jar });
  const buyerSettingsPage = await request("/settings", { jar: buyer });
  check(
    "the dictionaries screen is read-only for a buyer",
    settingsPage.status === 200 &&
      buyerSettingsPage.status === 200 &&
      settingsPage.text.includes("New offer") &&
      !buyerSettingsPage.text.includes("New offer") &&
      !buyerSettingsPage.text.includes("Buyers"),
    `admin ${settingsPage.status}, buyer ${buyerSettingsPage.status}`,
  );

  const page = await request(`/bundles/${detailId}`, { jar });
  check(
    "GET /bundles/[id] renders the whole detail screen server-side",
    page.status === 200 &&
      page.text.includes("Activity") &&
      page.text.includes(note) &&
      page.text.includes("Change status") &&
      page.text.includes("Bundle setup") &&
      page.text.includes("Profit by day"),
    `status ${page.status}`,
  );
  check(
    "the page draws the feed in words, not machine keys",
    page.text.includes("changed status") && page.text.includes("updated archive"),
    "looked for the human summary of the change rows",
  );
  check("an archived bundle says so on the page", page.text.includes("Archived"), "");

  const anonPage = await request(`/bundles/${detailId}`, { jar: createJar() });
  check(
    "an anonymous visitor to the detail page is redirected to the sign-in screen",
    anonPage.status === 307 && (anonPage.location ?? "").includes("/auth/login"),
    `status ${anonPage.status}, location ${anonPage.location ?? "none"}`,
  );

  // PPR flushes the segment's skeleton before the page can answer, so a streamed
  // not-found may arrive with status 200; what the user must see either way is the
  // 404 screen, not a crashed render.
  const missingPage = await request("/bundles/no-such-bundle-id", { jar });
  check(
    "a deleted or wrong id gets the 404 screen, not an error boundary",
    [200, 404].includes(missingPage.status) && missingPage.text.includes("Bundle not found"),
    `status ${missingPage.status}`,
  );

  const foreignDelete = await request(`/api/bundles/${detailId}`, { method: "DELETE", jar: buyer });
  check("a buyer cannot delete a bundle through the API", foreignDelete.status === 403, `status ${foreignDelete.status}`);

  const removed = await request("/api/bundles/bulk", {
    method: "POST",
    jar,
    body: { action: "delete", ids: [bundleDraft?.id] },
  });
  const goneList = await request(`/api/bundles?search=${encodeURIComponent(newBundle.name)}`, { jar });
  check(
    "the smoke bundle is deleted again",
    removed.json?.data?.affected === 1 && goneList.json?.data?.total === 0,
    `affected ${removed.json?.data?.affected}, left ${goneList.json?.data?.total}`,
  );

  // 12. Analytics (stage 6). The screen reads four endpoints over the same window, so the
  // test that matters most is not "it returns 200" but "the four agree with each other".
  for (const path of [
    "/api/analytics/dashboard",
    "/api/analytics/by-buyer",
    "/api/analytics/by-offer",
    "/api/analytics/top-bundles",
  ]) {
    const anon = await request(path);
    check(`${path} requires a session`, anon.status === 401, `status ${anon.status}`);
  }

  const summary = (await request("/api/analytics/dashboard?days=30", { jar })).json?.data;
  check(
    "GET /api/analytics/dashboard answers with the period, its totals and the period before",
    summary?.window?.days === 30 &&
      summary?.totals?.spent > 0 &&
      summary?.previous !== undefined &&
      Array.isArray(summary?.funnel) &&
      summary.funnel.length === 4 &&
      summary.counts.active > 0,
    JSON.stringify(summary?.totals ?? {}),
  );
  check(
    "the funnel starts where the bundle counter stands",
    summary?.funnel?.[0]?.count === summary?.counts?.active,
    `funnel ${summary?.funnel?.[0]?.count}, active ${summary?.counts?.active}`,
  );
  check(
    "team ROI is the window's revenue against its spend, not an average of ratios",
    Math.abs(summary.totals.roi - ((summary.totals.revenue - summary.totals.spent) / summary.totals.spent) * 100) < 0.1,
    `roi ${summary?.totals?.roi}`,
  );

  const byBuyer = (await request("/api/analytics/by-buyer?days=30", { jar })).json?.data;
  const buyerSpent = (byBuyer?.rows ?? []).reduce((sum, row) => sum + row.spent, 0);
  check(
    "profit per buyer adds up to the team totals and is ranked",
    Math.abs(buyerSpent - summary.totals.spent) < 0.05 &&
      (byBuyer?.rows ?? []).every((row, index, all) => index === 0 || all[index - 1].profit >= row.profit),
    `${byBuyer?.rows?.length} buyers, spent ${Math.round(buyerSpent)} vs ${summary?.totals?.spent}`,
  );

  const byOffer = (await request("/api/analytics/by-offer?days=30", { jar })).json?.data;
  const offerRevenue = (byOffer?.rows ?? []).reduce((sum, row) => sum + row.revenue, 0);
  check(
    "efficiency per offer carries the dictionary payout and adds up to the revenue",
    Math.abs(offerRevenue - summary.totals.revenue) < 0.05 && (byOffer?.rows ?? []).some((row) => row.payoutUSD > 0),
    `${byOffer?.rows?.length} offers, revenue ${Math.round(offerRevenue)}`,
  );

  const badDays = await request("/api/analytics/dashboard?days=abc", { jar });
  check("a period that is not a number is rejected", badDays.status === 422, `status ${badDays.status}`);

  const longDays = await request("/api/analytics/dashboard?days=900", { jar });
  check("a preset window is bounded", longDays.status === 422, `status ${longDays.status}`);

  const reversed = await request("/api/analytics/dashboard?from=2026-11-01&to=2026-10-01", { jar });
  check(
    "a range the wrong way round names the field at fault",
    reversed.status === 422 && Boolean(reversed.json?.error?.fields?.to),
    `status ${reversed.status}`,
  );

  const day = (offset) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
  const ranged = (await request(`/api/analytics/dashboard?from=${day(7)}&to=${day(0)}`, { jar })).json?.data;
  check(
    "an explicit range is counted inclusively and compared to the span before it",
    ranged?.window?.days === 8 && new Date(ranged.window.previousTo) < new Date(ranged.window.from),
    JSON.stringify(ranged?.window ?? {}),
  );

  const best = (await request("/api/analytics/top-bundles?days=30&limit=3", { jar })).json?.data;
  const worst = (await request("/api/analytics/top-bundles?days=30&limit=3&order=asc", { jar })).json?.data;
  check(
    "the ranking is capped, skips bundles without spend and flips with order",
    (best?.rows ?? []).length > 0 &&
      best.rows.length <= 3 &&
      best.rows.every((row) => row.spent > 0) &&
      best.rows[0].roi >= worst.rows[0].roi,
    `best ${best?.rows?.[0]?.roi}%, worst ${worst?.rows?.[0]?.roi}%`,
  );

  const profitable = (await request("/api/analytics/top-bundles?days=30&status=PROFIT", { jar })).json?.data;
  check(
    "the status filter narrows the ranking",
    (profitable?.rows ?? []).length > 0 && profitable.rows.every((row) => row.status === "PROFIT"),
    `${profitable?.rows?.length} rows`,
  );

  const badStatus = await request("/api/analytics/top-bundles?status=NOT_A_STATUS", { jar });
  check("an unknown status in the ranking filter is rejected", badStatus.status === 422, `status ${badStatus.status}`);

  const analyticsPage = await request("/analytics?days=14", { jar });
  const anonAnalyticsPage = await request("/analytics", { jar: createJar() });
  check(
    "GET /analytics renders the screen server-side and an anonymous visit is redirected with the path",
    analyticsPage.status === 200 &&
      analyticsPage.text.includes("Top bundles for the period") &&
      anonAnalyticsPage.status === 307 &&
      (anonAnalyticsPage.location ?? "").includes("from=%2Fanalytics"),
    `page ${analyticsPage.status}, anonymous ${anonAnalyticsPage.status}`,
  );

  // 13. Stage 7 — CSV import, the notification bell, the audit log.
  //
  // Everything written below is written by a freshly registered account that owns nothing
  // else, and is deleted again at the end of the block (bundles first, then the account —
  // the reverse order would be refused by the same rule the stage 6 block asserts). The
  // threshold is put back where the seed left it, so a run cannot leave the team's alert
  // rule set to a smoke value.
  const header = ["Name", "Offer", "Angle", "GEOs", "Buyer", "Status", "Budget planned", "Spent", "Revenue", "Clicks", "Conversions", "Tags", "Notes", "Creative"];
  const cell = (value) => {
    const text = value === undefined || value === null ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const csvFile = (rows, columns = header) => [columns.map(cell).join(","), ...rows.map((row) => row.map(cell).join(","))].join("\r\n");

  const importOfferName = sample?.offer?.label;
  const geoCode = sample?.geos?.[0]?.label;
  const rowFor = (name, patch = {}) => {
    const row = {
      Name: name,
      Offer: importOfferName,
      Angle: "Angle written by the smoke run",
      GEOs: geoCode,
      Buyer: "",
      Status: "TESTING",
      "Budget planned": 400,
      Spent: 500,
      Revenue: 100,
      Clicks: 5000,
      Conversions: 10,
      Tags: "",
      Notes: "",
      Creative: "",
      ...patch,
    };
    return header.map((key) => row[key]);
  };

  const stamp7 = Date.now();
  const goodName = `Smoke import ${stamp7}`;
  const importEmail = `smoke-import-${stamp7}@saints.com`;
  const importAccount = await request("/api/auth/register", {
    method: "POST",
    body: { name: "Smoke Importer", email: importEmail, password: "saints2026" },
  });
  const importer = await signInSession(importEmail, "saints2026");
  check(
    "a dedicated account is registered for the import rows",
    importAccount.status === 200 && importer.has("authjs.session-token"),
    `status ${importAccount.status}`,
  );

  const anonImport = await request("/api/bundles/import", { method: "POST", body: { text: csvFile([rowFor(goodName)]) } });
  check("POST /api/bundles/import requires a session", anonImport.status === 401, `status ${anonImport.status}`);

  const anonTemplate = await request("/api/bundles/import/template");
  const template = await request("/api/bundles/import/template", { jar });
  const templateLines = template.text.trim().split(/\r?\n/);
  check(
    "the import template offers the column list as a file",
    anonTemplate.status === 401 &&
      template.status === 200 &&
      template.contentType?.startsWith("text/csv") &&
      template.disposition?.includes("attachment") &&
      templateLines[0].includes("GEOs") &&
      templateLines.length === 2,
    `anon ${anonTemplate.status}, ${templateLines.length} lines, ${template.contentType}`,
  );

  const preview = await request("/api/bundles/import", {
    method: "POST",
    jar: importer,
    body: { text: csvFile([rowFor(goodName)]), dryRun: true },
  });
  const previewData = preview.json?.data;
  const previewList = await request(`/api/bundles?search=${encodeURIComponent(goodName)}`, { jar });
  check(
    "a dry run reports the row as valid and writes nothing",
    preview.status === 200 &&
      previewData?.dryRun === true &&
      previewData?.rows === 1 &&
      previewData?.invalid === 0 &&
      previewData?.created === 0 &&
      previewList.json?.data?.total === 0,
    `rows ${previewData?.rows}, invalid ${previewData?.invalid}, created ${previewData?.created}, left in the list ${previewList.json?.data?.total}`,
  );

  const unknownOffer = await request("/api/bundles/import", {
    method: "POST",
    jar: importer,
    body: { text: csvFile([rowFor(`No offer ${stamp7}`, { Offer: "Offer that does not exist" })]), dryRun: true },
  });
  const unknownOfferErrors = unknownOffer.json?.data?.outcomes?.[0]?.errors ?? {};
  check(
    "an unknown offer fails the row and names the place that fixes it",
    unknownOffer.json?.data?.invalid === 1 &&
      /Settings/.test(unknownOfferErrors.offer ?? "") &&
      unknownOffer.json?.data?.created === 0,
    JSON.stringify(unknownOfferErrors),
  );

  const tooManyConversions = await request("/api/bundles/import", {
    method: "POST",
    jar: importer,
    body: { text: csvFile([rowFor(`Bad maths ${stamp7}`, { Clicks: 2, Conversions: 10 })]), dryRun: true },
  });
  check(
    "the row is validated by the same schema as the form, not a copy of it",
    (tooManyConversions.json?.data?.outcomes?.[0]?.errors ?? {}).conversions !== undefined,
    JSON.stringify(tooManyConversions.json?.data?.outcomes?.[0]?.errors ?? {}),
  );

  const derivedColumns = [...header, "CR %", "ROI %", "Profit"];
  const withDerived = await request("/api/bundles/import", {
    method: "POST",
    jar: importer,
    body: {
      text: csvFile([rowFor(`Derived ignored ${stamp7}`).concat(["0.5", "-80", "-400"])], derivedColumns),
      dryRun: true,
    },
  });
  check(
    "columns the app computes itself are read and ignored, not trusted",
    withDerived.json?.data?.invalid === 0 && withDerived.json?.data?.columns?.ignored?.includes("ROI %"),
    JSON.stringify(withDerived.json?.data?.columns?.ignored ?? []),
  );

  const assignedToOther = await request("/api/bundles/import", {
    method: "POST",
    jar: importer,
    body: { text: csvFile([rowFor(`Not yours ${stamp7}`, { Buyer: "Ivan Ivanov" })]), dryRun: true },
  });
  const assignError = (assignedToOther.json?.data?.outcomes?.[0]?.errors ?? {}).buyer ?? "";
  check(
    "a buyer cannot import work onto another buyer's name",
    assignedToOther.json?.data?.invalid === 1 && /admin/i.test(assignError),
    assignError || "no buyer error reported",
  );

  const strictFile = await request("/api/bundles/import", {
    method: "POST",
    jar: importer,
    body: {
      text: csvFile([rowFor(`Strict good ${stamp7}`), rowFor(`Strict bad ${stamp7}`, { Offer: "Nothing" })]),
      dryRun: false,
      skipInvalid: false,
    },
  });
  const strictList = await request(`/api/bundles?search=${encodeURIComponent(`Strict good ${stamp7}`)}`, { jar });
  check(
    "with skip-invalid off, one bad row refuses the whole file",
    strictFile.json?.data?.aborted === true &&
      strictFile.json?.data?.created === 0 &&
      strictList.json?.data?.total === 0,
    `aborted ${strictFile.json?.data?.aborted}, created ${strictFile.json?.data?.created}, left ${strictList.json?.data?.total}`,
  );

  const tooManyRows = await request("/api/bundles/import", {
    method: "POST",
    jar: importer,
    body: { text: csvFile(Array.from({ length: 501 }, (_, index) => rowFor(`Over the cap ${stamp7} ${index}`))), dryRun: true },
  });
  check("a file over the row cap is refused before any row is read", tooManyRows.status === 413, `status ${tooManyRows.status}`);

  const missingColumnFile = await request("/api/bundles/import", {
    method: "POST",
    jar: importer,
    body: { text: ["Name", "x"].join("\r\n"), dryRun: true },
  });
  check(
    "a header without the required columns says which ones",
    missingColumnFile.status === 422 && /Offer|GEOs|Status/.test(missingColumnFile.json?.error?.message ?? ""),
    `status ${missingColumnFile.status}, ${missingColumnFile.json?.error?.message}`,
  );

  const imported = await request("/api/bundles/import", {
    method: "POST",
    jar: importer,
    body: {
      text: csvFile([rowFor(goodName), rowFor(`${goodName} B`, { Spent: 500, Revenue: 700 })]),
      dryRun: false,
      skipInvalid: true,
    },
  });
  const importedData = imported.json?.data;
  const importedList = await request(`/api/bundles?search=${encodeURIComponent(goodName)}&pageSize=100`, { jar: importer });
  check(
    "a real import writes the valid rows, owned by the caller",
    imported.status === 200 &&
      importedData?.created === 2 &&
      importedData?.dryRun === false &&
      importedList.json?.data?.total === 2 &&
      importedList.json?.data?.items?.every((item) => item.buyer.label === "Smoke Importer"),
    `created ${importedData?.created}, in the list ${importedList.json?.data?.total}`,
  );

  // The importer is also an audit writer: `import` is a field key of its own, so the log can
  // tell a loaded file apart from a bundle somebody filled in by hand.
  const auditImport = await request(`/api/audit?field=import&search=${encodeURIComponent(goodName)}`, { jar });
  check(
    "imported bundles reach the log as their own event",
    (auditImport.json?.data?.items ?? []).length === 2 &&
      auditImport.json?.data?.items?.every((entry) => entry.field === "import"),
    `${auditImport.json?.data?.items?.length} rows`,
  );

  const importedIds = (importedList.json?.data?.items ?? []).map((item) => item.id);

  // ROI of the first imported row is (100 - 500) / 500 = -80%, under the seeded -20 line.
  const alerts = await request("/api/notifications", { jar: importer });
  const alertData = alerts.json?.data;
  const losingAlert = (alertData?.items ?? []).find((item) => item.message.includes(goodName));
  check(
    "a bundle imported under the threshold raises an alert for its owner",
    alerts.status === 200 && losingAlert?.type === "roi_alert" && losingAlert?.read === false,
    JSON.stringify({ unread: alertData?.unread, found: Boolean(losingAlert) }),
  );

  const adminAlerts = await request("/api/notifications", { jar });
  check(
    "admins are told too, and only the caller's own rows come back",
    (adminAlerts.json?.data?.items ?? []).some((item) => item.message.includes(goodName)),
    `${adminAlerts.json?.data?.items?.length} rows, unread ${adminAlerts.json?.data?.unread}`,
  );

  const otherBuyerAlerts = await request("/api/notifications", { jar: buyer });
  check(
    "a third account cannot read an alert that is not theirs",
    (otherBuyerAlerts.json?.data?.items ?? []).every((item) => !item.message.includes(goodName)),
    `${otherBuyerAlerts.json?.data?.items?.length} rows for another buyer`,
  );

  const anonNotifications = await request("/api/notifications");
  check("GET /api/notifications requires a session", anonNotifications.status === 401, `status ${anonNotifications.status}`);

  const markedOne = await request("/api/notifications/read", { method: "POST", jar: importer, body: { ids: [losingAlert?.id] } });
  const afterMarkOne = await request("/api/notifications", { jar: importer });
  check(
    "marking one alert by id leaves the rest unread",
    markedOne.json?.data?.marked === 1 &&
      afterMarkOne.json?.data?.unread === (alertData?.unread ?? 0) - 1 &&
      afterMarkOne.json?.data?.items?.find((item) => item.id === losingAlert?.id)?.read === true,
    `marked ${markedOne.json?.data?.marked}, unread ${alertData?.unread} → ${afterMarkOne.json?.data?.unread}`,
  );

  const markedRest = await request("/api/notifications/read", { method: "POST", jar: importer, body: {} });
  const afterMarkAll = await request("/api/notifications", { jar: importer });
  const markedNothing = await request("/api/notifications/read", { method: "POST", jar: importer, body: {} });
  check(
    "an empty read receipt marks everything unread, and the next one marks nothing",
    afterMarkAll.json?.data?.unread === 0 &&
      markedRest.json?.data?.marked >= 0 &&
      markedNothing.json?.data?.marked === 0,
    `unread ${afterMarkAll.json?.data?.unread}, then ${markedNothing.json?.data?.marked}`,
  );

  // Moving the threshold has to re-raise the bell from the new line — otherwise the number
  // in Settings and the alerts a reader sees would disagree until every bundle was touched.
  const loosened = await request("/api/settings", { method: "PUT", jar, body: { roiAlertThreshold: -90 } });
  const afterLoosen = await request("/api/notifications?unread=1", { jar: importer });
  check(
    "loosening the threshold clears the alerts it no longer flags",
    loosened.json?.data?.roiAlertThreshold === -90 && afterLoosen.json?.data?.unread === 0,
    `threshold ${loosened.json?.data?.roiAlertThreshold}, unread ${afterLoosen.json?.data?.unread}`,
  );

  const tightened = await request("/api/settings", { method: "PUT", jar, body: { roiAlertThreshold: -20 } });
  const afterTighten = await request("/api/notifications?unread=1", { jar: importer });
  check(
    "putting it back re-raises them, and the seeded value is restored for the next run",
    tightened.json?.data?.roiAlertThreshold === -20 &&
      (afterTighten.json?.data?.items ?? []).some((item) => item.message.includes(goodName)),
    `unread ${afterTighten.json?.data?.unread}`,
  );

  // Ids stay as loosely typed as everywhere else in this API (`idParamSchema` is "non-empty
  // string"), so an id the caller does not own is not a validation error. What is worth
  // promising is that it marks nothing, and that the reader's one real alert survives it.
  const unknownIds = await request("/api/notifications/read", { method: "POST", jar: importer, body: { ids: ["not-a-notification"] } });
  const afterUnknownIds = await request("/api/notifications?unread=1", { jar: importer });
  check(
    "a read receipt for an id that is not the caller's marks nothing",
    unknownIds.json?.data?.marked === 0 && afterUnknownIds.json?.data?.unread === afterTighten.json?.data?.unread,
    `marked ${unknownIds.json?.data?.marked}, unread ${afterUnknownIds.json?.data?.unread}`,
  );

  const dismissed = await request(`/api/notifications/${losingAlert?.id}`, { method: "DELETE", jar: importer });
  const afterDismiss = await request("/api/notifications", { jar: importer });
  check(
    "dismissing an alert takes it out of that account's list",
    dismissed.status === 200 &&
      !(afterDismiss.json?.data?.items ?? []).some((item) => item.id === losingAlert?.id),
    `status ${dismissed.status}, ${afterDismiss.json?.data?.items?.length} rows left`,
  );

  const anonAudit = await request("/api/audit");
  const buyerAudit = await request("/api/audit", { jar: buyer });
  check(
    "the audit log is a session-only, admin-only read",
    anonAudit.status === 401 && buyerAudit.status === 403,
    `anon ${anonAudit.status}, buyer ${buyerAudit.status}`,
  );

  const audit = await request("/api/audit?pageSize=5", { jar });
  const auditRows = audit.json?.data?.items ?? [];
  const auditSorted = auditRows.every((entry, index) => index === 0 || auditRows[index - 1].at >= entry.at);
  check(
    "GET /api/audit pages the whole system newest-first",
    audit.status === 200 &&
      auditRows.length > 0 &&
      auditRows.length <= 5 &&
      auditSorted &&
      audit.json?.data?.pageSize === 5 &&
      audit.json?.data?.total > 5 &&
      audit.json?.data?.pageCount === Math.ceil(audit.json?.data?.total / 5),
    `${auditRows.length} of ${audit.json?.data?.total}, pageCount ${audit.json?.data?.pageCount}`,
  );

  const statusActor = auditRows.find((entry) => entry.actor.id === importAccount.json?.data?.id);
  const auditByActor = await request(`/api/audit?actorId=${importAccount.json?.data?.id}&pageSize=100`, { jar });
  check(
    "filtering by who did it returns only their rows",
    statusActor === undefined ||
      (auditByActor.json?.data?.items ?? []).every((entry) => entry.actor.id === importAccount.json?.data?.id),
    `${auditByActor.json?.data?.items?.length} rows for one actor`,
  );

  const auditByKind = await request("/api/audit?kind=comment&pageSize=100", { jar });
  const auditByField = await request("/api/audit?field=budgetSpent&pageSize=100", { jar });
  check(
    "the type and field filters hold",
    (auditByKind.json?.data?.items ?? []).every((entry) => entry.kind === "comment" && Boolean(entry.text)) &&
      (auditByField.json?.data?.items ?? []).every((entry) => entry.field === "budgetSpent"),
    `${auditByKind.json?.data?.items?.length} comments, ${auditByField.json?.data?.items?.length} spend rows`,
  );

  const auditSearch = await request(`/api/audit?search=${encodeURIComponent(goodName)}&pageSize=100`, { jar });
  check(
    "searching the log by bundle name stays inside that bundle",
    (auditSearch.json?.data?.items ?? []).length > 0 &&
      auditSearch.json?.data?.items.every((entry) => entry.bundle.label.includes(goodName)),
    `${auditSearch.json?.data?.items?.length} rows`,
  );

  const badAudit = await request("/api/audit?kind=nonsense", { jar });
  check("an unknown log type in the filter is rejected", badAudit.status === 422, `status ${badAudit.status}`);

  const staleAuditPage = await request("/api/audit?page=999", { jar });
  check(
    "a page past the end of the log is clamped, like the bundle list",
    staleAuditPage.json?.data?.page === staleAuditPage.json?.data?.pageCount,
    `page ${staleAuditPage.json?.data?.page} of ${staleAuditPage.json?.data?.pageCount}`,
  );

  const auditPage = await request("/audit", { jar });
  const buyerAuditPage = await request("/audit", { jar: buyer });
  const anonAuditPage = await request("/audit", { jar: createJar() });
  check(
    "GET /audit renders the table for an admin and an explanation for a buyer",
    auditPage.status === 200 &&
      auditPage.text.includes("Audit log") &&
      auditPage.text.includes("Every field change") &&
      buyerAuditPage.status === 200 &&
      buyerAuditPage.text.includes("Admin only") &&
      !buyerAuditPage.text.includes("What happened"),
    `admin ${auditPage.status}, buyer ${buyerAuditPage.status}`,
  );
  check(
    "an anonymous visit to /audit is redirected with the original path",
    anonAuditPage.status === 307 && (anonAuditPage.location ?? "").includes("from=%2Faudit"),
    `status ${anonAuditPage.status}, location ${anonAuditPage.location ?? "none"}`,
  );

  const bellOnShell = await request("/", { jar });
  check(
    "the bell is part of the authenticated shell",
    bellOnShell.status === 200 && bellOnShell.text.includes("Notifications") && bellOnShell.text.includes("aria-label=\"Notifications"),
    `status ${bellOnShell.status}`,
  );

  const removedImports = await request("/api/bundles/bulk", { method: "POST", jar, body: { action: "delete", ids: importedIds } });
  const alertsAfterDelete = await request("/api/notifications?unread=1", { jar: importer });
  const leftAfterDelete = await request(`/api/bundles?search=${encodeURIComponent(goodName)}`, { jar: importer });
  check(
    "deleting the bundles takes their alerts with them (the cascade the schema promises)",
    removedImports.json?.data?.affected === 2 &&
      leftAfterDelete.json?.data?.total === 0 &&
      (alertsAfterDelete.json?.data?.items ?? []).every((item) => !item.message.includes(goodName)),
    `affected ${removedImports.json?.data?.affected}, left ${leftAfterDelete.json?.data?.total}, unread ${alertsAfterDelete.json?.data?.unread}`,
  );

  const removedImporter = await request(`/api/users/${importAccount.json?.data?.id}`, { method: "DELETE", jar });
  check(
    "the import account is removable once its bundles are gone",
    removedImporter.status === 200,
    `status ${removedImporter.status}`,
  );
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
