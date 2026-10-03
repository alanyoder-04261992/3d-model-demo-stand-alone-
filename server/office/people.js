/* WHO IS ASKING, AND WHAT THEY MAY DO.

   Sign-in is Netlify Identity. A login on its own sees nothing: a person
   needs a record at people/<their Identity id>, and only an owner can make
   one -- by adding the person's email to the team (an invite). The first
   time somebody signs in with a confirmed email that has an invite, the
   invite becomes their person record.

   Invites and the first-owner claim only count when Identity really checked
   the email (see identity.js: "autoconfirm" turns that off).

   The very first owner is named by the OWNER_EMAIL setting. The first
   confirmed sign-in with that email claims the business once (the "setup"
   record); after that the setting can change and nothing happens.

   Roles: owner (everything), manager (every lot's customers and orders),
   dealer (their own lots' customers and orders). */

import { sha256Hex } from "./hash.js";
import { fail, text, email as emailField, oneOf, bool } from "./http.js";

export const ROLES = ["owner", "manager", "dealer"];
export const ROLE_WORDS = { owner: "Owner", manager: "Manager", dealer: "Dealer" };

export function emailKey(address) {
  return sha256Hex(String(address).trim().toLowerCase()).slice(0, 40);
}

/* A login counts only when Identity confirmed its email. Roles or anything
   else a person could edit on their own Identity profile are never read. */
export function confirmed(user) {
  return !!(user && typeof user.id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(user.id)
    && typeof user.email === "string" && user.email.includes("@")
    && user.confirmedAt && Number.isFinite(Date.parse(user.confirmedAt)));
}

export function publicPerson(p) {
  return { userId: p.userId, email: p.email, name: p.name || "", role: p.role, lots: p.lots || [],
    active: p.active !== false, addedAt: p.addedAt || null, lastSeenAt: p.lastSeenAt || null };
}

export function createPeople({ store, identityUser, ownerEmail = "", now }) {
  const iso = () => now().toISOString();

  /* -> {user, person|null}. Throws 401 without a confirmed login. */
  async function whoIsAsking(request) {
    let user = null;
    try { user = await identityUser(request); } catch { user = null; }
    if (!confirmed(user)) fail(401, "Please sign in.");
    const address = user.email.trim().toLowerCase();
    const display = { id: user.id, email: address, name: user.name || user.userMetadata?.full_name || "" };

    let person = await store.get(`people/${user.id}`);
    /* invites and the first-owner claim need an email Identity really checked */
    const checked = user.emailVerified !== false;
    if (!person && checked) person = await claimInvite(display);
    if (!person && checked) person = await claimFirstOwner(display);
    if (person && person.active === false) person = null;
    if (person) person = await noteVisit(person);
    return { user: display, person };
  }

  async function claimInvite(user) {
    const key = `invites/${emailKey(user.email)}`;
    const invite = await store.get(key);
    if (!invite || invite.email !== user.email) return null;
    const person = {
      userId: user.id, email: user.email, name: invite.name || user.name || "",
      role: invite.role, lots: invite.lots || [], active: true,
      addedAt: invite.invitedAt, addedBy: invite.invitedBy || null, joinedAt: iso(),
    };
    if (await store.create(`people/${user.id}`, person)) await store.remove(key);
    return store.get(`people/${user.id}`);
  }

  async function claimFirstOwner(user) {
    const wanted = String(ownerEmail || "").trim().toLowerCase();
    if (!wanted || wanted !== user.email) return null;
    await store.create("setup", { userId: user.id, email: user.email, at: iso() });
    const claim = await store.get("setup");
    if (claim?.userId !== user.id) return null;
    await store.create(`people/${user.id}`, {
      userId: user.id, email: user.email, name: user.name || "", role: "owner", lots: [], active: true,
      addedAt: iso(), addedBy: null, firstOwner: true,
    });
    return store.get(`people/${user.id}`);
  }

  /* Remember the last visit, at most once an hour (it is shown on the team page). */
  async function noteVisit(person) {
    const last = Date.parse(person.lastSeenAt || 0) || 0;
    if (now().getTime() - last < 3600000) return person;
    const at = iso();
    return (await store.change(`people/${person.userId}`, (p) => { if (p) p.lastSeenAt = at; })) || person;
  }

  /* -> {user, person}. Throws unless the person has access. */
  async function member(request) {
    const who = await whoIsAsking(request);
    if (!who.person) fail(403, `You're not on the team yet. Ask the owner to add ${who.user.email}.`);
    return who;
  }

  return { whoIsAsking, member };
}

/* ---------------------------------------------------------------------- */
/* What each role may do. Every route asks one of these.                  */

export const can = {
  seeAllLots: (p) => p.role === "owner" || p.role === "manager",
  seeLot: (p, slug) => p.role === "owner" || p.role === "manager" || (p.lots || []).includes(slug),
  changePrices: (p) => p.role === "owner",
  changeLots: (p) => p.role === "owner",
  changeTeam: (p) => p.role === "owner",
  seeTeam: (p) => p.role === "owner" || p.role === "manager",
  moveCustomers: (p) => p.role === "owner" || p.role === "manager",
  exportCustomers: (p) => p.role === "owner" || p.role === "manager",
  changeSettings: (p) => p.role === "owner",
};

