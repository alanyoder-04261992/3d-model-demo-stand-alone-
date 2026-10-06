"""THE BARNWRIGHT SIGN-UP PAPERS, as PDFs (Alan, Oct 2026: "Write terms and
conditions for me to have them sign when I sign them up").

  legal/barnwright-terms.pdf                 the Software Terms and Conditions.
                                             Published on every business's site
                                             (tools/build-site.mjs): the Dealer
                                             Center's "I agree" box links to it
                                             (server/office/terms.js)
  docs/legal/Barnwright-Sign-Up-Form.pdf     the form a new company fills in,
                                             initials and signs (fillable boxes)
  docs/legal/Barnwright-Adding-a-New-Customer.pdf
                                             Alan's steps from "yes" to live
  docs/legal/papers.json                     the list the control room's Papers
                                             page reads (from main on GitHub)
  docs/legal/Barnwright-Setup-Questions.pdf  what a new company answers so its
                                             3D designer, lots, prices and
                                             buildings can be set up (fillable;
                                             its lists come from library/)
  docs/legal/Barnwright-Flyer.pdf            one page to hand out or email to a
                                             shed company (picture: designer.jpg)
  docs/legal/Barnwright-Price-Sheet.pdf      one page: no setup fee, $250 a month
                                             with the first lot, $250 each lot after

Run:  python3 tools/legal/make-legal-pdfs.py            (into the repository)
      python3 tools/legal/make-legal-pdfs.py <folder>   (all of them there, to look at)
Needs: pip install reportlab

When the terms change: change VERSION here and TERMS.version in
server/office/terms.js together, so every owner is asked to agree again."""

import sys, os, re, json
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

