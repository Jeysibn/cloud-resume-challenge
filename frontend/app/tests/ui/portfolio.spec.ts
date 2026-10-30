import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function stubPublicApi(page: import("@playwright/test").Page) {
  await page.route("**/api/health", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ status: "healthy", service: "portfolio-api", version: "test" }),
    }),
  );
  await page.route("**/api/GetVisitorCount", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ count: 42 }) }),
  );
  await page.route("**/api/AiChatAssistant", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        reply: "The Cloud-Backed Portfolio uses Azure Functions and Terraform.",
        sources: [],
        usage: { limit: 10, remaining: 9 },
      }),
    }),
  );
}

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth + 1);
}

async function settleAnimations(page: import("@playwright/test").Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== "running"),
  );
}

test.describe("portfolio release browser gate", () => {
  test.beforeEach(async ({ page }) => {
    await stubPublicApi(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
  });

  test("keeps the desktop composition readable and contained", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("desktop"), "Desktop layout coverage only");

    await expect(page).toHaveTitle(/Jerome Christian V\. Ibon \| Aspiring Cloud & DevOps Engineer/);
    await expect(page.getByRole("heading", { name: "Jerome Christian Ibon" })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "DevOps Platform Engineer (technical support scope)" }),
    ).toBeAttached();
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    await expect(page.locator("#projects")).toBeVisible();
    await expect(page.locator("#skills")).toBeAttached();
    await expect(page.locator("#contact")).toBeAttached();
    await expectNoHorizontalOverflow(page);

    for (const title of ["Homelab GitOps Environment", "Cloud-Backed Portfolio", "MoniKey", "NOC Report Builder"]) {
      await expect(page.getByRole("heading", { level: 4, name: title })).toBeVisible();
    }
  });

  test("has no continuous decorative animation by default", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("desktop"), "Desktop motion coverage only");

    await page.waitForTimeout(500);
    const infinite = await page.evaluate(
      () =>
        document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations === Infinity)
          .length,
    );
    expect(infinite).toBe(0);
  });

  test("captures the stable 1920px hero anchor", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1920", "Stable visual anchor only");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload({ waitUntil: "networkidle" });
    await expect(page).toHaveScreenshot("hero-1920.png", {
      animations: "disabled",
      mask: [page.locator(".system-status"), page.locator(".visitor-count")],
    });
  });

  test("opens a case study from the static project index and restores focus", async ({ page }) => {
    const caseStudy = page.getByRole("button", { name: "View case study: Homelab GitOps Environment" });
    await caseStudy.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleName("Homelab GitOps Environment");
    await expect(dialog).toHaveAccessibleDescription(/Kubernetes/);
    await settleAnimations(page);
    const dialogAxe = await new AxeBuilder({ page }).include("dialog").analyze();
    expect(dialogAxe.violations).toEqual([]);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(caseStudy).toBeFocused();
  });

  test("opens a skill inspection state with keyboard and passes axe", async ({ page }) => {
    await page.locator("#skills").scrollIntoViewIfNeeded();
    const skill = page.getByRole("button", { name: "Azure — inspect Cloud & virtualization" });
    await skill.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleName(/Cloud & virtualization/);
    const dialogAxe = await new AxeBuilder({ page }).include("dialog").analyze();
    expect(dialogAxe.violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(skill).toBeFocused();
  });

  test("switches theme and persists the choice", async ({ page }) => {
    const themeButton = page.getByRole("button", { name: /Switch to dark theme/ });
    await themeButton.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("passes the initial page accessibility scan", async ({ page }) => {
    await settleAnimations(page);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("quiet motion", () => {
  test.beforeEach(async ({ page }) => {
    await stubPublicApi(page);
  });

  test("plays the hero entrance once and ends fully visible", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await settleAnimations(page);

    const hero = await page.locator(".hero > *").evaluateAll((nodes) =>
      nodes.map((node) => {
        const style = getComputedStyle(node);
        return { opacity: style.opacity, transform: style.transform };
      }),
    );
    expect(hero.length).toBeGreaterThanOrEqual(5);
    for (const item of hero) expect(item).toEqual({ opacity: "1", transform: "none" });

    const repeating = await page.evaluate(
      () => document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== 1).length,
    );
    expect(repeating).toBe(0);
  });

  test("reveals sections on scroll and never leaves content hidden", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(/reveal-on/);
    await expect(page.locator("#experience article").first()).toHaveCSS("opacity", "0");

    // Each marked element must become fully visible once it is brought into view.
    const targets = await page.locator("[data-reveal]").all();
    expect(targets.length).toBeGreaterThanOrEqual(8);
    for (const target of targets) {
      await target.scrollIntoViewIfNeeded();
      await expect(target).toHaveClass(/is-revealed/);
      await expect(target).toHaveCSS("opacity", "1");
      await expect(target).toHaveCSS("transform", "none");
    }
  });

  test("keeps all content visible and static with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?project=homelab-gitops", { waitUntil: "domcontentloaded" });

    await expect(page.locator("html")).not.toHaveClass(/reveal-on/);
    const state = await page.evaluate(() => {
      const moving = (selector: string) =>
        Array.from(document.querySelectorAll(selector)).filter((node) => {
          const style = getComputedStyle(node);
          return style.opacity !== "1" || style.transform !== "none" || style.animationName !== "none";
        }).length;
      return {
        hero: moving(".hero > *"),
        reveal: moving("[data-reveal]"),
        flow: moving(".flow-steps li"),
        flowSteps: document.querySelectorAll(".flow-steps li").length,
        running: document.getAnimations().filter((a) => a.playState === "running").length,
      };
    });
    expect(state).toMatchObject({ hero: 0, reveal: 0, flow: 0, running: 0 });
    expect(state.flowSteps).toBeGreaterThan(0);
  });

  test("traces the case-study flow once, in repository order", async ({ page }) => {
    await page.goto("/?project=homelab-gitops", { waitUntil: "domcontentloaded" });
    const steps = page.locator(".flow-steps").first().getByRole("listitem");
    await expect(steps).toHaveText(["Terraform", "Proxmox", "Ubuntu VM", "k3s + Calico", "Argo CD", "Workloads"]);

    await settleAnimations(page);
    for (const step of await steps.all()) await expect(step).toHaveCSS("opacity", "1");
    const infinite = await page.evaluate(
      () => document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations === Infinity).length,
    );
    expect(infinite).toBe(0);
  });

  test("lifts project cards on hover and keyboard focus without blocking interaction", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("desktop"), "Pointer hover coverage is desktop only");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator("#projects").scrollIntoViewIfNeeded();
    await settleAnimations(page);

    const card = page.locator(".project-card").first();
    await expect(card).toHaveCSS("transform", "none");
    await card.hover();
    await expect(card).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, -3)");
    await page.mouse.move(2, 2);
    await expect(card).toHaveCSS("transform", "none");

    const button = card.getByRole("button", { name: /View case study/ });
    await button.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(button).toBeFocused();
    await expect(card).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, -3)");

    await card.hover();
    await button.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("does not move project cards under reduced motion", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("desktop"), "Pointer hover coverage is desktop only");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const card = page.locator(".project-card").first();
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    await expect(card).toHaveCSS("transform", "none");
  });

  test("redirects the removed #about anchor to the top of the page", async ({ page }) => {
    await page.goto("/#about", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/#top$/);
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(40);
  });
});

