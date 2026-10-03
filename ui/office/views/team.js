/* TEAM (#/team): who can sign in to the Dealer Center, their job (owner,
   manager or dealer), which lots a dealer works, and when they were last
   here. People the owner added who haven't made their login yet are listed
   as invites.

   The owner adds people ("Add a person"), changes their job and lots, and
   removes them (they can't sign in after that; their customers stay with
   the lot). After adding someone, the screen shows a short message to send
   them, ready to copy. Managers see the list without the buttons. Dealers
   don't see the team. The server checks every change again, and refuses
   to remove or demote the last owner. */

import { h, clear, icon, button, field, form, dialog, confirmBox, toast, pageHead, emptyState, linkButton, copyText, nextId } from "../dom.js";
import { get, post, patch, del } from "../api.js";
import { ROLES, ROLE_WORDS, ROLE_HINTS, ago, dayWords, initials, plural } from "../words.js";

export async function render(ctx) {
  const { app } = ctx;
  ctx.setTitle("Team");
  if (!app.can("seeTeam")) {
    return h("div", { class: "team" }, pageHead("Team"),
      h("section", { class: "card" }, emptyState("The team list is for owners and managers",
        "Ask the owner when someone needs to be added to your lot or changed.",
        linkButton("Go to Today", "#/", { kind: "primary" }))));
  }
  const owner = app.can("changeTeam");
  const { people, invites } = await get("team");
  const active = people.filter((p) => p.active !== false);
  const removed = people.filter((p) => p.active === false);

  const words = [plural(active.length, "person", "people")];
  if (invites.length) words.push(`${plural(invites.length, "invite")} not used yet`);
  const sub = `${words.join(" · ")}. ${owner ? "Dealers see only the lots you give them." : "Only the owner can add or change people."}`;
  const head = pageHead("Team", sub, owner ? button("Add a person", () => addDialog(ctx), { kind: "primary", icon: "plus" }) : null);

  const peopleCard = h("section", { class: "card flush team-card" },
    h("div", { class: "card-head" }, h("h2", { class: "card-title" }, icon("team"), "People"),
      h("span", { class: "team-count" }, String(active.length))),
    h("div", { class: "team-rows" }, active.map((p) => personRow(ctx, p))),
    removed.length ? [
      h("h3", { class: "team-group" }, "Removed — can't sign in"),
      h("div", { class: "team-rows" }, removed.map((p) => personRow(ctx, p))),
    ] : null);

  const inviteCard = invites.length ? h("section", { class: "card flush team-card" },
    h("div", { class: "card-head" }, h("h2", { class: "card-title" }, icon("mail"), "Invited, not signed in yet"),
      h("span", { class: "team-count" }, String(invites.length))),
    h("p", { class: "team-card-note" }, "They show up under People the first time they sign in with this email."),
    h("div", { class: "team-rows" }, invites.map((i) => inviteRow(ctx, i)))) : null;

  const lonely = owner && active.length === 1 && !invites.length
    ? h("section", { class: "card team-hello" }, icon("customers", "team-hello-icon"),
      h("div", {}, h("h2", {}, "Bring in your team"),
        h("p", {}, "Add your managers and dealers. Each dealer sees only their own lot's customers and orders."),
        button("Add a person", () => addDialog(ctx), { kind: "primary", icon: "plus" })))
    : null;

  return h("div", { class: "team" }, head, h("div", { class: "stack" }, lonely, peopleCard, inviteCard));
}

/* ---- rows ------------------------------------------------------------------- */

/* "an owner", "a manager", "a dealer" -- for the middle of a sentence */
function jobWords(role) {
  return { owner: "an owner", manager: "a manager", dealer: "a dealer" }[role] || "on the team";
}

function roleTag(role) {
  return h("span", { class: ["pill", "plain", "team-role", role] }, ROLE_WORDS[role] || role);
}

function lotWords(app, role, lots) {
  if (role !== "dealer") return "All lots";
  if (!lots?.length) return "No lot yet";
  return lots.map((s) => app.lotName(s)).join(", ");
}