VERSION = "Version 1.2, October 2026"
DOMAIN = "barnwrightsoftware.com"   # every business's web address is <their name>.barnwrightsoftware.com
MONTHLY_FEE = 250                   # a month from go-live, for any number of lots; it includes the first lot. No setup fee
LOT_FEE = 250                       # one time, for each lot after the first
PROVIDER = "Barnwright Software"
SALES = "sales@" + DOMAIN
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
    """A labelled box someone can type in (a PDF form field), or a plain line
    to sign on (sign=True: e-signature tools and Fill & Sign put the
    signature there)."""
    def __init__(self, name, caption, width, height=20, multiline=False, sign=False, tip=None, suffix=None, value=""):
        super().__init__()
        self.name, self.caption, self.w, self.h, self.value = name, caption, width, height, value
        self.multiline, self.sign, self.tip, self.suffix = multiline, sign, tip or caption, suffix
    def wrap(self, aw, ah):
        return self.w, self.h + 13
    def draw(self):
        c = self.canv
        c.setFont("Helvetica-Bold", 7.6); c.setFillColor(MUTED)
        c.drawString(0, self.h + 4, self.caption.upper())
        if self.sign:
            c.setStrokeColor(INK); c.setLineWidth(0.8); c.line(0, 2, self.w, 2)
            c.setFont("Helvetica", 7); c.setFillColor(MUTED); c.drawString(2, 5, "Sign here")
            return
        box = self.w
        if self.suffix:   # words printed after the box, like ".barnwrightsoftware.com"
            c.setFont("Helvetica", 10); c.setFillColor(INK)
            box = self.w - c.stringWidth(self.suffix, "Helvetica", 10) - 3
            c.drawString(box + 3, 6, self.suffix)
        c.acroForm.textfield(name=self.name, tooltip=self.tip, x=0, y=0, width=box, height=self.h,
                             relative=True, borderStyle="underlined", borderColor=LINE, fillColor=FIELD_BG, value=self.value,
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


class Initial(Flowable):
    """A short box for initials, with the sentence it confirms."""
    def __init__(self, name, words, width):
        super().__init__(); self.name, self.w = name, width; self.p = Paragraph(words, body)
    def wrap(self, aw, ah):
        _, ph = self.p.wrap(self.w - 62, ah); self.ph = ph; return self.w, max(20, ph) + 6
    def draw(self):
        top = max(20, self.ph)
        self.canv.acroForm.textfield(name=self.name, tooltip="Initials", x=0, y=top - 18, width=44, height=18, relative=True,
                                     borderStyle="underlined", borderColor=INK, fillColor=FIELD_BG, textColor=INK,
                                     fontName="Helvetica-Bold", fontSize=10, borderWidth=1, maxlen=6)
        self.p.drawOn(self.canv, 56, top - self.ph)


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
TERMS = [
    ("1. What you get", [
        ("1.1", "Barnwright provides one product: the <b>Barnwright 3D designer</b>. It includes:"),
        ("(a)", "your <b>3D designer</b>, where your customers pick a building, size, colors, doors, windows and options, see a price, and send you a quote request;", "sub"),
        ("(b)", "your <b>Dealer Center</b>, where you set your price list, styles, sizes and options once for every lot, add your lots and your team, and keep your customers, quotes, follow-ups and orders; and", "sub"),
        ("(c)", "your web address, hosting, updates and fixes for as long as this agreement is in place.", "sub"),
        ("1.2", "The 3D designer stands on its own. It works alongside the software you already use, such as your website, your accounting and your rent-to-own company, and does not replace it. You keep using your own software for contracts, payments, inventory and delivery."),
        ("1.3", "We may improve, change or replace features over time. We will not take away a main feature you use without telling you at least 30 days ahead."),
        ("1.4", "<b>Lots.</b> Your monthly fee includes your first lot. Each lot after the first has a one-time lot fee (section 3) and adds nothing to your monthly fee. To open another lot later, ask us: we add it to your plan once its lot fee is paid."),
        ("1.5", "<b>Your web address.</b> Your 3D designer and Dealer Center are at a web address under " + DOMAIN + ", such as yourbusiness." + DOMAIN + ", which we choose with you. Barnwright owns " + DOMAIN + " and the addresses under it. You may use yours while this agreement is in place, and you may also show your 3D designer on your own websites."),
    ]),
    ("2. Setting up your software", [
        ("2.1", "We set up your 3D designer at no charge: your price list, your styles and sizes, your colors and logo, your lots, your web address, and the code for your website."),
        ("2.2", "You agree to send us, on time and correct, what we need to set you up, such as your answers to the <b>Barnwright Setup Questions</b>: your prices, the styles and sizes you sell and how you build them, your colors, your logo, your lots, your contact details, your website addresses and where quote requests should go."),
        ("2.3", "Before your 3D designer goes live, we show you your buildings and prices. You check them and tell us they are right. You are responsible for the prices and choices you approve."),
    ]),
    ("3. Fees and payment", [
        ("3.1", "There is no setup fee."),
        ("3.2", f"Your <b>monthly fee</b>, shown on your Sign-Up Form (${MONTHLY_FEE} a month unless the form says otherwise), starts on your <b>go-live date</b>: the day we tell you in writing (an email is enough) that your software is finished and ready to use. It includes your first lot, and it is the same for any number of lots."),
        ("3.3", "The monthly fee is charged ahead of each month by the payment method on your Sign-Up Form, for example a card or bank payment through our payment processor, or an invoice."),
        ("3.4", f"Each lot after the first has a <b>one-time lot fee of ${LOT_FEE}</b>, shown on your Sign-Up Form. You pay it before we open that lot. A lot fee is not refundable once the lot is open."),
        ("3.5", "If a payment fails, we try again and tell you. If a fee is still unpaid 15 days after we tell you, we may switch your account off as described in section 9 until it is paid."),
        ("3.6", "Fees do not include sales tax or other taxes. You pay any that apply."),
        ("3.7", "We may change the fees by telling you at least 30 days before the change. A change never charges again for a lot you already paid for. If you don't agree, you may end this agreement before the change takes effect."),
    ]),
    ("4. How long this agreement lasts", [
        ("4.1", "This agreement starts when both of us sign the Sign-Up Form. It continues month to month until you or we end it."),
        ("4.2", "Either of us may end it for any reason by giving the other 30 days' written notice. An email to the address on the Sign-Up Form is written notice."),
        ("4.3", "We may end it sooner, or switch your account off, if a fee is not paid (section 3.5), if you seriously break these terms and don't fix it within 10 days after we tell you, or if the software is used against the law."),
    ]),
    ("5. Your account and your team", [
        ("5.1", "Your owner controls your account: who is on your team, which lots each person sees, and your settings. Your owner is responsible for the people they add."),
        ("5.2", "Keep logins private. Each person uses their own login. Take people off your team when they leave."),
        ("5.3", "Tell us right away if you think someone got into your account who shouldn't have."),
    ]),
    ("6. Your prices, quotes and buildings", [
        ("6.1", "You set your prices, options, rent-to-own terms and the words your customers see. Quotes the software makes use your price list. You are responsible for checking that your price list is correct and for every price you give a customer."),
        ("6.2", "A price shown in the 3D designer is an estimate until you confirm the order with your customer. Tell your customers so, for example in the line under the price."),
        ("6.3", "The 3D pictures and floor plans are drawings to help your customers choose. They are not construction drawings, engineered plans or permit documents. You are responsible for how your buildings are built and delivered, and for building codes, permits, wind and engineering requirements, and the delivery site."),
        ("6.4", "Rent-to-own and other monthly figures are estimates worked out from the numbers you give us. Barnwright is not a lender or a rent-to-own company. Your rent-to-own and financing contracts, the disclosures they need and the laws that apply to them are your responsibility."),
    ]),
    ("7. Texting, email and your customers", [
        ("7.1", "The software can ask your customers for permission to text them, in the words you choose, and shows their phone number and email to your team. You are responsible for following the laws on calling, texting and emailing customers, including getting and keeping their permission and honoring requests to stop (such as a reply of STOP), and including the Telephone Consumer Protection Act, the CAN-SPAM Act and the Florida Telephone Solicitation Act where they apply."),
        ("7.2", "You are responsible for what you and your team send to customers, and for any texting or email service you connect."),
    ]),
    ("8. Your data", [
        ("8.1", "Your data belongs to you: your customers, quotes, orders, notes, price list, logo and settings."),
        ("8.2", "We use your data only to run, support, back up and improve the software for you, and when the law requires it. We do not sell your data, and we do not use your customers' details to market to them."),
        ("8.3", "You can look at and download your data at any time, including while your account is switched off."),
        ("8.4", "You confirm that you have the right to give us the data you put in, including your customers' details."),
        ("8.5", "After this agreement ends we keep your data for 30 days so you can download it. After that we may delete it. Copies in our backups are deleted as those backups are replaced."),
        ("8.6", "We use reasonable security to protect your data. If we learn that someone got into your data without permission, we will tell you without delay and help you with what the law requires."),
    ]),
    ("9. Check-ins, switching off and read-only", [
        ("9.1", "Your software checks in with Barnwright's control room to confirm that your account is on and how many lots you may have open."),
        ("9.2", "Your account is switched off when we switch it off under section 3.5 or 4.3, or when this agreement ends. It also stops taking changes if it cannot check in for 7 days in a row."),
        ("9.3", "While it is switched off, changes can't be saved, your 3D designer links show a short message with your lot's phone number instead of the designer, and quote requests can't be sent. You and your team can still look at and download everything, and taking a person off your team still works."),
        ("9.4", "When the reason is fixed, for example the fee is paid, we switch your account back on. Nothing is deleted while an account is switched off."),
        ("9.5", "You agree not to try to get around the check-ins, the lot limit or the switch."),
    ]),
    ("10. Help from Barnwright", [
        ("10.1", "Barnwright can't look into your Dealer Center unless your owner turns on <b>Help from Barnwright</b> in Settings, for 1 to 24 hours, with a reason. It turns off by itself when the time is up, and your owner can turn it off sooner."),
        ("10.2", "While it is on, we can run checks that show how your Dealer Center is running. Those checks don't show us your customers, prices or settings. Every visit is written in a log your owner can see."),
        ("10.3", "Support is by the ways and at the hours shown on your Sign-Up Form."),
    ]),
    ("11. Using the software the right way", [
        ("", "You agree not to:"),
        ("(a)", "copy, sell, rent or share the software, or give your activation key to anyone else;", "sub"),
        ("(b)", "try to take the software apart or copy how it works;", "sub"),
        ("(c)", "put your 3D designer on websites you don't own or haven't told us about;", "sub"),
        ("(d)", "use it to send spam or to break any law;", "sub"),
        ("(e)", "put in anything that harms the software or other users; or", "sub"),
        ("(f)", "let anyone outside your team use your account.", "sub"),
    ]),
    ("12. Who owns what", [
        ("12.1", "Barnwright owns the software and everything we make for it, including the 3D models, drawings, designs and code, and improvements to them, even when they came from your ideas. You may use the software for your business while this agreement is in place. That right ends when the agreement ends."),
        ("12.2", "You keep owning your business name, your logo and your own content. You let us use them to run your software, for example to show your name and logo in your 3D designer."),
        ("12.3", "Your 3D designer shows a small \"3D designer by Barnwright\" line unless your Sign-Up Form includes white-label."),
        ("12.4", "If you say yes on your Sign-Up Form, we may name your business as a Barnwright customer."),
    ]),
    ("13. Other companies' services", [
        ("", "The software runs on, or connects to, services run by other companies, such as web hosting, email delivery, payment processing, and any form or texting service you connect. Their terms apply to those services. We are not responsible for their outages or changes, but we will work to keep your software running if one of them has a problem."),
    ]),
    ("14. Keeping things running", [
        ("", "We work to keep the software running at all hours, but we can't promise it will never be down, slow or wrong. We may take it down briefly for updates, and we try to do that outside business hours. We fix problems we are responsible for as soon as we reasonably can."),
    ]),
    ("15. Confidential information", [
        ("", "Each of us keeps private the other's business information that isn't public: for you, your prices, customers and sales; for us, the software and our pricing. Each of us uses it only for this agreement and shares it only with people who need it for this agreement and keep it private too. This doesn't cover information that is already public, or that the law requires a party to share."),
    ]),
    ("16. Warranty", [
        ("16.1", "We will provide the software with reasonable care and skill."),
        ("16.2", "Apart from that, the software is provided \"as is\" and \"as available\". As far as the law allows, we make no other promises, including that it is fit for a particular purpose, that it will run without interruption or errors, or that it will bring you any number of sales."),
    ]),
    ("17. Limits on responsibility", [
        ("17.1", "Neither of us is responsible to the other for lost profits, lost sales, lost data that could have been downloaded, or indirect or special damages, even if warned they could happen."),
        ("17.2", "Our total responsibility for all claims under this agreement is limited to the fees you paid us in the 12 months before the claim."),
        ("17.3", "These limits do not apply to fraud or intentional wrongdoing, to amounts you owe us, or to section 18."),
    ]),
    ("18. Covering claims", [
        ("18.1", "You will defend and pay for claims by others that come from your prices, your buildings or their delivery, your contracts with your customers, rent-to-own or financing, your calls, texts or emails, or your breaking this agreement or the law."),
        ("18.2", "We will defend and pay for claims by others that the software, as we provide it, breaks their copyright or patent. If that happens, we may change the software, get the right for you to keep using it, or end this agreement and refund fees you paid ahead for time not used."),
        ("18.3", "The one asking to be covered must tell the other promptly and help with the defense."),
    ]),
    ("19. Changes to these terms", [
        ("", "We may update these terms. We will tell you at least 30 days before a change takes effect and put the new version and date at the top. If you don't agree, you may end this agreement before the change takes effect. Using the software after that date means you accept the change."),
    ]),
    ("20. General", [
        ("20.1", "Florida law governs this agreement. Any lawsuit about it will be brought in the state or federal courts for Charlotte County, Florida, and both of us agree to those courts."),
        ("20.2", "These terms and your signed Sign-Up Form are the whole agreement between us about the software. They replace earlier talks and proposals. If they say different things, the Sign-Up Form wins."),
        ("20.3", "Notices are given by email to the addresses on the Sign-Up Form, or by mail. Keep your contact details up to date."),
        ("20.4", "You may not transfer this agreement without our written permission, which we won't hold back unreasonably if you sell your business. We may transfer it to a company that takes over our business and these terms."),
        ("20.5", "Neither of us is responsible for delays caused by things outside our reasonable control, such as storms, power or internet outages, or outages at other companies' services."),
        ("20.6", "If any part of this agreement can't be enforced, the rest still applies. Not enforcing a part of it is not giving it up."),
        ("20.7", "Electronic signatures, and signed copies sent by email, count as originals. The Sign-Up Form may be signed in separate copies."),
        ("20.8", "Parts that by their nature should continue after the agreement ends, such as fees owed, your data, who owns what, confidential information, limits on responsibility and covering claims, keep applying."),
    ]),
]


def terms_pdf(path):
    s = []
    s.append(Paragraph("Software Terms and Conditions", title))
    s.append(Paragraph("For the Barnwright 3D designer", subtitle))
    s.append(GoldRule())
    s.append(Paragraph(
        "These terms are the agreement between <b>Barnwright Software</b> (" + DOMAIN + ") and the business named on the "
        "<b>Barnwright Sign-Up Form</b> (\"you\"). They apply together with your signed Sign-Up Form, which lists what "
        "you get and any fees. \"Barnwright\", \"we\" and \"us\" mean Barnwright Software, the provider named on "
        "your Sign-Up Form. If the Sign-Up Form and these terms say different things, the Sign-Up Form wins.", lead))
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
    s.append(Spacer(1, 10))
    s.append(GoldRule())
    s.append(Paragraph("You sign these terms by signing the Barnwright Sign-Up Form. Keep a copy of both.", small))
    build(path, s, "Software Terms and Conditions", "Barnwright Software Terms and Conditions")


# ================================================================ 2. SIGN-UP FORM
def signup_pdf(path):
    FW = W - 2 * MARGIN
    half = (FW - 12) / 2
    third = (FW - 24) / 3
    s = []
    s.append(Paragraph("Sign-Up Form", title))
    s.append(Paragraph("The Barnwright 3D designer", subtitle))
    s.append(GoldRule())
    s.append(Paragraph("Fill in the boxes on screen (any PDF reader with forms, such as the free Adobe Acrobat Reader) or print it and write in them. "
                       "Both of us sign at the end. This form and the <b>Barnwright Software Terms and Conditions</b> (" + VERSION + ") make up our agreement.", small))
    s.append(Spacer(1, 8))

    s.append(section_band("THE PROVIDER: BARNWRIGHT SOFTWARE  ·  " + DOMAIN))
    s.append(Spacer(1, 6))
    s.append(row(Field("provider_name", "Legal name", half, value=PROVIDER), Field("provider_email", "Email", half, value=SALES), widths=[half + 12, half]))
    s.append(row(Field("provider_address", "Mailing address", half), Field("provider_phone", "Phone", half), widths=[half + 12, half]))
    s.append(row(Field("support_how", "How to reach Barnwright for help", half), Field("support_hours", "Support hours", half), widths=[half + 12, half]))

    s.append(Spacer(1, 4))
    s.append(section_band("A.  YOUR BUSINESS"))
    s.append(Spacer(1, 6))
    s.append(row(Field("business_legal_name", "Legal business name", half), Field("business_dba", "Doing business as (if different)", half), widths=[half + 12, half]))
    s.append(row(Field("business_address", "Business address", half), Field("business_city_state_zip", "City, state and ZIP", half), widths=[half + 12, half]))
    s.append(row(Field("owner_name", "Owner's name", third), Field("owner_title", "Title", third), Field("owner_phone", "Phone", third), widths=[third + 12, third + 12, third]))
    s.append(row(Field("owner_email", "Owner's email (their Dealer Center login)", half), Field("billing_contact", "Billing contact and email", half), widths=[half + 12, half]))
    s.append(row(Field("web_name", "Your web address (we choose it with you)", half, suffix="." + DOMAIN),
                 Field("websites", "Your websites that will show your 3D designer", half), widths=[half + 12, half]))

    s.append(Spacer(1, 6))
    s.append(section_band("B.  WHAT YOU GET"))
    s.append(Spacer(1, 6))
    s.append(Paragraph("<b>The Barnwright 3D designer</b>, one product: your 3D designer and your Dealer Center, on your own web address. "
                       "It works alongside the software you already use (terms section 1).", body))
    s.append(Spacer(1, 4))
    s.append(row(Field("lots", "How many lots", third),
                 Paragraph(f"Your monthly fee includes your first lot. Each lot after the first is <b>${LOT_FEE} one time</b> "
                           "and adds nothing to the monthly fee (terms section 3).", small),
                 Check("white_label", "<b>White-label</b> (no \"3D designer by Barnwright\" line)", third), widths=[third + 12, third + 12, third]))
    s.append(Field("other_items", "Anything else included", FW))
    s.append(Spacer(1, 4))
    s.append(row(Paragraph("<b>May Barnwright name your business as a customer?</b>", body), Check("name_yes", "Yes", 60), Check("name_no", "No", 60),
                 widths=[half + 12, 80, 80]))

    s.append(PageBreak())
    s.append(section_band("C.  FEES AND PAYMENT"))
    s.append(Spacer(1, 6))
    s.append(Paragraph(f"<b>There is no setup fee.</b> The monthly fee starts on your go-live date and includes your first lot. "
                       f"Each lot after the first is ${LOT_FEE} one time, paid before that lot opens (terms section 3).", body))
    s.append(Spacer(1, 4))
    s.append(row(Field("monthly_fee", "Monthly fee ($), from the go-live date", half, value=str(MONTHLY_FEE)),
                 Paragraph("The same for any number of lots.", small), widths=[half + 12, half]))
    s.append(row(Field("extra_lots", "Lots after the first", third), Field("lot_fees", f"Lot fees (${LOT_FEE} each, $)", third),
                 Field("total_due", "Due now: the lot fees ($)", third), widths=[third + 12, third + 12, third]))
    s.append(Paragraph("<b>Payment method</b>", label))
    s.append(Spacer(1, 3))
    s.append(row(Check("pay_card", "Card", third), Check("pay_bank", "Bank payment (ACH)", third), Check("pay_invoice", "Invoice, due in the days below", third), widths=[third + 12, third + 12, third]))
    s.append(row(Field("invoice_days", "Invoice due in (days)", third), Paragraph("With one lot, nothing is due now: the first payment is the monthly fee on the go-live date.", small),
                 widths=[third + 12, third * 2 + 12]))

    s.append(Spacer(1, 6))
    s.append(section_band("D.  PLEASE INITIAL EACH ONE"))
    s.append(Spacer(1, 8))
    for name, words in [  # each with a little space after
        ("init_prices", "I will check my price list. My business is responsible for every price our customers see and every quote we give (section 6)."),
        ("init_drawings", "The 3D pictures and floor plans are not construction drawings, engineered plans or permit documents (section 6.3)."),
        ("init_rto", "Rent-to-own figures are estimates. Barnwright is not a lender, and our rent-to-own contracts are our responsibility (section 6.4)."),
        ("init_texting", "My business is responsible for texting and emailing customers lawfully, with their permission (section 7)."),
        ("init_readonly", "If a fee isn't paid, or the software can't check in for 7 days, changes stop and our 3D designer links close until it is fixed. We can still look at and download everything (section 9)."),
    ]:
        s.append(Initial(name, words, FW))
        s.append(Spacer(1, 2))

    sig = []
    sig.append(Spacer(1, 6))
    sig.append(section_band("SIGNATURES"))
    sig.append(Spacer(1, 6))
    sig.append(Paragraph("By signing, both of us agree to this Sign-Up Form and the Barnwright Software Terms and Conditions (" + VERSION + "). "
                       "The customer confirms they received and read the terms. Electronic signatures count as originals.", body))
    sig.append(Spacer(1, 8))
    col = half
    hw = (col - 10) / 2
    def party(who, key):
        return [Paragraph(f"<b>{who}</b>", body), Spacer(1, 2), Field(f"{key}_sign", "Signature", col, sign=True), Spacer(1, 4),
                Field(f"{key}_print", "Printed name", col),
                row(Field(f"{key}_title", "Title", hw), Field(f"{key}_date", "Date", hw), widths=[hw + 10, hw])]
    left, right = party("For the customer", "cust"), party("For Barnwright", "bw")
    t = Table([[left, right]], colWidths=[col + 12, col], hAlign="LEFT")
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 12)]))
    sig.append(t)
    sig.append(Spacer(1, 8))
    sig.append(Paragraph("<b>For Barnwright's records:</b> go-live date ______________  (the monthly fee starts on this date, section 3.2)", small))
    s.append(KeepTogether(sig))
    build(path, s, "Sign-Up Form", "Barnwright Sign-Up Form")


