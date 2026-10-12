import { chromium, type Browser } from 'playwright-core';

/**
 * Renders pages that build their content with JavaScript, in the system's
 * Chrome (or the binary at CHROME_PATH). One browser is shared across an
 * ingest run; call closeRenderer() when done or the process won't exit.
 */
let browser: Promise<Browser> | undefined;

/** Enough text to stop waiting; fetchArticle still applies its own minimum. */
const SETTLED_WORDS = 150;

export async function renderPage(url: string, userAgent: string): Promise<string> {
  browser ??= chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' },
  );
  const context = await (await browser).newContext({ userAgent });
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
    // Analytics keep the network busy forever, so wait for the text instead of network idle.
    await page
      .waitForFunction((min) => document.body.innerText.split(/\s+/).length >= min, SETTLED_WORDS, {
        timeout: 10_000,
      })
      .catch(() => {}); // a thin page stays thin; the caller reports it
    return await page.content();
  } finally {
    await context.close();
  }
}

export async function closeRenderer() {
  if (browser) await (await browser).close();
  browser = undefined;
}