function seenWords(p) {
  if (!p.lastSeenAt) return "Hasn't signed in yet";
  const a = ago(p.lastSeenAt);
  return `Last here ${a === "Yesterday" ? "yesterday" : a}`;
}

function personRow(ctx, p) {
  const { app } = ctx;
  const me = p.userId === app.person?.userId;
  const removed = p.active === false;
  const name = p.name || p.email;
  return h("div", { class: ["team-row", removed && "removed"] },
    h("span", { class: "team-avatar", "aria-hidden": "true" }, initials(name)),
    h("div", { class: "team-who" },
      h("strong", {}, name, me ? h("span", { class: "team-you" }, "You") : null),
      h("a", { href: `mailto:${p.email}` }, p.email)),
    h("div", { class: "team-meta" },
      h("span", { class: "team-role-cell" }, removed ? h("span", { class: ["pill", "plain", "team-role", "gone"] }, "Removed") : roleTag(p.role)),
      h("span", { class: "team-lots" }, icon("lots"), removed ? "No lots" : lotWords(app, p.role, p.lots)),
      h("span", { class: "team-seen" }, icon("clock"), seenWords(p))),
    h("div", { class: "team-act" }, app.can("changeTeam")
      ? button(removed ? "Put back" : "Edit", () => editDialog(ctx, p), { small: true, icon: removed ? "plus" : "edit" }) : null));
}

function inviteRow(ctx, i) {
  const { app } = ctx;
  const name = i.name || i.email;
  return h("div", { class: "team-row invite" },
    h("span", { class: "team-avatar ghost", "aria-hidden": "true" }, initials(name)),
    h("div", { class: "team-who" }, h("strong", {}, name), h("a", { href: `mailto:${i.email}` }, i.email)),
    h("div", { class: "team-meta" },
      h("span", { class: "team-role-cell" }, roleTag(i.role)),
      h("span", { class: "team-lots" }, icon("lots"), lotWords(app, i.role, i.lots)),
      h("span", { class: "team-seen" }, icon("mail"), `Invited ${dayWords(i.invitedAt)} — hasn't signed in yet`)),
    h("div", { class: "team-act" }, app.can("changeTeam") ? [
      button("Copy message", async () => {
        if (await copyText(inviteMessage(app, i.name, i.email))) toast(`Message for ${name} copied. Paste it in a text or email.`);
        else toast("Couldn't copy. Open Add a person again to see the message.", { error: true });
      }, { small: true, icon: "copy" }),
      button("Remove invite", () => removeInvite(ctx, i), { small: true, kind: "quiet", icon: "trash" }),
    ] : null));
}

async function removeInvite(ctx, i) {
  const name = i.name || i.email;
  const yes = await confirmBox(`Remove the invite for ${name}?`,
    `${i.email} can't be used to sign in after this. You can add ${name} again any time.`, { yes: "Remove invite", danger: true });
  if (!yes) return;
  try {
    await del(`team/invites/${i.id}`);
  } catch (e) {
    toast(e.message, { error: true });
    return;
  }
  toast(`Removed the invite for ${name}.`);
  ctx.refresh();
}

/* ---- the message to send a new person ------------------------------------------------ */

function inviteMessage(app, name, email) {
  const first = String(name || "").trim().split(/\s+/)[0];
  const business = app.business?.name || "our";
  return `Hi${first ? ` ${first}` : ""} — I added you to the ${business} Dealer Center. Go to ${location.origin}/dealer, tap “Make your login” and use ${email}.`;
}

/* ---- picking a job and lots (shared by both pop-ups) ---------------------------------- */

function jobPicker(current, onChange) {
  const group = nextId("job");
  const inputs = [];
  const el = h("fieldset", { class: "team-jobs" }, h("legend", {}, "Job"),
    h("div", { class: "team-job-list" }, ROLES.map(([key, label]) => {
      const input = h("input", { type: "radio", name: group, value: key, checked: key === current, onchange: () => onChange(key) });
      inputs.push(input);
      return h("label", { class: "team-job" }, input,
        h("span", { class: "team-job-words" }, h("strong", {}, label), h("small", {}, ROLE_HINTS[key])));
    })));
  return { el, value: () => inputs.find((i) => i.checked)?.value || current };
}