# ================================================================ 3. SETUP STEPS
# ================================================================ 3. NEW CUSTOMER SETUP (for Alan)
CONTROL_ROOM = "barnwright-control-room.netlify.app"
# Alan, Oct 6 2026: "add inbox.barnwrightsoftware.com and 3dsetup.barnwrightsoftware.com
# to the links and pdf files or any file on how to add clients".
SALES_INBOX = "inbox." + DOMAIN
SETUP_3D = "3dsetup." + DOMAIN
REPO = "alanyoder-04261992/3d-model-demo-stand-alone-"

PARTS = [
    ("Before your first customer", "Once.", [
        ("Set up " + DOMAIN, [
            "Add <b>" + DOMAIN + "</b> to the Netlify project for your Barnwright website: <b>Domain management, Add a domain</b> (<b>Buy a new domain</b>, or <b>Add a domain you already own</b>).",
            "Next to it, tap <b>Options, Set up Netlify DNS</b> and follow the steps. After that, each customer's web address takes one step (step 6), and Netlify makes the address and its https lock by itself.",
        ]),
    ]),
    ("Part 1. The paperwork", "The day they say yes.", [
        ("Fill in their Sign-Up Form", [
            "Open the <b>Sign-Up Form</b>. Barnwright Software and " + SALES + " are already typed in the provider box; add your mailing address, phone and support hours once and keep that copy as your template.",
            "Fill in <b>Section B</b> (how many lots, white-label) and <b>Section C</b>: the lots after the first, the lot fees ($" + str(LOT_FEE) + " each), the monthly fee ($" + str(MONTHLY_FEE) + ", already typed in) and how they pay. One lot means nothing is due before go-live. There is no setup fee. Save it as <b>Sign-Up Form - (their business).pdf</b>.",
            "Pick their web address with them, for example <b>cedar-ridge-sheds</b>." + DOMAIN + ", and type it in Section A.",
        ]),
        ("Send it with the terms and the questions", [
            "Email them the Sign-Up Form, the <b>Barnwright Terms and Conditions.pdf</b> and the <b>Barnwright Setup Questions.pdf</b> together.",
            "They type in Section A (their business and the <b>owner's email</b>, which becomes their Dealer Center login), initial Section D, sign with <b>Fill and Sign</b> and email it back. You sign it for Barnwright and send them the finished copy.",
            "They send back the Setup Questions with their logo, their price sheet and photos of their buildings. You need them for Part 4.",
            "Save the signed form and their answers in a folder for that company.",
        ]),
    ]),
    ("Part 2. The control room", CONTROL_ROOM, [
        ("Add the customer", [
            "Sign in to the control room and tap <b>Add customer</b>.",
            "Type the <b>Business name</b>, <b>Contact person</b>, <b>Email address</b> and <b>Phone</b> from their Sign-Up Form.",
            "<b>Dealership cap</b> is <b>1</b>, the lot their monthly fee includes (the control room says dealerships; the Dealer Center says lots). It goes up by itself when they pay for more lots. Put <b>0</b> in <b>One-time build fee (USD)</b> (there is no setup fee) and <b>" + str(MONTHLY_FEE) + "</b> in <b>Monthly subscription (USD)</b>.",
            "Leave <b>Application URL</b> and <b>Netlify site ID</b> empty for now (you get them in Part 3). Save.",
        ]),
        ("Collect the lot fees (more than one lot only)", [
            "One lot: skip this step. Nothing is due.",
            "More lots: on the customer, tap <b>Collect lot fee</b>, type the lots after the first (each is <b>$" + str(LOT_FEE) + "</b>, one time), copy the payment link and email it to them.",
            "When Stripe confirms the payment, the control room raises their <b>Dealership cap</b> by that many lots by itself. You can start building before it is paid; their extra lots open once it is. The monthly fee does <b>not</b> start yet.",
        ]),
    ]),
    ("Part 3. Their Dealer Center site", "On netlify.com, about 15 minutes.", [
        ("Make their site", [
            "In Netlify: <b>Add new project</b>, <b>Import an existing project</b>, <b>GitHub</b>, then pick <b>" + REPO + "</b>. Keep the build settings it fills in and tap <b>Deploy</b>.",
            "<b>Project configuration, Change project name</b>: use their web address name, for example <b>cedar-ridge-sheds</b>.",
            "<b>Domain management, Add a domain, Add a domain you already own</b>: type <b>cedar-ridge-sheds." + DOMAIN + "</b> and confirm. Their Dealer Center is then https://cedar-ridge-sheds." + DOMAIN + "/dealer.",
            "Copy the <b>Project ID</b> (also called Site ID) from <b>Project configuration, General</b>. In the control room, open the customer and paste it in <b>Netlify site ID</b>, and put https://cedar-ridge-sheds." + DOMAIN + " in <b>Application URL</b>. Save.",
        ]),
        ("Turn on sign-in", [
            "In Netlify: <b>Project configuration, Identity</b>, tap <b>Enable Identity</b>. Leave registration <b>Open</b>: anybody can make a login, but only people their owner adds can see anything.",
        ]),
        ("Make their activation key", [
            "In the control room, on the customer, tap <b>Create activation key</b>. It shows the key <b>once</b>, with the customer ID, the control room address and the public key. Keep the page open for the next step.",
        ]),
        ("Put the settings on their site", [
            "In Netlify: <b>Project configuration, Environment variables, Add a variable</b>. Add each of these:",
            "<b>OWNER_EMAIL</b>: the owner's email from Section A of their Sign-Up Form.",
            "<b>CONTROL_ROOM_URL</b>: https://" + CONTROL_ROOM,
            "<b>CONTROL_ROOM_CUSTOMER_ID</b>: the customer ID the control room showed.",
            "<b>CONTROL_ROOM_PUBLIC_KEY</b>: the public key, every line of it.",
            "<b>CONTROL_ROOM_ACTIVATION_KEY</b>: the activation key. Tick <b>Contains secret values</b> and choose the <b>Functions</b> scope only.",
            "If you want the Dealer Center to email lots about new quotes and send team invites: <b>RESEND_API_KEY</b> and <b>EMAIL_FROM</b>.",
            "Then <b>Deploys, Trigger deploy, Deploy project</b>, so the settings take effect.",
        ]),
        ("Check it", [
            "Open https://cedar-ridge-sheds." + DOMAIN + "/dealer. The sign-in page shows, black and gold.",
            "In the control room, the customer's <b>Software connection</b> fills in after the owner first opens the Dealer Center. <b>Run check</b> confirms it.",
        ]),
    ]),
    ("Part 4. Their owner sets up", "With them on the phone or a screen share, about 30 minutes.", [
        ("Their first sign-in", [
            "Send the owner their link: https://(their name)." + DOMAIN + "/dealer. They tap <b>Make your login</b> with the owner's email, confirm it from their email, and sign in.",
            "<b>Step 1, Your business</b>: their name, business name, phone and email, and the box <b>I have read and agree to the Barnwright Software Terms and Conditions</b>. The Dealer Center records who ticked it and when; it shows in <b>Settings, Help from Barnwright</b>.",
            "<b>Step 2</b>: a starting price list. <b>Step 3</b>: their first lot.",
        ]),
        ("Their prices, look and lots, from their Setup Questions", [
            "<b>Price list</b>: turn off the styles they don't sell and type their prices for every size, door, window and option.",
            "<b>Settings</b>: their logo, colors, the line under the price, rent to own, and what the quote form asks.",
            "<b>Lots</b>: add their other lots, up to the lots in their plan. <b>Team</b>: add their managers and dealers; each gets a message saying how to sign in.",
            "If they build differently from the standard (section 6 of their answers), ask Claude to set that up for their business before you open it.",
        ]),
        ("Open it to customers", [
            "They open each lot's <b>3D designer link</b> and check the buildings and prices. Then <b>Settings, 3D designer, Open to customers</b>, and save.",
            "<b>Lots</b>, each lot, <b>Put the designer on your website</b>: add their website address, then <b>Copy website code</b> and send it to whoever runs their website.",
            "Send a test quote from a lot's designer link. It shows up in <b>Customers</b> as New.",
        ]),
    ]),
    ("Part 5. Go live", "When everything works.", [
        ("Start the monthly fee", [
            "In the control room, on the customer, tap <b>Start monthly subscription</b>, confirm, and copy the payment link.",
            "Email it to them with their go-live date: \"Your Barnwright 3D designer is finished and ready to use as of (date). Your monthly fee of $" + str(MONTHLY_FEE) + " starts today. Here is the link to set up the payment.\"",
            "Write the go-live date at the bottom of their signed Sign-Up Form.",
        ]),
        ("Follow up", [
            "Add a reminder in the control room to call them in two weeks.",
            "If something isn't working later, ask them to turn on <b>Help from Barnwright</b> in Settings, then use <b>Run check</b> on their customer in the control room.",
        ]),
    ]),
    ("Later. Adding a lot", "When they open another lot.", [
        ("Collect the lot fee", [
            "In the control room, open the customer and tap <b>Collect lot fee</b>. Type how many new lots (each is <b>$" + str(LOT_FEE) + "</b>, one time), then copy the payment link and email it to them.",
            "When Stripe confirms the payment, the control room raises their <b>Dealership cap</b> by that many lots by itself. The monthly fee stays the same.",
            "Their Dealer Center picks up the new number within six hours. Their owner then adds the lot under <b>Lots</b>.",
        ]),
    ]),
]


