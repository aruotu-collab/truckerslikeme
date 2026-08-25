import Browserbase from "@browserbasehq/sdk";
import { shiplyConnectConfigured } from "@/lib/shiply-connect-config";

export const SHIPLY_HOME = "https://www.shiply.com/";
export { shiplyConnectConfigured };

export function getBrowserbase() {
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  if (!apiKey) throw new Error("BROWSERBASE_API_KEY is not configured.");
  return new Browserbase({ apiKey });
}

export function connectUrlForSession(sessionId: string) {
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

/** Create cloud browser + live view. No Playwright — safe on Vercel. */
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
