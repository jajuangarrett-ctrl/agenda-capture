import { PDFArray, PDFDocument, PDFHexString, PDFName, StandardFonts, rgb } from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import { itemPresentation } from './agenda-template';
import type { PublishedAgendaMember } from './publishData';

const WIDTH = 612;
const HEIGHT = 792;
const MARGIN = 43;
const NAVY = rgb(.047, .169, .251);
const INK = rgb(.145, .231, .306);
const MUTED = rgb(.25, .34, .42);
const ORANGE = rgb(.8, .31, .08);
const WHITE = rgb(1, 1, 1);

// Preserve words when possible; when a token is wider than the page, split it
// rather than clipping it. CR/LF delimit paragraphs, not visual overflow.
export function wrapPdfText(value: string, maxWidth: number, measure: (line: string) => number): string[] {
  value = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\t/g, ' ');
  return value.split(/\r\n?|\n/).flatMap(paragraph => {
    const lines: string[] = [];
    let line = '';
    for (const word of paragraph.trim().split(/\s+/u)) {
      const joined = line ? line + ' ' + word : word;
      if (measure(joined) <= maxWidth) { line = joined; continue; }
      if (line) lines.push(line);
      line = '';
      for (const character of word) {
        if (line && measure(line + character) > maxWidth) { lines.push(line); line = ''; }
        line += character;
      }
    }
    lines.push(line);
    return lines;
  });
}

/** Create a Letter PDF in the webview, without window.print, a server or a popup. */
export async function buildAgendaPdf(doc: Document, agenda: PublishedAgendaMember, title: string, date: string): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const canvas = doc.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const supportsText = (line: string) => {
    try { font.encodeText(line); return true; }
    catch { return false; }
  };
  const fontSpec = (size: number) => `${size}px Arial, sans-serif`;
  const measure = (line: string, size: number): number => {
    if (supportsText(line) || !ctx) return font.widthOfTextAtSize(line, size);
    ctx.font = fontSpec(size);
    return ctx.measureText(line).width;
  };
  const wrap = (value: string, width: number, size: number) => wrapPdfText(value, width, line => measure(line, size));
  let page: PDFPage;
  let top = 0;
  const newPage = () => {
    page = pdf.addPage([WIDTH, HEIGHT]);
    page.drawRectangle({ x: MARGIN, y: HEIGHT - 74, width: WIDTH - 2 * MARGIN, height: 39, color: NAVY });
    page.drawRectangle({ x: MARGIN, y: HEIGHT - 74, width: 5, height: 39, color: ORANGE });
    page.drawText(pdf.getPageCount() === 1 ? 'STUDENT SUPPORT SERVICES' : 'STUDENT SUPPORT SERVICES  /  AGENDA CONTINUED', {
      x: MARGIN + 13, y: HEIGHT - 59, size: 10, font, color: WHITE
    });
    page.drawText(String(pdf.getPageCount()), { x: WIDTH - MARGIN - 20, y: 23, size: 9, font, color: MUTED });
    top = 88;
  };
  const ensureRoom = (height: number) => { if (top + height > HEIGHT - MARGIN) newPage(); };
  const draw = async (text: string, x: number, y: number, size: number, color = INK) => {
    if (!text) return;
    if (supportsText(text)) {
      page.drawText(text, { x, y: HEIGHT - y - size, size, font, color });
      return;
    }
    // Core PDF fonts don't support all scripts. Render just those lines with
    // local system fonts, keeping common Latin text selectable.
    if (!ctx) throw new Error('This device cannot render the agenda’s text.');
    const w = Math.ceil(measure(text, size)) + 4;
    const h = Math.ceil(size * 1.55);
    canvas.width = w * 3;
    canvas.height = h * 3;
    ctx.scale(3, 3);
    ctx.font = fontSpec(size);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = `rgb(${Math.round(color.red * 255)},${Math.round(color.green * 255)},${Math.round(color.blue * 255)})`;
    ctx.fillText(text, 0, size + 1);
    const image = await pdf.embedPng(canvas.toDataURL('image/png'));
    page.drawImage(image, {x, y: HEIGHT - y - h, width: w, height: h});
  };
  const line = async (value: string, x: number, size: number, color = INK) => {
    const height = Math.ceil(size * 1.55);
    ensureRoom(height);
    await draw(value, x, top, size, color);
    top += height;
  };
  const addLink = (href: string, x: number, y: number, size: number, label: string) => {
    const url = new URL(href);
    if (!['http:', 'https:'].includes(url.protocol)) return;
    const uri = PDFHexString.of(Array.from(new TextEncoder().encode(url.href), byte => byte.toString(16).padStart(2, '0')).join(''));
    const ref = pdf.context.register(pdf.context.obj({
      Type: 'Annot', Subtype: 'Link', Border: [0, 0, 0],
      Rect: [x, HEIGHT - y - size - 4, x + measure(label, size), HEIGHT - y],
      A: { S: 'URI', URI: uri },
    }));
    const key = PDFName.of('Annots');
    const current = page.node.lookupMaybe(key, PDFArray);
    if (current) current.push(ref);
    else page.node.set(key, pdf.context.obj([ref]));
  };

  newPage();
  for (const text of wrap(title, WIDTH - 2 * MARGIN, 23)) await line(text, MARGIN, 23);
  for (const text of wrap(date, WIDTH - 2 * MARGIN, 11)) await line(text, MARGIN, 11, MUTED);
  top += 9;
  await line('AGENDA', MARGIN, 11, ORANGE);
  top += 7;
  if (!agenda.tasks.length) await line('No open agenda items.', MARGIN, 11);
  for (const [index, task] of agenda.tasks.entries()) {
    const item = itemPresentation(task.title);
    const x = MARGIN + 31;
    const lines = wrap(item.title, WIDTH - MARGIN - x - 5, 11);
    ensureRoom(25);
    await draw(`${index + 1}.`, MARGIN, top, 11, NAVY);
    for (const text of lines) await line(text, x, 11);
    if (task.source === 'objective') await line('Objective', x, 9, MUTED);
    if (item.slideUrl) {
      const label = 'Slide deck';
      ensureRoom(16);
      const linkTop = top;
      await line(label, x, 10, ORANGE);
      try { addLink(item.slideUrl, x, linkTop, 10, label); } catch { /* invalid legacy slide URL */ }
    }
    top += 9;
  }
  // Copy into an exact-sized ArrayBuffer accepted by Obsidian on iOS.
  const bytes = await pdf.save();
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export function agendaPdfFilename(title: string, date: string): string {
  const value = `${title.trim()} - ${date.trim()}`.replace(/[\\/:*?"<>|#^\[\]\u0000-\u001f\u007f]/g, '-')
    .replace(/\s+/g, ' ').replace(/^[ .-]+|[ .-]+$/g, '');
  // Bound the UTF-8 filename bytes with room for the extension and collision suffix.
  const encoder = new TextEncoder();
  let name = '';
  for (const character of value) {
    if (encoder.encode(name + character).length > 170) break;
    name += character;
  }
  return name.replace(/[ .-]+$/g, '') || 'Meeting Agenda';
}
