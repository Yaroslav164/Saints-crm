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
    ["/bundles", ["Bundles", "Export CSV", "New bundle", "Loading bundles", "Search by name"]],
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
