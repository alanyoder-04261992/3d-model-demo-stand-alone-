"""THE BARNWRIGHT PAPERS, as PDFs (Alan, Oct 2026: "Write terms and conditions
for me to have them sign when I sign them up"; Oct 7 2026: "redo the terms and
conditions and redo sign up let me sent sign up link, i dont like the
terminology ... lets steam line it as fast as possible").

An owner signs up on the sign-up page Alan texts them from the Control Room
(there is no paper form): it shows the short version of the terms, the owner
ticks "I agree" and types their name.

  legal/barnwright-terms.pdf                 the Barnwright Terms and Conditions.
                                             Published on every business's site
                                             (tools/build-site.mjs): the Dealer
                                             Center's "I agree" box links to it
                                             (server/office/terms.js)
  docs/legal/terms.json                      the same terms as plain text, with
                                             the short version: the Control
                                             Room's sign-up page reads it (from
                                             main on GitHub)
  docs/legal/Barnwright-Adding-a-New-Customer.pdf
                                             Alan's steps, from saying hello at
                                             their lot to their first quote
  docs/legal/Barnwright-Welcome-Sheet.pdf    one page for the owner: signing in,
                                             their computer and phone, prices,
                                             lots, team, website and help
  docs/legal/Barnwright-Setup-Questions.pdf  only when Alan can't visit: what a
                                             new company answers so its 3D
                                             designer, lots, prices and
                                             buildings can be set up (fillable;
                                             its lists come from library/)
  docs/legal/Barnwright-Flyer.pdf            one page to hand out or email to a
                                             shed company (picture: designer.jpg)
  docs/legal/Barnwright-Price-Sheet.pdf      one page: no setup fee, $250 a month
                                             with the first lot, $250 each lot after
  docs/legal/papers.json                     the list the Control Room's Papers
                                             page reads (from main on GitHub)

Run:  python3 tools/legal/make-legal-pdfs.py            (into the repository)
      python3 tools/legal/make-legal-pdfs.py <folder>   (all of them there, to look at)
Needs: pip install reportlab

When the terms change: change TERMS_VERSION (and TERMS_DATE) here and
TERMS.version in server/office/terms.js together, so every owner is asked to
agree again."""

import sys, os, re, json, html
from xml.sax.saxutils import escape
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Flowable,
                                KeepTogether, Table, TableStyle, CondPageBreak, PageBreak)
from reportlab.pdfgen import canvas as rl_canvas

OUT = sys.argv[1] if len(sys.argv) > 1 else None
if OUT: os.makedirs(OUT, exist_ok=True)

TERMS_TITLE = "Barnwright Terms and Conditions"
TERMS_VERSION = "2.0"               # server/office/terms.js TERMS.version says the same
TERMS_DATE = "October 2026"
VERSION = f"Version {TERMS_VERSION}, {TERMS_DATE}"   # at the top of every paper, and in papers.json
DOMAIN = "barnwrightsoftware.com"   # every business's web address is <their name>.barnwrightsoftware.com
MONTHLY_FEE = 250                   # a month from the start date, for any number of lots; it includes the first lot. No setup fee
LOT_FEE = 250                       # one time, for each lot after the first
SALES = "sales@" + DOMAIN
SUPPORT = "support@" + DOMAIN
BLACK = colors.HexColor("#16130E")
INK = colors.HexColor("#1D1A15")
MUTED = colors.HexColor("#635D52")
GOLD = colors.HexColor("#C9A227")
GOLD_DEEP = colors.HexColor("#85660F")
GOLD_SOFT = colors.HexColor("#F6EED6")
LINE = colors.HexColor("#CFC7B7")
FIELD_BG = colors.HexColor("#FBF8EF")

W, H = letter
PAGES = {}   # doc name -> page count, filled in as each PDF is written
MARGIN = 0.8 * inch

# ---------------------------------------------------------------- styles
body = ParagraphStyle("body", fontName="Helvetica", fontSize=9.6, leading=13.4, textColor=INK, spaceAfter=4)
small = ParagraphStyle("small", parent=body, fontSize=8.4, leading=11.2, textColor=MUTED)
title = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=BLACK, spaceAfter=2)
subtitle = ParagraphStyle("subtitle", fontName="Helvetica", fontSize=10.5, leading=14, textColor=MUTED, spaceAfter=10)
h1 = ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=BLACK, spaceBefore=10, spaceAfter=4)
h2 = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=10, leading=13, textColor=GOLD_DEEP, spaceBefore=8, spaceAfter=4)
clause = ParagraphStyle("clause", parent=body, leftIndent=22, firstLineIndent=-22)
sub = ParagraphStyle("sub", parent=body, leftIndent=40, firstLineIndent=-16, spaceAfter=2)
lead = ParagraphStyle("lead", parent=body, fontSize=10, leading=14.2)
label = ParagraphStyle("label", fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=MUTED)
step_t = ParagraphStyle("step_t", fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=BLACK, spaceAfter=3)


# ---------------------------------------------------------------- page frame
class NumberedCanvas(rl_canvas.Canvas):
    """Draws 'Page x of y' and the running header once every page is known."""
    def __init__(self, *a, doc_name="", **k):
        super().__init__(*a, **k)
        self._saved = []
        self.doc_name = doc_name

    def showPage(self):
        self._saved.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        n = len(self._saved)
        PAGES[self.doc_name] = n
        for state in self._saved:
            self.__dict__.update(state)
            self._decorate(n)
            super().showPage()
        super().save()

    def _decorate(self, n):
        self.saveState()
        # header: a black band with a gold rule, the name and the version
        self.setFillColor(BLACK)
        self.rect(0, H - 0.42 * inch, W, 0.42 * inch, stroke=0, fill=1)
        self.setFillColor(GOLD)
        self.rect(0, H - 0.45 * inch, W, 0.03 * inch, stroke=0, fill=1)
        self.setFont("Helvetica-Bold", 9.5)
        self.setFillColor(GOLD)
        self.drawString(MARGIN, H - 0.27 * inch, "BARNWRIGHT SOFTWARE")
        self.setFont("Helvetica", 8.5)
        self.setFillColor(colors.HexColor("#E8E2D4"))
        self.drawRightString(W - MARGIN, H - 0.27 * inch, f"{self.doc_name}  ·  {VERSION}")
        # footer
        self.setStrokeColor(LINE)
        self.setLineWidth(0.5)
        self.line(MARGIN, 0.6 * inch, W - MARGIN, 0.6 * inch)
        self.setFont("Helvetica", 8)
        self.setFillColor(MUTED)
        self.drawString(MARGIN, 0.42 * inch, self.doc_name)
        self.drawCentredString(W / 2, 0.42 * inch, DOMAIN)
        self.drawRightString(W - MARGIN, 0.42 * inch, f"Page {self._pageNumber} of {n}")
        self.restoreState()


