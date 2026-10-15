import {newWorkspace,validate,summary,transact,importTSV,exportHandoff,exportYaff,pending,PRIORITIES,STATES} from "./core.mjs";
const $=id=>document.getElementById(id);
let w=newWorkspace(),selected=w.tasks[0]?.id||"",db=null,savedRev=0,dirty=false;
const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const notice=(msg,fail=false)=>{const e=$("toast");e.textContent=msg;e.style.background=fail?"#f5c7be":"#c6e0c4";e.classList.add("show");clearTimeout(notice.timer);notice.timer=setTimeout(()=>e.classList.remove("show"),4200);};
const safe=fn=>Promise.resolve().then(fn).catch(e=>notice(e.message||String(e),true));
function openStore(){
 return new Promise((resolve,reject)=>{
  const r=indexedDB.open("bonfyre-shift-continuity-v1",1);
  r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains("workspaces"))r.result.createObjectStore("workspaces");};
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||Error("Browser storage unavailable"));
 });
}
const read=key=>new Promise((resolve,reject)=>{
 const t=db.transaction("workspaces","readonly"),r=t.objectStore("workspaces").get(key);
 r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);
});
function write(key,expected,data){
 return new Promise((resolve,reject)=>{
  const t=db.transaction("workspaces","readwrite"),store=t.objectStore("workspaces");
  let newRev;
  store.get(key).onsuccess=e=>{
   const old=e.target.result;
   if((old?.storageRev||0)!==expected){t.abort();return;}
   newRev=expected+1;
   store.put({storageRev:newRev,workspace:structuredClone(data)},key);
  };
  t.oncomplete=()=>resolve(newRev);
  t.onabort=()=>reject(Error("A different tab changed this shift. Reload instead of overwriting its work."));
  t.onerror=()=>reject(t.error);
 });
}
async function save(){
 if(!db)throw Error("Local browser storage is unavailable; export instead.");
 validate(w);savedRev=await write("north-district",savedRev,w);
 dirty=false;$("save").textContent="Saved ✓";notice("Saved local shift, actors, source links and audit events in this browser.");
}
function mutate(command,options={}){
 w=transact(w,w.activeActor,command,options);
 dirty=true;$("save").textContent="Save changes •";
 render();return w;
}
function csv(s){return String(s||"").replace(/[\r\n\t]/g," ").slice(0,1200);}
function down(name,text,type="text/markdown"){
 const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement("a");a.href=url;a.download=name;a.click();
 setTimeout(()=>URL.revokeObjectURL(url),2500);
}
function allowedStage(t,filter){
 return filter==="all"||filter==="open"&&pending(t)||t.stage===filter;
}
function renderList(){
 const list=$("taskList"),query=$("query").value.toLowerCase().trim(),stage=$("stageFilter").value,priority=$("priorityFilter").value;
 const order={critical:0,high:1,normal:2,low:3},tasks=w.tasks.filter(t=>allowedStage(t,stage)&&(priority==="all"||t.priority===priority)&&
  [t.title,t.detail,t.source,t.blocker,t.id].join(" ").toLowerCase().includes(query)).sort((a,b)=>order[a.priority]-order[b.priority]||a.id.localeCompare(b.id));
 list.replaceChildren();
 if(!tasks.length){const e=document.createElement("p");e.textContent="No matching work in this shift.";e.className="description";list.append(e);return;}
 for(const t of tasks){
  const button=document.createElement("button");button.type="button";button.className="task-button"+(t.id===selected?" selected":"");
  button.setAttribute("aria-pressed",String(t.id===selected));button.dataset.id=t.id;
  button.innerHTML='<div class="task-line"><span class="'+escape(t.priority)+'">'+escape(t.priority.toUpperCase())+'</span><span class="'+escape(t.stage)+'">'+escape(t.stage)+'</span></div><strong>'+escape(t.title)+'</strong><p>'+escape(t.source)+'</p>';
  button.addEventListener("click",()=>{selected=t.id;render();});
  list.append(button);
 }
}
function renderDetail(){
 const t=w.tasks.find(t=>t.id===selected)||w.tasks[0];if(!t)return;
 selected=t.id;
 $("taskTitle").textContent=t.title;$("taskId").textContent=t.id;
 $("taskDescription").textContent=t.detail;
 $("taskPriority").textContent=t.priority+" priority";
 $("taskStage").textContent=t.stage;$("taskOwner").textContent="Domain: "+t.owner;
 $("taskBlocker").textContent=t.blocker||"No blocker recorded";
 $("requirements").replaceChildren();
 for(const text of t.requires){const span=document.createElement("span");span.textContent=text;$("requirements").append(span);}
 $("taskClaim").textContent=t.assignee?(t.assignee+" · until "+new Date(t.leaseUntil).toLocaleString()):"Not claimed";
 const a=$("taskSource");
 a.textContent=t.source;if(t.source.startsWith("https://")){a.href=t.source;a.setAttribute("aria-disabled","false");}
 else{a.href="#";a.setAttribute("aria-disabled","true");}
 $("claim").disabled=t.stage==="resolved"||Boolean(t.assignee&&t.assignee!==w.activeActor&&t.leaseUntil>Date.now());
 $("renew").disabled=t.assignee!==w.activeActor||t.leaseUntil<=Date.now();
 $("release").disabled=t.assignee!==w.activeActor&&w.activeActor!==w.supervisor;
 $("review").disabled=t.review==="reviewed"||![w.incoming,w.supervisor].includes(w.activeActor);
 $("review").textContent=t.review==="reviewed"?"Reviewed ✓":"Mark reviewed";
 $("resolveForm").querySelector("button").disabled=t.stage==="blocked"||t.assignee!==w.activeActor||t.leaseUntil<=Date.now();
 $("unblock").disabled=t.stage!=="blocked"||t.assignee!==w.activeActor&&w.activeActor!==w.supervisor;
}
function renderJournal(){
 const holder=$("journal");holder.replaceChildren();
 const rows=w.audit.slice(-26).reverse();
 if(!rows.length){const p=document.createElement("p");p.className="description";p.textContent="This fixture has no real-world transition receipts. Take an action to build the local event history.";holder.append(p);return;}
 for(const event of rows){
  const div=document.createElement("div");div.className="event";
  const title=document.createElement("strong");title.textContent=event.action+" · "+event.actor;
  const desc=document.createElement("small");desc.textContent=event.taskId+" · revision "+event.rev;
  const time=document.createElement("time");time.textContent=event.at;
  div.append(title,desc,document.createElement("br"),time);
  if(event.note){const p=document.createElement("p");p.textContent=event.note;div.append(p);}
  holder.append(div);
 }
}
function renderHandoff(){
 const h=w.handoff;
 $("handoffState").textContent=w.closed?"Closed":!h?"Not prepared":h.accepted?"Acknowledged":"Awaiting acknowledgement";
 $("handoffReceipt").textContent=!h?"No handoff prepared. Source work stays individually reviewable.":
  (h.accepted?"Accepted by "+h.acceptedBy+" at "+h.acceptedAt+". ":"Prepared by "+h.preparedBy+" at "+h.preparedAt+". ")+
  "Cut revision "+h.expectedRevision+". Status: "+(h.accepted?"locally acknowledged":h.expectedRevision===w.revision?"reviewable":"STALE · source changed; revoke and prepare again")+".";
 $("prepare").disabled=w.closed||!([w.outgoing,w.supervisor].includes(w.activeActor))||!!h&&!h.accepted;
 $("accept").disabled=w.closed||w.activeActor!==w.incoming||!h||h.accepted||h.expectedRevision!==w.revision;
 $("revoke").disabled=w.closed||w.activeActor!==w.supervisor||!h||h.accepted;
}
function render(){
 validate(w);const s=summary(w);
 $("team").textContent=w.team;$("shift").textContent=w.shift;
 $("outgoing").textContent=w.outgoing;$("incoming").textContent=w.incoming;
 $("revision").textContent="Revision "+w.revision;
 $("openCount").textContent=s.open;$("criticalCount").textContent=s.critical;
 $("blockedCount").textContent=s.blocked;$("claimCount").textContent=s.claimed;
 $("reviewCount").textContent=s.unreviewed;
 $("actor").replaceChildren();
 for(const [actor,role] of [[w.outgoing,"Outgoing operator"],[w.incoming,"Incoming operator"],[w.supervisor,"Supervisor"]]){
  $("actor").add(new Option(role+" · "+actor,actor,false,actor===w.activeActor));
 }
 renderList();renderDetail();renderJournal();renderHandoff();
}
async function reset(){
 w=newWorkspace();selected=w.tasks[0].id;savedRev=0;dirty=false;
 if(db){const saved=await read("north-district");if(saved){savedRev=saved.storageRev;
  w=saved.workspace;selected=w.tasks[0]?.id||selected;}}
 render();
}
$("actor").addEventListener("change",e=>{w.activeActor=e.target.value;render();notice("Simulated role: "+w.activeActor+". This is not actual staff authentication.");});
$("query").addEventListener("input",renderList);
$("stageFilter").addEventListener("change",renderList);
$("priorityFilter").addEventListener("change",renderList);
$("taskSource").addEventListener("click",e=>{if(e.currentTarget.getAttribute("aria-disabled")==="true")e.preventDefault();});
$("claim").addEventListener("click",()=>safe(()=>mutate("claim",{taskId:selected,minutes:30})));
$("renew").addEventListener("click",()=>safe(()=>mutate("renew",{taskId:selected})));
$("release").addEventListener("click",()=>safe(()=>mutate("release",{taskId:selected})));
$("review").addEventListener("click",()=>safe(()=>mutate("review",{taskId:selected,note:"Reviewed by "+w.activeActor})));
$("unblock").addEventListener("click",()=>safe(()=>mutate("unblock",{taskId:selected})));
$("noteForm").addEventListener("submit",e=>{e.preventDefault();safe(()=>{mutate("note",{taskId:selected,note:new FormData(e.target).get("note")});e.target.reset();});});
$("blockForm").addEventListener("submit",e=>{e.preventDefault();safe(()=>{mutate("block",{taskId:selected,reason:new FormData(e.target).get("reason")});e.target.reset();});});
$("resolveForm").addEventListener("submit",e=>{e.preventDefault();safe(()=>{mutate("resolve",{taskId:selected,receipt:new FormData(e.target).get("receipt")});e.target.reset();});});
$("prepare").addEventListener("click",()=>safe(()=>{mutate("prepare");notice("Handoff cut prepared. Switch to incoming operator and acknowledge exact revision.");}));
$("accept").addEventListener("click",()=>safe(()=>{mutate("accept");notice("Exact shift cut locally acknowledged. No live WorkGraph claim created.");}));
$("revoke").addEventListener("click",()=>safe(()=>{mutate("revoke");notice("Stale handoff revoked. Source items remain unchanged.");}));
$("save").addEventListener("click",()=>safe(save));
$("export").addEventListener("click",()=>safe(()=>{down("shift-continuity-review.md",exportHandoff(w));notice("Source-linked review downloaded.");}));
$("downloadYaff").addEventListener("click",()=>safe(()=>{down("shift-continuity-proposal.yaff",exportYaff(w),"text/plain");notice("Typed handoff proposal exported; no native operator submitted.");}));
$("load").addEventListener("click",()=>safe(async()=>{
 if(dirty&&!confirm("Replace unsaved local changes with the reference scenario?"))return;
 if(!confirm("Reset this browser workspace to the fictional source scenario?"))return;
 const fixture=newWorkspace();w=fixture;selected=w.tasks[0].id;
 if(db){savedRev=await write("north-district",savedRev,w);}dirty=false;render();notice("Reference scenario restored.");
}));
$("tsv").addEventListener("change",e=>safe(async()=>{
 const file=e.target.files?.[0];if(!file)return;
 if(file.size>125000)throw Error("TSV exceeds the 125KB local bound.");
 w=importTSV(await file.text(),w);dirty=true;selected=w.tasks[w.tasks.length-1].id;
 $("save").textContent="Save changes •";render();notice("Source tasks imported. Their identities and original URLs were retained.");e.target.value="";
}));
$("postmortem").addEventListener("click",e=>{
 const t=w.tasks.find(x=>x.id===selected);
 if(!t)return;
 // Link-only projection: Postmortem Atlas owns its ingestion and effect paths.
 // Do not imply that it accepted this draft or that incident source was verified.
 const u=new URL(e.currentTarget.href);
 u.searchParams.set("subject",t.id);
 u.searchParams.set("context","shift-continuity");
 e.currentTarget.href=u.toString();
});
Object.defineProperty(window,"aurekaiShiftWitness",{get:()=>({revision:w.revision,actor:w.activeActor,stats:summary(w),handoff:w.handoff&&{accepted:w.handoff.accepted,expectedRevision:w.handoff.expectedRevision},tasks:w.tasks.length})});
(async()=>{try{db=await openStore();const v=await read("north-district");
 if(v){w=v.workspace;validate(w);savedRev=v.storageRev;selected=w.tasks[0]?.id||selected;}
 render();}catch(e){render();notice("Local draft storage unavailable; exports still work.",true);}})();
