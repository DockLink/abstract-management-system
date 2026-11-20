import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ROUTES, authFile } from "./routes";

const THEMES = ["light", "dark"] as const;

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  // Client-fetched screens show skeletons first; wait for them to go.
  await page
    .locator('[aria-busy="true"]:visible')
    .first()
    .waitFor({ state: "detached", timeout: 15_000 })
    .catch(() => {});
}

for (const route of ROUTES) {
  for (const theme of THEMES) {
    test.describe(`${route.name} · ${theme}`, () => {
      test.use({
        colorScheme: theme,
        ...(route.as ? { storageState: authFile(route.as) } : {}),
      });

      test("no serious or critical axe violations", async ({ page }) => {
        await page.addInitScript((t) => {
          try {
            localStorage.setItem("theme", t);
          } catch {}
        }, theme);
        await page.goto(route.path);
        await settle(page);

        if (route.then === "firstReview") {
          const link = page.getByRole("link", { name: /^(Start|Continue|View)\b/ }).locator("visible=true").first();
          test.skip((await link.count()) === 0, "No review assigned to the seeded reviewer");
          await link.click();
          await page.waitForURL(/\/reviews\/[^/]+$/);
          await settle(page);
        }

        await expect(page.locator("html")).toHaveClass(new RegExp(theme === "dark" ? "\\bdark\\b" : "^(?!.*\\bdark\\b)"));

        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          // Next.js dev overlay is not part of the app.
          .exclude("nextjs-portal")
          .analyze();

        const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        const summary = blocking.map(
          (v) =>
            `${v.impact} ${v.id}: ${v.help}\n` +
            v.nodes
              .slice(0, 5)
              .map((n) => `    ${n.target.join(" ")}  ${n.failureSummary?.split("\n")[1]?.trim() ?? ""}`)
              .join("\n"),
        );
        expect(blocking, summary.join("\n")).toEqual([]);
      });
    });
  }
}
