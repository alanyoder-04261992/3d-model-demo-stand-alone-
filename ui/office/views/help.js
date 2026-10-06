/* HELP (#/help, everybody; the Help button at the top and the menu open it).

     Short answers   the questions people ask most, with a search box
                     (help-answers.js). They work everywhere, the "try it"
                     demo too.
     Ask Barnwright  a box and Send. The question goes straight to
                     Barnwright (server/office/help.js) with the screen the
                     person came from and a few technical details -- the
                     version, the account and recent errors, never
                     customers or prices -- and the answer comes back here
                     and by email.
     Your questions  each question, waiting or answered, with Barnwright's
                     answers, newest first. The owner and managers see the
                     whole team's; a dealer sees their own.

   A Dealer Center that isn't connected to Barnwright (Alan's own business,
   this computer, the demo) shows its answers and, instead of the box, one
   line with the email to write to. The server says which in GET me (so the
   box shows at once) and again in GET help (the control room refusing this
   Dealer Center's key turns the box into that line). */

import { h, clear, icon, button, field, form, pageHead, loading } from "../dom.js";
import { get, post } from "../api.js";
import { when, plural } from "../words.js";
import { HELP_SCREEN, SUPPORT_EMAIL, answersFor, findAnswers } from "../help-answers.js";
import { recentProblems, screenOf } from "../../problems.js";