def steps_pdf(path):
    s = [Paragraph("Adding a new customer", title),
         Paragraph("From the day they say yes to the day they go live", subtitle), GoldRule()]
    s.append(Paragraph("Everything you do for a shed company that signs up for the Barnwright 3D designer, in order: the paperwork, the control room, "
                       "their Dealer Center site at their own ." + DOMAIN + " address, their owner's setup, the go-live, and adding a lot later. "
                       "The words in <b>bold</b> are the buttons and boxes you will see.", lead))
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
    s.append(Paragraph("Changing the terms later: make a new version, email every customer at least 30 days before it takes effect (section 19), "
                       "and their owner is asked to agree again the next time they open the Dealer Center.", small))
    build(path, s, "Adding a new customer", "Barnwright: adding a new customer")


# ================================================================ 4. SETUP QUESTIONS (for the customer)
# What a new company answers so their 3D designer and Dealer Center can be
# set up, and their buildings drawn the way they really build them (Alan,
# Oct 2026: "a list of questions to give to my customers to set up the
# software to their needs ... their barn and their size so we can build the
# barn"). The styles, doors, windows, options, colors and the "how we draw it"
# column come from the designer's own files (library/manufacturers/standard.json
# and library/construction.json), so the questions stay in step with them.

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


# ================================================================ 5. FLYER AND PRICE SHEET
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


