import { expect, test, type Page } from "@playwright/test";

const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099"}`;
const PASSWORD = "synthetic-password-123";

/** Creates a synthetic account directly in the Auth emulator. */
async function createEmulatorUser(email: string) {
  const response = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD, displayName: "Live Test Participant", returnSecureToken: true }),
  });
  expect(response.ok).toBe(true);
}

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/participant/, { timeout: 30_000 });
}

test("signed-in participant: consent, scored run saved to the API, export, access log, erase", async ({ page }) => {
  const email = `live-${Date.now()}@example.test`;
  await createEmulatorUser(email);
  await signIn(page, email);

  // 1. Consent is explicit: nothing is saved until the participant grants it.
  await page.goto("/participant/digital-twin");
  await expect(page.getByText("Not granted")).toBeVisible({ timeout: 30_000 });
  await page.getByLabel(/agree to save scored CPT results/i).check();
  await page.getByRole("button", { name: "Grant consent" }).click();
  await expect(page.getByText("Consent granted")).toBeVisible({ timeout: 30_000 });

  // 2. Complete a practice run and a scored run (no responses: every target is a miss).
  await page.goto("/participant/activities/cpt");
  await page.getByRole("button", { name: /start \d+-trial practice/i }).click();
  const startScored = page.getByRole("button", { name: "Start scored task" });
  const continuePractice = page.getByRole("button", { name: /continue practice|view practice summary/i });
  for (let guard = 0; guard < 60 && !(await startScored.isVisible()); guard += 1) {
    if (await continuePractice.isVisible()) {
      await continuePractice.click();
    } else {
      await page.waitForTimeout(250);
    }
  }
  await startScored.click();
  await expect(page.getByText("Scored run complete")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/Saved to the research backend/)).toBeVisible({ timeout: 30_000 });

  // 2b. Go/No-Go: practice, then a scored run that the server validates and stores.
  await page.goto("/participant/activities/go-no-go");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Start scored run" }).click({ timeout: 60_000 });
  await expect(page.getByText("Scored run complete")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/Saved to the research backend/)).toBeVisible({ timeout: 30_000 });

  // 2c. Stop-Signal: same flow, scored by the server (no key presses: every go trial is an omission).
  await page.goto("/participant/activities/stop-signal");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Start scored run" }).click({ timeout: 60_000 });
  await expect(page.getByText("Scored run complete")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/Saved to the research backend/)).toBeVisible({ timeout: 30_000 });

  // 2d. N-back: practice, the level break, then a scored run saved by the server.
  await page.goto("/participant/activities/n-back");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Start scored run" }).click({ timeout: 60_000 });
  await page.getByRole("button", { name: "Continue" }).click({ timeout: 60_000 });
  await expect(page.getByText("Scored run complete")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/Saved to the research backend/)).toBeVisible({ timeout: 30_000 });

  // 2e. Stroop: practice, then a scored run saved by the server (no answers: every trial is an omission).
  await page.goto("/participant/activities/stroop");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Start scored run" }).click({ timeout: 60_000 });
  await expect(page.getByText("Scored run complete")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/Saved to the research backend/)).toBeVisible({ timeout: 30_000 });

  // 2f. Task Switching: practice, then a scored run saved by the server (every trial an omission).
  await page.goto("/participant/activities/task-switching");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Start scored run" }).click({ timeout: 60_000 });
  await expect(page.getByText("Scored run complete")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/Saved to the research backend/)).toBeVisible({ timeout: 30_000 });

  // 2g. Visual Search: practice, then a scored run saved by the server (every screen an omission).
  await page.goto("/participant/activities/visual-search");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Start scored run" }).click({ timeout: 60_000 });
  await expect(page.getByText("Scored run complete")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/Saved to the research backend/)).toBeVisible({ timeout: 30_000 });

  // 2h. Planning Puzzle: skip every puzzle (unsolved), then a scored run saved after the server replays it.
  await page.goto("/participant/activities/planning-puzzle");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Skip puzzle" }).click();
  await page.getByRole("button", { name: "Start scored run" }).click();
  for (let puzzle = 0; puzzle < 3; puzzle++) {
    await page.getByRole("button", { name: "Skip puzzle" }).click();
  }
  await expect(page.getByText("Scored run complete")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Saved to the research backend/)).toBeVisible({ timeout: 30_000 });

  // 2i. Visual Sequence Memory: practice, then a scored run saved by the server (no taps: every trial times out).
  await page.goto("/participant/activities/visual-sequence");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Start scored run" }).click({ timeout: 60_000 });
  await expect(page.getByText("Scored run complete")).toBeVisible({ timeout: 400_000 });
  await expect(page.getByText(/Saved to the research backend/)).toBeVisible({ timeout: 30_000 });

  // 2j. Time Perception: practice, then a scored run saved by the server (no answers: every trial times out).
  await page.goto("/participant/activities/time-perception");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Start scored run" }).click({ timeout: 60_000 });
  await expect(page.getByText("Scored run complete")).toBeVisible({ timeout: 600_000 });
  await expect(page.getByText(/Saved to the research backend/)).toBeVisible({ timeout: 30_000 });

  // 2k. Multiple Object Tracking: pick nothing each trial ("Done"), then the server checks the run.
  await page.goto("/participant/activities/multiple-object-tracking");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Done" }).click({ timeout: 30_000 });
  await page.getByRole("button", { name: "Start scored run" }).click();
  for (let trial = 0; trial < 6; trial++) {
    await page.getByRole("button", { name: "Done" }).click({ timeout: 30_000 });
  }
  await expect(page.getByText("Scored run complete")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Saved to the research backend/)).toBeVisible({ timeout: 30_000 });

  // 3. The saved run shows up on the Digital Twin page after a reload (server-calculated).
  await page.goto("/participant/digital-twin");
  await expect(page.getByText(/Version 1/).first()).toBeVisible({ timeout: 30_000 });

  // 3b. Twin v2 detail states that one run is not enough for trends; then a report and its PDF.
  await expect(page.getByText("Detail from your saved runs")).toBeVisible();
  await expect(page.getByText("Not enough data").first()).toBeVisible();
  await page.getByRole("button", { name: /create report from saved runs/i }).click();
  const pdfPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).first().click();
  const pdf = await pdfPromise;
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);

  // 4. Data rights: export downloads a JSON file and the access log records it.
  await page.goto("/participant/data");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /download my data/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  await expect(page.getByText(/Downloaded /)).toBeVisible();
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByText(/export/i).first()).toBeVisible();

  // 5. Erasure needs the typed confirmation.
  const erase = page.getByRole("button", { name: /permanently erase my research data/i });
  await expect(erase).toBeDisabled();
  await page.getByLabel(/to confirm/i).fill("ERASE MY DATA");
  await erase.click();
  await expect(page.getByText("Your research data was erased")).toBeVisible({ timeout: 30_000 });
});