def build(path, story, doc_name, pdf_title):
    doc = BaseDocTemplate(path, pagesize=letter, leftMargin=MARGIN, rightMargin=MARGIN,
                          topMargin=0.8 * inch, bottomMargin=0.85 * inch,
                          title=pdf_title, author="Barnwright", subject=doc_name, creator="Barnwright")
    frame = Frame(MARGIN, 0.85 * inch, W - 2 * MARGIN, H - 0.8 * inch - 0.85 * inch, id="f", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([PageTemplate(id="p", frames=[frame])])
    doc.build(story, canvasmaker=lambda *a, **k: NumberedCanvas(*a, doc_name=doc_name, **k))


class GoldRule(Flowable):
    def __init__(self, width=None, thick=1.6, space=8):
        super().__init__(); self.w = width; self.thick = thick; self.space = space
    def wrap(self, aw, ah):
        self.aw = self.w or aw; return self.aw, self.thick + self.space
    def draw(self):
        self.canv.setFillColor(GOLD); self.canv.rect(0, self.space / 2, 46, self.thick, stroke=0, fill=1)
        self.canv.setFillColor(LINE); self.canv.rect(50, self.space / 2 + self.thick / 2 - 0.25, self.aw - 50, 0.5, stroke=0, fill=1)


# ---------------------------------------------------------------- fillable fields
class Field(Flowable):
    """A labelled box someone can type in (a PDF form field)."""
    def __init__(self, name, caption, width, height=20, multiline=False, tip=None, suffix=None):
        super().__init__()
        self.name, self.caption, self.w, self.h = name, caption, width, height
        self.multiline, self.tip, self.suffix = multiline, tip or caption, suffix
    def wrap(self, aw, ah):
        return self.w, self.h + 13
    def draw(self):
        c = self.canv
        c.setFont("Helvetica-Bold", 7.6); c.setFillColor(MUTED)
        c.drawString(0, self.h + 4, self.caption.upper())
        box = self.w
        if self.suffix:   # words printed after the box, like ".barnwrightsoftware.com"
            c.setFont("Helvetica", 10); c.setFillColor(INK)
            box = self.w - c.stringWidth(self.suffix, "Helvetica", 10) - 3
            c.drawString(box + 3, 6, self.suffix)
        c.acroForm.textfield(name=self.name, tooltip=self.tip, x=0, y=0, width=box, height=self.h,
                             relative=True, borderStyle="underlined", borderColor=LINE, fillColor=FIELD_BG, value="",
                             textColor=INK, fontName="Helvetica", fontSize=0 if self.multiline else 10,
                             borderWidth=1, fieldFlags="multiline" if self.multiline else "", maxlen=400 if self.multiline else 120)


class Check(Flowable):
    """A tick box with words beside it."""
    def __init__(self, name, words, width, tip=None):
        super().__init__(); self.name, self.words, self.w, self.tip = name, words, width, tip or words
        self.p = Paragraph(words, body)
    def wrap(self, aw, ah):
        _, ph = self.p.wrap(self.w - 20, ah); self.ph = ph; return self.w, max(14, ph) + 3
    def draw(self):
        top = max(14, self.ph)
        self.canv.acroForm.checkbox(name=self.name, tooltip=self.tip, x=0, y=top - 12, size=11, relative=True,
                                    buttonStyle="check", borderColor=INK, fillColor=colors.white, textColor=BLACK,
                                    borderWidth=0.8, fieldFlags="")
        self.p.drawOn(self.canv, 18, top - self.ph)


def row(*cells, widths):
    t = Table([list(cells)], colWidths=widths, hAlign="LEFT")
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                           ("RIGHTPADDING", (0, 0), (-1, -1), 10), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    return t


def section_band(text):
    t = Table([[Paragraph(text, ParagraphStyle("band", fontName="Helvetica-Bold", fontSize=9.5, leading=12, textColor=BLACK))]],
              colWidths=[W - 2 * MARGIN], hAlign="LEFT")
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), GOLD_SOFT), ("LINEBEFORE", (0, 0), (0, -1), 3, GOLD),
                           ("LEFTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    return t


# ================================================================ 1. TERMS
# Version 2.0 (Alan, Oct 7 2026: "redo the terms and conditions ... i dont like
# the terminology"): the same protections as version 1.2, in plain words, and
# signed on the sign-up page (no paper form). TERMS_INTRO goes at the top of
# the PDF and of docs/legal/terms.json; TERMS_SUMMARY is the short version the
# sign-up page shows above "I agree". TERMS_TITLE, TERMS_VERSION and
# TERMS_DATE are at the top of this file.

TERMS_INTRO = [
    "These are the rules for using the Barnwright 3D designer. \"We\" and \"us\" mean Barnwright Software. \"You\" means the business that signs up.",
    "You agree to them by ticking \"I agree\" and typing your name on your sign-up page. That is your signature, the same as signing on paper.",
]

TERMS = [
    ("1. What you get", [
        ("1.1", "The <b>Barnwright 3D designer</b>. It includes:"),
        ("(a)", "your <b>3D designer</b>, where your customers pick a building, its size, colors, doors, windows and options, see the price, and send you a quote request;", "sub"),
        ("(b)", "your <b>Dealer Center</b>, where you keep your price list, your lots, your team, and your customers, quotes and orders; and", "sub"),
        ("(c)", "your own web address, hosting, updates and fixes, for as long as you use it.", "sub"),
        ("1.2", "It works alongside the software you already use, such as your website, your accounting and your rent-to-own company. It does not replace them."),
        ("1.3", "We may add, change or improve features. We will tell you at least 30 days before we take away a main feature you use."),
        ("1.4", "<b>Your web address</b> is under " + DOMAIN + ", such as yourbusiness." + DOMAIN + ". We pick it with you. Barnwright owns " + DOMAIN + ". You can use your address while you use the 3D designer, and you can also show your 3D designer on your own websites."),
    ]),
    ("2. Getting set up", [
        ("2.1", "We set up your 3D designer for you at no charge: your buildings, sizes, prices, options, colors, logo, lots and web address."),
        ("2.2", "To do that we need your price list, photos of your buildings, and your options and colors. Please get them to us correct and on time."),
        ("2.3", "Before your customers can use it, we show you your buildings and prices. You check them and tell us they are right. You are responsible for the prices you approve."),
    ]),
    ("3. What it costs", [
        ("3.1", "There is no setup fee."),
        ("3.2", f"<b>${MONTHLY_FEE} a month</b>, or the amount on your sign-up page. It starts on your <b>start date</b>: the day we tell you, by email or text, that your 3D designer is ready to use. It includes your first lot, and it stays the same no matter how many lots you have."),
        ("3.3", f"<b>Each lot after your first is ${LOT_FEE} one time</b>, or the amount on your sign-up page. You pay it before that lot opens. It is not refunded once the lot is open."),
        ("3.4", "<b>Your card.</b> When you sign up, you save a card with our payment company, Stripe. Nothing is charged that day except the one-time fees for any extra lots. You allow us to charge that card for the monthly fee on your start date and on the same day each month after, and for any extra lots you ask for, until this agreement ends. You can change the card any time: ask us for the link. If we agree, you can pay by invoice instead."),
        ("3.5", "If a payment doesn't go through, we try again and let you know. If it is still unpaid 15 days after we tell you, we may pause your account (section 8) until it is paid."),
        ("3.6", "Prices don't include sales tax. You pay any tax that applies."),
        ("3.7", "We may change our prices. We will tell you at least 30 days before. A change never charges you again for a lot you already paid for. If you don't agree, you can stop before the change starts."),
    ]),
    ("4. Starting and stopping", [
        ("4.1", "This agreement starts when you sign up and continues month to month."),
        ("4.2", "You or we can stop it at any time, for any reason, by telling the other 30 days ahead. An email is enough."),
        ("4.3", "We can stop it sooner, or pause your account, if a payment is not made (3.5), if you seriously break these terms and don't fix it within 10 days after we tell you, or if the software is used against the law."),
    ]),
    ("5. Your login and your team", [
        ("5.1", "Your owner is in charge of your account: who is on your team, which lots each person sees, and your settings. Your owner is responsible for the people they add."),
        ("5.2", "Everyone uses their own login and keeps it private. Take people off your team when they leave."),
        ("5.3", "Tell us right away if you think someone got into your account who shouldn't have."),
    ]),
    ("6. Your prices and your buildings", [
        ("6.1", "You set your prices, options and the words your customers see. You are responsible for checking your price list and for every price and quote you give."),
        ("6.2", "A price in the 3D designer is an estimate until you confirm the order with your customer. Say so in the line under the price."),
        ("6.3", "The 3D pictures and floor plans help your customers choose. They are not construction drawings, engineered plans or permit papers. How your buildings are built and delivered is your responsibility, including building codes, permits, wind ratings and the delivery site."),
        ("6.4", "Rent-to-own and other monthly payment figures are estimates from the numbers you give us. Barnwright is not a lender or a rent-to-own company. Your rent-to-own and financing contracts, and the laws about them, are your responsibility."),
    ]),
    ("7. Texting and emailing your customers", [
        ("7.1", "Your 3D designer can ask your customers if you may text them, in words you choose. You must follow the laws about calling, texting and emailing customers: get their permission, keep a record of it, and stop when they ask, such as a reply of STOP. These laws include the Telephone Consumer Protection Act, the CAN-SPAM Act and the Florida Telephone Solicitation Act."),
        ("7.2", "You are responsible for what you and your team send to customers, and for any texting or email service you connect."),
    ]),
    ("8. If your account is paused", [
        ("8.1", "Your Dealer Center connects to Barnwright to confirm that your account is active and how many lots you have."),
        ("8.2", "We pause your account if a payment is still unpaid 15 days after we tell you (3.5), if we stop under 4.3, or when this agreement ends. It also pauses by itself if your Dealer Center can't connect to Barnwright for 7 days in a row."),
        ("8.3", "While it is paused, nothing new can be saved, quote requests can't be sent, and your 3D designer shows your phone number instead of the designer. You and your team can still look at and download everything."),
        ("8.4", "When the reason is fixed, for example the payment goes through, we turn it back on. Nothing is deleted while it is paused."),
        ("8.5", "Please don't try to get around the lot limit or the pause."),
    ]),
    ("9. Your information", [
        ("9.1", "Your information belongs to you: your customers, quotes, orders, notes, prices, logo and settings."),
        ("9.2", "We use it only to run, support, back up and improve your 3D designer, and when the law requires. We never sell it, and we never use your customers' details to market to them."),
        ("9.3", "You can look at and download your information at any time, even while your account is paused."),
        ("9.4", "You confirm that you have the right to give us the information you put in, including your customers' details."),
        ("9.5", "When this agreement ends, we keep your information for 30 days so you can download it. After that we may delete it. Backup copies are deleted as the backups are replaced."),
        ("9.6", "We keep your information safe with reasonable security. If someone gets into it without permission, we tell you right away and help you with what the law requires."),
    ]),
    ("10. Help from Barnwright", [
        ("10.1", "We can't look inside your Dealer Center unless your owner turns on <b>Help from Barnwright</b> in Settings, for 1 to 24 hours. It turns off by itself, and your owner can turn it off sooner."),
        ("10.2", "While it is on, we can run checks on how your Dealer Center is working. Every visit is written in a log your owner can see."),
        ("10.3", "For help, tap <b>Help</b> in your Dealer Center or email support@" + DOMAIN + "."),
    ]),
    ("11. Please don't", [
        ("(a)", "copy, sell, rent or share the software;", "sub"),
        ("(b)", "try to take it apart or copy how it works;", "sub"),
        ("(c)", "put your 3D designer on websites you don't own or haven't told us about;", "sub"),
        ("(d)", "use it to send spam or to break any law;", "sub"),
        ("(e)", "put in anything that harms the software or other users; or", "sub"),
        ("(f)", "let anyone outside your team use your account.", "sub"),
    ]),
    ("12. Who owns what", [
        ("12.1", "Barnwright owns the software and everything we make for it: the 3D models, drawings, designs and code, and improvements to them, even ones that came from your ideas. You may use it for your business while this agreement is in place."),
        ("12.2", "You keep owning your business name, your logo and your own content. You let us use them to run your 3D designer, for example to show your logo."),
        ("12.3", "Your 3D designer shows a small \"3D designer by Barnwright\" line unless we agree otherwise."),
        ("12.4", "We name your business as a Barnwright customer only if you say yes on your sign-up page."),
    ]),
    ("13. Other companies", [
        ("", "The software runs on, and connects to, services from other companies, such as web hosting, email, payments, and any form or texting service you connect. Their own terms apply to those services. We are not responsible for their outages or changes, but we will work to keep your 3D designer running."),
    ]),
    ("14. Keeping it running", [
        ("", "We work to keep it running day and night, but we can't promise it will never be down, slow or wrong. We may take it down briefly for updates, outside business hours when we can. We fix problems that are ours to fix as soon as we reasonably can."),
    ]),
    ("15. Keeping each other's business private", [
        ("", "We each keep the other's private business information private: for you, your prices, customers and sales; for us, the software and our pricing. We each use it only for this agreement and share it only with people who need it and keep it private too. This doesn't cover information that is already public, or that the law requires us to share."),
    ]),
    ("16. Our promise", [
        ("16.1", "We will provide the software with reasonable care and skill."),
        ("16.2", "Other than that, the software is provided \"as is\". As far as the law allows, we make no other promises, including that it fits a particular purpose, that it will never stop or have errors, or that it will bring you a certain number of sales."),
    ]),
    ("17. Limits", [
        ("17.1", "Neither of us is responsible to the other for lost profits, lost sales, lost information that could have been downloaded, or indirect damages, even if warned they could happen."),
        ("17.2", "Our total responsibility for all claims is limited to what you paid us in the 12 months before the claim."),
        ("17.3", "These limits don't apply to fraud, intentional wrongdoing, money you owe us, or section 18."),
    ]),
    ("18. Claims from other people", [
        ("18.1", "You will defend us against, and pay for, claims by others that come from your prices, your buildings or their delivery, your contracts with your customers, rent-to-own or financing, your calls, texts or emails, or your breaking these terms or the law."),
        ("18.2", "We will defend you against, and pay for, claims by others that the software, as we provide it, copies their work (copyright) or their invention (patent). If that happens, we may change the software, get the right for you to keep using it, or end this agreement and refund what you paid ahead for time not used."),
        ("18.3", "The one asking to be covered must tell the other quickly and help with the defense."),
    ]),
    ("19. Changes to these terms", [
        ("", "We may update these terms. We will tell you at least 30 days before a change takes effect, and put the new version and date at the top. If you don't agree, you can stop before the change starts. Using the software after that date means you accept the change."),
    ]),
    ("20. The fine print", [
        ("20.1", "Florida law applies. Any lawsuit about this agreement will be in the state or federal courts for Charlotte County, Florida, and we both agree to those courts."),
        ("20.2", "These terms and your sign-up page are our whole agreement about the software. They replace anything said or written before. If they say different things, your sign-up page wins."),
        ("20.3", "We send notices by email, or by mail, to the address on your sign-up page. Please keep your details up to date."),
        ("20.4", "You can't transfer this agreement to someone else without our written okay, which we won't unreasonably refuse if you sell your business. We can transfer it to a company that takes over our business."),
        ("20.5", "Neither of us is responsible for delays caused by things we can't control, such as storms, power or internet outages, or outages at other companies."),
        ("20.6", "If part of these terms can't be enforced, the rest still applies. Not enforcing a part is not giving it up."),
        ("20.7", "Ticking \"I agree\" and typing your name on your sign-up page is your signature, the same as signing on paper."),
        ("20.8", "Parts that should continue after this agreement ends keep applying, such as money owed, your information, who owns what, keeping things private, limits and claims."),
    ]),
]

# The short version the sign-up page shows above "I agree" (the full terms are
# one tap away). Each line points at the section it sums up.
TERMS_SUMMARY = [
    ("What you get", "Your 3D designer and your Dealer Center, on your own web address. We set it up for you (sections 1 and 2)."),
    ("What it costs", "No setup fee. You save a card when you sign up; nothing is charged that day except one-time fees for any extra lots. The monthly fee is charged to your card from the day your 3D designer is ready, and it includes your first lot (section 3)."),
    ("Stopping", "Month to month. Either of us can stop with 30 days' notice by email (section 4)."),
    ("Your prices", "You check your price list and you are responsible for your prices, your buildings and your rent-to-own contracts. The 3D pictures are not construction drawings (section 6)."),
    ("Texting customers", "You follow the texting and email laws, with your customers' permission (section 7)."),
    ("If a payment is missed", "Your account pauses until it is paid. You can still see and download everything (section 8)."),
    ("Your information", "It belongs to you. We never sell it (section 9)."),
]


def terms_pdf(path):
    s = [Paragraph(TERMS_TITLE, title), Paragraph(VERSION, subtitle), GoldRule()]
    for words in TERMS_INTRO:
        s.append(Paragraph(words, lead))
    s.append(Spacer(1, 4))
    for head, items in TERMS:
        block = [Paragraph(head, h1)]
        for it in items:
            num, text = it[0], it[1]
            kind = it[2] if len(it) > 2 else "clause"
            if not num:
                block.append(Paragraph(text, body))
            elif kind == "sub":
                block.append(Paragraph(f"{num}&nbsp;&nbsp;{text}", sub))
            else:
                block.append(Paragraph(f"<b>{num}</b>&nbsp;&nbsp;{text}", clause))
        s.append(KeepTogether(block[:2]))
        s.extend(block[2:])
    s += [Spacer(1, 10), GoldRule()]
    build(path, s, "Terms and Conditions", TERMS_TITLE)


def plain_text(words):
    """A paragraph's words as plain text: no <b> tags, and &amp;, &nbsp; and
    the like back to the characters they stand for."""
    text = html.unescape(re.sub(r"<[^>]+>", "", words)).replace("\u00a0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    assert text and not re.search(r"[<>]|&[#A-Za-z0-9]+;", text), words
    return text


def terms_json():
    """The terms the Control Room's sign-up page shows (it reads
    docs/legal/terms.json from main on GitHub): plain text, keys always in
    this order, so the same terms give the same file byte for byte."""
    sections = [{"heading": plain_text(head),
                 "items": [{"n": it[0], "text": plain_text(it[1]), "sub": len(it) > 2 and it[2] == "sub"} for it in items]}
                for head, items in TERMS]
    # every section a sentence points at ("section 8", "sections 1 and 2", "(3.5)", "under 4.3") is there
    numbers = {s["heading"].split(".")[0] for s in sections} | {it["n"] for s in sections for it in s["items"]}
    words = " ".join([plain_text(p) for p in TERMS_INTRO] + [plain_text(t) for _, t in TERMS_SUMMARY]
                     + [it["text"] for s in sections for it in s["items"]])
    pointed = re.findall(r"\bsections? (\d+)(?: and (\d+))?|\((\d+\.\d+)\)|\bunder (\d+\.\d+)", words)
    missing = sorted({n for found in pointed for n in found if n and n not in numbers})
    assert pointed and not missing, f"the terms point at sections that aren't there: {missing}"
    return {
        "title": TERMS_TITLE, "version": TERMS_VERSION, "date": TERMS_DATE,
        "pdf": "legal/barnwright-terms.pdf",
        "intro": [plain_text(p) for p in TERMS_INTRO],
        "summary": [{"title": plain_text(t), "text": plain_text(x)} for t, x in TERMS_SUMMARY],
        "sections": sections,
    }


def write_json(path, value):
    """UTF-8, two-space indent, a newline at the end: the same value gives the same bytes."""
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


# ================================================================ 2. ADDING A NEW CUSTOMER (for Alan)
# Version 2 (Alan, Oct 7 2026: "lets steam line it as fast as possible ... keep
# in mind i need to take picture of there building and prices and option and
# sign up the owner and help him set up on his computer and other lots if he as
# any. write instructions very easy to understand"). Bold words are the exact
# button and box names on the screens: the Control Room and the Dealer Center
# use these same words.
CONTROL_ROOM = "control." + DOMAIN
# Alan, Oct 6 2026: "add inbox.barnwrightsoftware.com and 3dsetup.barnwrightsoftware.com
# to the links and pdf files or any file on how to add clients".
SALES_INBOX = "inbox." + DOMAIN
SETUP_3D = "3dsetup." + DOMAIN

GUIDE_TITLE = "Adding a new customer"
GUIDE_SUBTITLE = "From saying hello to their first quote, step by step"
GUIDE_INTRO = [
    "You need your phone with your Control Room open (<b>" + CONTROL_ROOM + "</b>) and about an hour at their lot. "
    "The words in <b>bold</b> are the buttons you tap.",
    "<b>First time? Practice first.</b> On your Control Room's first page, tap <b>Practice adding a customer</b>. "
    "Everything works the same, but nothing is real: no texts, no emails, no payments.",
]

PARTS = [
    ("Before your first customer", "Once, about 10 minutes, on a computer.", [
        ("Give your Control Room a Netlify key", [
            "In Netlify: your picture at the top right, <b>User settings</b>, <b>Applications</b>, <b>Personal access tokens</b>, <b>New access token</b>. Name it <b>Control Room</b>, pick the longest <b>Expiration</b> it offers, tap <b>Generate token</b> and copy it.",
            "Open your Control Room's project in Netlify: <b>Project configuration</b>, <b>Environment variables</b>, <b>Add a variable</b>. Key: <b>NETLIFY_API_TOKEN</b>. Paste the token as the value, tick <b>Contains secret values</b>, and save. Then <b>Deploys</b>, <b>Trigger deploy</b>.",
            "Now <b>Make their Dealer Center</b> is one button. Without the key, your Control Room shows the steps to do by hand instead. When the key runs out, your Control Room tells you: make a new one the same way.",
        ]),
        ("Let Stripe save cards", [
            "In Stripe: <b>Developers</b>, <b>API keys</b>, then your Control Room's restricted key, and <b>Edit</b>.",
            "Set <b>Subscriptions</b> to <b>Write</b>. Set <b>SetupIntents</b>, <b>PaymentIntents</b> and <b>PaymentMethods</b> to <b>Read</b>. Tap <b>Save</b>.",
            "Now the owner's card is saved when they sign up, and <b>Start and charge the card</b> works. If a permission is missing, your Control Room says which one.",
        ]),
    ]),
    ("Part 1. At their lot", "About 30 minutes, on your phone.", [
        ("Add them", [
            "In your Control Room, tap <b>New customer</b>.",
            "Type what you know: at least the owner's <b>phone</b> (to text the link) or <b>email</b>. Their <b>business name</b>, the <b>owner's name</b> and <b>how many lots</b> help too. Tap <b>Save</b>. The owner fills in the rest on the sign-up page, and it fills into your Control Room by itself.",
        ]),
        ("Send the owner the sign-up link", [
            "Tap <b>Send sign-up link</b>, then <b>Text it</b> (or <b>Email it</b>). Your phone's messages open with the link already written. Tap Send.",
            "The owner opens it on their phone, fills in or checks their details and their web address, reads the short version of the terms, ticks <b>I agree</b>, types their name and taps <b>Sign up and save my card</b>. Stripe's page asks for their card. Nothing is charged that day, except their extra lots if they have more than one. It takes about three minutes.",
            "Your Control Room fills in everything they typed and shows <b>Signed</b> and <b>Card saved</b>, with their name and the time.",
        ]),
        ("Take the photos", [
            "On the customer, tap <b>Take photos</b> and pick what you are shooting: <b>Buildings</b>, <b>Price list</b>, <b>Options and colors</b> or <b>Other</b>. Your camera opens. Take as many as you like.",
            "<b>Buildings</b>: each style they sell, the front and the side, and the inside if they show it.",
            "<b>Price list</b>: every page, flat, in good light, close enough that every number is easy to read.",
            "<b>Options and colors</b>: their doors, windows and options with prices, their color cards (siding, trim, roof), and their logo or sign.",
            "The photos are kept with the customer. Tap one to see it big.",
        ]),
    ]),
    ("Part 2. Make their Dealer Center", "One button, about 3 minutes.", [
        ("Make their Dealer Center", [
            "On the customer, tap <b>Make their Dealer Center</b>. Check their web address name (for example <b>cedar-ridge-sheds</b>) and tap <b>Make it</b>.",
            "Your Control Room makes their site in Netlify, gives it their web address, turns on sign-in, connects it to your Control Room and starts it. It takes about 3 minutes.",
            "If it says <b>One more step</b>, tap the link it shows, then <b>Enable Identity</b> in Netlify.",
            "When their Dealer Center first opens, your Control Room shows <b>Connected</b>.",
        ]),
    ]),
    ("Part 3. At the owner's computer", "About 30 minutes, with the owner.", [
        ("The owner's login", [
            "On the owner's computer, open <b>https://(their web address)/dealer</b>, for example https://cedar-ridge-sheds." + DOMAIN + "/dealer.",
            "They tap <b>Make your login</b>, type the email from their sign-up and a password, then open the email that comes and tap the link in it.",
            "They sign in. The first setup asks for their business, has them tick <b>I agree</b> to the terms, makes a starting price list and their first lot.",
        ]),
        ("Keep it on their computer and their phone", [
            "<b>Computer</b> (Chrome or Edge): click the <b>Install</b> button at the right end of the address bar, then <b>Install</b>. The Dealer Center gets its own icon on their desktop.",
            "No Install button? Bookmark the page, or in Chrome use the menu, <b>Cast, save and share</b>, <b>Create shortcut</b>.",
            "<b>Phone</b>: open the same address, tap <b>Share</b>, then <b>Add to Home Screen</b>.",
        ]),
        ("Their prices and options, from your photos", [
            "<b>Price list</b>: turn off the styles they don't sell and type their price for each size, door, window and option, using your <b>Price list</b> and <b>Options and colors</b> photos.",
            "<b>Settings</b>: their logo, their colors and the line under the price.",
        ]),
        ("Their other lots and their team", [
            "<b>Lots</b>, <b>Add a lot</b>: one for each of their other lots. They can open as many as they have paid for.",
            "<b>Team</b>, <b>Add a person</b>: their managers and dealers. Each one gets a message saying how to make their login.",
        ]),
        ("Open it to customers", [
            "Open each lot's <b>3D designer link</b> and check the buildings and prices with the owner.",
            "<b>Settings</b>, <b>3D designer</b>, <b>Open to customers</b>, <b>Save settings</b>.",
            "<b>Lots</b>, each lot, <b>Put the designer on your website</b>, <b>Copy website code</b>: send it to whoever runs their website.",
            "Send a test quote from a lot's 3D designer link. It shows up in <b>Customers</b> as New.",
            "Give the owner the <b>Welcome Sheet</b> (on your Papers page). It has all of this for them.",
        ]),
    ]),
    ("Part 4. Start", "When everything works.", [
        ("Start the monthly fee", [
            "In your Control Room, on the customer, tap <b>Start monthly fee</b>. Check the amount and the card, then tap <b>Start and charge the card</b>. Their card is charged that day and on the same day every month after.",
            "No card saved? Then <b>Start monthly fee</b> gives you a payment link instead: <b>Text it</b> or <b>Email it</b>.",
            "Card declined? Tap <b>Send card link</b> and text it: they save a different card on their page. Then tap <b>Start and charge the card</b> again.",
            "Add a reminder to call them in two weeks.",
        ]),
    ]),
    ("Later. When they open another lot", "", [
        ("Collect the lot fee", [
            "On the customer, tap <b>Get extra lot payment link</b>, choose how many new lots, then <b>Text it</b> or <b>Email it</b>.",
            "When they have paid, their Dealer Center lets them add the lot within a few hours: <b>Lots</b>, <b>Add a lot</b>.",
        ]),
    ]),
]

GUIDE_FOOTER = ("Changing the terms later: make a new version, tell every customer at least 30 days before it starts (terms section 19), "
                "and each owner is asked to agree again the next time they open their Dealer Center.")


def steps_pdf(path):
    s = [Paragraph(GUIDE_TITLE, title), Paragraph(GUIDE_SUBTITLE, subtitle), GoldRule()]
    for words in GUIDE_INTRO:
        s.append(Paragraph(words, lead))
    s.append(Paragraph("<b>Addresses you use:</b> your <b>Sales Inbox</b> at <b>" + SALES_INBOX + "</b> (your private inbox for "
                       "Barnwright sales messages), and <b>3D Setup</b> at <b>" + SETUP_3D + "</b> (where you set up a new "
                       "client's 3D designer).", body))
    n = 0
    for part, note, steps in PARTS:
        s.append(Spacer(1, 6))
        band = section_band(part.upper() + ("  ·  " + note if note else ""))
        for k, (head, items) in enumerate(steps):
            n += 1
            block = []
            num = Table([[Paragraph(f"<b>{n}</b>", ParagraphStyle('n', fontName='Helvetica-Bold', fontSize=11, alignment=TA_CENTER, leading=14, textColor=BLACK)),
                          Paragraph(head, step_t)]], colWidths=[24, W - 2 * MARGIN - 24], hAlign="LEFT")
            num.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, 0), GOLD), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                                     ("LEFTPADDING", (0, 0), (0, 0), 0), ("RIGHTPADDING", (0, 0), (0, 0), 0), ("LEFTPADDING", (1, 0), (1, 0), 10),
                                     ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
            block.append(Spacer(1, 7)); block.append(num); block.append(Spacer(1, 4))
            for t in items:
                block.append(Paragraph("•&nbsp;&nbsp;" + t, ParagraphStyle("b", parent=body, leftIndent=34, firstLineIndent=-10)))
            s.append(KeepTogether(([band] if k == 0 else []) + block))   # a part's heading never ends a page alone
    s.append(Spacer(1, 10))
    s.append(GoldRule())
    s.append(Paragraph(GUIDE_FOOTER, small))
    build(path, s, GUIDE_TITLE, "Barnwright: " + GUIDE_TITLE.lower())


# ================================================================ 3. SETUP QUESTIONS (for the customer)
# What a new company answers so their 3D designer and Dealer Center can be
# set up, and their buildings drawn the way they really build them (Alan,
# Oct 2026: "a list of questions to give to my customers to set up the
# software to their needs ... their barn and their size so we can build the
# barn"). Since Oct 7 2026 Alan takes photos at their lot instead; this is for
# a company he can't visit. The styles, doors, windows, options, colors and
# the "how we draw it" column come from the designer's own files
# (library/manufacturers/standard.json and library/construction.json), so the
# questions stay in step with them.

def _json(rel):
    with open(os.path.join(ROOT, rel)) as f:
        return json.load(f)


def inches(x):
    """0.625 -> '5/8', 76.5 -> '76 1/2' (to the nearest sixteenth)."""
    whole = int(x); n = round((x - whole) * 16)
    if n == 16: whole, n = whole + 1, 0
    if not n: return str(whole)
    d = 16
    while n % 2 == 0: n //= 2; d //= 2
    return (f"{whole} " if whole else "") + f"{n}/{d}"


def plain(t):
    """Library names for Helvetica and Paragraph: 48″ -> 48 in, 6′ -> 6 ft, & escaped."""
    t = re.sub(r'(\d)″', r'\1 in', t); t = re.sub(r'(\d)′', r'\1 ft', t); t = re.sub(r'(\d)"', r'\1 in', t)
    return escape(t.replace(" — ", ", "))


def half_in(x):
    return inches(round(x * 2) / 2)


def feet_inches(ft):
    total = round(ft * 12 * 2) / 2
    f, i = int(total // 12), total - 12 * int(total // 12)
    return f"{f} ft" + (f" {inches(i)} in" if i else "")


class Box(Flowable):
    """A fillable box with no caption above it (for tables)."""
    def __init__(self, name, width, height=17, tip="", multiline=False, prefix=None):
        super().__init__(); self.name, self.w, self.h, self.tip, self.multiline, self.prefix = name, width, height, tip, multiline, prefix
    def wrap(self, aw, ah):
        return self.w, self.h
    def draw(self):
        c, x = self.canv, 0
        if self.prefix:
            c.setFont("Helvetica", 9); c.setFillColor(INK); c.drawString(0, 5, self.prefix)
            x = c.stringWidth(self.prefix, "Helvetica", 9) + 2
        c.acroForm.textfield(name=self.name, tooltip=self.tip, x=x, y=0, width=self.w - x, height=self.h, relative=True,
                             borderStyle="underlined", borderColor=LINE, fillColor=FIELD_BG, textColor=INK,
                             fontName="Helvetica", fontSize=0 if self.multiline else 9, borderWidth=1,
                             fieldFlags="multiline" if self.multiline else "", maxlen=600 if self.multiline else 120)


cell = ParagraphStyle("cell", parent=body, fontSize=8.8, leading=11.2, spaceAfter=0)
cell_b = ParagraphStyle("cell_b", parent=cell, fontName="Helvetica-Bold")
cell_m = ParagraphStyle("cell_m", parent=cell, textColor=MUTED)
head_c = ParagraphStyle("head_c", fontName="Helvetica-Bold", fontSize=7.4, leading=9, textColor=MUTED)


class Tick(Check):
    """A tick box with smaller words, for tables."""
    def __init__(self, name, words, width, tip=None):
        Flowable.__init__(self); self.name, self.words, self.w, self.tip = name, words, width, tip or words
        self.p = Paragraph(words, cell)


def grid(rows, widths, head=None, zebra=True):
    data = ([[Paragraph(h.upper(), head_c) for h in head]] if head else []) + rows
    t = Table(data, colWidths=widths, hAlign="LEFT", repeatRows=1 if head else 0)
    st = [("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
          ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
          ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#E6E0D3"))]
    if head: st += [("LINEBELOW", (0, 0), (-1, 0), 0.8, GOLD), ("BOTTOMPADDING", (0, 0), (-1, 0), 4)]
    t.setStyle(TableStyle(st))
    return t


def questions_pdf(path):
    M = _json("library/manufacturers/standard.json")
    C = _json("library/construction.json")
    FW = W - 2 * MARGIN
    half, third, quarter = (FW - 12) / 2, (FW - 24) / 3, (FW - 36) / 4
    named = lambda d: [(k, v) for k, v in d.items() if not k.startswith("_")]
    s = [Paragraph("Setup Questions", title),
         Paragraph("So we can set up your 3D designer and build your buildings the way you do", subtitle), GoldRule()]
    s.append(Paragraph(
        "Answer what you can and email it back to us with <b>your logo</b>, <b>your price sheet</b> and <b>photos of your buildings</b> "
        "(the front, a side and the inside of each style). Skip anything that doesn't fit your business; we go over the rest with you on the phone. "
        "Type in the boxes on screen (the free Adobe Acrobat Reader works) or print it and write.", lead))
    s.append(Spacer(1, 6))
    sent = [("sent_logo", "Our logo"), ("sent_prices", "Our price sheet"), ("sent_photos", "Photos of our buildings"), ("sent_trusses", "Truss or framing drawings")]
    s.append(Paragraph("<b>We are sending you</b>", label)); s.append(Spacer(1, 3))
    s.append(row(*[Check(k, w, quarter) for k, w in sent], widths=[quarter + 12] * 3 + [quarter]))
    s.append(row(Field("q_filled_by", "Filled in by", half), Field("q_filled_date", "Date", half), widths=[half + 12, half]))

    def part(text, note=None, first=()):
        """A section's band (and note) never ends a page alone: it is kept with first."""
        s.append(Spacer(1, 8))
        s.append(KeepTogether([section_band(text)] + ([Spacer(1, 4), Paragraph(note, small)] if note else []) + [Spacer(1, 6)] + list(first)))

    # ---- 1. business
    part("1.  YOUR BUSINESS", first=[row(Field("q_business_name", "Business name, as your customers should see it", half), Field("q_short_name", "A short name, if that one is long", half), widths=[half + 12, half])])
    s.append(row(Field("q_phone", "Main phone", third), Field("q_email", "Main email", third), Field("q_website", "Website", third), widths=[third + 12, third + 12, third]))
    s.append(row(Field("q_contact", "Who we set things up with", third), Field("q_contact_phone", "Their phone", third), Field("q_contact_email", "Their email", third), widths=[third + 12, third + 12, third]))
    s.append(row(Field("q_web_1", "Your web address, first choice", half, suffix="." + DOMAIN), Field("q_web_2", "Second choice", half, suffix="." + DOMAIN), widths=[half + 12, half]))

    # ---- 2. look
    part("2.  YOUR LOOK", "Your 3D designer and your Dealer Center use your logo and two colors. Send your logo as a PNG, SVG or JPG, the biggest and clearest one you have.",
         first=[row(Check("q_colors_standard", "Use the standard <b>black and gold</b>", third),
                    Field("q_color_header", "Or your colors: the top bar", third, tip="A color code like #1F3A5F, or 'match our logo'"),
                    Field("q_color_accent", "Buttons and highlights", third, tip="A color code like #C9A227, or 'match our logo'"), widths=[third + 12, third + 12, third])])
    s.append(Field("q_tagline", "A line under your name (for example: Storage buildings, delivered)", FW))

    # ---- 3. lots
    s.append(PageBreak())
    lot_blocks = []
    for i in (1, 2, 3):
        k = f"q_lot{i}_"
        block = [Paragraph(f"Lot {i}", h2),
                 row(Field(k + "name", "Lot name (for example: Port Charlotte)", half), Field(k + "phone", "Phone", quarter), Field(k + "email", "Email for quote requests", quarter),
                     widths=[half + 12, quarter + 12, quarter]),
                 row(Field(k + "street", "Street", half), Field(k + "city", "City", quarter), Field(k + "state_zip", "State and ZIP", quarter), widths=[half + 12, quarter + 12, quarter]),
                 row(Field(k + "hours", "Hours", half), Field(k + "site", "The web page that will show this lot's 3D designer", half), widths=[half + 12, half])]
        lot_blocks.append(block)
    part("3.  YOUR LOTS", "Each lot gets its own 3D designer link, and its quote requests go to that lot. More lots? List them in section 10.", first=lot_blocks[0])
    s.extend(KeepTogether(b) for b in lot_blocks[1:])

    # ---- 4. team
    part("4.  YOUR TEAM", "Everyone who signs in to your Dealer Center. <b>Managers</b> see every lot's customers and orders, <b>dealers</b> their own lots'. "
         "Only owners change prices and settings. More people? List them in section 10.")
    tw = [FW * 0.26, FW * 0.34, FW * 0.17, FW * 0.23]
    rows = [[Box(f"q_team{i}_name", tw[0] - 10), Box(f"q_team{i}_email", tw[1] - 10), Box(f"q_team{i}_role", tw[2] - 10, tip="Owner, manager or dealer"), Box(f"q_team{i}_lots", tw[3] - 10)] for i in range(1, 7)]
    s[-1] = KeepTogether(list(s[-1]._content) + [grid(rows, tw, head=["Name", "Email (their login)", "Owner, manager or dealer", "Their lots"])])

    # ---- 5. buildings
    s.append(PageBreak())
    cats = {}
    for key, st in named(M["styles"]):
        cats.setdefault(st.get("category") or "Other", []).append((key, st["name"]))
    cw = [FW * 0.25, FW * 0.25 - 12, 12, FW * 0.25, FW * 0.25 - 12]
    blocks = []
    for cat, styles in cats.items():
        rows = []
        for j in range(0, len(styles), 2):
            r = []
            for key, name in styles[j:j + 2]:
                r += [Tick(f"q_style_{key}", f"<b>{plain(name)}</b>", cw[0] - 8), Box(f"q_style_{key}_name", cw[1] - 10, tip=f"Your name for the {name}")]
                if len(r) == 2: r.append("")
            while len(r) < 5: r.append("")
            rows.append(r)
        blocks.append([Paragraph(cat.replace(" & ", " and "), h2), grid(rows, cw, head=None if blocks else ["Style", "Your name for it", "", "Style", "Your name for it"])])
    part("5.  THE BUILDINGS YOU SELL", "Tick each style you sell, and give it your own name if you call it something else. "
         "Each one is drawn the way it is built, so send photos of yours, and of anything you build that isn't on this list.", first=blocks[0])
    s.extend(KeepTogether(b) for b in blocks[1:])
    s.append(Spacer(1, 6))
    s.append(Field("q_other_styles", "Buildings you sell that aren't on the list", FW, height=40, multiline=True))
    s.append(Field("q_standard_items", "What comes standard on each style (doors, windows, vents)", FW, height=52, multiline=True,
                   tip="For example: Lofted Barn, a 72 in double door and two 2x3 windows"))
    s.append(Paragraph("For example: Lofted Barn, a 72 in double door and two 2×3 windows.", small))

    s.append(PageBreak())
    pw = [FW * 0.2, FW * 0.13, FW * 0.13, 12, FW * 0.2, FW * 0.13, FW * 0.13 - 12]
    rows = []
    for i in range(1, 25):
        rows.append([Box(f"q_size{i}_style", pw[0] - 10), Box(f"q_size{i}_wl", pw[1] - 10, tip="Width x length, like 10 x 16"), Box(f"q_size{i}_price", pw[2] - 10, prefix="$"), "",
                     Box(f"q_size{i + 24}_style", pw[4] - 10), Box(f"q_size{i + 24}_wl", pw[5] - 10, tip="Width x length, like 10 x 16"), Box(f"q_size{i + 24}_price", pw[6] - 10, prefix="$")])
    part("5.  SIZES AND PRICES", "Easiest: send us your price sheet and skip this page. Otherwise write each size you sell as width × length in feet "
         "(widths 4 to 16 ft, lengths up to 60 ft) and its price with the doors and windows it comes with.",
         first=[grid(rows, pw, head=["Style", "Size", "Price", "", "Style", "Size", "Price"])])

    # ---- 6. how you build
    s.append(PageBreak())
    part("6.  HOW YOU BUILD THEM", "We draw every building the way it is really built, from the skids up to the roof. The middle column is how we draw it now. "
         "Write only what you do differently.")
    sk = C["skids"]; fl = C["floor"]; wa = C["walls"]; rf = C["roof"]; rd = C["roofDeck"]; lo = C["loft"]; po = C["porch"]; op = C["openings"]; si = C["site"]
    def rule_words(rules, unit=""):
        parts = []
        for r in rules:
            when = r.get("when", {})
            if "maxW" in when: parts.append(f"{r['value']} up to {when['maxW']} ft wide")
            elif "maxL" in when: parts.append(f"{r['value']} up to {when['maxL']} ft long")
            elif "maxSpanFt" in when: parts.append(f"{r['value']} up to {feet_inches(when['maxSpanFt'])}")
            else: parts.append(f"{r['value']} {('wider' if parts else '')}".strip())
        return ", ".join(parts)
    counts = {}
    for wft, offs in named(sk["table"]): counts.setdefault(2 * len(offs), []).append(int(wft))
    skid_words = ", ".join(f"{n} under {min(ws)} to {max(ws)} ft wide" if len(ws) > 1 else f"{n} under {ws[0]} ft wide" for n, ws in sorted(counts.items()))
    gable = rf["shapes"]["gable"]; barn = rf["shapes"]["gambrel"]
    pitch = round(gable["rise"]["w"] * 2 * 12 * 2) / 2
    loft_depth = next((st["loft"]["depthFt"] for _, st in named(M["styles"]) if st.get("loft")), 4)
    anchors = rule_words([{**r, "value": str(r["value"])} for r in si["anchors"]]).replace(" wider", " longer")
    BUILD = [
        ("Blocks and anchors", f"{si['blocks']} concrete blocks, one for every {si['perimeterFtPerBlock']} ft of outside wall. Anchors: {anchors}"),
        ("Skids", f"{sk['size']} treated, on edge: {skid_words}"),
        ("Floor joists", f"{rule_words(fl['joist'])}, {fl['spacingIn']} in on center, {fl['rim']} rim joists"),
        ("Floor", f"{inches(fl['deck']['thicknessIn'])} in {fl['deck']['sheet']}, {'one layer' if fl['deck']['layers'] == 1 else str(fl['deck']['layers']) + ' layers'}"),
        ("Wall studs", f"{wa['stud']}, {wa['spacingIn']} in on center, {wa['bottomPlates']} bottom plate, {wa['topPlates']} top plates, {wa['corner']} corners"),
        ("Stud length", f"{inches(wa['studLengthIn']['tall'])} in on tall walls, {inches(wa['studLengthIn']['loft'])} in on barn (loft) walls"),
        ("Door and window headers", rule_words(wa["header"])),
        ("Wooden door openings", f"{inches(op['doorHeightIn']['other'])} in high on tall walls, {inches(op['doorHeightIn']['gambrel'])} in on barns"),
        ("Roof framing", f"{'Trusses' if rf['framing'] == 'truss' else 'Rafters'} {rf['spacingIn']} in on center, {rf['chord']} chords, {rf['gussets']} gussets"),
        ("Roof pitch", f"About {inches(pitch)} in 12 on gable roofs; our standard barn (gambrel) truss on barns. Send your truss drawings if you have them"),
        ("Overhangs", f"Gable roofs: {half_in(gable['eaveOverhang']['left'] * 12)} in at the eaves, {half_in(gable['rakeOverhang'] * 12)} in at the ends. "
                      f"Barns: {half_in(barn['eaveOverhang']['left'] * 12)} in at the eaves, {half_in(barn['rakeOverhang'] * 12)} in at the ends"),
        ("Roof deck", f"{inches(rd['sheathingIn'])} in OSB; {rd['purlins']['size']} purlins laid flat, {rd['purlins']['spacingIn']} in apart, on metal buildings"),
        ("Roofing", "Ribbed metal panels with a ridge cap"),
        ("Siding", "Painted wood siding; metal siding on metal buildings"),
        ("Lofts", f"{feet_inches(loft_depth)} deep at both ends of lofted barns, {lo['joist']} loft joists {lo['spacingIn']} in on center"),
        ("Porches", f"{po['post']} posts, {po['joist']} deck joists, a railing {po['railHeightIn']} in high"),
        ("Widths and delivery", " ".join(v for k, v in named(C.get("notes", {})))),
    ]
    bw = [FW * 0.2, FW * 0.42, FW * 0.38]
    rows = [[Paragraph(f"<b>{p}</b>", cell), Paragraph(plain(d), cell_m), Box(f"q_build_{i}", bw[2] - 10, height=22, multiline=True, tip=f"{p}: how you build it, if different")]
            for i, (p, d) in enumerate(BUILD, 1)]
    s[-1] = KeepTogether(list(s[-1]._content) + [grid(rows, bw, head=["Part", "How we draw it", "How you build it, if different"])])
    s.append(Spacer(1, 8))
    s.append(Field("q_build_other", "Anything else about how you build, or what an option changes", FW, height=46, multiline=True))

    # ---- 7. doors, windows and options
    s.append(PageBreak())
    part("7.  DOORS, WINDOWS AND OPTIONS", "Tick what you offer and write your price. A building's price already includes the doors and windows it comes with; "
         "a bigger door is charged as the difference. Give anything your own name if you call it something else.")
    iw = [FW * 0.42, FW * 0.18, FW * 0.40]
    per_foot = {"bench", "shelf"}
    rows = []
    for k, it in named(M["items"]):
        words = plain(it["name"]) + (" (per foot)" if k in per_foot else "")
        rows.append([Tick(f"q_item_{k}", words, iw[0] - 8), Box(f"q_item_{k}_price", iw[1] - 10, prefix="$"), Box(f"q_item_{k}_name", iw[2] - 10, tip=f"Your name for the {it['name']}")])
    s[-1] = KeepTogether(list(s[-1]._content) + [grid(rows, iw, head=["Door, window or fixture", "Your price", "Your name for it"])])
    s.append(PageBreak())
    O = M["options"]
    opts = []
    for k, d in named(O.get("dormers", {})): opts.append((f"dormer_{k}", f"{d['name']} (Dormer Shed)"))
    for k, d in named(O.get("ramps", {})): opts.append((f"ramp_{k}", d["name"]))
    for k, d in named(O.get("elec", {})): opts.append((f"elec_{k}", f"Electrical package {k}: {d.get('desc', '')}"))
    for k, d in named(O.get("misc", {})): opts.append((f"misc_{k}", d["name"] + (" (a pair, for one window)" if k == "shutter" else "")))
    for k, d in named(O.get("rates", {})): opts.append((f"rate_{k}", f"{d['name']} (per square foot of {'floor' if d.get('basis') == 'floor' else d.get('basis', 'floor')})"))
    rows = [[Tick(f"q_opt_{k}", plain(w), iw[0] - 8), Box(f"q_opt_{k}_price", iw[1] - 10, prefix="$"), Box(f"q_opt_{k}_name", iw[2] - 10)] for k, w in opts]
    s.append(grid(rows, iw, head=["Option", "Your price", "Your name for it"]))
    s.append(Spacer(1, 8))
    ew = [FW * 0.42, FW * 0.36, FW * 0.22]
    rows = [[Box(f"q_extra{i}_name", ew[0] - 10), Box(f"q_extra{i}_how", ew[1] - 10, tip="Each, per foot, per square foot of floor, walls or roof, or a percent"), Box(f"q_extra{i}_price", ew[2] - 10, prefix="$")] for i in range(1, 6)]
    s.append(KeepTogether([Paragraph("Options of your own", h2), grid(rows, ew, head=["What it is", "How it's priced (each, per foot, per square foot, percent)", "Price"])]))

    # ---- 8. colors
    s.append(PageBreak())
    part("8.  COLORS", "Tick the colors you offer. Have colors of your own? Write their names below and send a color chip or a photo.")
    P = M["palettes"]
    groups = [("paint", "Siding, doors and shutters (painted)"), ("trim", "Trim"), ("metal", "Metal roofs, and the siding of metal buildings")]
    for g, words in groups:
        names = [c[0] for c in P.get(g, [])]
        cols = 4; w4 = (FW - 36) / cols
        rows = []
        for j in range(0, len(names), cols):
            r = [Tick(f"q_color_{g}_{n.replace(' ', '_')}", plain(n), w4) for n in names[j:j + cols]]
            r += [""] * (cols - len(r)); rows.append(r)
        blk = [Paragraph(words, h2), grid(rows, [w4 + 12] * cols)]
        if g == "paint": s[-1] = KeepTogether(list(s[-1]._content) + blk)
        else: s.append(KeepTogether(blk))
    s.append(Spacer(1, 6))
    s.append(Field("q_colors_own", "Colors of your own (name, and the paint or metal company's color name)", FW, height=40, multiline=True))
    s.append(Paragraph("The building your 3D designer opens on", h2))
    fifth = (FW - 48) / 5
    s.append(row(Field("q_open_style", "Style", fifth), Field("q_open_size", "Size", fifth), Field("q_open_body", "Siding color", fifth),
                 Field("q_open_trim", "Trim color", fifth), Field("q_open_roof", "Roof color", fifth), widths=[fifth + 12] * 4 + [fifth]))

    # ---- 9. prices and quotes
    s.append(PageBreak())
    part("9.  PRICES AND QUOTES", first=[Paragraph("<b>How prices show in your 3D designer</b>", label), Spacer(1, 3)])
    s.append(row(Check("q_show_price", "<b>The full price</b>, with a running total", third), Check("q_show_from", "<b>A starting price</b> (\"from $4,250\")", third),
                 Check("q_show_none", "<b>No price</b>: they send the design and you call", third), widths=[third + 12, third + 12, third]))
    s.append(row(Field("q_fine_print", "The line under the price", half, tip="For example: Prices plus tax. Free delivery within 50 miles."),
                 Field("q_width_notes", "Notes for building widths", half, tip="For example: 14 ft wide needs a permit"), widths=[half + 12, half]))
    s.append(row(Paragraph("For example: Prices plus tax. Free delivery within 50 miles.", small), Paragraph("For example: 14 ft wide needs a permit.", small), widths=[half + 12, half]))
    s.append(Spacer(1, 2))
    s.append(Paragraph("<b>Rent to own</b>", label)); s.append(Spacer(1, 3))
    s.append(Check("q_rto", "Show a monthly rent-to-own price by the total, and a box in the quote to pick the months", FW))
    s.append(Spacer(1, 3))
    terms = ["36", "48", "60"]
    s.append(Paragraph("What your rent-to-own company charges a month on a <b>$5,000</b> building, for each term you offer (we work out the rest):", small))
    s.append(Spacer(1, 3))
    s.append(row(*[Field(f"q_rto_{m}", f"{m} months ($ a month)", third, tip=f"What your rent-to-own company charges a month on a $5,000 building over {m} months") for m in terms],
                 widths=[third + 12, third + 12, third]))
    s.append(row(Field("q_rto_company", "Your rent-to-own company", third), Field("q_rto_show", "Months to show by the price", third),
                 Field("q_rto_note", "Words under the monthly price", third), widths=[third + 12, third + 12, third]))
    s.append(Spacer(1, 2))
    fields = [("name", "Name"), ("phone", "Phone"), ("email", "Email"), ("zip", "ZIP code"), ("address", "Street and city"), ("note", "A note from the customer")]
    qw = [FW * 0.34, FW * 0.22, FW * 0.22, FW * 0.22]
    rows = [[Paragraph(f"<b>{w}</b>", cell), Tick(f"q_ask_{k}_req", "Required", qw[1] - 8), Tick(f"q_ask_{k}_opt", "Optional", qw[2] - 8), Tick(f"q_ask_{k}_off", "Don't ask", qw[3] - 8)] for k, w in fields]
    s.append(KeepTogether([Paragraph("What the quote form asks", h2), grid(rows, qw, head=["Question", "", "", ""])]))
    s.append(Spacer(1, 6))
    s.append(Check("q_ask_plan", "Also ask <b>What do you want to do with this quote?</b> (ready to buy, needs permit paperwork, needs engineering plans, or just seeing the price)", FW))
    s.append(Spacer(1, 4))
    s.append(Field("q_sms", "Permission to text: the words by a box customers can tick (for example: You may text me about my quote)", FW))

    # ---- 10. anything else
    part("10.  ANYTHING ELSE")
    s.append(Field("q_anything", "More lots or people, other buildings, how you'd like it to work, or questions for us", FW, height=80, multiline=True))
    build(path, s, "Setup Questions", "Barnwright Setup Questions")


# ================================================================ 4. FLYER AND PRICE SHEET
# What Alan hands or emails to a shed company before it signs up (Alan, Oct
# 2026: "yes" to a flyer and a price sheet). One page each, no page numbers.
# The picture is the demo company's 3D designer (tools/legal/designer.jpg,
# taken from `npm run serve` at /?c=demo); take it again when the designer's
# look changes.
WEB_PAGE = "www." + DOMAIN + "/3d-configurator"
PICTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "designer.jpg")
big = ParagraphStyle("big", fontName="Helvetica-Bold", fontSize=25, leading=29, textColor=colors.white)
hero_sub = ParagraphStyle("hero_sub", fontName="Helvetica", fontSize=11.5, leading=15.5, textColor=colors.HexColor("#E8E2D4"))
eyebrow = ParagraphStyle("eyebrow", fontName="Helvetica-Bold", fontSize=8.6, leading=11, textColor=GOLD)
col_head = ParagraphStyle("col_head", fontName="Helvetica-Bold", fontSize=11.5, leading=14.5, textColor=BLACK, spaceAfter=4)
tick_line = ParagraphStyle("tick_line", parent=body, fontSize=9.6, leading=13, leftIndent=12, firstLineIndent=-12, spaceAfter=3)
price_big = ParagraphStyle("price_big", fontName="Helvetica-Bold", fontSize=19, leading=22, textColor=BLACK, alignment=TA_CENTER)
price_cap = ParagraphStyle("price_cap", fontName="Helvetica", fontSize=8.6, leading=11, textColor=MUTED, alignment=TA_CENTER)
contact = ParagraphStyle("contact", fontName="Helvetica-Bold", fontSize=11, leading=15, textColor=BLACK, alignment=TA_CENTER)


def sheet(path, story, doc_name, pdf_title, foot=("Barnwright Software", SALES, WEB_PAGE)):
    """A one-page sheet: the black and gold band, three words at the foot
    (left, middle, right: the sales email and web page unless foot says
    otherwise), no page numbers."""
    def page(c, doc):
        c.saveState()
        c.setFillColor(BLACK); c.rect(0, H - 0.42 * inch, W, 0.42 * inch, stroke=0, fill=1)
        c.setFillColor(GOLD); c.rect(0, H - 0.45 * inch, W, 0.03 * inch, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 9.5); c.drawString(MARGIN, H - 0.27 * inch, "BARNWRIGHT SOFTWARE")
        c.setFont("Helvetica", 8.5); c.setFillColor(colors.HexColor("#E8E2D4"))
        c.drawRightString(W - MARGIN, H - 0.27 * inch, DOMAIN)
        c.setStrokeColor(LINE); c.setLineWidth(0.5); c.line(MARGIN, 0.6 * inch, W - MARGIN, 0.6 * inch)
        c.setFont("Helvetica", 8); c.setFillColor(MUTED)
        c.drawString(MARGIN, 0.42 * inch, foot[0])
        c.drawCentredString(W / 2, 0.42 * inch, foot[1])
        c.drawRightString(W - MARGIN, 0.42 * inch, foot[2])
        c.restoreState()
    doc = BaseDocTemplate(path, pagesize=letter, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=0.7 * inch, bottomMargin=0.8 * inch,
                          title=pdf_title, author="Barnwright", subject=doc_name, creator="Barnwright")
    frame = Frame(MARGIN, 0.8 * inch, W - 2 * MARGIN, H - 0.7 * inch - 0.8 * inch, id="f", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([PageTemplate(id="p", frames=[frame], onPage=page)])
    count = {"n": 0}
    def counted(*a, **k):
        cv = rl_canvas.Canvas(*a, **k)
        show = cv.showPage
        def showPage():
            count["n"] += 1; show()
        cv.showPage = showPage
        return cv
    doc.build(story, canvasmaker=counted)
    PAGES[doc_name] = count["n"]
    assert count["n"] == 1, f"{doc_name} should be one page, it is {count['n']}"


def hero(head, words, FW):
    t = Table([[[Paragraph("THE BARNWRIGHT 3D DESIGNER", eyebrow), Spacer(1, 6), Paragraph(head, big), Spacer(1, 8), Paragraph(words, hero_sub)]]],
              colWidths=[FW], hAlign="LEFT")
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), BLACK), ("LINEBELOW", (0, 0), (-1, -1), 3, GOLD),
                           ("LEFTPADDING", (0, 0), (-1, -1), 18), ("RIGHTPADDING", (0, 0), (-1, -1), 18),
                           ("TOPPADDING", (0, 0), (-1, -1), 13), ("BOTTOMPADDING", (0, 0), (-1, -1), 15)]))
    return t