def sheet(path, story, doc_name, pdf_title):
    """A one-page sales sheet: the black and gold band, the address at the foot, no page numbers."""
    def page(c, doc):
        c.saveState()
        c.setFillColor(BLACK); c.rect(0, H - 0.42 * inch, W, 0.42 * inch, stroke=0, fill=1)
        c.setFillColor(GOLD); c.rect(0, H - 0.45 * inch, W, 0.03 * inch, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 9.5); c.drawString(MARGIN, H - 0.27 * inch, "BARNWRIGHT SOFTWARE")
        c.setFont("Helvetica", 8.5); c.setFillColor(colors.HexColor("#E8E2D4"))
        c.drawRightString(W - MARGIN, H - 0.27 * inch, DOMAIN)
        c.setStrokeColor(LINE); c.setLineWidth(0.5); c.line(MARGIN, 0.6 * inch, W - MARGIN, 0.6 * inch)
        c.setFont("Helvetica", 8); c.setFillColor(MUTED)
        c.drawString(MARGIN, 0.42 * inch, "Barnwright Software")
        c.drawCentredString(W / 2, 0.42 * inch, SALES)
        c.drawRightString(W - MARGIN, 0.42 * inch, WEB_PAGE)
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
    cells = [("$0", "setup"), (f"${MONTHLY_FEE}", "a month, from go-live"), ("Included", "your first lot"), (f"${LOT_FEE}", "one time, each lot after the first")]
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
        ("Setup", "Your price list, styles, sizes, colors, logo, web address and website code, set up by us from your answers to our Setup Questions.", "$0"),
        ("Monthly fee", "Your 3D designer and Dealer Center for your first lot, on your own web address, with hosting, updates, fixes and help. Starts on your go-live date.", f"${MONTHLY_FEE} a month"),
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
        "Email " + SALES + ". We send you the Sign-Up Form, the terms and the Setup Questions.",
        "Sign the form and answer the questions. Send your logo, price sheet and photos of your buildings.",
        "We build your 3D designer and show you your buildings and prices. You check them.",
        "You open it to your customers.",
    ], 1)]
    s += [Spacer(1, 6), Paragraph("Fees do not include sales tax. Fees are paid by card, bank payment or invoice. "
                                  "The Barnwright Software Terms and Conditions apply.", small),
          Spacer(1, 8), Paragraph("Try it at " + WEB_PAGE + "&nbsp;&nbsp;·&nbsp;&nbsp;" + SALES, contact)]
    sheet(path, s, "Price Sheet", "Barnwright 3D designer pricing")


