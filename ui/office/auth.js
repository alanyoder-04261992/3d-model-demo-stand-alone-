/* SIGNING IN.

   On the live site this is Netlify Identity: an email and a password, a
   "Make your login" form for people the owner added, "Forgot your
   password?", and the links in Netlify's emails (confirm, invite, reset)
   which land on this page with a token after the #. The password goes only
   to Identity (identity.js); the sign-in it gives is handed at once to the
   Dealer Center's server, which keeps it in its own cookie (api.js
   startSession, server/office/session.js).

   "Keep me signed in on this device for 30 days" is under the password on
   every form that signs somebody in (Sign in, Make your login, the invite
   and reset links). It starts unticked every time: a lot computer is
   shared. Ticked, the sign-in lasts 30 days on this device, closing the
   browser or not; unticked, until the browser closes. The tick on "Make
   your login" is kept in this browser only until the email's link opens
   here (two days at most), since that link is where the sign-in happens.

   On the local Dealer Center (npm run office) there are no passwords: pick
   who you are from the sample team (no tick there, nor in the "try it"
   demo, nor on a Barnwright visit).

   On Alan's learning preview and his demo site the sign-in also opens the
   "try it" demo: leave both boxes empty and tap Sign in. A client build
   leaves that out (the build sets __DEALER_DEMO__ to false, see
   tools/build-site.mjs). */

import { h, clear, button, field, form, icon, checkbox } from "./dom.js";
import { startSession, tellOtherTabs } from "./api.js";
import { passwordSignIn, signup, recover, verify, setPassword as saveNewPassword, emailOf, SIGN_IN_WORDS } from "./identity.js";
import { ROLE_WORDS } from "./words.js";

export const KEEP_WORDS = "Keep me signed in on this device for 30 days";
export const KEEP_HINT = "Leave it off on a computer other people use.";

/* The tick, unticked. */
function keepBox() {
  const box = checkbox(KEEP_WORDS, false, { hint: KEEP_HINT });
  box.wrap.classList.add("keep");
  box.input.name = "keep";
  return box;
}

/* The tick on "Make your login", until its email link opens in this browser. */
const KEEP_AFTER_LINK = "dealer-center:keep-after-link";
function rememberKeep(on) {
  try {
    if (on) localStorage.setItem(KEEP_AFTER_LINK, String(Date.now() + 2 * 86400000));
    else localStorage.removeItem(KEEP_AFTER_LINK);
  } catch { /* storage blocked: the link signs in until the browser closes */ }
}
function takeKeep() {
  try {
    const until = Number(localStorage.getItem(KEEP_AFTER_LINK));
    localStorage.removeItem(KEEP_AFTER_LINK);
    return until > Date.now();
  } catch { return false; }
}

/* Why the last sign-in on this device ended (the server's {ended, kept}). */
export function endedWords(ended, kept) {
  if (ended === "time") return kept ? "You were kept signed in on this device for 30 days. Sign in again." : "Your sign-in ran out after 30 days. Sign in again.";
  if (ended === "password") return "Your password was changed. Sign in with the new one.";
  if (ended === "everywhere") return "You signed out on every device. Sign in again.";
  if (ended === "identity") return "You were signed out. Sign in again.";
  return null;
}

function frame(root, title, intro, ...body) {
  clear(root, h("main", { class: "auth" },
    h("div", { class: "auth-card" },
      h("div", { class: "auth-mark" }, icon("shed")),
      h("h1", {}, title),
      intro ? h("p", { class: "auth-intro" }, intro) : null,
      body)));
  root.querySelector("input:not([readonly])")?.focus();
}

/* Links in Netlify's emails: #confirmation_token=, #invite_token=,
   #recovery_token=. The token leaves the address at once. Returns
   {message, warn} (words for the next screen; warn when the link didn't
   work) when it was one, or null. */