test.describe("mobile portfolio interactions", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("mobile"), "Mobile project coverage only");
    await stubPublicApi(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
  });

  test("supports navigation, static skills, contact, and no page overflow", async ({ page }) => {
    const menu = page.getByRole("button", { name: "Menu" });
    await menu.click();
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    const navAxe = await new AxeBuilder({ page }).include("#primary-nav").analyze();
    expect(navAxe.violations).toEqual([]);

    await page.getByRole("link", { name: "Toolkit", exact: true }).click();
    await expect(page.locator(".skill-group")).toHaveCount(6);
    await expect(page.locator(".skill-group").first()).toBeVisible();
    await page.locator("#contact").scrollIntoViewIfNeeded();
    await expect(page.getByRole("link", { name: "Email jeysibn@gmail.com" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Send email" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy email" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("supports project deep links and invalid values without breaking the page", async ({ page }) => {
    await page.goto("/?project=monikey", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveAccessibleName("MoniKey");
    await page.getByRole("button", { name: "Close system inspection" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.getByRole("button", { name: "View case study: Cloud-Backed Portfolio" }).click();
    await expect(page).toHaveURL(/\/\?project=cloud-portfolio$/);
    await page.goBack();
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.goForward();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.goto("/?project=not-a-project", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Jerome Christian Ibon" })).toBeVisible();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expectNoHorizontalOverflow(page);
  });

  test("keeps assistant keyboard and accessibility states usable", async ({ page }) => {
    const trigger = page.getByRole("button", { name: /Ask this portfolio/ });
    await trigger.click();
    await expect(page.getByLabel("Your question")).toBeFocused();
    const assistantAxe = await new AxeBuilder({ page }).include(".portfolio-assistant").analyze();
    expect(assistantAxe.violations).toEqual([]);

    await page.getByLabel("Your question").fill("How does Jerome use Terraform?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Azure Functions and Terraform.")).toBeVisible();
    await page.getByRole("button", { name: "Close assistant" }).click();
    await expect(trigger).toBeFocused();
  });

  test("keeps skills content readable with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".skill-group")).toHaveCount(6);
    await expect(page.getByText(/Select any skill/)).toBeVisible();
  });
});
