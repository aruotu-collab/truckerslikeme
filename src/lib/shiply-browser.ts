import Browserbase from "@browserbasehq/sdk";
import { chromium, type Browser, type Page } from "playwright-core";
import { shiplyConnectConfigured } from "@/lib/shiply-connect-config";

export const SHIPLY_HOME = "https://www.shiply.com/";
export { shiplyConnectConfigured };

export function getBrowserbase() {
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  if (!apiKey) throw new Error("BROWSERBASE_API_KEY is not configured.");
  return new Browserbase({ apiKey });
}

function connectUrlForSession(sessionId: string) {
  const apiKey = process.env.BROWSERBASE_API_KEY!.trim();
  return `wss://connect.browserbase.com?apiKey=${encodeURIComponent(apiKey)}&sessionId=${encodeURIComponent(sessionId)}`;
}

export async function ensureShiplyContext(existingId?: string | null) {
  const bb = getBrowserbase();
  const projectId = process.env.BROWSERBASE_PROJECT_ID!.trim();
  if (existingId?.trim()) return existingId.trim();
  const ctx = await bb.contexts.create({ projectId });
  return ctx.id;
}

export async function createShiplySession(opts?: {
  contextId?: string | null;
}) {
  const bb = getBrowserbase();
  const projectId = process.env.BROWSERBASE_PROJECT_ID!.trim();
  const contextId = await ensureShiplyContext(opts?.contextId);

  const session = await bb.sessions.create({
    projectId,
    region: "eu-central-1",
    keepAlive: true,
    api_timeout: 1800,
    browserSettings: {
      context: { id: contextId, persist: true },
      viewport: { width: 1280, height: 900 },
      solveCaptchas: true,
    },
  });

  const debug = await bb.sessions.debug(session.id);
  const liveViewUrl =
    debug.debuggerFullscreenUrl || debug.debuggerUrl || null;

  // Open Shiply once so the driver lands on login / home
  const browser = await chromium.connectOverCDP(
    session.connectUrl || connectUrlForSession(session.id),
  );
  try {
    const context = browser.contexts()[0];
    const page = context?.pages()[0] ?? (await context?.newPage());
    if (page) {
      await page.goto(SHIPLY_HOME, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
    }
  } finally {
    // Disconnect CDP only — keepAlive keeps the cloud browser running
    await browser.close().catch(() => undefined);
  }

  return {
    sessionId: session.id,
    liveViewUrl,
    contextId,
  };
}

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

  const browser = await chromium.connectOverCDP(
    connectUrlForSession(sessionId),
  );
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

export async function releaseShiplySession(sessionId: string) {
  const bb = getBrowserbase();
  await bb.sessions.update(sessionId, { status: "REQUEST_RELEASE" });
}
