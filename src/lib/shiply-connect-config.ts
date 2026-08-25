/** Safe to import from any route — no Playwright / Browserbase SDK. */
export function shiplyConnectConfigured() {
  return Boolean(
    process.env.BROWSERBASE_API_KEY?.trim() &&
      process.env.BROWSERBASE_PROJECT_ID?.trim(),
  );
}
