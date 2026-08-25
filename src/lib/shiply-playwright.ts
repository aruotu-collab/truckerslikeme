import { chromium, type Browser, type Page } from "playwright-core";
import {
  connectUrlForSession,
  getBrowserbase,
  SHIPLY_HOME,
} from "@/lib/shiply-browser";

export async function connectShiplyPage(sessionId: string): Promise<{
  browser: Browser;
  page: Page;
}> {
  const bb = getBrowserbase();
  const session = await bb.sessions.retrieve(sessionId);
  if (session.status !== "RUNNING") {
    throw new Error(
      `Shiply session is ${session.status}. Start a new Connect Shiply session.`,
    );
  }

  const connectUrl =
    session.connectUrl ||
    connectUrlForSession(sessionId, session.region || "eu-central-1");

  const browser = await chromium.connectOverCDP(connectUrl);
  const context = browser.contexts()[0];
  if (!context) {
    await browser.close().catch(() => undefined);
    throw new Error("No browser context on Shiply session.");
  }
  const page = context.pages()[0] ?? (await context.newPage());
  return { browser, page };
}

export async function captureVisibleShiply(page: Page): Promise<{
  url: string;
  text: string;
  screenshotBase64: string;
}> {
  const url = page.url();
  const text = await page.evaluate(() => {
    const body = document.body?.innerText || "";
    return body.replace(/\s+/g, " ").trim().slice(0, 24_000);
  });
  const buf = await page.screenshot({ fullPage: false, type: "png" });
  return {
    url,
    text,
    screenshotBase64: `data:image/png;base64,${buf.toString("base64")}`,
  };
}

export async function extractJobAnchors(page: Page) {
  return page.evaluate(() => {
    const out: { href: string; text: string }[] = [];
    const seen = new Set<string>();
    for (const el of Array.from(document.querySelectorAll("a[href]"))) {
      const a = el as HTMLAnchorElement;
      const href = a.href;
      if (!href || seen.has(href)) continue;
      if (!/shiply\.com/i.test(href)) continue;
      const inTable = Boolean(a.closest("table, tbody, tr"));
      const looksLikeJob =
        /job|listing|shipment|request|detail|view|item/i.test(href) || inTable;
      if (!looksLikeJob) continue;
      const text = (a.textContent || "").replace(/\s+/g, " ").trim();
      if (text.length < 2) continue;
      seen.add(href);
      out.push({ href, text: text.slice(0, 160) });
    }
    return out.slice(0, 100);
  });
}

export function matchHrefToJob(
  job: {
    item?: string | null;
    origin?: string | null;
    destination?: string | null;
  },
  anchors: { href: string; text: string }[],
): string | null {
  const needles = [job.item, job.origin, job.destination]
    .map((s) => (s || "").trim().toLowerCase())
    .filter((s) => s.length >= 4);
  if (!needles.length) return null;
  for (const a of anchors) {
    const hay = `${a.text} ${a.href}`.toLowerCase();
    if (needles.some((n) => hay.includes(n.slice(0, 24)))) {
      return a.href;
    }
  }
  return null;
}

/** Open a job detail page via href or by clicking the matching results row. */
export async function openShiplyJob(
  page: Page,
  job: {
    href?: string | null;
    item?: string | null;
    origin?: string | null;
    destination?: string | null;
  },
) {
  const href = job.href?.trim();
  if (href) {
    const absolute = href.startsWith("http")
      ? href
      : new URL(href, page.url() || "https://www.shiply.com/").toString();
    await page.goto(absolute, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    return;
  }

  const needles = [job.item, job.destination, job.origin]
    .map((s) => (s || "").trim())
    .filter((s) => s.length >= 4);

  for (const needle of needles) {
    const short = needle.slice(0, 48);
    const link = page.getByRole("link", { name: short }).first();
    if ((await link.count().catch(() => 0)) > 0) {
      await link.click({ timeout: 10_000 });
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      await page.waitForTimeout(800);
      return;
    }
    const row = page.locator("tr", { hasText: short }).first();
    if ((await row.count().catch(() => 0)) > 0) {
      const rowLink = row.locator("a").first();
      if ((await rowLink.count().catch(() => 0)) > 0) {
        await rowLink.click({ timeout: 10_000 });
      } else {
        await row.click({ timeout: 10_000 });
      }
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      await page.waitForTimeout(800);
      return;
    }
    const textHit = page.getByText(short, { exact: false }).first();
    if ((await textHit.count().catch(() => 0)) > 0) {
      await textHit.click({ timeout: 10_000 });
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      await page.waitForTimeout(800);
      return;
    }
  }

  throw new Error(
    `Could not find “${job.item || job.origin || "job"}” on the results page. Stay on the Shiply search results list and try again.`,
  );
}

export async function openShiplyHome(page: Page) {
  const url = page.url();
  if (!url || url === "about:blank" || !/shiply/i.test(url)) {
    await page.goto(SHIPLY_HOME, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
  }
}