def price_strip(FW):
    """No setup fee, $250 a month with the first lot included, $250 one time a lot after that."""
    cells = [("$0", "setup"), (f"${MONTHLY_FEE}", "a month, from the day it's ready"), ("Included", "your first lot"), (f"${LOT_FEE}", "one time, each lot after the first")]
    w = FW / 4
    t = Table([[[Paragraph(a, price_big), Spacer(1, 2), Paragraph(b, price_cap)] for a, b in cells]], colWidths=[w] * 4, hAlign="LEFT")
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), GOLD_SOFT), ("LINEABOVE", (0, 0), (-1, 0), 2, GOLD),
                           ("LINEAFTER", (0, 0), (-2, -1), 0.5, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                           ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10)]))
    return t


def ticks(items):
    return [Paragraph(f"<font color='#85660F'>&#8226;</font>&nbsp; {x}", tick_line) for x in items]


def flyer_pdf(path):
    from reportlab.platypus import Image as Picture
    FW = W - 2 * MARGIN
    half = (FW - 18) / 2
    s = [hero("Let your customers build their shed in 3D.",
              "Your buildings, sizes, colors and prices, on your own web address. "
              "Customers design the building they want, see the price, and send you a quote.", FW),
         Spacer(1, 10)]
    pw = FW * 0.84
    pic = Picture(PICTURE, width=pw, height=pw * 983 / 1600)
    frame = Table([[pic]], colWidths=[pw], hAlign="CENTER")
    frame.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.6, LINE), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                               ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    s += [frame, Spacer(1, 10)]
    left = [Paragraph("What your customers do", col_head)] + ticks([
        "Pick a style and a size, and spin the building around in 3D.",
        "Choose colors, doors, windows and options, and drag them where they want them.",
        "See the price as they go, and a monthly price if you offer rent to own.",
        "Send you a quote with their building, from your website or your lot.",
    ])
    right = [Paragraph("What you get", col_head)] + ticks([
        "<b>Your 3D designer</b> with your logo, colors and prices, on yourname." + DOMAIN + " and your own website.",
        "<b>Your Dealer Center</b>: one price list for every lot, and every customer, quote, follow-up and order.",
        "Your team: an owner, managers and dealers, each seeing their own lots.",
        "Works alongside the software you already use. We set it all up for you.",
    ])
    cols = Table([[left, right]], colWidths=[half + 18, half], hAlign="LEFT")
    cols.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 18),
                              ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    s += [cols, Spacer(1, 10), price_strip(FW), Spacer(1, 10),
          Paragraph("Try it at " + WEB_PAGE + "&nbsp;&nbsp;·&nbsp;&nbsp;" + SALES, contact)]
    sheet(path, s, "Flyer", "The Barnwright 3D designer")


