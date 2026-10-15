# Aurekai Shift Continuity

**[Open the Shift Continuity Studio](https://nickgonzales76017.github.io/pages-shift-handoff/continuity/)** · [Original shift-recording intake](https://nickgonzales76017.github.io/pages-shift-handoff/) · [Incident Postmortem Atlas](https://nickgonzales76017.github.io/pages-postmortem-atlas/)

## Carry operational work across a shift change

The Shift Continuity Studio gives an outgoing operator, an incoming operator and a supervisor different, enforceable **local demonstration** transitions. It is designed to show what a full operational handoff requires—not just a list of action items.

The default **North District Service Operations** scenario is fictional. It contains six source-linked occurrences: a critical cooling issue, access request, supplier parts lead time, resident notice, routine generator check and an outstanding incident review. No actual incident or worker is asserted.

### Follow a complete handoff

1. Start as **Alex, outgoing operator**. Select an item and read its original source identity, priority, missing proof, current blocker and lease.
2. **Claim work** for thirty minutes. The simulated claim excludes another operator while it is active; an expired claim can be recovered, and the current claimant can renew.
3. Record a source-linked correction or blocker. Critical work cannot be resolved until its blocker has been cleared, an independent reviewer has checked it and the current claimant has supplied a completion source.
4. Select **Prepare handoff** to freeze an exact cut of pending tasks, source references, blockers, proof obligations and reviewer changes.
5. Switch to **Morgan, incoming operator** and explicitly **Acknowledge** that cut. If work changes between preparation and acknowledgement, the stale cut is refused. The supervisor can revoke it so the outgoing shift can prepare a fresh cut.
6. Save the draft in this browser, export a reviewer-friendly Markdown brief, or export a typed YAFF handoff proposal for an authorized native WorkGraph operator.

The page has task search, stage and priority filters; an event journal records who performed each local transition and when. None of the role selections authenticates a real employee or authorizes external dispatch.

### Bring source records

Import a tab-separated file (TSV) with columns `id`, `title`, `priority`, `kind`, `source`, and `detail`. A batch is limited to 120 new tasks and every task must have a distinct identity and an exact source reference. Unsupported sources and repeated IDs are refused rather than silently combined.

The original Shift Handoff page is retained for authorized GitHub-native recording intake. Its GitHub commit/process pipeline is separate from this browser-local editor; preparing a recording does not imply it was transcribed or admitted as a real operational event.

### Where the record goes

Drafts persist using browser-local structured-clone storage, protected by a local compare-and-swap revision. The studio models the same **operator, worker-family, claim/lease, review, handoff and completion-receipt distinctions** as native Bonfÿre WorkGraph.

Actual worker availability, authentication, incident evidence, dispatched effects and finance require the corresponding production owners. Exported browser proposals **do not** enqueue a native mission or assign real staff. The [Incident Postmortem Atlas](https://nickgonzales76017.github.io/pages-postmortem-atlas/) is available for deeper incident review; the outgoing link is a reference, not a performed data import.

### Customer configuration

For an institution, the binding work is to connect your authenticated shift roles, existing source events, escalation policies, source readers and target work system. The demo refuses stale acknowledgement or unverified closure before those systems are connected; it does not substitute local role labels for production authority.

See the [Bonfÿre/Aurekai working application gallery](https://nickgonzales76017.github.io/bonfyre/#experiences) for related experiences.
