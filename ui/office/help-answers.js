/* THE SHORT HELP ANSWERS on the Help screen (views/help.js), and the
   screen's own sentences about asking Barnwright.

   Each answer follows the screens as they are today. **Bold** words are a
   button, a heading or a note exactly as it reads on the screen;
   tools/check-help.mjs finds every one of them in the Dealer Center's
   screens (ui/office/) or the customer's 3D designer, and every link's
   screen in the menu's routes. When a button's words change, change them
   here too.

   An answer: {id, title, lines: [sentences], find: more words for the
   search box, link: [address, words], when}. A link shows only to the
   people who can open that screen. `when: "connected"` is for a Dealer
   Center connected to Barnwright's control room only (a plan, its notes at
   the top, the Barnwright card), `when: "not-connected"` for one that
   isn't (Alan's own business, the demo); no `when` fits both. `terms:
   "change"` is for a Dealer Center whose Barnwright terms let Barnwright
   change the price list (2.2 or later, see barnwrightCanChange), `terms:
   "checks"` for one where Barnwright can only run checks; no `terms` fits
   both. Each Dealer Center shows at most 15 (the 15th, Oct 7 2026: putting
   the Dealer Center on a computer or phone). */

export const SUPPORT_EMAIL = "support@barnwrightsoftware.com";

/* Barnwright changes a price list only under the Barnwright Terms and
   Conditions 2.2 or later (server/office/setup-access.js TERMS_NEEDED):
   when this Dealer Center ships them, or when the owner has agreed to them.
   That is the Barnwright card's own rule (setup.termsOut or setup.termsOk),
   so the answer and the card never disagree. terms: GET me's terms
   ({version, agreed}), null when the Dealer Center isn't connected. */
export const CHANGE_TERMS = "2.2";
export function barnwrightCanChange(terms) {
  return !!terms && (versionAtLeast(terms.version, CHANGE_TERMS) || versionAtLeast(terms.agreed?.version, CHANGE_TERMS));
}
/* "2.2" or later, compared as numbers: server/office/terms.js
   versionAtLeast, which this screen can't load (check-help keeps them the same) */
export function versionAtLeast(version, need) {
  if (typeof version !== "string" || !/^\d{1,4}(\.\d{1,4}){0,3}$/.test(version)) return false;
  const a = version.split(".").map(Number), b = String(need).split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return true;
}

/* The Help screen's own words (server/office/help.js says the "not
   connected" one too, when someone asks anyway; check-help keeps them equal). */
export const HELP_SCREEN = Object.freeze({
  notConnected: `Questions go straight to Barnwright from a Dealer Center Barnwright sets up. To ask from here, email ${SUPPORT_EMAIL}.`,
  notSetUp: `Barnwright hasn't finished setting up Help for your Dealer Center yet. Until then, email ${SUPPORT_EMAIL}.`,
  sent: (email) => `Sent. Barnwright will answer here and by email at ${email}.`,
  /* screen: the menu's name for the page they came from ("" when they opened Help itself) */
  whatGoes: (screen) => `Barnwright also gets ${screen ? `the page you came from (${screen})` : "this page"}, your name, email and job, and what helps find a problem: how your Dealer Center is set up, its Barnwright account, your browser and screen, and any recent errors. Never your customers or prices.`,
});