def price_pdf(path):
    FW = W - 2 * MARGIN
    s = [Paragraph("Pricing", title), Paragraph("The Barnwright 3D designer", subtitle), GoldRule(),
         price_strip(FW), Spacer(1, 6)]
    cell = ParagraphStyle("cell", parent=body, fontSize=10, leading=13.6, spaceAfter=0)
    cell_b = ParagraphStyle("cell_b", parent=cell, fontName="Helvetica-Bold")
    money = ParagraphStyle("money", parent=cell_b, alignment=2)
    rows = [
        ("Setup", "Your price list, styles, sizes, colors, logo, web address and website code, set up by us from photos of your buildings, price list and options.", "$0"),
        ("Monthly fee", "Your 3D designer and Dealer Center for your first lot, on your own web address, with hosting, updates, fixes and help. Starts the day your 3D designer is ready.", f"${MONTHLY_FEE} a month"),
        ("Each extra lot", "Its own 3D designer link, its own customers and its own team. Paid once, before the lot opens.", f"${LOT_FEE} one time"),
    ]
    t = Table([[Paragraph(a, cell_b), Paragraph(b, cell), Paragraph(c, money)] for a, b, c in rows],
              colWidths=[1.45 * inch, FW - 1.45 * inch - 1.15 * inch, 1.15 * inch], hAlign="LEFT")
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE),
                           ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                           ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    s += [Paragraph("What it costs", h1), t, Spacer(1, 2)]

    lots = [1, 2, 3, 5, 10]
    head = [Paragraph("Your lots", cell_b)] + [Paragraph(str(n), ParagraphStyle("n", parent=cell_b, alignment=TA_CENTER)) for n in lots]
    pay = [Paragraph("You pay, one time", cell_b)] + [Paragraph("$0" if n == 1 else f"${LOT_FEE * (n - 1):,}", ParagraphStyle("p", parent=cell, alignment=TA_CENTER)) for n in lots]
    month = [Paragraph("Then each month", cell_b)] + [Paragraph(f"${MONTHLY_FEE}", ParagraphStyle("m", parent=cell, alignment=TA_CENTER)) for _ in lots]
    first = 1.55 * inch
    ex = Table([head, pay, month], colWidths=[first] + [(FW - first) / len(lots)] * len(lots), hAlign="LEFT")
    ex.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), GOLD_SOFT), ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE),
                            ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6), ("LEFTPADDING", (0, 0), (-1, -1), 6)]))
    s += [Paragraph("For example", h1), ex, Spacer(1, 2)]

    s += [Paragraph("Everything is included", h1)] + ticks([
        "Your 3D designer: every style, size, color, door, window and option you sell, with your prices and rent to own.",
        "Your Dealer Center: your price list, lots, team, customers, quotes, follow-ups and orders.",
        "Your web address (yourname." + DOMAIN + "), and the code to show your 3D designer on your own website.",
        "Hosting, updates, fixes and help.",
    ])
    s += [Paragraph("How to start", h1)] + [Paragraph(f"<b>{i}.</b>&nbsp; {x}", tick_line) for i, x in enumerate([
        "Alan sends you a sign-up link. Two minutes on your phone.",
        "We build your 3D designer and show you your buildings and prices. You check them.",
        "You open it to your customers.",
    ], 1)]
    s += [Spacer(1, 6), Paragraph("Fees do not include sales tax. Fees are charged to the card you save when you sign up, or paid by invoice if we agree. "
                                  "The " + TERMS_TITLE + " apply.", small),
          Spacer(1, 8), Paragraph("Try it at " + WEB_PAGE + "&nbsp;&nbsp;·&nbsp;&nbsp;" + SALES, contact)]
    sheet(path, s, "Price Sheet", "Barnwright 3D designer pricing")


