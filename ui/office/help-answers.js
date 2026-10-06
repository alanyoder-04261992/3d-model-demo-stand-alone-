/* THE SHORT HELP ANSWERS on the Help screen (views/help.js), and the
   screen's own sentences about asking Barnwright.

   Each answer follows the screens as they are today. **Bold** words are a
   button, a heading or a note exactly as it reads on the screen;
   tools/check-help.mjs finds every one of them in the Dealer Center's
   screens (ui/office/) or the customer's 3D designer, and every link's
   screen in the menu's routes. When a button's words change, change them
   here too.

   An answer: {id, title, lines: [sentences], find: more words for the
   search box, link: [address, words]}. A link shows only to the people who
   can open that screen. */

export const SUPPORT_EMAIL = "support@barnwrightsoftware.com";

/* The Help screen's own words (server/office/help.js says the "not
   connected" one too, when someone asks anyway; check-help keeps them equal). */
export const HELP_SCREEN = Object.freeze({
  notConnected: `Questions go straight to Barnwright from a Dealer Center Barnwright sets up. To ask from here, email ${SUPPORT_EMAIL}.`,
  notSetUp: `Barnwright hasn't finished setting up Help for your Dealer Center yet. Until then, email ${SUPPORT_EMAIL}.`,
  sent: (email) => `Sent. Barnwright will answer here and by email at ${email}.`,
  /* screen: the menu's name for the page they came from ("" when they opened Help itself) */
  whatGoes: (screen) => `Barnwright also gets ${screen ? `the page you came from (${screen})` : "this page"} and a few technical details: the Dealer Center's version, your account and any recent errors. Never your customers or prices.`,
});

export const ANSWERS = Object.freeze([
  {
    id: "price",
    title: "Change a price",
    lines: [
      "Only the owner changes prices. Tap **Price list**, then a building under **Buildings** to see its sizes and prices.",
      "Type the new price next to the size. To raise or lower many prices at once, tap **Change prices** and check the preview.",
      "Tap the gold button at the bottom: **Save for your lot**, or **Save for all lots** when you have more than one. Every lot's 3D designer shows the new price right away. Quotes you already gave keep their price.",
    ],
    find: "cost raise lower dollars size sizes building style save",
    link: ["#/price-list", "Open the price list"],
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
    title: "Open another lot",
    lines: [
      "Your Barnwright plan includes a set number of open lots. **Lots** says how many are open, like “1 of 1 open lot in your Barnwright plan”.",
      "To open one more, ask Barnwright to add a lot. Each extra lot is $250, one time, and Barnwright emails you a link to pay.",
      "Once it's paid, your Dealer Center picks it up within six hours. Then the owner taps **Add a lot** on **Lots**.",
      "Closing a lot you don't use frees its place for another one.",
    ],
    find: "new lot location add more plan limit cost pay",
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
    title: "Why changes can't be saved",
    lines: [
      "The note at the top of every screen says why:",
      "**Isn't switched on yet**: Barnwright is still setting up your account. Ask Barnwright below.",
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
      "The 3D designer is closed for every lot. The owner opens it in **Settings**, under **3D designer**: pick **Open to customers** and tap **Save settings**. A new Dealer Center starts closed, so you can get your prices ready first.",
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
    id: "barnwright-look",
    title: "Let Barnwright look at your Dealer Center",
    lines: [
      "Only the owner can turn this on. Tap **Settings**, then **Help from Barnwright** at the bottom.",
      "Type what Barnwright should look at, pick how long (1 to 24 hours) and tap **Let Barnwright help**.",
      "Barnwright sees how your Dealer Center runs, never your customers or prices, and can't change anything. **Turn off now** stops it at once, and it turns itself off when the time is up.",
    ],
    find: "support check diagnostics look problem broken",
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
      "Signed in and told they're not on the team yet? The owner added another email. Check it on **Team**.",
    ],
    find: "login log in password reset forgot invite email access",
    link: ["#/team", "Open the team"],
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

/* The answers that match what someone typed (every word, anywhere in an
   answer), in the order above. */
export function findAnswers(typed) {
  const words = String(typed || "").toLowerCase().replace(/[^a-z0-9$ ]+/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return ANSWERS;
  return ANSWERS.filter((a) => {
    const hay = `${a.title} ${a.lines.join(" ")} ${a.find || ""}`.toLowerCase().replace(/\*\*/g, "");
    return words.every((w) => hay.includes(w));
  });
}
