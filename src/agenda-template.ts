import type { PublishedAgendaMember } from './publishData';

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!));
export function itemPresentation(value: string) {
  const link = value.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i);
  const wiki = value.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
  const slides = link && /slide|deck|presentation/i.test(link[1] + ' ' + link[2]);
  let title = value.replace(/(^|\s)#[\p{L}\p{N}_/-]+/gu, '$1');
  if (slides) title = title.replace(link![0], '');
  else title = title.replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1');
  title = title.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) => alias || target);
  // A hashtag-only item is meaningful content, not an empty title.
  if (!title.trim()) title = value.replace(/#/g, '');
  return { title: title.trim(), slideUrl: slides ? link![2] : '', wiki };
}

export const AGENDA_DOCUMENT_CSS = `
.ag-sheet{background:#fff;color:#253b4e;font:11pt/1.4 Arial,Helvetica,sans-serif;box-sizing:border-box;min-width:0;--ag-navy:#0c2b40;--ag-orange:#ed7926}
.ag-sheet *{box-sizing:border-box}
.ag-banner{background:var(--ag-navy);color:#fff;border-left:7px solid var(--ag-orange);padding:17px 6.5% 20px;margin:0}
.ag-brand{font:10pt/1.4 Arial,Helvetica,sans-serif;color:#fff;margin:0 0 3px;text-transform:uppercase}
.ag-heading-line{display:flex;align-items:center;justify-content:space-between;gap:20px}
.ag-sheet h2.ag-title{font:normal 22pt/1.2 Arial,Helvetica,sans-serif;color:#fff;margin:0;letter-spacing:0}
.ag-date{font:10pt/1.3 Arial,Helvetica,sans-serif;text-transform:uppercase;white-space:nowrap}
.ag-body{padding:14px 7.2% 30px}
.ag-section{display:flex;align-items:center;gap:14px;color:var(--ag-orange);font:10pt/1.4 Arial,Helvetica,sans-serif;margin:0 0 12px}
.ag-section:after{content:'';height:1px;background:#d2dfea;flex:1}
.ag-list{display:grid;gap:7px}
.ag-row{display:flex;align-items:center;gap:13px;padding:11px 10px;min-height:40px;background:#f4f7f9;border:1px solid #d2dfea;border-radius:7px;break-inside:avoid;page-break-inside:avoid}
.ag-row.has-slides{background:#fff8f1;border-color:#ffb887}
.ag-number{display:grid;place-items:center;flex:none;width:22px;height:22px;border-radius:50%;background:#123e5b;color:#fff;font:9pt/1 Arial,Helvetica,sans-serif}
.ag-row-text{flex:1;min-width:0;overflow-wrap:anywhere;font:11pt/1.4 Arial,Helvetica,sans-serif}
.ag-slides{flex:none;background:var(--ag-orange);color:#fff!important;border-radius:999px;padding:3px 10px;font:8pt/1.25 Arial,Helvetica,sans-serif;text-decoration:none!important;white-space:nowrap}
.ag-footer{display:flex;justify-content:space-between;gap:16px;border-top:1px solid #d2dfea;margin:0 7.2%;padding:5px 0 0;color:#577087;font:8pt/1.4 Arial,Helvetica,sans-serif}
.ag-sheet button.ag-complete{display:grid;place-items:center;flex:none;width:32px;height:32px;min-height:32px;padding:0;border:1px solid #d2dfea;background:#fff;color:#123e5b;border-radius:6px}
@media screen and (max-width:600px){.ag-heading-line{display:block}.ag-date{display:block;margin-top:10px}.ag-sheet h2.ag-title{font-size:19pt}.ag-row{flex-wrap:wrap}.ag-slides{margin-left:35px}.ag-row-text{font-size:11pt}.ag-footer{font-size:8pt}}
@media print {
  @page { size: letter; margin: 0.4in; }
  .ag-sheet { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .ag-sheet .ag-banner { break-inside: avoid; break-after: avoid; }
  .ag-sheet .ag-list { display: block; }
  .ag-sheet .ag-row { display: block; position: relative; padding-left: 46px; margin-bottom: 7px; }
  .ag-sheet .ag-number { position: absolute; top: 11px; left: 10px; }
  .ag-sheet .ag-slides { display: inline-block; }
  .ag-sheet .ag-footer { break-inside: avoid; }
  .ag-sheet :is(.ag-complete, .ag-objective-open) { display: none !important; }
  .ag-sheet .ag-print-objective { display: inline; margin-left: 8px; color: #577087; font: 8pt Arial, sans-serif; }
}
@media screen { .ag-print-objective { display: none; } }
`;

