import { expect, test } from "./fixtures";
import { signIn, SUPABASE } from "./session";

const side = (p: string, id: string, extra: Record<string, unknown>) => ({
  [`${p}_id`]: id, [`${p}_slug`]: `plek-${id.slice(0, 4)}`, [`${p}_name`]: `Plek ${id.slice(0, 4)}`, [`${p}_status`]: "draft",
  [`${p}_lat`]: 52.1, [`${p}_lng`]: 5.1, [`${p}_osm`]: false, [`${p}_completeness`]: 0.5,
  ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [`${p}_${k}`, v])),
});
const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";
const C = "cccccccc-0000-4000-8000-000000000003";
const D = "dddddddd-0000-4000-8000-000000000004";

test.describe("beheer: dubbele plekken", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.route(`${SUPABASE}/rest/v1/rpc/is_admin**`, (r) => r.fulfill({ json: true }));
    await page.route(`${SUPABASE}/rest/v1/user_trips**`, (r) => r.fulfill({ json: null }));
    await page.route(`${SUPABASE}/rest/v1/rpc/admin_duplicate_candidates**`, (r) =>
      r.fulfill({
        json: [
          { ...side("a", A, {}), ...side("b", B, { status: "published", osm: true }), distance_m: 4, name_similarity: 1 },
          { ...side("a", C, { completeness: 0.9 }), ...side("b", D, {}), distance_m: 120, name_similarity: 0.1 },
        ],
      }),
    );
  });

  test("toont paren met zekerheid en de standaardkeuze", async ({ page }) => {
    await page.goto("/admin/dubbelen");
    await expect(page.getByText("zekerheid hoog")).toBeVisible();
    await expect(page.getByText("zekerheid laag")).toBeVisible();
    // Online plek (B) blijft standaard
    const first = page.locator("li", { hasText: "zekerheid hoog" });
    await expect(first.locator("label", { hasText: "Plek bbbb" }).getByText("blijft")).toBeVisible();
  });

  test("selectie 'hoog' samenvoegen roept admin_merge_places aan met de juiste richting", async ({ page }) => {
    const calls: unknown[] = [];
    await page.route(`${SUPABASE}/rest/v1/rpc/admin_merge_places**`, async (r) => {
      calls.push(r.request().postDataJSON());
      await r.fulfill({ json: { keep: "plek-bbbb", removed: "plek-aaaa" } });
    });
    await page.goto("/admin/dubbelen");
    await page.getByRole("button", { name: /Selecteer alle "hoog"/ }).click();
    await page.getByRole("button", { name: "1 samenvoegen" }).click();
    await expect(page.getByText("1 paar samengevoegd.")).toBeVisible();
    expect(calls).toEqual([{ p_keep: B, p_remove: A }]);
  });

  test("handmatig de andere plek laten blijven", async ({ page }) => {
    const calls: unknown[] = [];
    await page.route(`${SUPABASE}/rest/v1/rpc/admin_merge_places**`, async (r) => {
      calls.push(r.request().postDataJSON());
      await r.fulfill({ json: {} });
    });
    await page.goto("/admin/dubbelen");
    const pair = page.locator("li", { hasText: "zekerheid hoog" });
    await pair.locator("label", { hasText: "Plek aaaa" }).getByRole("radio").check();
    await pair.getByRole("button", { name: "Samenvoegen" }).click();
    await expect.poll(() => calls).toEqual([{ p_keep: A, p_remove: B }]);
  });

  test("geen dubbel slaat het paar op", async ({ page }) => {
    let body: unknown = null;
    await page.route(`${SUPABASE}/rest/v1/duplicate_dismissals**`, async (r) => {
      body = r.request().postDataJSON();
      await r.fulfill({ status: 201, json: [] });
    });
    await page.goto("/admin/dubbelen");
    await page.locator("li", { hasText: "zekerheid laag" }).getByRole("button", { name: "Geen dubbel" }).click();
    await expect.poll(() => body).toEqual([{ a: C, b: D }]);
  });
});