/* which screen a page is, in the menu's words */
const SCREENS = [
  [/^#\/?$/, "Today"], [/^#\/customers\/:id/, "a customer's page"], [/^#\/customers/, "Customers"], [/^#\/orders/, "Orders"],
  [/^#\/price-list/, "Price list"], [/^#\/lots/, "Lots"], [/^#\/team/, "Team"], [/^#\/settings/, "Settings"],
  [/^#\/help/, "Help"], [/^#\/setup/, "first setup"],
];
const screenName = (page) => SCREENS.find(([re]) => re.test(page))?.[1] || "Help";

/* who may open which screen (the menu's rule, main.js NAV) */
const OPENS = { "#/team": ["owner", "manager"], "#/settings": ["owner"] };
const canOpen = (app, href) => (OPENS[href.split("/").slice(0, 2).join("/")] || ["owner", "manager", "dealer"]).includes(app.role);

/* "Tap **Price list**" -> words with the button's name in bold (as text, never HTML) */
function words(line) {
  return line.split("**").map((part, i) => (i % 2 ? h("strong", {}, part) : part));
}

export async function render(ctx) {
  const { app } = ctx;
  ctx.setTitle("Help");
  /* the screen they came from (main.js keeps it), never which customer */
  const page = screenOf(app.helpFrom || location.hash || "#/help") || "#/help";
  /* {connected, canAsk} from GET me: the box needs no wait */
  const known = app.me?.help || null;
  const connected = known ? known.connected : !!app.account;

  const answers = answersCard(app, connected);
  const ask = h("section", { class: "card hp-ask", id: "hp-ask" },
    h("h2", { class: "card-title" }, icon("send"), "Ask Barnwright"), h("div", { class: "hp-ask-body" }, loading()));
  const questions = h("section", { class: "card flush hp-questions", id: "hp-questions", hidden: true });

  const jump = h("nav", { class: "hp-jump", "aria-label": "Help sections" },
    [["Short answers", answers], ["Ask Barnwright", ask], ["Your questions", questions]].map(([label, el]) =>
      h("button", { type: "button", class: "chip", dataset: { to: el.id }, onclick: () => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        if (el === ask) el.querySelector("textarea")?.focus({ preventScroll: true });
      } }, label)));

  const root = h("div", { class: "hp" },
    pageHead("Help", "Short answers to what people ask most. When you need more, ask Barnwright."),
    jump,
    h("div", { class: "hp-grid" }, answers, h("div", { class: "hp-side" }, ask, questions)));

  /* The answers and the box show at once; the list fills in when the
     server answers. Sending a question, or "Try again", draws only the list
     again, so nothing typed in the box is lost. */
  const toQuestions = jump.querySelector('[data-to="hp-questions"]');
  let shown = "";   /* what the Ask card shows: "box" or "line" */
  const showAsk = (state) => {
    if (state.canAsk) {
      if (shown !== "box") drawAsk(ctx, ask, state, page, questionsAgain);
      shown = "box";
      return;
    }
    /* questions can't go from here: the line with the email, unless someone already typed in the box */
    if (shown === "box" && ask.querySelector("textarea")?.value.trim()) return;
    drawAsk(ctx, ask, state, page, questionsAgain);
    shown = "line";
  };
  const showList = (state) => {
    drawQuestions(app, questions, state, questionsAgain);
    toQuestions.hidden = !state.canAsk;
  };
  const questionsAgain = async () => {
    let state;
    try { state = await get("help"); } catch (e) { state = { canAsk: true, items: null, problem: e.message }; }
    if (!state.canAsk) showAsk(state);
    showList(state);
  };
  const fill = async () => {
    let state;
    try {
      state = await get("help");
    } catch (e) {
      if (shown) { showList({ canAsk: true, items: null, problem: e.message }); return; }
      clear(ask.querySelector(".hp-ask-body"), h("div", { class: "hp-note warn" }, icon("alert"),
        h("div", {}, h("p", {}, e.message), button("Try again", () => fill(), { small: true }))));
      return;
    }
    showAsk(state);
    showList(state);
  };
  toQuestions.hidden = true;
  if (known) {
    showAsk(known);
    /* nothing to list where questions can't go */
    if (!known.canAsk) return root;
    showList({ canAsk: true, items: undefined });
  }
  fill().catch((e) => console.error(e));
  return root;
}

/* ---- the short answers ---------------------------------------------------------- */

function answersCard(app, connected) {
  const search = h("input", { type: "search", placeholder: "Search, like website or price", "aria-label": "Search the answers", autocomplete: "off", enterKeyHint: "search" });
  const list = h("div", { class: "hp-list" });
  const none = h("div", { class: "hp-none", hidden: true });
  const count = h("span", { class: "crm-count" }, String(answersFor(connected).length));
  const draw = () => {
    const typed = search.value.trim();
    const found = findAnswers(typed, connected);
    clear(list, found.map((a) => answerItem(app, a, !!typed && found.length === 1)));
    count.textContent = String(found.length);
    none.hidden = found.length > 0;
    if (!found.length) {
      clear(none, h("p", {}, `No answer has “${typed}” in it. Try another word, or ask Barnwright.`),
        button("Ask Barnwright", () => {
          const ask = document.getElementById("hp-ask");
          ask?.scrollIntoView({ behavior: "smooth", block: "start" });
          ask?.querySelector("textarea")?.focus({ preventScroll: true });
        }, { small: true, icon: "send" }));
    }
  };
  let timer = 0;
  search.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(draw, 120); });
  draw();
  return h("section", { class: "card hp-answers", id: "hp-answers" },
    h("div", { class: "hp-answers-head" },
      h("h2", { class: "card-title" }, icon("help"), "Short answers"), count),
    h("div", { class: "search hp-search" }, icon("search"), search),
    list, none);
}

function answerItem(app, a, open) {
  const go = a.link && canOpen(app, a.link[0])
    ? h("a", { class: "hp-go", href: a.link[0] }, h("span", {}, a.link[1]), icon("arrowRight")) : null;
  return h("details", { class: "hp-answer", open, dataset: { answer: a.id } },
    h("summary", {}, h("span", { class: "hp-q" }, a.title), icon("chevronDown", "hp-chev")),
    h("div", { class: "hp-a" }, a.lines.map((line) => h("p", {}, words(line))), go));
}

/* ---- Ask Barnwright -------------------------------------------------------------------- */

/* the sentence with the support email as a link to write to */
function emailLine(sentence) {
  const [before, after = ""] = sentence.split(SUPPORT_EMAIL);
  return h("p", { class: "hp-note" }, icon("mail"),
    h("span", {}, before, h("a", { href: `mailto:${SUPPORT_EMAIL}` }, SUPPORT_EMAIL), after));
}