# ================================================================ 5. WELCOME SHEET (for the owner)
# One page Alan gives the owner when he sets up their computer (Alan, Oct 7
# 2026: "sign up the owner and help him set up on his computer and other
# lots"): signing in, their computer and phone, prices, lots, team, their
# website and help. Big type, black on white with gold marks, so it reads
# well printed.
WELCOME_TITLE = "Welcome to your Barnwright 3D designer"
WELCOME_SUBTITLE = "Everything you need to get started, on one page"
WELCOME = [
    ("Your Dealer Center", "Open <b>https://(your web address)/dealer</b> and sign in with your email and password. Your web address: ____________________." + DOMAIN),
    ("Keep it on your computer", "In Chrome or Edge, click <b>Install</b> at the right end of the address bar. On your phone: <b>Share</b>, <b>Add to Home Screen</b>."),
    ("Your prices", "<b>Price list</b>: your styles, sizes, doors, windows and options. Change a price and every lot has it at once."),
    ("Your lots", "<b>Lots</b>, <b>Add a lot</b>. Each lot has its own 3D designer link and its own customer list."),
    ("Your team", "<b>Team</b>, <b>Add a person</b>: your managers and dealers. Each one makes their own login with the email you add."),
    ("Your website", "<b>Lots</b>, pick a lot, <b>Put the designer on your website</b>, <b>Copy website code</b>, and send it to whoever runs your website."),
    ("New quotes", "Every quote a customer sends shows up in <b>Customers</b> as New, on the lot it came from."),
    ("Your card", "Your monthly fee is charged to the card you saved when you signed up. To use a different card, ask Alan for a new card link."),
    ("Help", "Tap <b>Help</b> in your Dealer Center, or email <b>support@" + DOMAIN + "</b>."),
]