function lotPicker(app, chosen) {
  const boxes = app.lots.map((l) => {
    const input = h("input", { type: "checkbox", value: l.slug, checked: chosen.includes(l.slug) });
    return { input, wrap: h("label", { class: "team-lot" }, input, h("span", {}, l.name, l.active === false ? h("small", {}, " (closed)") : null)) };
  });
  const allNote = h("p", { class: "team-all-lots" }, icon("lots"), "Owners and managers see every lot.");
  const list = h("fieldset", { class: "team-lots-pick" }, h("legend", {}, "Lots they work"),
    boxes.length ? h("div", { class: "team-lot-list" }, boxes.map((b) => b.wrap))
      : h("p", { class: "hint" }, "Add a lot first on the Lots page, then give it dealers."));
  const el = h("div", {}, list, allNote);
  return {
    el,
    show(role) { list.hidden = role !== "dealer"; allNote.hidden = role === "dealer"; },
    value: () => boxes.filter((b) => b.input.checked).map((b) => b.input.value),
  };
}

/* ---- add a person -------------------------------------------------------------------------- */

function addDialog(ctx) {
  const { app } = ctx;
  const name = field("Name", { required: true, maxLength: 80, autocomplete: "off", placeholder: "Maria Lopez" });
  const email = field("Email", { type: "email", required: true, maxLength: 200, autocomplete: "off", placeholder: "maria@example.com",
    hint: "They sign in with this email." });
  email.input.setAttribute("autocapitalize", "off");
  const openLots = app.lots.filter((l) => l.active !== false);
  const lots = lotPicker(app, openLots.length === 1 ? [openLots[0].slug] : []);
  const job = jobPicker("dealer", (role) => lots.show(role));
  lots.show("dealer");
  const sendIt = app.me?.emailOn ? h("label", { class: "check" }, h("input", { type: "checkbox", checked: true }),
    h("span", {}, "Email them the invite", h("small", { class: "hint" }, "You also get a message to copy and send yourself."))) : null;

  const body = h("div", { class: "team-dialog" });
  let added = false;
  const box = dialog("Add a person", body, { wide: true, onClose: () => { if (added) ctx.refresh(); } });
  clear(body, form([
    h("div", { class: "form-grid" }, name.wrap, email.wrap),
    job.el,
    lots.el,
    sendIt,
    h("div", { class: "actions end" },
      button("Cancel", () => box.close()),
      h("button", { type: "submit", class: "btn btn-primary" }, icon("plus"), h("span", {}, "Add person"))),
  ], async () => {
    const role = job.value();
    const picked = role === "dealer" ? lots.value() : [];
    if (role === "dealer" && !picked.length) throw new Error("Pick at least one lot for a dealer.");
    const who = { name: name.input.value.trim(), email: email.input.value.trim().toLowerCase() };
    const out = await post("team", { ...who, role, lots: picked, sendEmail: !!sendIt?.querySelector("input").checked });
    await app.loadMe().catch(() => null);
    added = true;
    if (out.person) {
      box.close();
      toast(`${out.person.name || who.name} already had a login, so they're ${jobWords(role)} now.`);
      return;
    }
    showMessage(ctx, box, body, who, out.emailed);
  }));
  name.input.focus();
}

