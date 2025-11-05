# automated PDF download test (test: sm.spec.js)

Purpose
- Automated Playwright Test that opens https://www.elections.tn.gov.in/, finds PDF links (href / data-href / onclick), optionally scans first-level same-origin pages, downloads the PDF files into a local folder, and asserts at least one PDF was saved.

Files
- tests/sm.spec.js — the Playwright test that performs the download workflow.
- tn_election_pdfs/ — output folder created at runtime containing downloaded PDFs.

Prerequisites
- Node.js (recommended LTS)
- Playwright installed in project:
  npm install -D @playwright/test
  npx playwright install

How to run (recommended)
1. Open a terminal on macOS and go to the project root:

2. Run the test (headless):
   npx playwright test tests/sm.spec.js --project=chromium

3. For interactive debugging (headed) and trace:
   npx playwright test tests/sm.spec.js --project=chromium --headed --trace on

Check downloaded files
- Downloads are saved to:
  /User/Desktop/playwrite/tn_election_pdfs
- To list files:
  ls -la tn_election_pdfs

Expected output
- Console will log:
  - Found N PDF link candidates.
  - Downloading (i/N): <url> for each candidate
  - Saved: /.../tn_election_pdfs/<filename>.pdf for each successful download
  - Completed. Downloaded X files to <DOWNLOAD_DIR>
- Final test assertion expects downloaded > 0.

Common issues & fixes
- "response.arrayBuffer is not a function" — fixed by using Playwright APIResponse.body() which returns a Buffer.
- Unknown CLI option `-v` — Playwright CLI does not use `-v`. Use `--trace on`, `--headed`, or DEBUG env flags (e.g. `DEBUG=pw:api`).
- If downloaded = 0 but links were found:
  - The site may require interaction/login or block automated requests.
  - Re-run headed with trace to inspect: npx playwright test tests/sm.spec.js --project=chromium --headed --trace on
  - Check network responses in the trace (npx playwright show-trace <trace>).

Tips
- To target a different start URL, edit START_URL in tests/sm.spec.js.
- To increase crawl depth or link limits, adjust the code that slices same-origin links (currently up to 25).
- Use small throttles (the test includes short waits) to avoid server rate‑limiting.
