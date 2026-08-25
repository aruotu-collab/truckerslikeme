import Browserbase from "@browserbasehq/sdk";
import { shiplyConnectConfigured } from "@/lib/shiply-connect-config";

export const SHIPLY_HOME = "https://www.shiply.com/";
export { shiplyConnectConfigured };

export function getBrowserbase() {
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  if (!apiKey) throw new Error("BROWSERBASE_API_KEY is not configured.");
  return new Browserbase({ apiKey });
}

export function connectUrlForSession(
  sessionId: string,
  region: string = "eu-central-1",
) {
  const apiKey = process.env.BROWSERBASE_API_KEY!.trim();
  // Regional hosts — default connect.browserbase.com only serves us-west-2.
  const hostByRegion: Record<string, string> = {
    "us-west-2": "connect.browserbase.com",
    "us-east-1": "connect.use1.browserbase.com",
    "eu-central-1": "connect.euc1.browserbase.com",
    "ap-southeast-1": "connect.apse1.browserbase.com",
  };
  const host = hostByRegion[region] || "connect.euc1.browserbase.com";
  return `wss://${host}?apiKey=${encodeURIComponent(apiKey)}&sessionId=${encodeURIComponent(sessionId)}`;
}

export async function ensureShiplyContext(existingId?: string | null) {
  const bb = getBrowserbase();
  const projectId = process.env.BROWSERBASE_PROJECT_ID!.trim();
  if (existingId?.trim()) return existingId.trim();
  const ctx = await bb.contexts.create({ projectId });
  return ctx.id;
}

/**
 * Navigate via raw CDP (no Playwright) so Vercel session create can open Shiply
 * instead of leaving the live view on about:blank.
 */
async function cdpGoto(connectUrl: string, url: string) {
  const ws = new WebSocket(connectUrl);
  let nextId = 1;
  const pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();

  const send = (
    method: string,
    params: Record<string, unknown> = {},
    sessionId?: string,
  ) =>
    new Promise<unknown>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      const payload: Record<string, unknown> = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      ws.send(JSON.stringify(payload));
    });

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("CDP connect timeout")), 20_000);
    ws.addEventListener("open", () => {
      clearTimeout(t);
      resolve();
    });
    ws.addEventListener("error", () => {
      clearTimeout(t);
      reject(new Error("CDP socket error"));
    });
  });

  ws.addEventListener("message", (ev) => {
    try {
      const msg = JSON.parse(String(ev.data)) as {
        id?: number;
        result?: unknown;
        error?: { message?: string };
      };
      if (msg.id == null) return;
      const waiter = pending.get(msg.id);
      if (!waiter) return;
      pending.delete(msg.id);
      if (msg.error) {
        waiter.reject(new Error(msg.error.message || "CDP error"));
      } else {
        waiter.resolve(msg.result);
      }
    } catch {
      // ignore non-JSON
    }
  });

  try {
    const targets = (await send("Target.getTargets")) as {
      targetInfos?: Array<{ targetId: string; type: string; url: string }>;
    };
    let page = targets.targetInfos?.find((t) => t.type === "page");
    if (!page) {
      const created = (await send("Target.createTarget", {
        url: "about:blank",
      })) as { targetId: string };
      page = { targetId: created.targetId, type: "page", url: "about:blank" };
    }

    const attached = (await send("Target.attachToTarget", {
      targetId: page.targetId,
      flatten: true,
    })) as { sessionId: string };

    await send("Page.enable", {}, attached.sessionId);
    await send("Page.navigate", { url }, attached.sessionId);
    // Brief settle so the live view shows Shiply, not blank
    await new Promise((r) => setTimeout(r, 1500));
  } finally {
    try {
      ws.close();
    } catch {
      // ignore
    }
  }
}

/** Create cloud browser, open Shiply, return live view. */
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
      viewport: { width: 980, height: 720 },
      solveCaptchas: true,
    },
  });

  const connectUrl =
    session.connectUrl || connectUrlForSession(session.id, "eu-central-1");

  try {
    await cdpGoto(connectUrl, SHIPLY_HOME);
  } catch {
    // Live view still works — driver can type shiply.com manually
  }

  const debug = await bb.sessions.debug(session.id);
  const liveViewUrl =
    debug.debuggerFullscreenUrl || debug.debuggerUrl || null;

  return {
    sessionId: session.id,
    liveViewUrl,
    contextId,
    startUrl: SHIPLY_HOME,
  };
}

export async function releaseShiplySession(sessionId: string) {
  const bb = getBrowserbase();
  await bb.sessions.update(sessionId, { status: "REQUEST_RELEASE" });
}
