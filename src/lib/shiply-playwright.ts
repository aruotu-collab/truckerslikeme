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

export async function openShiplyHome(page: Page) {
  const url = page.url();
  if (!url || url === "about:blank" || !/shiply/i.test(url)) {
    await page.goto(SHIPLY_HOME, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
  }
}