def welcome_pdf(path):
    FW = W - 2 * MARGIN
    big_title = ParagraphStyle("w_title", parent=title, fontSize=24, leading=29, spaceAfter=3)
    big_sub = ParagraphStyle("w_sub", parent=subtitle, fontSize=12.5, leading=16.5, spaceAfter=10)
    num = ParagraphStyle("w_num", fontName="Helvetica-Bold", fontSize=12.5, leading=16, alignment=TA_CENTER, textColor=BLACK)
    head = ParagraphStyle("w_head", fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=BLACK)
    words = ParagraphStyle("w_words", parent=body, fontSize=11.5, leading=15.6, leftIndent=40, spaceAfter=0)
    s = [Paragraph(WELCOME_TITLE, big_title), Paragraph(WELCOME_SUBTITLE, big_sub), GoldRule()]
    for i, (topic, text) in enumerate(WELCOME, 1):
        top = Table([[Paragraph(str(i), num), Paragraph(topic, head)]], colWidths=[28, FW - 28], hAlign="LEFT")
        top.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, 0), GOLD), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                                 ("LEFTPADDING", (0, 0), (0, 0), 0), ("RIGHTPADDING", (0, 0), (0, 0), 0), ("LEFTPADDING", (1, 0), (1, 0), 12),
                                 ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
        s.append(KeepTogether([Spacer(1, 11), top, Spacer(1, 5), Paragraph(text, words)]))
    sheet(path, s, "Welcome Sheet", WELCOME_TITLE, foot=("Barnwright Software", SUPPORT, DOMAIN))


