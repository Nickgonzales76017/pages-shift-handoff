/* Bonfyre Operations Continuity / bounded local WorkGraph preview.
 * No JSON business carrier, no remote dispatcher, no real worker claims.
 * Source identity and human authority stay separate from projected actions.
 */
export const STATES=["new","claimed","blocked","ready","resolved"];
export const PRIORITIES=["critical","high","normal","low"];
export const ROLES=["outgoing","incoming","supervisor"];
const identifier=s=>typeof s==="string"&&/^[a-z][a-z0-9-]{2,78}$/.test(s);
export const safeSource=s=>{
 if(/^fixture:[a-z0-9:\/.-]{2,160}$/i.test(s))return true;
 try{const u=new URL(s);return u.protocol==="https:"&&!u.username&&!u.password&&!u.hash&&u.href.length<=500;}catch{return false;}
};
const stamp=()=>new Date().toISOString();
const task=(id,title,priority,owner,source,kind,detail,requires,blocker="",stage="new")=>({
 id,title,priority,owner,source,kind,detail,requires,blocker,stage,
 assignee:"",leaseUntil:0,review:"unreviewed",receipt:"",correction:"",history:[]
});
export function newWorkspace(){
 const at="2026-10-14T21:00:00Z";
 return {id:"north-district-demo",kind:"synthetic_operational_scenario",team:"North District Service Operations",
  shift:"Evening → Morning continuity",outgoing:"alex",incoming:"morgan",supervisor:"jordan",
  activeActor:"alex",view:"all",startedAt:at,revision:0,closed:false,
  tasks:[
   task("svc-cooling","Cooling system alert / service site 4","critical","facilities","fixture://facilities/site-4","incident",
    "Sensor alert reported at 20:42. Technician dispatch is not confirmed.",["technician receipt","sensor recheck"],"Technician ETA unknown","blocked"),
   task("svc-access","After-hours facility access","high","security","fixture://security/access-window","request",
    "Badge access list needs morning-shift confirmation.",["access approval"],"","new"),
   task("svc-supplier","Replacement parts lead time","high","procurement","fixture://supplier/quote-17","vendor",
    "Supplier mentions a part on hand, not a reserved purchase.",["dated supplier quote","order authorization"],"Quote not confirmed","new"),
   task("svc-community","Resident service interruption notice","normal","communications","fixture://comms/draft-9","communication",
    "Draft notice prepared but has not been approved or published.",["approved notice"],"Approval outstanding","blocked"),
   task("svc-backup","Backup generator weekly check","normal","facilities","fixture://facilities/checklist-2","routine",
    "Checklist due for morning review. No completion receipt yet.",["signed checklist"],"","new"),
   task("svc-incident","Access incident retrospective","low","operations","fixture://operations/incident-11","retrospective",
    "Prior access issue requires a reviewed timeline and corrective follow-up.",["reviewed chronology"],"","ready")
  ],audit:[],handoff:null};
}
export function validate(w){
 if(!w||w.kind!=="synthetic_operational_scenario"&&!["local_import","local_workspace"].includes(w?.kind))throw Error("Unknown operational workspace carrier.");
 if(!identifier(w.id)||!Array.isArray(w.tasks)||w.tasks.length>200||w.tasks.length===0||
    !Number.isSafeInteger(w.revision)||w.revision<0||!identifier(w.outgoing)||
    !identifier(w.incoming)||w.outgoing===w.incoming||!identifier(w.supervisor))
    throw Error("Invalid shift, actors or task boundary.");
 const ids=new Set();
 for(const t of w.tasks){
  if(!identifier(t.id)||ids.has(t.id)||!PRIORITIES.includes(t.priority)||!STATES.includes(t.stage)||
     typeof t.title!=="string"||!t.title.trim()||t.title.length>160||
     typeof t.detail!=="string"||t.detail.length>1400||!safeSource(t.source)||
     !Array.isArray(t.requires)||t.requires.length>12||!Array.isArray(t.history)||
     t.history.length>100||!["incident","request","vendor","communication","routine","retrospective"].includes(t.kind)||
     !Number.isSafeInteger(t.leaseUntil)||t.leaseUntil<0)
    throw Error("Task identity, provenance or stage invalid.");
  ids.add(t.id);
 }
 return w;
}
export const pending=t=>t.stage!=="resolved";
export function summary(w){
 validate(w);
 const open=w.tasks.filter(pending);
 return {total:w.tasks.length,open:open.length,critical:open.filter(t=>t.priority==="critical").length,
  blocked:open.filter(t=>t.stage==="blocked").length,
  claimed:open.filter(t=>t.stage==="claimed").length,
  unreviewed:open.filter(t=>t.review!=="reviewed").length,
  ready:open.filter(t=>t.stage==="ready").length,
  verifiedResolved:w.tasks.filter(t=>t.stage==="resolved"&&t.receipt).length};
}
const copy=w=>structuredClone(w);
const who=(w,actor)=>[w.outgoing,w.incoming,w.supervisor].includes(actor);
function record(w,taskId,actor,action,note=""){
 w.revision++;
 const item=w.tasks.find(t=>t.id===taskId),entry={rev:w.revision,at:stamp(),actor,taskId,action,note:String(note).slice(0,240)};
 w.audit.push(entry);if(w.audit.length>500)w.audit.shift();
 if(item){item.history.push(entry);if(item.history.length>100)item.history.shift();}
 return w;
}
export function transact(workspace,actor,command,options={}){
 const w=copy(validate(workspace)),t=w.tasks.find(x=>x.id===options.taskId);
 if(!who(w,actor))throw Error("Actor does not belong to the configured shift.");
 if(w.closed)throw Error("This shift is closed. Create a new session.");
 if(["claim","renew","block","unblock","resolve","release","review","note","priority"].includes(command)&&!t)
    throw Error("Exact task identity required.");
 const now=Number.isSafeInteger(options.now)?options.now:Date.now();
 if(command==="claim"){
  if(!pending(t))throw Error("Resolved work cannot be claimed.");
  if(t.assignee&&t.assignee!==actor&&t.leaseUntil>now)throw Error("Another operator has an active claim.");
  if(w.handoff?.accepted&&actor===w.outgoing)throw Error("Outgoing operator cannot reclaim after acceptance.");
  const minutes=Number(options.minutes||30);
  if(![5,15,30,60,120].includes(minutes))throw Error("Unsupported lease duration.");
  t.assignee=actor;t.leaseUntil=now+minutes*60000;
  if(t.stage==="new"||t.stage==="ready")t.stage="claimed";
  return record(w,t.id,actor,"claimed","Lease "+minutes+" minutes");
 }
 if(command==="renew"){
  if(t.assignee!==actor||t.leaseUntil<=now)throw Error("Only the current claimant can renew an unexpired lease.");
  t.leaseUntil=now+30*60000;return record(w,t.id,actor,"renewed","30-minute bounded lease");
 }
 if(command==="release"){
  if(t.assignee!==actor&&actor!==w.supervisor)throw Error("Only the claimant or supervisor can release work.");
  t.assignee="";t.leaseUntil=0;if(t.stage==="claimed")t.stage="new";
  return record(w,t.id,actor,"released");
 }
 if(command==="block"){
  if(t.assignee!==actor&&actor!==w.supervisor)throw Error("Claim the task before recording a blocker.");
  const reason=String(options.reason||"").trim().slice(0,260);
  if(reason.length<5)throw Error("A blocker needs a meaningful reason.");
  t.blocker=reason;t.stage="blocked";return record(w,t.id,actor,"blocked",reason);
 }
 if(command==="unblock"){
  if(t.assignee!==actor&&actor!==w.supervisor)throw Error("Only a claimant or supervisor can clear the blocker.");
  t.stage="claimed";t.blocker="";return record(w,t.id,actor,"unblocked","Blocker explicitly cleared");
 }
 if(command==="review"){
  if(actor!==w.supervisor&&actor!==w.incoming)throw Error("Supervisor or incoming operator review is required.");
  t.review="reviewed";return record(w,t.id,actor,"reviewed",String(options.note||"").slice(0,240));
 }
 if(command==="note"){
  const note=String(options.note||"").trim().slice(0,1200);
  if(!note)throw Error("A source-linked observation cannot be blank.");
  t.correction=note;return record(w,t.id,actor,"note",note);
 }
 if(command==="priority"){
  if(actor!==w.supervisor||!PRIORITIES.includes(options.priority))throw Error("Only the supervisor can reprioritize.");
  t.priority=options.priority;return record(w,t.id,actor,"priority",t.priority);
 }
 if(command==="resolve"){
  if(t.stage==="blocked")throw Error("Clear the blocker before resolution.");
  if(t.assignee!==actor||t.leaseUntil<=now)throw Error("Only the current active claimant may resolve.");
  const receipt=String(options.receipt||"").trim();
  if(!receipt||receipt.length>500||!safeSource(receipt))throw Error("Resolution requires a source-linked completion receipt.");
  if(t.priority==="critical"&&t.review!=="reviewed")throw Error("Critical work needs incoming/supervisor review before resolution.");
  t.receipt=receipt;t.stage="resolved";t.assignee="";t.leaseUntil=0;
  return record(w,t.id,actor,"resolved","Source-linked completion received");
 }
 if(command==="prepare"){
  if(actor!==w.outgoing&&actor!==w.supervisor)throw Error("Only outgoing shift or supervisor can prepare the handoff.");
  if(w.handoff&&!w.handoff.accepted)throw Error("Resolve or revoke the existing handoff before preparing a replacement.");
  const digest=handoffCut(w);
  w.handoff={from:w.outgoing,to:w.incoming,preparedBy:actor,preparedAt:stamp(),
   expectedRevision:w.revision+1,sourceCut:digest,accepted:false,acceptedAt:"",acceptedBy:""};
  return record(w,"-",actor,"handoff-prepared",digest.slice(0,120));
 }
 if(command==="revoke"){
  if(!w.handoff||w.handoff.accepted||actor!==w.supervisor)throw Error("Only a supervisor can revoke an unaccepted handoff.");
  w.handoff=null;return record(w,"-",actor,"handoff-revoked");
 }
 if(command==="accept"){
  if(actor!==w.incoming||!w.handoff||w.handoff.accepted)throw Error("Only the incoming operator can accept a pending handoff.");
  if(w.handoff.expectedRevision!==w.revision)throw Error("Handoff is stale. Supervisor must revoke and prepare a fresh cut.");
  if(w.handoff.sourceCut!==handoffCut(w))throw Error("Handoff source frontier has changed.");
  w.handoff.accepted=true;w.handoff.acceptedAt=stamp();w.handoff.acceptedBy=actor;
  return record(w,"-",actor,"handoff-accepted",w.handoff.sourceCut.slice(0,120));
 }
 if(command==="close"){
  if(actor!==w.supervisor||!w.handoff?.accepted)throw Error("Only supervisor may close an accepted handoff.");
  w.closed=true;return record(w,"-",actor,"shift-closed");
 }
 throw Error("Unsupported transition.");
}
export function handoffCut(w){
 const rows=w.tasks.map(t=>[t.id,t.priority,t.stage,t.assignee,t.blocker,t.source,t.receipt,t.review].map(v=>String(v??"").replace(/[\r\n\t|]/g," ")).join("|")).sort();
 return "bonfyre-shift-cut-v1\n"+w.id+"\n"+w.shift+"\n"+rows.join("\n");
}
export function importTSV(text,workspace){
 if(typeof text!=="string"||text.length>125000)throw Error("Use a bounded TSV file smaller than 125KB.");
 const rows=text.trim().split(/\r?\n/).map(s=>s.split("\t"));
 const fields=rows.shift()?.map(s=>s.trim().toLowerCase());
 for(const f of ["id","title","priority","kind","source","detail"])if(!fields?.includes(f))throw Error("Missing exact TSV column: "+f);
 if(rows.length<1||rows.length>120)throw Error("Import 1–120 tasks per batch.");
 const w=copy(validate(workspace)),known=new Set(w.tasks.map(t=>t.id));
 if(known.size+rows.length>200)throw Error("This shift exceeds the 200-task limit.");
 const read=(line,key)=>String(line[fields.indexOf(key)]||"").trim();
 const newTasks=rows.map(line=>{
  const id=read(line,"id"),source=read(line,"source"),priority=read(line,"priority"),kind=read(line,"kind");
  if(!identifier(id)||known.has(id)||!safeSource(source)||!PRIORITIES.includes(priority)||!["incident","request","vendor","communication","routine","retrospective"].includes(kind))throw Error("Invalid, repeated, or unsupported source row "+id);
  known.add(id);
  return task(id,read(line,"title").slice(0,160),priority,"unassigned",source,kind,read(line,"detail").slice(0,1400),[], "", "new");
 });
 w.tasks.push(...newTasks);w.kind="local_import";record(w,"-",w.activeActor,"imported",newTasks.length+" distinct source tasks");
 return w;
}
const atom=s=>'"'+String(s??"").replace(/[\r\n\t"]/g," ").slice(0,500)+'"';
export function exportHandoff(w){
 validate(w);
 const s=summary(w),parts=[
  "# "+w.team+" — "+w.shift,"","Local handoff review; no live dispatch or worker lease is asserted.","",
  "## Open work ("+s.open+")"
 ];
 for(const t of w.tasks.filter(pending).sort((a,b)=>PRIORITIES.indexOf(a.priority)-PRIORITIES.indexOf(b.priority))){
  parts.push("### "+t.priority.toUpperCase()+" / "+t.title,
   "- Source: "+t.source,"- Stage: "+t.stage,"- Operator: "+(t.assignee||"unassigned"),
   "- Requirement: "+(t.requires.join("; ")||"not specified"),"- Blocker: "+(t.blocker||"none"),
   "- Context: "+t.detail,"");
 }
 parts.push("## Handoff",w.handoff?(w.handoff.accepted?"Accepted":"Pending acknowledgement")+" by "+(w.handoff.acceptedBy||w.handoff.to):"Not prepared",
  "","Generated from browser-local workspace; cannot certify source facts, person availability, or dispatched operations.");
 return parts.join("\n");
}
export function exportYaff(w){
 validate(w);const rows=["program operations-shift-continuity","shift "+atom(w.id),
  "team "+atom(w.team),"revision "+w.revision,"outgoing "+w.outgoing,"incoming "+w.incoming,
  "handoff "+(w.handoff?.accepted?"locally-accepted":w.handoff?"pending":"none")];
 for(const t of w.tasks)rows.push(["item",t.id,t.stage,t.priority,t.assignee||"unassigned",atom(t.source),atom(t.receipt||"unadmitted"),atom(t.blocker||"-")].join(" "));
 rows.push("authority local-preview-only","cannot_infer local_claim_or_ack_is_not_native_workgraph_receipt_or_real_operational_effect");
 return rows.join("\n")+"\n";
}
