import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

test('download all PDFs from elections.tn.gov.in', async ({ page }) => {
  const START_URL = 'https://www.elections.tn.gov.in/';
  const DOWNLOAD_DIR = path.resolve(process.cwd(), 'tn_election_pdfs');
  await fs.mkdir(DOWNLOAD_DIR, { recursive: true });

  await page.goto(START_URL, { waitUntil: 'networkidle' });

  const resolveUrl = (u, base) => { try { return new URL(u, base).href; } catch { return null; } };

  // collect href/data-href/onclick strings from current page
  const collectCandidates = async () =>
    (await page.$$eval('a', els =>
      els.map(a => ({
        href: a.getAttribute('href') || '',
        dataHref: a.getAttribute('data-href') || '',
        onclick: a.getAttribute('onclick') || ''
      }))
    )).flatMap(c => [c.href, c.dataHref, c.onclick].filter(Boolean));

  const pdfSet = new Set();

  // scan start page
  for (const raw of await collectCandidates()) {
    if (raw.toLowerCase().includes('.pdf')) {
      const r = resolveUrl(raw, page.url());
      if (r) pdfSet.add(r);
    }
  }

  // if none found, visit up to 25 same-origin links and scan them
  if (pdfSet.size === 0) {
    const anchors = await page.$$eval('a[href]', els => els.map(a => a.getAttribute('href')).filter(Boolean));
    const links = [...new Set(anchors.map(h => resolveUrl(h, page.url())).filter(Boolean))]
      .filter(h => new URL(h).origin === new URL(START_URL).origin)
      .slice(0, 25);

    for (const link of links) {
      try {
        await page.goto(link, { waitUntil: 'networkidle', timeout: 30000 });
      } catch {
        continue;
      }
      for (const raw of await collectCandidates()) {
        if (raw.toLowerCase().includes('.pdf')) {
          const r = resolveUrl(raw, page.url());
          if (r) pdfSet.add(r);
        }
      }
      if (pdfSet.size > 0) break;
      await page.waitForTimeout(300);
    }

    // return to start page for stability
    await page.goto(START_URL, { waitUntil: 'networkidle' });
  }

  const pdfLinks = Array.from(pdfSet);
  console.log(`Found ${pdfLinks.length} PDF link candidates.`);

  let downloaded = 0;
  for (const [i, pdfUrl] of pdfLinks.entries()) {
    try {
      console.log(`Downloading (${i + 1}/${pdfLinks.length}): ${pdfUrl}`);
      const response = await page.request.get(pdfUrl);
      if (!response.ok()) {
        console.warn(`Skipped (status ${response.status()}): ${pdfUrl}`);
        continue;
      }
      const ct = (response.headers()['content-type'] || '').toLowerCase();
      if (!ct.includes('pdf') && !pdfUrl.toLowerCase().includes('.pdf')) {
        console.warn(`Skipped (not PDF): ${pdfUrl} (content-type: ${ct})`);
        continue;
      }
      // Playwright's APIResponse provides .body() returning a Buffer
      const buffer = await response.body();
      if (!buffer.length) {
        console.warn(`Skipped (empty): ${pdfUrl}`);
        continue;
      }
      const baseName = path.basename(new URL(pdfUrl).pathname) || `file-${i + 1}.pdf`;
      const savePath = path.join(DOWNLOAD_DIR, `${i + 1}-${baseName}`);
      await fs.writeFile(savePath, buffer);
      console.log(`Saved: ${savePath} (${buffer.length} bytes)`);
      downloaded++;
      await page.waitForTimeout(200); // small throttle
    } catch (err) {
      console.warn(`Error downloading ${pdfUrl}: ${err.message}`);
    }
  }

  console.log(`Completed. Downloaded ${downloaded} files to ${DOWNLOAD_DIR}`);
  if (downloaded === 0) {
    console.error('No PDFs downloaded. The site may require interaction or PDFs are not directly linked on scanned pages.');
  }
  expect(downloaded).toBeGreaterThan(0);
});
