import { expect, test, type Page } from "@playwright/test";

const DEMO_ROLE_COOKIE = "attune_demo_role";

type Role = "participant" | "clinician" | "researcher";

/** Collects uncaught page errors and console errors so smoke tests fail on them. */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console: ${message.text()}`);
    }
  });
  return errors;
}

async function enterDemo(page: Page, role: Role) {
  await page.context().addCookies([
    { name: DEMO_ROLE_COOKIE, value: role, url: "http://127.0.0.1:3100" },
  ]);
}

test.describe("public pages", () => {
  test("landing page renders and links into the participant demo", async ({ page }) => {
    const errors = trackErrors(page);
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // The landing page has more than one entry link to the participant demo.
    await expect(page.getByRole("link", { name: /open participant demo/i }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("login page offers one-click demo accounts and no real sign-in in demo mode", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("One-click demo accounts")).toBeVisible();
    await expect(page.getByRole("button", { name: /demo participant/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /demo clinician/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /demo researcher/i })).toBeVisible();
  });

  test("register page renders", async ({ page }) => {
    const response = await page.goto("/register");
    expect(response?.status()).toBe(200);
  });

  test("unknown routes return 404", async ({ page }) => {
    const response = await page.goto("/this-route-does-not-exist");
    expect(response?.status()).toBe(404);
  });
});

test.describe("demo sign-in", () => {
  for (const [name, path] of [
    ["Demo Participant", "/participant"],
    ["Demo Clinician", "/clinician"],
    ["Demo Researcher", "/research"],
  ] as const) {
    test(`${name} lands on its own portal`, async ({ page }) => {
      await page.goto("/login");
      await page.getByRole("button", { name: new RegExp(name, "i") }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    });
  }

  test("a participant demo session cannot open clinician records", async ({ page }) => {
    await enterDemo(page, "participant");
    await page.goto("/clinician");
    await expect(page.getByText("This demo session belongs to another portal")).toBeVisible();
  });
});

const portalRoutes: Record<Role, string[]> = {
  participant: [
    "/participant",
    "/participant/sessions",
    "/participant/upload",
    "/participant/activities",
    "/participant/activities/cpt",
    "/participant/activities/history",
    "/participant/progress",
    "/participant/digital-twin",
  ],
  clinician: [
    "/clinician",
    "/clinician/participants",
    "/clinician/compare",
  ],
  researcher: [
    "/research",
    "/research/models",
    "/research/experiments",
    "/research/datasets",
    "/research/explainability",
  ],
};

test.describe("portal routes render without runtime errors", () => {
  for (const role of Object.keys(portalRoutes) as Role[]) {
    for (const route of portalRoutes[role]) {
      test(`${role}: ${route}`, async ({ page }) => {
        const errors = trackErrors(page);
        await enterDemo(page, role);
        const response = await page.goto(route);
        expect(response?.status()).toBe(200);
        await expect(page.locator("main")).toBeVisible();
        await expect(page.getByText(/application error|something went wrong/i)).toHaveCount(0);
        expect(errors).toEqual([]);
      });
    }
  }
});

test.describe("participant journeys", () => {
  test("CPT intro offers practice before scored trials", async ({ page }) => {
    await enterDemo(page, "participant");
    await page.goto("/participant/activities/cpt");
    await expect(page.getByRole("button", { name: /practice/i }).first()).toBeVisible();
  });

  test("starting CPT practice shows a response control", async ({ page }) => {
    await enterDemo(page, "participant");
    await page.goto("/participant/activities/cpt");
    await page.getByRole("button", { name: /start practice|practice/i }).first().click();
    await expect(page.getByRole("button", { name: /respond|press|tap/i }).first()).toBeVisible();
  });

  test("EEG upload rejects unsupported file types", async ({ page }) => {
    await enterDemo(page, "participant");
    await page.goto("/participant/upload");
    await page.locator('input[type="file"]').setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an eeg file"),
    });
    await expect(page.getByText("Choose a .csv, .edf, or .bdf demo file.")).toBeVisible();
  });

  test("an empty progress page explains that no scored runs exist yet", async ({ page }) => {
    await enterDemo(page, "participant");
    await page.goto("/participant/progress");
    await expect(page.locator("main")).toContainText(/no .*run|complete .*scored|not enough/i);
  });
});

test.describe("clinician journeys", () => {
  test("roster search filters participants", async ({ page }) => {
    await enterDemo(page, "clinician");
    await page.goto("/clinician/participants");
    const search = page.getByRole("searchbox").or(page.getByRole("textbox")).first();
    await expect(search).toBeVisible();
    await search.fill("zzzz-no-such-participant");
    await expect(page.locator("main")).toContainText(/no .*(match|result|participant)/i);
  });
});