# ---------------------------------------------------------------- where the files go
# With no argument: into the repository (legal/ is published on every
# business's site; docs/legal/ is Alan's and never published). With a folder:
# all of them there, to look at first.
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
if len(sys.argv) > 1:
    terms_out = os.path.join(OUT, "Barnwright Terms and Conditions.pdf")
    form_out = os.path.join(OUT, "Barnwright Sign-Up Form.pdf")
    steps_out = os.path.join(OUT, "Barnwright Adding a New Customer.pdf")
    questions_out = os.path.join(OUT, "Barnwright Setup Questions.pdf")
    flyer_out = os.path.join(OUT, "Barnwright Flyer.pdf")
    price_out = os.path.join(OUT, "Barnwright Price Sheet.pdf")
else:
    os.makedirs(os.path.join(ROOT, "legal"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "docs", "legal"), exist_ok=True)
    terms_out = os.path.join(ROOT, "legal", "barnwright-terms.pdf")
    form_out = os.path.join(ROOT, "docs", "legal", "Barnwright-Sign-Up-Form.pdf")
    steps_out = os.path.join(ROOT, "docs", "legal", "Barnwright-Adding-a-New-Customer.pdf")
    questions_out = os.path.join(ROOT, "docs", "legal", "Barnwright-Setup-Questions.pdf")
    flyer_out = os.path.join(ROOT, "docs", "legal", "Barnwright-Flyer.pdf")
    price_out = os.path.join(ROOT, "docs", "legal", "Barnwright-Price-Sheet.pdf")