function drawAsk(ctx, ask, state, page, questionsAgain) {
  const body = ask.querySelector(".hp-ask-body");
  if (!state.canAsk) {
    clear(body, emailLine(state.connected ? HELP_SCREEN.notSetUp : HELP_SCREEN.notConnected));
    return;
  }
  const box = field("Your question", { type: "textarea", rows: 5, maxLength: 4000, placeholder: "Like: how do I add a 12×32 size to the Lofted Barn?" });
  const sent = (email) => HELP_SCREEN.sent(email);
  const f = form([
    box.wrap,
    h("p", { class: "hp-goes" }, icon("note"), h("span", {}, HELP_SCREEN.whatGoes(page === "#/help" ? "" : screenName(page)))),
    h("div", { class: "actions" }, h("button", { type: "submit", class: "btn btn-primary" }, icon("send"), h("span", {}, "Send"))),
  ], async () => {
    const text = box.input.value.trim();
    if (!text) { box.input.focus(); throw new Error("Type your question, then tap Send."); }
    const out = await post("help", { text, page, details: browserDetails() });
    box.input.value = "";
    questionsAgain().catch(() => {});
    return sent(out.email || ctx.app.person.email);
  }, { class: "hp-form" });
  clear(body, h("p", { class: "hp-intro" }, "Type your question and tap Send. Barnwright answers here and by email."), f);
}

/* the browser's side of the details: what it is, its screen, language,
   time zone and the errors this page has seen (ui/problems.js) */
function browserDetails() {
  let timezone = "";
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { timezone = ""; }
  return {
    browser: String(navigator.userAgent || "").slice(0, 300),
    screen: `${Math.round(window.innerWidth)}x${Math.round(window.innerHeight)}`,
    language: String(navigator.language || ""),
    timezone,
    errors: recentProblems(),
  };
}

/* ---- Your questions ----------------------------------------------------------------------- */

function drawQuestions(app, card, state, again) {
  card.hidden = !state.canAsk;
  if (!state.canAsk) return;
  const items = state.items;
  const head = h("div", { class: "card-head" },
    h("h2", { class: "card-title" }, icon("text"), "Your questions"),
    Array.isArray(items) && items.length ? h("span", { class: "crm-count" }, String(items.length)) : null);
  /* still on its way from Barnwright */
  if (items === undefined) {
    clear(card, head, h("div", { class: "hp-quiet" }, loading()));
    return;
  }
  if (!Array.isArray(items)) {
    clear(card, head, h("div", { class: "hp-quiet warn" }, icon("alert"),
      h("div", {}, h("p", {}, state.problem || "Barnwright couldn't be reached just now. Try again in a minute."),
        button("Try again", (e) => { e.currentTarget.disabled = true; again(); }, { small: true }))));
    return;
  }
  if (!items.length) {
    clear(card, head, h("div", { class: "hp-quiet" }, icon("check"),
      h("div", {}, h("strong", {}, "No questions yet."),
        h("p", {}, app.seesAllLots ? "Questions you and your team send show up here with Barnwright's answers." : "Questions you send show up here with Barnwright's answers."))));
    return;
  }
  const waiting = items.filter((q) => q.status === "waiting").length;
  clear(card, head,
    waiting ? h("p", { class: "hp-waiting-line" }, `${plural(waiting, "question")} waiting for an answer.`) : null,
    h("div", { class: "hp-items" }, items.map((q) => questionItem(app, q))));
}

function questionItem(app, q) {
  const status = q.status === "waiting" ? ["waiting", "Waiting for an answer"]
    : q.status === "answered" || q.replies.length ? ["answered", "Answered"] : ["closed", "Closed"];
  const who = q.asker.id === app.person?.userId ? "You" : q.asker.name || "Someone on your team";
  return h("article", { class: ["hp-item", `is-${status[0]}`] },
    h("div", { class: "hp-item-top" },
      h("span", { class: ["pill", `hp-${status[0]}`] }, status[1]),
      h("span", { class: "hp-item-meta" }, [who, q.at ? when(q.at) : ""].filter(Boolean).join(" · "))),
    h("p", { class: "hp-item-text" }, q.text),
    q.replies.map((r) => h("div", { class: "hp-reply" },
      h("p", { class: "hp-reply-who" }, h("span", { class: "hp-mark", "aria-hidden": "true" }, "B"),
        h("strong", {}, "Barnwright"), r.at ? h("span", {}, when(r.at)) : null),
      h("p", { class: "hp-reply-text" }, r.text))));
}