# ---------------------------------------------------------------- where the files go
# With no argument: into the repository (legal/ is published on every
# business's site; docs/legal/ is Alan's and never published). With a folder:
# all of them there, to look at first.
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
if len(sys.argv) > 1:
    terms_out = os.path.join(OUT, "Barnwright Terms and Conditions.pdf")
    terms_json_out = os.path.join(OUT, "terms.json")
    steps_out = os.path.join(OUT, "Barnwright Adding a New Customer.pdf")
    welcome_out = os.path.join(OUT, "Barnwright Welcome Sheet.pdf")
    questions_out = os.path.join(OUT, "Barnwright Setup Questions.pdf")
    flyer_out = os.path.join(OUT, "Barnwright Flyer.pdf")
    price_out = os.path.join(OUT, "Barnwright Price Sheet.pdf")
else:
    os.makedirs(os.path.join(ROOT, "legal"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "docs", "legal"), exist_ok=True)
    terms_out = os.path.join(ROOT, "legal", "barnwright-terms.pdf")
    terms_json_out = os.path.join(ROOT, "docs", "legal", "terms.json")
    steps_out = os.path.join(ROOT, "docs", "legal", "Barnwright-Adding-a-New-Customer.pdf")
    welcome_out = os.path.join(ROOT, "docs", "legal", "Barnwright-Welcome-Sheet.pdf")
    questions_out = os.path.join(ROOT, "docs", "legal", "Barnwright-Setup-Questions.pdf")
    flyer_out = os.path.join(ROOT, "docs", "legal", "Barnwright-Flyer.pdf")
    price_out = os.path.join(ROOT, "docs", "legal", "Barnwright-Price-Sheet.pdf")
