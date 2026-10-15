/* Shift continuity room. Typed browser-local source records, replayable claims,
 * conflict-safe revisions and actor-gated acknowledgment. No JSON object store.
 * A simulation is not a production employee attendance attestation.
 */
export const STATES=["reported","triaged","assigned","in-progress","blocked","resolved","verified"];
export const ROLES=["operator","lead","responder","reviewer"];
const id=()=>crypto.randomUUID();
export const seed=()=>({
 facility:"Dallas service operations / example",shift:"Evening → Morning",rev:0,
 events:[
  {id:"INC-104",source:"shift:2026-10-14:line-A",title:"Inbound delivery manifest discrepancy",detail:"Six cartons counted; delivery notice claims eight. Carrier acknowledgment still missing.",kind:"inventory",impact:5,state:"blocked",owner:"Logistics",reviewer:"",proof:"delivery notice and count sheet",resolution:"",created:"20:15",history:[["20:15","operator","reported","Intake count received"],["20:32","lead","blocked","Need carrier receipt"]]},
  {id:"INC-105",source:"sensor:packing-line-2",title:"Packing line two stopped intermittently",detail:"Three short faults during handoff window; operator reset but underlying trigger not established.",kind:"equipment",impact:5,state:"in-progress",owner:"Maintenance",reviewer:"",proof:"operator log",resolution:"",created:"21:10",history:[["21:10","operator","reported","Intermittent stop"],["21:23","lead","in-progress","Maintenance follow-up needed"]]},
  {id:"INC-106",source:"ticket:SR-220",title:"Customer shipment confirmation waiting",detail:"Tracking was generated. Customer notification is waiting for delivery evidence.",kind:"customer",impact:3,state:"assigned",owner:"Support",reviewer:"",proof:"carrier tracking",resolution:"",created:"22:04",history:[["22:04","operator","reported","Customer asked for ETA"],["22:18","lead","assigned","Support to follow up"]]}
 ],ack:[],notes:"Opening shift should check carton count, recurring line faults and outbound message evidence."});
export function decide(room,actor,role,eventId,next,note,expectedRev){
 if(room.rev!==expectedRev)throw Error("This room was changed in another review. Reload before making a new decision.");
 if(!ROLES.includes(role)||!actor?.trim()||actor.length>72)throw Error("A named actor and valid role are required.");
 const event=room.events.find(x=>x.id===eventId);if(!event)throw Error("That incident does not exist.");
 if(!STATES.includes(next))throw Error("Unknown incident transition.");
 if(!note?.trim()||note.length>500)throw Error("Record a short transition reason.");
 if(next==="verified"&&role!=="reviewer")throw Error("A reviewer must verify a closure.");
 if(next==="resolved"&&!event.resolution.trim())throw Error("Record a resolution before closing work.");
 if(event.state==="verified"&&role!=="reviewer")throw Error("Verified work can only be reopened by a reviewer.");
 if(next==="verified"&&(!event.proof.trim()||!event.reviewer.trim()))throw Error("Reviewer and completion evidence are required.");
 if(next==="in-progress"&&!event.owner.trim())throw Error("Assign an accountable owner first.");
 const c=structuredClone(room),e=c.events.find(x=>x.id===eventId);
 e.state=next;e.history.push([new Date().toISOString(),actor+" ("+role+")",next,note.trim()]);
 c.rev++;return c;
}
export function acknowledge(room,actor,role,expectedRev){
 if(room.rev!==expectedRev)throw Error("Handoff revision changed. Reload the current state.");
 if(!actor?.trim()||actor.length>72||!ROLES.includes(role))throw Error("Named accountable actor required.");
 if(room.ack.some(a=>a.actor===actor&&a.rev===room.rev))throw Error("Already acknowledged this revision.");
 const c=structuredClone(room);c.ack.push({actor,role,rev:room.rev,at:new Date().toISOString()});c.rev++;return c;
}
export const summary=room=>{
 const open=room.events.filter(x=>x.state!=="verified"),critical=open.filter(x=>x.impact===5);
 return {open:open.length,critical:critical.length,blocked:open.filter(x=>x.state==="blocked").length,
  verified:room.events.length-open.length,acknowledgments:room.ack.length};
};
export function handoff(room){
 const metrics=summary(room);
 return ["# "+room.facility,"Shift: "+room.shift,"Open: "+metrics.open,
  "Critical: "+metrics.critical,"Blocked: "+metrics.blocked,"",
  "## Work requiring a new-shift decision",
  ...room.events.filter(e=>e.state!=="verified").flatMap(e=>[
   "### "+e.id+" — "+e.title,
   "State: "+e.state+" · Owner: "+(e.owner||"UNASSIGNED")+" · Impact "+e.impact,
   "Source: "+e.source,"Observation: "+e.detail,
   "Evidence still needed: "+e.proof,"Resolution: "+(e.resolution||"unconfirmed"),""
  ]),
  "## Shift acknowledgment history",
  ...room.ack.map(a=>a.actor+" ("+a.role+") acknowledged revision "+a.rev+" at "+a.at),
  "","Handoff acknowledgment is a browser-local training record, not a verified attendance, source admission or official incident closure."
 ].join("\n");
}
export const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