export const ANSWERS = Object.freeze([
  {
    id: "price",
    title: "Change buildings, prices or their standard layout",
    lines: [
      "Only the owner changes the buildings, prices and standard layouts. Tap **Price list**, then **Edit** on a building under **Your buildings**.",
      "Type the new price next to the size. To raise or lower many prices at once, tap **Change prices** and check the preview.",
      "To add a building, tap **Add a building**. Tap **Add it** for a standard building, or **Make my own from it** for your own name, sizes and prices. Type the prices on its Edit page.",
      "To stop selling a building, tap **Stop selling** on its Edit page. **Sell it again** brings it back until you save.",
      "To change the doors, windows and porch posts that come with a building, tap **Set the standard layout** on its Edit page. Move, add or remove them in the 3D designer, then tap **Save as standard**. Every size is checked, and every lot starts customers from that layout.",
      "Customers can still move the included doors, windows and posts or add more on their own building.",
      "Prices and building changes wait for the gold button at the bottom: **Save for your lot**, or **Save for all lots** when you have more than one. Every lot's 3D designer shows them right away. Quotes and orders already made keep their building and price.",
    ],
    find: "cost raise lower dollars size sizes building style save add stop selling own version layout door doors window windows porch post posts included standard",
    link: ["#/price-list", "Open Your buildings"],
  },
  {
    id: "color-option",
    title: "Add a color or an option",
    lines: [
      "Only the owner changes the price list. Tap **Price list**.",
      "On **Colors**, tap a color to switch it on for customers. For a color of your own, open **Add your own siding color** (or trim, or roof), type its name, pick the color and tap **Add color**.",
      "On **Options**, tick **Sell this** and type the price. For something else you sell, like a ridge vent, tap **Add an option** under **Your own options** and give it a name, how it's priced and a price.",
      "Then tap the gold save button at the bottom. Customers can pick it on every lot's 3D designer.",
    ],
    find: "colors siding trim roof paint options extras upgrade ramp shutters dormer",
    link: ["#/price-list/colors", "Open the colors"],
  },
  {
    id: "another-lot",
    when: "connected",
    title: "Open another lot",
    lines: [
      "Your Barnwright plan includes a set number of open lots. **Lots** says how many are open, like “1 of 1 open lot in your Barnwright plan”.",
      "To open one more, ask Barnwright to add a lot. Each extra lot is a one-time fee, and Barnwright emails you a link to pay.",
      "Once it's paid, your Dealer Center picks it up within six hours. Then the owner taps **Add a lot** on **Lots**.",
      "Closing a lot you don't use frees its place for another one.",
    ],
    find: "new lot location add more plan limit cost pay",
    link: ["#/lots", "Open your lots"],
  },
  {
    id: "another-lot-own",
    when: "not-connected",
    title: "Open another lot",
    lines: [
      "Only the owner adds lots. Tap **Lots**, then **Add a lot**.",
      "Type the lot's name, address, phone and hours, then tap **Add lot**. Its 3D designer link is ready at once.",
      "A lot you don't use can be closed with **Close lot**. Its 3D designer link closes too, and **Open lot** opens both again.",
    ],
    find: "new lot location add more",
    link: ["#/lots", "Open your lots"],
  },
  {
    id: "website",
    title: "Put the 3D designer on your website",
    lines: [
      "Tap **Lots**, then the lot's name. Under **Put the designer on your website**, tap **Copy website code** and send it to whoever runs your website. They paste it where the designer should show.",
      "Under **Websites that may show it**, the owner types your website, like yoursite.com, and taps **Add website**. The designer shows only on the websites listed there.",
      "To send customers straight to the designer instead, tap **Copy link** under **Its 3D designer link** and put the link in a text, an email or a post.",
    ],
    find: "web site code paste link page facebook",
    link: ["#/lots", "Open your lots"],
  },
  {
    id: "team",
    title: "Add someone to your team",
    lines: [
      "Only the owner adds people. Tap **Team**, then **Add a person**.",
      "Type their name and email, pick their job (Owner, Manager or Dealer) and, for a dealer, the lots they work. Tap **Add person**.",
      "Send them the message it shows with **Copy message** or **Email it**. They open your Dealer Center, tap **Make your login** and use that same email.",
    ],
    find: "person people employee salesperson invite dealer manager owner login",
    link: ["#/team", "Open the team"],
  },
  {
    id: "stopped",
    when: "connected",
    title: "Why changes can't be saved",
    lines: [
      "The note at the top of every screen says why:",
      "**Isn't switched on yet**: Barnwright is still setting up your account. Ask Barnwright on this screen.",
      "**Can't confirm its Barnwright account**: your Dealer Center's Barnwright settings need a look. Ask Barnwright.",
      "**Your Barnwright account is switched off**: ask Barnwright to switch it back on.",
      "**Hasn't reached Barnwright in 7 days**: it sets itself right the next time it reaches Barnwright. If the note stays, ask Barnwright.",
      "Meanwhile you can still look at and download everything, take a person off the team and ask Barnwright here. On the price list or in Settings, a note that someone else saved first means another person saved while you worked: reload, then make your change again.",
    ],
    find: "save saving locked stopped switched off account error read only",
  },
  {
    id: "not-open",
    title: "The 3D designer link says it isn't open",
    lines: [
      "Customers see “Our 3D designer isn't open right now” and a number to call when:",
      "The 3D designer is closed for every lot. The owner opens it in **Settings**, under **3D designer**: pick **Open to customers** and tap **Save settings**. A new Dealer Center starts closed, so you can get your prices ready first: the owner's **Getting started** list on **Today** goes through it step by step.",
      "That lot is closed. The owner taps **Open lot** on **Lots**.",
      "Changes are stopped on your Barnwright account. The note at the top of every screen says why, and the links open again once that's fixed.",
    ],
    find: "closed designer link open customers website not working",
    link: ["#/lots", "Open your lots"],
  },
  {
    id: "quote-request",
    title: "Where a customer's quote request goes",
    lines: [
      "When a customer taps **Request my quote** on a lot's 3D designer, they show up on that lot's **Customers** list as **New**, with the building, its price and a quote number.",
      "**Today** lists them under “New — nobody has talked to them yet” until someone saves a call, text, email or visit on them.",
      "Someone the lot already has (same email or phone) gets the new quote on their file instead. With email set up, the lot's email gets a note too.",
    ],
    find: "website quote request lead new customer email notification",
    link: ["#/customers", "Open your customers"],
  },
  {
    id: "follow-up",
    title: "Set a follow-up",
    lines: [
      "Open the customer. Under **Follow-up**, tap **Today**, **Tomorrow**, **In 3 days** or **Next week**, or pick a day and tap **Save follow-up**. Type a note so you remember why.",
      "They show up on **Today** that day, in red once they're late. Tap **Done** when you've talked to them.",
    ],
    find: "reminder call back callback date remind",
    link: ["#/", "Open Today"],
  },
  {
    id: "order",
    title: "Turn a quote into an order",
    lines: [
      "Open the customer and find the quote they're buying under **Quotes**. Tap **Mark sold**.",
      "Pick how they're paying, type the deposit, the delivery date and the address, then tap **Make the order**.",
      "The order keeps the quote's number and shows on **Orders**. On the customer, tap **Sent to builder**, **Ready** and **Delivered** as the building moves.",
    ],
    find: "sold sale sell order deposit delivery payment",
    link: ["#/orders", "Open the orders"],
  },
  {
    /* the owner's one Barnwright card (server/office/setup-access.js),
       once the terms let Barnwright change things */
    id: "barnwright",
    when: "connected",
    terms: "change",
    title: "Let Barnwright change your prices",
    lines: [
      "Only the owner can. Tap **Settings**, then the **Barnwright** card at the bottom.",
      "Until your 3D designer is open to customers, Barnwright can set up your price list and settings for you. **Stop Barnwright's setup access** stops that.",
      "After it's open, pick **Run checks** or **Run checks and change my price list and settings**, type what Barnwright should do, pick how long (1 to 24 hours) and tap **Turn on**.",
      "Every change is listed on the card and in **Price list**, **History**, where **Put this back** undoes it. **Turn off now** stops it at once, and it turns itself off when the time is up. Barnwright never sees your customers, quotes, orders or team.",
    ],
    find: "barnwright change prices setup access switch support check diagnostics look problem broken help",
    link: ["#/settings", "Open Settings"],
  },
  {
    /* the same card before the terms let Barnwright change anything (a
       Dealer Center that still ships terms older than 2.2): the card offers
       Run checks only (its "aren't out yet" line) */
    id: "barnwright-checks",
    when: "connected",
    terms: "checks",
    title: "Let Barnwright run checks on your Dealer Center",
    lines: [
      "Only the owner can. Tap **Settings**, then the **Barnwright** card at the bottom.",
      "Type what Barnwright should check, pick how long (1 to 24 hours) and tap **Turn on**.",
      "Barnwright sees how your Dealer Center runs, never your customers, quotes, orders or team, and can't change anything. **Turn off now** stops it at once, and it turns itself off when the time is up.",
    ],
    find: "barnwright support check checks diagnostics look problem broken help",
    link: ["#/settings", "Open Settings"],
  },
  {
    id: "download",
    title: "Download your customers",
    lines: [
      "Tap **Customers**, then **Download spreadsheet**. You get every customer you can see, ready to open in Excel or Google Sheets.",
      "Owners and managers can download, even while changes are stopped.",
    ],
    find: "export spreadsheet excel csv list backup",
    link: ["#/customers", "Open your customers"],
  },
  {
    id: "sign-in",
    title: "Someone can't sign in",
    lines: [
      "They need to be on your team first: the owner adds their email on **Team**.",
      "New people tap **Make your login** on the sign-in screen, use the email the owner added, then open the link we email them to confirm it.",
      "Forgot the password? Tap **Forgot your password?** on the sign-in screen for a link to choose a new one.",
      "Told they're not on the team yet? The owner added another email. Check it on **Team**.",
      "To stay signed in, tick **Keep me signed in on this device for 30 days** when you sign in. Then closing the browser doesn't sign you out. Leave it off on a computer other people use: then it signs out when the browser closes, or after 12 hours with nobody using it.",
      "**Sign out** signs out only the computer or phone you're on. To sign out everywhere (a lost phone, or a shared computer), tap your name, then **Sign out on every device**.",
    ],
    find: "login log in password reset forgot invite email access stay signed in keep remember 30 days 12 hours sign out every device lost",
    link: ["#/team", "Open the team"],
  },
  {
    /* the buttons named here are the browser's own, not the Dealer Center's, so they are not in
       bold; only the Dealer Center's own tick on its sign-in card is */
    id: "install",
    title: "Put the Dealer Center on your computer or phone",
    lines: [
      "On a computer, in Chrome or Edge: click Install at the right end of the address bar, then Install. The Dealer Center gets its own icon and opens in its own window.",
      "No Install button? Bookmark the page, or in Chrome open the menu, then Cast, save and share, then Create shortcut.",
      "On an iPhone: open your Dealer Center in Safari, tap Share, then Add to Home Screen.",
      "The Dealer Center on a Home Screen keeps its own sign-in, apart from Safari: sign in there once, and tick **Keep me signed in on this device for 30 days** there too.",
      "On an Android phone: open it in Chrome, tap the menu, then Add to Home screen or Install app.",
    ],
    find: "app install icon desktop shortcut bookmark home screen iphone android chrome edge safari phone computer window",
  },
  {
    id: "look",
    title: "Change your logo and colors",
    lines: [
      "Only the owner can. Tap **Settings**. Under **Logo**, tap **Upload a logo**. Under **Colors**, pick the header and button colors and watch the preview.",
      "Tap **Save settings** at the bottom. Customers see them on every lot's 3D designer; the Dealer Center itself stays black and gold. **Use the standard black and gold** puts the colors back.",
    ],
    find: "logo brand colors header button look picture",
    link: ["#/settings", "Open Settings"],
  },
]);

/* The answers for this Dealer Center: connected to Barnwright's control
   room or not, and whether its terms let Barnwright change things (see
   `when` and `terms` above; terms: GET me's terms). */
export function answersFor(connected, terms = null) {
  const change = barnwrightCanChange(terms) ? "change" : "checks";
  return ANSWERS.filter((a) => (!a.when || a.when === (connected ? "connected" : "not-connected")) && (!a.terms || a.terms === change));
}

/* The answers that match what someone typed (every word, anywhere in an
   answer), in the order above. */
export function findAnswers(typed, connected = true, terms = null) {
  const mine = answersFor(connected, terms);
  const words = String(typed || "").toLowerCase().replace(/[^a-z0-9$ ]+/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return mine;
  return mine.filter((a) => {
    const hay = `${a.title} ${a.lines.join(" ")} ${a.find || ""}`.toLowerCase().replace(/\*\*/g, "");
    return words.every((w) => hay.includes(w));
  });
}