export function agendaMarkup(agenda: PublishedAgendaMember, title: string, month: string): string {
  return `<section class="ag-sheet"><header class="ag-banner"><p class="ag-brand">Student Support Services</p><div class="ag-heading-line"><h2 class="ag-title">${escapeHtml(title)}</h2><span class="ag-date">${escapeHtml(month)}</span></div></header><div class="ag-body"><div class="ag-section">AGENDA</div><div class="ag-list">${agenda.tasks.map((task, index) => {
    const display = itemPresentation(task.title);
    return `<article class="ag-row${display.slideUrl ? ' has-slides' : ''}" data-key="${escapeHtml(task.key)}"><span class="ag-number">${index + 1}</span><span class="ag-row-text">${escapeHtml(display.title)}${task.source === 'objective' ? '<span class="ag-print-objective">Objective</span>' : ''}</span>${display.slideUrl ? `<a class="ag-slides" href="${escapeHtml(display.slideUrl)}" target="_blank" rel="noopener noreferrer">SLIDE DECK</a>` : ''}</article>`;
  }).join('') || '<p>No open agenda items.</p>'}</div></div><footer class="ag-footer"><span>${escapeHtml(title.replace(/ Agenda$/, ''))}</span><span>${escapeHtml(month)} <span class="ag-page-number"></span></span></footer></section>`;
}

export function agendaPrintHtml(agenda: PublishedAgendaMember, title: string, month: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} - ${escapeHtml(month)}</title><style>${AGENDA_DOCUMENT_CSS}</style></head><body>${agendaMarkup(agenda,title,month)}</body></html>`;
}

const PRINT_HOST_CSS = `
.fjg-agenda-print-host { display: none; }
@media print {
  html.fjg-agenda-print-root, body.fjg-agenda-printing {
    display: block !important; position: static !important; width: auto !important; height: auto !important;
    min-height: 0 !important; max-height: none !important; overflow: visible !important;
    margin: 0 !important; padding: 0 !important; background: #fff !important; contain: none !important;
  }
  body.fjg-agenda-printing > :not(.fjg-agenda-print-host) { display: none !important; }
  body.fjg-agenda-printing > .fjg-agenda-print-host { display: block !important; overflow: visible !important; }
}`;

const activePrints = new WeakMap<Document, () => void>();

/** Give the print engine one flowing document, independent of Obsidian's on-screen height. */
export function printAgendaInPlace(doc: Document, win: Window, agenda: PublishedAgendaMember, title: string, month: string): boolean {
  activePrints.get(doc)?.();
  if (typeof win.print !== 'function') return false;
  const host = doc.createElement('section');
  host.className = 'fjg-agenda-print-host';
  host.innerHTML = `<style>${AGENDA_DOCUMENT_CSS}${PRINT_HOST_CSS}</style>${agendaMarkup(agenda, title, month)}`;
  doc.body.appendChild(host);
  doc.documentElement.classList.add('fjg-agenda-print-root');
  doc.body.classList.add('fjg-agenda-printing');
  let timer: number | undefined;
  const cleanup = () => {
    if (activePrints.get(doc) !== cleanup) return;
    activePrints.delete(doc);
    win.removeEventListener('afterprint', cleanup);
    if (timer !== undefined) win.clearTimeout(timer);
    doc.documentElement.classList.remove('fjg-agenda-print-root');
    doc.body.classList.remove('fjg-agenda-printing');
    host.remove();
  };
  activePrints.set(doc, cleanup);
  win.addEventListener('afterprint', cleanup);
  try {
    win.print();
    if (activePrints.get(doc) === cleanup) timer = win.setTimeout(cleanup, 60_000);
    return true;
  } catch {
    cleanup();
    return false;
  }
}
