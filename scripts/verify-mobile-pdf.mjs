import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const obsidian = `
export class ItemView { constructor(leaf){this.app=leaf.app;this.containerEl=leaf.containerEl;} }
export class TFile {}
export class TFolder {}
export const Platform={isMobile:false,isMobileApp:true};
export const normalizePath=p=>p;
export const setIcon=()=>{};
export const Notice=class { constructor(text){window.notices.push(text);} };
`;
const fixture = `
import { AgendaDashboardView } from './src/DashboardView';
import { TFolder, TFile } from 'obsidian';
window.notices=[];
HTMLElement.prototype.createEl=function(tag,o={}) {
  const el=this.ownerDocument.createElement(tag);
  if(o.cls) el.className=o.cls;
  if(o.text) el.textContent=o.text;
  for(const [k,v] of Object.entries(o.attr||{})) el.setAttribute(k,v);
  this.append(el);return el;
};
HTMLElement.prototype.createDiv=function(o){return this.createEl('div',o);};
HTMLElement.prototype.createSpan=function(o){return this.createEl('span',o);};
HTMLElement.prototype.empty=function(){this.replaceChildren();};
HTMLElement.prototype.addClass=function(v){this.classList.add(v);};
HTMLElement.prototype.setText=function(v){this.textContent=v;};
window.print=()=>{window.prints++;throw new Error('Unavailable host dialog');};
window.prints=0; window.files={}; window.opened=[]; window.shared=[]; window.failSave=false;
const entries=new Map([['People',new TFolder()]]);
const app={vault:{
  getAbstractFileByPath:p=>entries.get(p),
  adapter:{exists:async p=>entries.has(p)},
  async createFolder(p){entries.set(p,new TFolder());},
  async createBinary(path,bytes){
    if(window.failSave)throw new Error('Fixture disk error');
    if(entries.has(path))throw new Error('File collision');
    const f=Object.assign(new TFile(),{path,name:path.split('/').pop()});
    entries.set(path,f);window.files[path]=Array.from(new Uint8Array(bytes));return f;
  },
},workspace:{getLeaf:()=>({openFile:async f=>{window.opened.push(f.path);}})}};
const root=document.createElement('div'); root.append(document.createElement('div'),document.createElement('div'));document.body.append(root);
const view=new AgendaDashboardView({app,containerEl:root},{settings:{vaultSubfolder:'People'}});
const tasks=Array.from({length:26},(_,i)=>({key:String(i),title:'ITEM-'+String(i+1).padStart(2,'0')+' '+ 'Check the follow-up with the team. '.repeat(i===20?300:3),sourceIndex:i, ...(i>=23?{source:'objective'}:{})}));
tasks[20].title+=' END-OVERSIZED-ROW';
tasks[12].title+=' [Presentation](https://example.test/slides?q=%29)';
tasks.push({key:'unicode',title:'日本語 العربية 😀',sourceIndex:26});
view.agendas=[{name:'Synthetic',kind:'Staff',fileName:'Synthetic.md',tasks}];
view.selected='Synthetic'; view.render();
`;
const { outputFiles } = await build({ stdin:{contents:fixture,resolveDir:process.cwd()},bundle:true,write:false,
  plugins:[{name:'obsidian-fixture',setup(builder){
    builder.onResolve({filter:/^obsidian$/},()=>({path:'obsidian',namespace:'fixture'}));
    builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:obsidian,loader:'js'}));
  }}]
});
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
const dir = await mkdtemp(join(tmpdir(),'agenda-mobile-'));
try {
  const page=await browser.newPage({viewport:{width:386,height:678},hasTouch:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<main>Dashboard fixture</main>');
  await page.addScriptTag({content:outputFiles[0].text});
  await page.getByRole('textbox',{name:'Agenda title'}).fill('Test / Meeting Agenda');
  await page.getByRole('textbox',{name:'Meeting date'}).fill('November 2026');
  const save=page.getByRole('button',{name:'Save PDF',exact:true});
  await save.tap();
  await page.getByRole('button',{name:'Open PDF',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Share / Print'}).count(),0);
  await page.getByRole('button',{name:'Open PDF',exact:true}).tap();
  const keys=await page.evaluate(()=>Object.keys(window.files));
  assert.deepEqual(keys,['People/Agenda Exports/Test - Meeting Agenda - November 2026.pdf']);
  assert.deepEqual(await page.evaluate(()=>window.opened),keys);
  const path=join(dir,'export.pdf');
  await writeFile(path,Buffer.from(await page.evaluate(key=>window.files[key],keys[0])));
  const contents=execFileSync('pdftotext',[path,'-'],{encoding:'utf8'});
  assert.ok(contents.includes('Test / Meeting Agenda'));
  assert.ok(contents.includes('November 2026'));
  assert.ok(contents.includes('END-OVERSIZED-ROW'));
  assert.ok(!contents.includes('Open objective'));
  assert.equal((contents.match(/\bObjective\b/g)||[]).length,3);
  assert.deepEqual(contents.match(/ITEM-\d{2}/g),Array.from({length:26},(_,i)=>'ITEM-'+String(i+1).padStart(2,'0')));
  assert.ok(await page.evaluate(()=>window.prints===0),'Mobile bypasses window.print');
  assert.match(execFileSync('pdfinfo',['-url',path],{encoding:'utf8'}),/https:\/\/example\.test\/slides/);
  const images=execFileSync('pdfimages',['-list',path],{encoding:'utf8'});
  assert.match(images,/\bimage\s+\d+\s+\d+/,'Characters outside the core font are rendered into the PDF');
  await page.evaluate(()=>{
    Object.defineProperty(navigator,'canShare',{value:({files})=>files[0]?.type==='application/pdf'});
    Object.defineProperty(navigator,'share',{value:async ({files})=>{window.shared.push(files[0].name);}});
  });
  await save.tap();
  await page.getByRole('button',{name:'Share / Print'}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.shared),[],'Export does not open the share sheet automatically');
  await page.getByRole('button',{name:'Share / Print'}).tap();
  assert.deepEqual(await page.evaluate(()=>window.shared),['Test - Meeting Agenda - November 2026 (2).pdf']);
  assert.equal(await page.evaluate(()=>Object.keys(window.files).length),2);
  await page.evaluate(()=>{window.failSave=true;});
  await save.tap();
  await page.getByText('Could not save the PDF: Fixture disk error').waitFor();
  assert.ok(await save.isEnabled());
  assert.equal(await page.evaluate(()=>Object.keys(window.files).length),2);
  assert.deepEqual(errors,[]);
  console.log('PASS mobile dashboard button, full multi-page PDF, saved collision-free, open, optional explicit share, and save errors');
} finally {
  await browser.close(); await rm(dir,{recursive:true,force:true});
}