terms_pdf(terms_out)
signup_pdf(form_out)
steps_pdf(steps_out)
questions_pdf(questions_out)
flyer_pdf(flyer_out)
price_pdf(price_out)
print("written:", terms_out, form_out, steps_out, questions_out, flyer_out, price_out, sep="\n  ")

# THE PAPERS LIST the control room's Papers page reads (Alan, Oct 2026: "Add
# all these files in control room so I can access them and keep them up to
# date"). The control room fetches this file and each PDF from this
# repository's main branch whenever Alan opens them, so a change merged here
# is what he sees there. Paths are repository paths; nothing here is dated, so
# running the script again changes the list only when a paper changes.
if len(sys.argv) == 1:
    PAPERS = [
        ("sign-up-form", "Sign-Up Form", "customer", "Sign-Up Form",
         "Fill in sections B and C (lots and fees), then send it with the terms and the Setup Questions. They fill in section A, initial and sign; you sign for Barnwright.",
         "docs/legal/Barnwright-Sign-Up-Form.pdf", "Barnwright Sign-Up Form.pdf"),
        ("terms", "Terms and Conditions", "customer", "Software Terms and Conditions",
         "Send it with the Sign-Up Form. Their owner also ticks I agree to it in the Dealer Center's first setup.",
         "legal/barnwright-terms.pdf", "Barnwright Terms and Conditions.pdf"),
        ("setup-questions", "Setup Questions", "customer", "Setup Questions",
         "Send it with the Sign-Up Form. They answer it and send it back with their logo, price sheet and photos, so you can set them up and build their buildings their way.",
         "docs/legal/Barnwright-Setup-Questions.pdf", "Barnwright Setup Questions.pdf"),
        ("adding-a-new-customer", "Adding a New Customer", "you", "Adding a new customer",
         "Your steps from the day they say yes to the day they go live, and adding a lot later.",
         "docs/legal/Barnwright-Adding-a-New-Customer.pdf", "Barnwright Adding a New Customer.pdf"),
        ("flyer", "Flyer", "customer", "Flyer",
         "Hand it out or email it to shed companies. It shows the 3D designer, what they get and the price, with your email and web page.",
         "docs/legal/Barnwright-Flyer.pdf", "Barnwright Flyer.pdf"),
        ("price-sheet", "Price Sheet", "customer", "Price Sheet",
         "What it costs: no setup fee, $" + str(MONTHLY_FEE) + " a month with the first lot included, $" + str(LOT_FEE) + " one time for each lot after the first, with examples and how to start.",
         "docs/legal/Barnwright-Price-Sheet.pdf", "Barnwright Price Sheet.pdf"),
    ]
    manifest = {
        "_about": "The papers the control room's Papers page shows. Made by tools/legal/make-legal-pdfs.py; "
                  "the control room reads this file and each PDF from this repository's main branch.",
        "version": VERSION,
        "papers": [{"id": i, "title": t, "for": who, "about": about, "path": path, "download": dl, "pages": PAGES[doc]}
                   for i, t, who, doc, about, path, dl in PAPERS],
    }
    for paper in manifest["papers"]:
        assert os.path.isfile(os.path.join(ROOT, paper["path"])), paper["path"]
    with open(os.path.join(ROOT, "docs", "legal", "papers.json"), "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print("  " + os.path.join(ROOT, "docs", "legal", "papers.json"))
