import { test as setup, expect } from "@playwright/test";
import { ROLES, authFile } from "./routes";

const password = process.env.SEED_TEST_PASSWORD || process.env.SEED_ADMIN_PASSWORD;

for (const role of ROLES) {
  setup(`sign in as ${role}`, async ({ page }) => {
    setup.skip(!password, "Set SEED_TEST_PASSWORD (see prisma/seed-role-users.ts)");
    await page.goto("/login");
    await page.fill("#email", `${role}@example.com`);
    await page.fill("#password", password!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
    await page.context().storageState({ path: authFile(role) });
  });
}