terms_pdf(terms_out)
write_json(terms_json_out, terms_json())
steps_pdf(steps_out)
welcome_pdf(welcome_out)
questions_pdf(questions_out)
flyer_pdf(flyer_out)
price_pdf(price_out)
print("written:", terms_out, terms_json_out, steps_out, welcome_out, questions_out, flyer_out, price_out, sep="\n  ")

# THE PAPERS LIST the Control Room's Papers page reads (Alan, Oct 2026: "Add
# all these files in control room so I can access them and keep them up to
# date"). The Control Room fetches this file and each PDF from this
# repository's main branch whenever Alan opens them, so a change merged here
# is what he sees there. Paths are repository paths; nothing here is dated, so
# running the script again changes the list only when a paper changes. The
# Control Room refuses the whole list if one paper breaks its rules
# (control-room netlify/functions/_shared/papers.ts), so they are checked here.
if len(sys.argv) == 1:
    PAPERS = [
        ("adding-a-new-customer", "Adding a New Customer", "you", GUIDE_TITLE,
         "Your steps, from saying hello at their lot to their first quote: the sign-up link, the photos, their Dealer Center, their computer, their other lots and the monthly fee.",
         "docs/legal/Barnwright-Adding-a-New-Customer.pdf", "Barnwright Adding a New Customer.pdf"),
        ("welcome-sheet", "Welcome Sheet", "customer", "Welcome Sheet",
         "Give it to the owner when you set up their computer: signing in, putting it on their computer and phone, prices, lots, team, their website and help.",
         "docs/legal/Barnwright-Welcome-Sheet.pdf", "Barnwright Welcome Sheet.pdf"),
        ("terms", "Terms and Conditions", "customer", "Terms and Conditions",
         "What every owner agrees to on their sign-up page. They also tick I agree in their Dealer Center the first time they sign in.",
         "legal/barnwright-terms.pdf", "Barnwright Terms and Conditions.pdf"),
        ("flyer", "Flyer", "customer", "Flyer",
         "Hand it out or email it to shed companies. It shows the 3D designer, what they get and the price, with your email and web page.",
         "docs/legal/Barnwright-Flyer.pdf", "Barnwright Flyer.pdf"),
        ("price-sheet", "Price Sheet", "customer", "Price Sheet",
         "What it costs: no setup fee, $" + str(MONTHLY_FEE) + " a month with the first lot included, $" + str(LOT_FEE) + " one time for each lot after the first, with examples and how to start.",
         "docs/legal/Barnwright-Price-Sheet.pdf", "Barnwright Price Sheet.pdf"),
        ("setup-questions", "Setup Questions", "customer", "Setup Questions",
         "Only if you can't visit them: they answer it and send it back with photos of their buildings, price list and options.",
         "docs/legal/Barnwright-Setup-Questions.pdf", "Barnwright Setup Questions.pdf"),
    ]
    manifest = {
        "_about": "The papers the Control Room's Papers page shows. Made by tools/legal/make-legal-pdfs.py; "
                  "the Control Room reads this file and each PDF from this repository's main branch.",
        "version": VERSION,
        "papers": [{"id": i, "title": t, "for": who, "about": about, "path": path, "download": dl, "pages": PAGES[doc]}
                   for i, t, who, doc, about, path, dl in PAPERS],
    }
    words_ok = lambda v, most: isinstance(v, str) and v.strip() == v and 0 < len(v) <= most and not re.search(r"[\x00-\x1f\x7f<>]", v)
    assert 0 < len(manifest["papers"]) <= 20 and words_ok(manifest["version"], 100)
    assert len({p["id"] for p in manifest["papers"]}) == len(manifest["papers"]), "two papers have the same id"
    for paper in manifest["papers"]:
        assert re.fullmatch(r"[a-z0-9][a-z0-9-]{0,39}", paper["id"]), paper["id"]
        assert re.fullmatch(r"(legal|docs/legal)/[A-Za-z0-9][A-Za-z0-9-]{0,80}\.pdf", paper["path"]), paper["path"]
        assert re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9 -]{0,80}\.pdf", paper["download"]), paper["download"]
        assert words_ok(paper["title"], 80) and words_ok(paper["about"], 400), paper["id"]
        assert paper["for"] in ("customer", "you") and 0 < paper["pages"] < 1000, paper["id"]
        assert os.path.isfile(os.path.join(ROOT, paper["path"])), paper["path"]
    write_json(os.path.join(ROOT, "docs", "legal", "papers.json"), manifest)
    print("  " + os.path.join(ROOT, "docs", "legal", "papers.json"))
