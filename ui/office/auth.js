/* SIGNING IN.

   On the live site this is Netlify Identity: an email and a password, a
   "Make your login" form for people the owner added, "Forgot your
   password?", and the links in Netlify's emails (confirm, invite, reset)
   which land on this page with a token after the #.

   On the local Dealer Center (npm run office) there are no passwords: pick
   who you are from the sample team. */

import { h, clear, button, field, form, icon } from "./dom.js";
import { identity } from "./api.js";
import { ROLE_WORDS } from "./words.js";

function frame(root, title, intro, ...body) {
  clear(root, h("main", { class: "auth" },
    h("div", { class: "auth-card" },
      h("div", { class: "auth-mark" }, icon("shed")),
      h("h1", {}, title),
      intro ? h("p", { class: "auth-intro" }, intro) : null,
      body)));
  root.querySelector("input")?.focus();
}

/* Links in Netlify's emails: #confirmation_token=, #invite_token=,
   #recovery_token=. Returns what happened, or null. */
export async function handleEmailLink(root) {
  if (!/(confirmation|invite|recovery|email_change)_token=/.test(location.hash)) return null;
  let result = null;
  try {
    result = await identity.handleAuthCallback();
  } catch {
    history.replaceState(null, "", location.pathname);
    return { message: "That link has expired or was already used. Sign in, or ask for a new link." };
  }
  history.replaceState(null, "", location.pathname);
  if (result?.type === "invite") {
    await new Promise((done) => setPassword(root, "Welcome! Choose a password", "You'll use your email and this password to sign in.",
      async (password) => { await identity.acceptInvite(result.token, password); done(); }));
    return { message: null };
  }
  if (result?.type === "recovery") {
    await new Promise((done) => setPassword(root, "Choose a new password", "Then you're signed in.",
      async (password) => { await identity.updateUser({ password }); done(); }));
    return { message: null };
  }
  return { message: result?.type === "confirmation" ? "Your email is confirmed." : null };
}

function setPassword(root, title, intro, save) {
  const p1 = field("Password", { type: "password", required: true, minLength: 10, autocomplete: "new-password", hint: "At least 10 characters." });
  const p2 = field("Type it again", { type: "password", required: true, minLength: 10, autocomplete: "new-password" });
  frame(root, title, intro, form([p1.wrap, p2.wrap, h("button", { class: "btn btn-primary btn-block", type: "submit" }, "Save password")], async () => {
    if (p1.input.value !== p2.input.value) throw new Error("The two passwords are different.");
    await save(p1.input.value);
  }));
}

/* The sign-in screen. mode: "netlify" | "local". */
export function signInScreen(root, { mode, business, note }) {
  if (mode === "local") return localPicker(root, { business, note });
  const name = business?.name;
  let view = "in";
  const draw = () => {
    if (view === "in") {
      const email = field("Email", { type: "email", required: true, autocomplete: "email" });
      const password = field("Password", { type: "password", required: true, autocomplete: "current-password" });
      frame(root, "Sign in", name ? `The Dealer Center for ${name}.` : "The Dealer Center.",
        note ? h("p", { class: "auth-note" }, note) : null,
        form([email.wrap, password.wrap, h("button", { class: "btn btn-primary btn-block", type: "submit" }, "Sign in")], async () => {
          try {
            await identity.login(email.input.value.trim(), password.input.value);
          } catch (e) {
            throw new Error(/confirm/i.test(e.message || "") ? "Confirm your email first: open the link we emailed you." : "That email and password don't match. Try again, or reset your password.");
          }
          location.reload();
        }),
        h("div", { class: "auth-links" },
          button("Make your login", () => { view = "up"; draw(); }, { kind: "link" }),
          button("Forgot your password?", () => { view = "forgot"; draw(); }, { kind: "link" })));
    } else if (view === "up") {
      const nm = field("Your name", { required: true, autocomplete: "name" });
      const email = field("Email", { type: "email", required: true, autocomplete: "email", hint: "Use the email the owner added to the team." });
      const password = field("Password", { type: "password", required: true, minLength: 10, autocomplete: "new-password", hint: "At least 10 characters." });
      frame(root, "Make your login", "For people the owner added to the team.",
        form([nm.wrap, email.wrap, password.wrap, h("button", { class: "btn btn-primary btn-block", type: "submit" }, "Make my login")], async () => {
          try {
            await identity.signup(email.input.value.trim(), password.input.value, { full_name: nm.input.value.trim() });
          } catch (e) {
            if (/not allowed|disabled/i.test(e.message || "")) throw new Error("New logins are by invitation here. Ask the owner to send you an invite.");
            if (/already/i.test(e.message || "")) throw new Error("There is already a login for that email. Sign in, or reset the password.");
            throw new Error("We couldn't make that login. Check the email and try again.");
          }
          view = "check";
          draw();
        }),
        h("div", { class: "auth-links" }, button("Back to sign in", () => { view = "in"; draw(); }, { kind: "link" })));
    } else if (view === "check") {
      frame(root, "Check your email", "We sent you a link. Open it to confirm your email, then you're in.",
        h("div", { class: "auth-links" }, button("Back to sign in", () => { view = "in"; draw(); }, { kind: "link" })));
    } else if (view === "forgot") {
      const email = field("Email", { type: "email", required: true, autocomplete: "email" });
      frame(root, "Reset your password", "We'll email you a link to choose a new one.",
        form([email.wrap, h("button", { class: "btn btn-primary btn-block", type: "submit" }, "Email me a link")], async () => {
          try { await identity.requestPasswordRecovery(email.input.value.trim()); } catch { /* same answer either way */ }
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
  frame(root, "Who are you?", `This is the Dealer Center on your computer${business ? ` for ${business.name}` : ""}. No passwords here — pick a person.`,
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
