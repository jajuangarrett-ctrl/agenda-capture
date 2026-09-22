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
@media(max-width:600px){.ag-heading-line{display:block}.ag-date{display:block;margin-top:10px}.ag-sheet h2.ag-title{font-size:19pt}.ag-row{flex-wrap:wrap}.ag-slides{margin-left:35px}.ag-row-text{font-size:11pt}.ag-footer{font-size:8pt}}
@media print{@page{size:letter;margin:0}html,body{margin:0!important;padding:0!important;background:white!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.ag-print-page{width:8.5in;height:11in;position:relative;break-after:page;overflow:hidden}.ag-print-page:last-child{break-after:auto}.ag-print-page .ag-footer{position:absolute;bottom:.3in;left:0;right:0}.ag-print-page .ag-body{padding-top:14px}.ag-complete{display:none!important}}
`;

export function agendaMarkup(agenda: PublishedAgendaMember, title: string, month: string): string {
  return `<section class="ag-sheet"><header class="ag-banner"><p class="ag-brand">Student Support Services</p><div class="ag-heading-line"><h2 class="ag-title">${escapeHtml(title)}</h2><span class="ag-date">${escapeHtml(month)}</span></div></header><div class="ag-body"><div class="ag-section">AGENDA</div><div class="ag-list">${agenda.tasks.map((task, index) => {
    const display = itemPresentation(task.title);
    return `<article class="ag-row${display.slideUrl ? ' has-slides' : ''}" data-key="${escapeHtml(task.key)}"><span class="ag-number">${index + 1}</span><span class="ag-row-text">${escapeHtml(display.title)}</span>${display.slideUrl ? `<a class="ag-slides" href="${escapeHtml(display.slideUrl)}" target="_blank" rel="noopener noreferrer">SLIDE DECK</a>` : ''}</article>`;
  }).join('') || '<p>No open agenda items.</p>'}</div></div><footer class="ag-footer"><span>${escapeHtml(title.replace(/ Agenda$/, ''))}</span><span>${escapeHtml(month)} <span class="ag-page-number"></span></span></footer></section>`;
}

/** Paginate by measured row heights so long agendas repeat the banner and never clip at a footer. */
export function paginateAgenda(root: Document | HTMLElement): void {
  const source = root.querySelector<HTMLElement>('.ag-sheet');
  if (!source) return;
  const doc = source.ownerDocument;
  const rows = Array.from(source.querySelectorAll<HTMLElement>('.ag-row'));
  const header = source.querySelector('.ag-banner')!, footer = source.querySelector('.ag-footer')!;
  const host = doc.createElement('main'); source.replaceWith(host);
  let page: HTMLElement, list: HTMLElement;
  const newPage = () => {
    page = doc.createElement('section'); page.className = 'ag-sheet ag-print-page';
    page.style.cssText = 'width:816px;min-height:1056px;position:relative;padding-bottom:65px;margin:0 auto;';
    page.appendChild(header.cloneNode(true));
    const body = doc.createElement('div'); body.className = 'ag-body';
    body.innerHTML = '<div class="ag-section">AGENDA</div><div class="ag-list"></div>';
    list = body.querySelector('.ag-list')!; page.appendChild(body);
    const foot = footer.cloneNode(true) as HTMLElement; foot.style.cssText='position:absolute;bottom:28px;left:0;right:0;';
    foot.querySelector('.ag-page-number')!.textContent = ` | ${host.children.length + 1}`;
    page.appendChild(foot); host.appendChild(page);
  };
  newPage();
  for (const row of rows) {
    list!.appendChild(row);
    if (row.getBoundingClientRect().bottom - page!.getBoundingClientRect().top > 975 && list!.children.length > 1) { row.remove(); newPage(); list!.appendChild(row); }
    // An exceptionally long item can occupy a page of its own; allow it to flow rather than crop it.
    if (row.getBoundingClientRect().bottom - page!.getBoundingClientRect().top > 975) page!.style.height = 'auto';
  }
}

export function agendaPrintHtml(agenda: PublishedAgendaMember, title: string, month: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} - ${escapeHtml(month)}</title><style>${AGENDA_DOCUMENT_CSS}</style></head><body>${agendaMarkup(agenda,title,month)}</body></html>`;
}

const PRINT_HOST_CSS = `
.fjg-agenda-print-host{position:fixed;left:-100000px;top:0;width:816px;visibility:hidden;pointer-events:none;background:#fff}
@media print{
  body.fjg-agenda-printing{margin:0!important;padding:0!important;background:#fff!important;overflow:visible!important}
  body.fjg-agenda-printing>*:not(.fjg-agenda-print-host){display:none!important}
  body.fjg-agenda-printing>.fjg-agenda-print-host{display:block!important;position:static!important;left:auto!important;top:auto!important;width:auto!important;visibility:visible!important;pointer-events:auto!important}
}`;

/** Print inside the current Obsidian window; browser-style pop-ups are not required. */
export function printAgendaInPlace(doc: Document, win: Window, agenda: PublishedAgendaMember, title: string, month: string): boolean {
  doc.querySelector('.fjg-agenda-print-host')?.remove();
  const host = doc.createElement('section');
  host.className = 'fjg-agenda-print-host';
  host.innerHTML = `<style>${AGENDA_DOCUMENT_CSS}${PRINT_HOST_CSS}</style>${agendaMarkup(agenda, title, month)}`;
  doc.body.appendChild(host);
  paginateAgenda(host);
  doc.body.classList.add('fjg-agenda-printing');
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    doc.body.classList.remove('fjg-agenda-printing');
    host.remove();
  };
  win.addEventListener('afterprint', cleanup, { once: true });
  try {
    win.print();
    win.setTimeout(cleanup, 60_000);
    return true;
  } catch {
    cleanup();
    return false;
  }
}
