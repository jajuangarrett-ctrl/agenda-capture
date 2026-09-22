import { App, Modal } from "obsidian";
import type AgendaCapturePlugin from "../../main";
import { CaptureLiveSession } from "../capture-live/session";
import { captureKey } from "../capture-live/panel";
import { AGENDA_LIVE_INSTRUCTIONS, AGENDA_LIVE_TOOLS, agendaBackendInstructions, LiveAgendaTools } from "./tools";

export class AgendaLiveModal extends Modal {
  private session?: CaptureLiveSession; private closed=false; private muted=false;
  private status!:HTMLElement; private transcript!:HTMLElement; private updates!:HTMLElement; private audio!:HTMLAudioElement;
  private startButton!:HTMLButtonElement; private muteButton!:HTMLButtonElement; private endButton!:HTMLButtonElement;
  constructor(app:App, private plugin:AgendaCapturePlugin, private selected:()=>string, private released:()=>void){super(app);}
  onOpen():void{this.titleEl.setText("Talk to Agenda Center");this.modalEl.addClass("fjg-agenda-live-modal");const root=this.contentEl;
    root.createEl("p",{text:"Ask what is on an agenda, have it read aloud, or say what to add, rename, complete, or delete. Clear requests save immediately."});
    this.status=root.createEl("p",{text:"Microphone off — press Start conversation",cls:"fjg-agenda-live-status",attr:{role:"status"}});
    const controls=root.createDiv({cls:"fjg-capture-live-controls"});this.startButton=controls.createEl("button",{text:"Start conversation",cls:"mod-cta"});this.startButton.onclick=()=>void this.start();
    this.muteButton=controls.createEl("button",{text:"Mute microphone"});this.muteButton.disabled=true;this.muteButton.onclick=()=>{this.muted=!this.muted;this.session?.mute(this.muted);this.muteButton.setText(this.muted?"Unmute microphone":"Mute microphone");};
    this.endButton=controls.createEl("button",{text:"End conversation"});this.endButton.disabled=true;this.endButton.onclick=()=>this.session?.end();
    this.audio=root.createEl("audio",{attr:{controls:"",autoplay:"","aria-label":"Agenda assistant playback"}});this.transcript=root.createDiv({cls:"fjg-capture-live-transcript",attr:{role:"log"}});this.updates=root.createDiv({cls:"fjg-agenda-live-updates",attr:{role:"log"}});
  }
  private async start(){if(this.closed||this.startButton.disabled)return;this.startButton.disabled=true;let session:CaptureLiveSession;
    const tools=new LiveAgendaTools(this.app,()=>this.plugin.settings.vaultSubfolder,(message)=>{this.plugin.refreshDashboard();this.updates.createEl("p",{text:message});},()=>!this.closed&&session.active);
    session=new CaptureLiveSession(this.audio,{state:(state,message)=>{this.status.setText(message);this.startButton.disabled=["connecting","connected","ending"].includes(state);this.muteButton.disabled=state!=="connected";this.endButton.disabled=!["connecting","connected"].includes(state);},transcript:(speaker,delta)=>{let line=this.transcript.lastElementChild as HTMLElement|null;if(!line||line.dataset.speaker!==speaker){line=this.transcript.createEl("p",{text:`${speaker}: `});line.dataset.speaker=speaker;}line.appendText(delta);},execute:(name,args)=>tools.execute(name,args)});this.session=session;
    const context=JSON.stringify({selected_agenda:this.selected(),local_date:new Date().toLocaleDateString("en-CA"),time_zone:Intl.DateTimeFormat().resolvedOptions().timeZone});
    await session.start(await captureKey(this.app,this.plugin.settings.openaiApiKey),"gpt-5.6-terra",context,{instructions:AGENDA_LIVE_INSTRUCTIONS,backendInstructions:agendaBackendInstructions,tools:AGENDA_LIVE_TOOLS,maxOutputTokens:2200});
  }
  onClose(){this.closed=true;this.session?.end();this.released();}
}
