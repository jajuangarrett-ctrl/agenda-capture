import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { outputFiles } = await build({ stdin: {
  contents: "import {agendaMarkup, printAgendaInPlace} from './src/agenda-template'; window.fixture = {agendaMarkup, printAgendaInPlace};",
  resolveDir: process.cwd()
}, bundle: true, write: false });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const dir = await mkdtemp(join(tmpdir(), 'agenda-print-'));
try {
  const page = await browser.newPage({viewport: { width: 386, height: 678 }});
  for (const scenario of ['multi-page', 'oversized-row', 'empty']) {
    await page.setContent('<style>html, body {width:100%; height:100%; overflow:hidden} body{display:flex}</style><main>Agenda Center dashboard chrome</main>');
    await page.addScriptTag({ content: outputFiles[0].text });
    await page.evaluate(scenario => {
      const tasks = scenario === 'empty' ? [] : Array.from({length: 26}, (_, i) => ({
        key: String(i), title: `ITEM-${String(i+1).padStart(2, '0')} ` + 'Review next steps and follow-up with the team. '.repeat(i === 20 ? (scenario === 'oversized-row' ? 220 : 20) : 2),
        ...(i >= 23 ? { source: 'objective' } : {})
      }));
      if (scenario === 'oversized-row') tasks[20].title += ' END-OVERSIZED-ROW';
      // Stubbing only the host dialog keeps the plugin's exact print-gathering path.
      window.print = () => {};
      if (!window.fixture.printAgendaInPlace(document, window, { tasks }, 'Synthetic Meeting Agenda', 'November 2026')) throw new Error('Print setup failed');
    }, scenario);
    const path = join(dir, scenario + '.pdf');
    await page.pdf({path, preferCSSPageSize: true, printBackground: true});
    const contents = execFileSync('pdftotext', [path, '-'], {encoding:'utf8'});
    assert.ok(contents.includes('Synthetic Meeting Agenda'));
    assert.ok(!contents.includes('dashboard chrome'));
    assert.ok(!contents.includes('Open objective'));
    if (scenario === 'empty') assert.ok(contents.includes('No open agenda items.'));
    else {
      assert.equal((contents.match(/\bObjective\b/g) || []).length, 3, 'The three objective rows are labeled without the screen-only buttons');
      const expected = Array.from({length: 26}, (_, i) => `ITEM-${String(i+1).padStart(2, '0')}`);
      assert.deepEqual(contents.match(/ITEM-\d{2}/g), expected, 'Every agenda row is included exactly once in order, including the last three objective rows');
    }
    if (scenario === 'oversized-row') assert.ok(contents.includes('END-OVERSIZED-ROW'), 'Long rows cannot clip at page boundaries');
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    assert.equal(await page.locator('.fjg-agenda-print-host').count(), 0);
    assert.equal(await page.locator('.fjg-agenda-printing, .fjg-agenda-print-root').count(), 0);
    console.log('PASS', scenario);
  }
} finally {
  await browser.close();
  await rm(dir, {recursive: true, force: true});
}