export async function handleEmailLink(root) {
  /* a link Identity itself turned down (it ran out, or was used) */
  if (/(?:^#|&)error_description=/.test(location.hash)) {
    history.replaceState(null, "", location.pathname + location.search);
    return { message: SIGN_IN_WORDS.used, warn: true };
  }
  const m = /^#(confirmation|invite|recovery|email_change)_token=([^&]+)/.exec(location.hash);
  if (!m) return null;
  history.replaceState(null, "", location.pathname + location.search);
  const [, kind, raw] = m;
  let token = raw;
  try { token = decodeURIComponent(raw); } catch { /* as it came */ }
  const failed = (e) => ({ message: e?.kind === "down" || e?.kind === "busy" ? e.message : SIGN_IN_WORDS.used, warn: true });

  if (kind === "email_change") return { message: "That link can't be used here. Sign in with your email and password.", warn: true };
  if (kind === "confirmation") {
    let tokens;
    try { tokens = await verify("signup", token); } catch (e) { return failed(e); }
    try { await startSession(tokens.refresh, { keep: takeKeep() }); } catch (e) { return { message: e.message, warn: true }; }
    tellOtherTabs("in");
    return { message: "Your email is confirmed." };
  }
  if (kind === "invite") {
    let tokens = null;
    await new Promise((done) => choosePassword(root, {
      title: "Welcome! Choose a password", intro: "You'll use your email and this password to sign in.",
      save: async (password, keep) => {
        if (!tokens) tokens = await verify("signup", token, password);
        await startSession(tokens.refresh, { keep });
        done();
      },
    }));
    tellOtherTabs("in");
    return { message: null };
  }
  /* a reset link: the new password, then signed in -- and signed out on
     every other device */
  let tokens;
  try { tokens = await verify("recovery", token); } catch (e) { return failed(e); }
  const email = await emailOf(tokens.access);
  await new Promise((done) => choosePassword(root, {
    title: "Choose a new password", intro: "Then you're signed in.", email,
    save: async (password, keep) => {
      await saveNewPassword(tokens.access, password);
      await startSession(tokens.refresh, { keep, why: "reset" });
      done();
    },
  }));
  tellOtherTabs("in");
  return { message: "Your new password is saved." };
}

/* A new password, typed twice, and the tick. The email (when known) shows
   above it, so the browser saves the new password with the right email. */
function choosePassword(root, { title, intro, email, save }) {
  const who = email ? field("Email", { type: "email", value: email, readOnly: true, autocomplete: "username" }) : null;
  const p1 = field("Password", { type: "password", required: true, minLength: 10, autocomplete: "new-password", hint: "At least 10 characters." });
  const p2 = field("Type it again", { type: "password", required: true, minLength: 10, autocomplete: "new-password" });
  const keep = keepBox();
  frame(root, title, intro, form([who?.wrap, p1.wrap, p2.wrap, keep.wrap, h("button", { class: "btn btn-primary btn-block", type: "submit" }, "Save password")], async () => {
    if (p1.input.value !== p2.input.value) throw new Error("The two passwords are different.");
    await save(p1.input.value, keep.input.checked);
  }));
}

/* The sign-in screen. mode: "netlify" | "local". note: words in green
   (Your email is confirmed); ended: plain words above the boxes (why the
   last sign-in ended, or that an email's link didn't work). */
export function signInScreen(root, { mode, business, note, ended }) {
  if (mode === "local") return localPicker(root, { business, note });
  const name = business?.name;
  let view = "in";
  let kept = false;
  const draw = () => {
    if (view === "in") {
      const email = field("Email", { type: "email", required: !__DEALER_DEMO__, autocomplete: "username", inputmode: "email" });
      const password = field("Password", { type: "password", required: !__DEALER_DEMO__, autocomplete: "current-password" });
      const keep = keepBox();
      frame(root, "Sign in", name ? `The Dealer Center for ${name}.` : "The Dealer Center.",
        ended ? h("p", { class: "auth-note info", role: "status" }, ended) : null,
        note ? h("p", { class: "auth-note" }, note) : null,
        form([email.wrap, password.wrap, keep.wrap, h("button", { class: "btn btn-primary btn-block", type: "submit" }, "Sign in"),
          __DEALER_DEMO__ ? h("p", { class: "hint" }, "Leave both boxes empty and tap Sign in to try a made-up shed business.") : null], async () => {
          if (__DEALER_DEMO__) {
            const typed = [email.input.value.trim(), password.input.value].filter(Boolean).length;
            if (typed === 0) { location.assign("/dealer?demo"); return; }
            if (typed === 1) throw new Error("Type your email and your password, or leave both empty to try the demo.");
          }
          const refresh = await passwordSignIn(email.input.value, password.input.value);
          await startSession(refresh, { keep: keep.input.checked });
          tellOtherTabs("in");
          location.reload();
          return "Opening the Dealer Center…";
        }),
        h("div", { class: "auth-links" },
          button("Make your login", () => { view = "up"; draw(); }, { kind: "link" }),
          button("Forgot your password?", () => { view = "forgot"; draw(); }, { kind: "link" })));
    } else if (view === "up") {
      const nm = field("Your name", { required: true, autocomplete: "name" });
      const email = field("Email", { type: "email", required: true, autocomplete: "username", inputmode: "email", hint: "Use the email the owner added to the team." });
      const password = field("Password", { type: "password", required: true, minLength: 10, autocomplete: "new-password", hint: "At least 10 characters." });
      const keep = keepBox();
      frame(root, "Make your login", "For people the owner added to the team.",
        form([nm.wrap, email.wrap, password.wrap, keep.wrap, h("button", { class: "btn btn-primary btn-block", type: "submit" }, "Make my login")], async () => {
          await signup(email.input.value, password.input.value, nm.input.value.trim());
          kept = keep.input.checked;
          rememberKeep(kept);
          view = "check";
          draw();
        }),
        h("div", { class: "auth-links" }, button("Back to sign in", () => { view = "in"; draw(); }, { kind: "link" })));
    } else if (view === "check") {
      frame(root, "Check your email", `We sent you a link. Open it to confirm your email, then you're in.${kept ? " Open it in this browser to stay signed in for 30 days." : ""}`,
        h("div", { class: "auth-links" }, button("Back to sign in", () => { view = "in"; draw(); }, { kind: "link" })));
    } else if (view === "forgot") {
      const email = field("Email", { type: "email", required: true, autocomplete: "username", inputmode: "email" });
      frame(root, "Reset your password", "We'll email you a link to choose a new one.",
        form([email.wrap, h("button", { class: "btn btn-primary btn-block", type: "submit" }, "Email me a link")], async () => {
          await recover(email.input.value);
          return "If that email has a login, the link is on its way.";
        }),
        h("div", { class: "auth-links" }, button("Back to sign in", () => { view = "in"; draw(); }, { kind: "link" })));
    }
  };
  draw();
}

async function localPicker(root, { business, note }) {
  let people = [];
  let ownerEmail = "";
  try {
    const data = await (await fetch("/__local/people", { cache: "no-store" })).json();
    people = data.people || [];
    ownerEmail = data.ownerEmail || "";
  } catch { /* the list stays empty */ }
  const signInAs = async (email) => {
    const r = await fetch("/__local/sign-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "That didn't work.");
    location.reload();
  };
  const other = field("Or sign in with another email", { type: "email", placeholder: ownerEmail || "name@example.com" });
  const demo = __DEALER_DEMO__ && new URLSearchParams(location.search).has("demo");
  frame(root, demo ? "Try the Dealer Center" : "Who are you?",
    demo ? "A made-up shed business with three lots and thirty customers. Pick who you want to be — the owner sees everything, a dealer sees only their lot."
      : `This is the Dealer Center on your computer${business ? ` for ${business.name}` : ""}. No passwords here — pick a person.`,
    note ? h("p", { class: "auth-note" }, note) : null,
    h("div", { class: "people-pick" }, people.map((p) => h("button", {
      type: "button", class: "person-pick", onclick: () => signInAs(p.email),
    }, h("strong", {}, p.name || p.email), h("span", {}, `${ROLE_WORDS[p.role] || p.role}${p.invited ? " · invited" : ""}`)))),
    form([other.wrap, h("button", { class: "btn btn-ghost btn-block", type: "submit" }, "Sign in")], async () => {
      await signInAs(other.input.value.trim());
    }));
}

/* Signed in, but nobody added this email to the team. */
export function notOnTeam(root, { email, signOut }) {
  frame(root, "You're not on the team yet", `You're signed in as ${email}. Ask the owner to add this email to the team, then tap Check again.`,
    h("div", { class: "actions center" },
      button("Check again", () => location.reload(), { kind: "primary" }),
      button("Sign out", signOut)));
}