export function must(allowed, message = "Only the owner can do that.") {
  if (!allowed) fail(403, message);
}

/* ---------------------------------------------------------------------- */
/* The team page: adding, changing and removing people.                   */

export function createTeam({ store, now, lotExists, sendInvite, log = console.error }) {
  const iso = () => now().toISOString();

  async function list() {
    const people = (await store.all("people/")).map(publicPerson);
    const invites = (await store.all("invites/")).map((i) => ({ ...i, id: emailKey(i.email) }));
    people.sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || (a.name || a.email).localeCompare(b.name || b.email));
    invites.sort((a, b) => a.email.localeCompare(b.email));
    return { people, invites };
  }

  async function checkLots(role, lots) {
    if (!Array.isArray(lots) || lots.length > 50) fail(422, "Pick the lots from the list.");
    const clean = [...new Set(lots.map((s) => text(s, 60, "Lot")))];
    for (const slug of clean) if (!(await lotExists(slug))) fail(422, "One of those lots does not exist.");
    if (role === "dealer" && !clean.length) fail(422, "Pick at least one lot for a dealer.");
    return role === "dealer" ? clean : [];
  }

  async function activeOwners(exceptId) {
    return (await store.all("people/")).filter((p) => p.role === "owner" && p.active !== false && p.userId !== exceptId);
  }

  /* Change a person's record. The routes check "is somebody else still an
     owner?" before calling this, but two owners demoting each other at the
     same moment could both pass that check. So when this change took an
     owner away, it looks again afterwards; if no active owner is left, it
     puts the person back as they were and says why. */
  async function setPerson(by, userId, fields) {
    let before = null;
    const person = await store.change(`people/${userId}`, (p) => {
      if (!p) fail(404, "That person is not on the team.");
      before = { name: p.name, role: p.role, lots: p.lots, active: p.active };
      Object.assign(p, fields, { changedAt: iso(), changedBy: by.userId });
    });
    const wasOwner = before.role === "owner" && before.active !== false;
    const stillOwner = person.role === "owner" && person.active !== false;
    if (wasOwner && !stillOwner && !(await activeOwners(userId)).length) {
      await store.change(`people/${userId}`, (p) => { if (p) Object.assign(p, before); });
      fail(422, "Every business needs at least one owner.");
    }
    return person;
  }

  /* Add someone by email. If they already have access, change them instead. */
  async function add(by, data) {
    const address = emailField(data.email, "Email", true);
    const name = text(data.name, 80, "Name", { required: true });
    const role = oneOf(data.role, ROLES, "Pick a role: owner, manager or dealer.");
    const lots = await checkLots(role, data.lots || []);

    const existing = (await store.all("people/")).find((p) => p.email === address);
    if (existing) {
      if (existing.role === "owner" && role !== "owner" && !(await activeOwners(existing.userId)).length) {
        fail(422, "Every business needs at least one owner.");
      }
      const person = await setPerson(by, existing.userId, { name, role, lots, active: true });
      return { person: publicPerson(person), invite: null, emailed: false };
    }

    const invite = { email: address, name, role, lots, invitedAt: iso(), invitedBy: by.userId, invitedByName: by.name || by.email };
    await store.put(`invites/${emailKey(address)}`, invite);
    /* The invite is saved either way; an email that cannot be sent (the
       email service is down) only means the owner passes the message on
       themselves, so it never turns the whole add into an error. */
    let emailed = false;
    if (sendInvite && data.sendEmail === true) {
      try {
        emailed = (await sendInvite(invite)) === true;
      } catch (e) {
        log("The invite email could not be sent:", e);
      }
    }
    return { person: null, invite: { ...invite, id: emailKey(address) }, emailed };
  }

  async function change(by, userId, data) {
    if (typeof userId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(userId)) fail(404, "That person is not on the team.");
    const current = await store.get(`people/${userId}`);
    if (!current) fail(404, "That person is not on the team.");
    const role = data.role != null ? oneOf(data.role, ROLES, "Pick a role: owner, manager or dealer.") : current.role;
    const active = data.active != null ? bool(data.active, "Can sign in") : current.active !== false;
    const lots = data.lots != null || role !== current.role ? await checkLots(role, data.lots ?? current.lots ?? []) : current.lots;
    const name = data.name != null ? text(data.name, 80, "Name", { required: true }) : current.name;
    const stopsBeingOwner = current.role === "owner" && current.active !== false && (role !== "owner" || !active);
    if (stopsBeingOwner && !(await activeOwners(userId)).length) fail(422, "Every business needs at least one owner.");
    const person = await setPerson(by, userId, { name, role, lots, active });
    return { person: publicPerson(person) };
  }

  async function cancelInvite(id) {
    if (typeof id !== "string" || !/^[a-f0-9]{40}$/.test(id)) fail(404, "That invite is gone.");
    if (!(await store.get(`invites/${id}`))) fail(404, "That invite is gone.");
    await store.remove(`invites/${id}`);
    return { ok: true };
  }

  return { list, add, change, cancelInvite };
}