/* After adding: the message to send them, ready to copy. */
function showMessage(ctx, box, body, who, emailed) {
  const { app } = ctx;
  const message = inviteMessage(app, who.name, who.email);
  const words = h("textarea", { class: "team-message", readonly: true, rows: 4 });
  words.value = message;
  box.el.querySelector(".dialog-head h2").textContent = `${who.name} is added`;
  const subject = `Your login for the ${app.business?.name || ""} Dealer Center`.replace(/\s+/g, " ");
  const mail = `mailto:${encodeURIComponent(who.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  clear(body,
    h("div", { class: "team-added" }, h("span", { class: "team-added-mark" }, icon("check")),
      h("p", {}, emailed
        ? `We emailed the invite to ${who.email}. You can also send them this message:`
        : `Send ${who.name.split(/\s+/)[0]} this message so they know where to go:`)),
    words,
    app.me?.signIn === "local"
      ? h("p", { class: "team-local-note" }, icon("star"), `On this computer there are no passwords: sign out and pick ${who.name} from the list to see what they see.`)
      : null,
    h("div", { class: "actions end" },
      h("a", { class: "btn btn-ghost", href: mail }, icon("mail"), h("span", {}, "Email it")),
      button("Copy message", async () => {
        if (await copyText(message)) toast("Message copied. Paste it in a text or email.");
        else { words.select(); toast("Couldn't copy. Press and hold the message to copy it.", { error: true }); }
      }, { icon: "copy" }),
      button("Done", () => box.close(), { kind: "primary" })));
}

/* ---- change a person ------------------------------------------------------------------------- */

function editDialog(ctx, p) {
  const { app } = ctx;
  const me = p.userId === app.person?.userId;
  const removed = p.active === false;
  const nm = p.name || p.email;
  const name = field("Name", { required: true, maxLength: 80, value: p.name || "", autocomplete: "off" });
  const lots = lotPicker(app, p.lots || []);
  const job = jobPicker(p.role, (role) => lots.show(role));
  lots.show(p.role);
  const status = h("p", { class: "form-status error", role: "alert" });
  /* the server refuses this too; saying it here saves a trip */
  const lastOwner = p.role === "owner" && !removed
    && !(app.me?.team || []).some((x) => x.role === "owner" && x.active !== false && x.userId !== p.userId);
  const LAST_OWNER = "Every business needs at least one owner. Make someone else an owner first.";

  const after = async (words) => {
    await app.loadMe().catch(() => null);
    toast(words);
    if (me) { location.reload(); return; }
    ctx.refresh();
  };

  const setActive = async (activeNow) => {
    status.textContent = "";
    if (!activeNow && lastOwner) { status.textContent = LAST_OWNER; return; }
    if (!activeNow) {
      const yes = await confirmBox(`Remove ${nm} from the team?`,
        `${nm} can't sign in after this. Their customers and orders stay with the lot.`, { yes: "Remove from team", danger: true });
      if (!yes) return;
    }
    try {
      await patch(`team/${p.userId}`, { active: activeNow });
    } catch (e) {
      status.textContent = e.message;
      return;
    }
    box.close();
    await after(activeNow ? `${nm} is back on the team.` : `${nm} is off the team. Their customers stay with the lot.`);
  };

  const box = dialog(removed ? `Put ${nm} back on the team` : `Edit ${nm}`, form([
    h("p", { class: "team-dialog-email" }, icon("mail"), p.email),
    h("div", { class: "form-grid" }, name.wrap),
    job.el,
    lots.el,
    me ? h("p", { class: "hint" }, "This is you. If you stop being an owner, you can't change prices, lots or people anymore.") : null,
    h("div", { class: "actions end" },
      button("Cancel", () => box.close()),
      h("button", { type: "submit", class: "btn btn-primary" }, icon("check"), h("span", {}, removed ? "Save and put back" : "Save changes"))),
    h("div", { class: "team-danger" },
      removed
        ? h("p", { class: "hint" }, `${nm} can't sign in right now.`)
        : [h("div", {}, h("strong", {}, "Remove from team"), h("p", { class: "hint" }, `${nm} can't sign in after this. Their customers and orders stay.`)),
          button("Remove from team", () => setActive(false), { kind: "danger", small: true, icon: "trash" })],
      status),
  ], async () => {
    const role = job.value();
    const picked = role === "dealer" ? lots.value() : [];
    if (lastOwner && role !== "owner") throw new Error(LAST_OWNER);
    if (role === "dealer" && !picked.length) throw new Error("Pick at least one lot for a dealer.");
    const body = { name: name.input.value.trim(), role, lots: picked };
    if (removed) body.active = true;
    const out = await patch(`team/${p.userId}`, body);
    box.close();
    const changedJob = out.person.role !== p.role;
    await after(removed ? `${out.person.name || nm} is back on the team.`
      : changedJob ? `${out.person.name || nm} is ${jobWords(out.person.role)} now.` : `Saved ${out.person.name || nm}.`);
  }), { wide: true });
}
