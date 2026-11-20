import { test, expect, type Page } from "@playwright/test";
import { authFile } from "./routes";

const ORG = process.env.E2E_ORG ?? "demo-college";
const EVENT = process.env.E2E_EVENT ?? "aas-2026";

/** Tab through the page; every stop must be visible and show a focus indicator. */
async function tabWalk(page: Page, stops = 30) {
  const problems: string[] = [];
  let count = 0;
  for (let i = 0; i < stops; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body || el.tagName === "NEXTJS-PORTAL") return null; // dev overlay
      if (el.dataset.kbSeen) return { repeat: true } as const;
      el.dataset.kbSeen = "1";
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const ring = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
      const shadow = cs.boxShadow && cs.boxShadow !== "none";
      const name = (el.getAttribute("aria-label") || el.innerText || el.getAttribute("placeholder") || el.tagName).trim().slice(0, 40);
      return { repeat: false, name, tag: el.tagName, visible: r.width > 0 && r.height > 0, indicator: ring || !!shadow };
    });
    if (!info) continue;
    if (info.repeat) break;
    count++;
    if (!info.visible) problems.push(`hidden focus stop: ${info.tag} "${info.name}"`);
    else if (!info.indicator) problems.push(`no focus indicator: ${info.tag} "${info.name}"`);
  }
  return { problems, count };
}

test.describe("keyboard", () => {
  test.skip(({ isMobile }) => !!isMobile, "Keyboard walk runs on desktop only");

  test("skip link moves focus to main content", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("reviewer") });
    const page = await ctx.newPage();
    await page.goto(`/${ORG}/${EVENT}/reviews`);
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toHaveText(/skip to (main )?content/i);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
    await expect(page.locator("#main-content")).toBeFocused();
    await ctx.close();
  });

  for (const [name, path, role] of [
    ["event page", `/${ORG}/${EVENT}`, null],
    ["login", "/login", null],
    ["reviewer dashboard", `/${ORG}/${EVENT}/reviews`, "reviewer"],
    ["admin reviews", `/org/${ORG}/events/${EVENT}/reviews`, "eventadmin"],
    ["submit", `/${ORG}/${EVENT}/submit`, "multi"],
  ] as const) {
    test(`${name}: every tab stop is visible and focus-ringed`, async ({ browser }) => {
      const ctx = await browser.newContext(role ? { storageState: authFile(role) } : {});
      const page = await ctx.newPage();
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const { problems, count } = await tabWalk(page);
      expect(count).toBeGreaterThan(2);
      expect(problems, problems.join("\n")).toEqual([]);
      await ctx.close();
    });
  }

  test("review screen: scores and recommendation work from the keyboard", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("reviewer") });
    const page = await ctx.newPage();
    await page.goto(`/${ORG}/${EVENT}/reviews`);
    await page.waitForLoadState("networkidle");
    const link = page.getByRole("link", { name: /^(Start|Continue|View)\b/ }).locator("visible=true").first();
    test.skip((await link.count()) === 0, "No review assigned");
    await link.click();
    await page.waitForURL(/\/reviews\/[^/]+$/);
    const firstScore = page.locator("[role=radiogroup][aria-labelledby^=crit-label-]:visible").first().getByRole("radio").first();
    await firstScore.focus();
    await page.keyboard.press("Enter");
    await expect(firstScore).toHaveAttribute("aria-checked", "true");
    const { problems } = await tabWalk(page, 40);
    expect(problems, problems.join("\n")).toEqual([]);
    await ctx.close();
  });
});
