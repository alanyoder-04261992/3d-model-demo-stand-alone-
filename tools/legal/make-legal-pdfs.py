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

Run:  python3 tools/legal/make-legal-pdfs.py            (into the repository)
      python3 tools/legal/make-legal-pdfs.py <folder>   (all three there, to look at)
Needs: pip install reportlab

When the terms change: change VERSION here and TERMS.version in
server/office/terms.js together, so every owner is asked to agree again."""

import sys, os
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

VERSION = "Version 1.0, October 2026"
BLACK = colors.HexColor("#16130E")
INK = colors.HexColor("#1D1A15")
MUTED = colors.HexColor("#635D52")
GOLD = colors.HexColor("#C9A227")
GOLD_DEEP = colors.HexColor("#85660F")
GOLD_SOFT = colors.HexColor("#F6EED6")
LINE = colors.HexColor("#CFC7B7")
FIELD_BG = colors.HexColor("#FBF8EF")

W, H = letter
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
        self.drawString(MARGIN, H - 0.27 * inch, "BARNWRIGHT")
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
    def __init__(self, name, caption, width, height=20, multiline=False, sign=False, tip=None):
        super().__init__()
        self.name, self.caption, self.w, self.h = name, caption, width, height
        self.multiline, self.sign, self.tip = multiline, sign, tip or caption
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
        c.acroForm.textfield(name=self.name, tooltip=self.tip, x=0, y=0, width=self.w, height=self.h,
                             relative=True, borderStyle="underlined", borderColor=LINE, fillColor=FIELD_BG,
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
        ("1.1", "Barnwright provides online software for selling portable buildings, as listed on your Sign-Up Form. It may include:"),
        ("(a)", "the <b>3D designer</b>, where your customers pick a building, size, colors, doors, windows and options, see a price, and send you a quote request;", "sub"),
        ("(b)", "the <b>Dealer Center</b>, where you set your price list, styles, sizes and options, add your lots and your team, and keep your customers, quotes, follow-ups and orders; and", "sub"),
        ("(c)", "hosting, updates and fixes for as long as this agreement is in place.", "sub"),
        ("1.2", "We may improve, change or replace features over time. We will not take away a main feature you pay for without telling you at least 30 days ahead."),
        ("1.3", "Your plan includes the number of open lots shown on your Sign-Up Form. Opening more lots needs a change to your plan."),
    ]),
    ("2. Setting up your software and the build fee", [
        ("2.1", "You pay the one-time build fee shown on your Sign-Up Form. It covers setting up your software: your price list, your styles and sizes, your colors and logo, your lots, and the links for your website."),
        ("2.2", "You agree to send us, on time and correct, what we need to set you up: your prices, the styles and sizes you sell, your colors, your logo, your contact details, your website addresses and where quote requests should go."),
        ("2.3", "Before your 3D designer goes live, we show you your buildings and prices. You check them and tell us they are right. You are responsible for the prices and choices you approve."),
        ("2.4", "The build fee is not refundable once we have started work, unless your Sign-Up Form says otherwise."),
    ]),
    ("3. Monthly fee and payment", [
        ("3.1", "Your monthly fee starts on your <b>go-live date</b>: the day we tell you in writing (an email is enough) that your software is finished and ready to use. Paying the build fee does not start the monthly fee."),
        ("3.2", "The monthly fee is charged ahead of each month by the payment method on your Sign-Up Form, for example a card or bank payment through our payment processor, or an invoice."),
        ("3.3", "If a payment fails, we try again and tell you. If the fee is still unpaid 15 days after we tell you, we may switch your account off as described in section 9 until it is paid."),
        ("3.4", "Fees do not include sales tax or other taxes. You pay any that apply."),
        ("3.5", "We may change the monthly fee by telling you at least 30 days before the change. If you don't agree, you may end this agreement before the change takes effect."),
    ]),
    ("4. How long this agreement lasts", [
        ("4.1", "This agreement starts when both of us sign the Sign-Up Form. It continues month to month, or for the first term shown on the Sign-Up Form and then month to month, until you or we end it."),
        ("4.2", "Either of us may end it for any reason by giving the other 30 days' written notice. An email to the address on the Sign-Up Form is written notice."),
        ("4.3", "We may end it sooner, or switch your account off, if the fee is not paid (section 3.3), if you seriously break these terms and don't fix it within 10 days after we tell you, or if the software is used against the law."),
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
        ("9.2", "Your account is switched off when we switch it off under section 3.3 or 4.3, or when this agreement ends. It also stops taking changes if it cannot check in for 7 days in a row."),
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
    s.append(Paragraph("For the Barnwright 3D designer and Dealer Center", subtitle))
    s.append(GoldRule())
    s.append(Paragraph(
        "These terms are the agreement between <b>Barnwright</b> and the business named on the "
        "<b>Barnwright Sign-Up Form</b> (\"you\"). They apply together with your signed Sign-Up Form, which lists what "
        "you are buying and what it costs. \"Barnwright\", \"we\" and \"us\" mean the company named as the provider on "
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
    s.append(Paragraph("Barnwright 3D designer and Dealer Center", subtitle))
    s.append(GoldRule())
    s.append(Paragraph("Fill in the boxes on screen (any PDF reader with forms, such as the free Adobe Acrobat Reader) or print it and write in them. "
                       "Both of us sign at the end. This form and the <b>Barnwright Software Terms and Conditions</b> (" + VERSION + ") make up our agreement.", small))
    s.append(Spacer(1, 8))

    s.append(section_band("THE PROVIDER (BARNWRIGHT)"))
    s.append(Spacer(1, 6))
    s.append(row(Field("provider_name", "Legal name", half), Field("provider_email", "Email", half), widths=[half + 12, half]))
    s.append(row(Field("provider_address", "Mailing address", half), Field("provider_phone", "Phone", half), widths=[half + 12, half]))

    s.append(Spacer(1, 4))
    s.append(section_band("A.  YOUR BUSINESS"))
    s.append(Spacer(1, 6))
    s.append(row(Field("business_legal_name", "Legal business name", half), Field("business_dba", "Doing business as (if different)", half), widths=[half + 12, half]))
    s.append(row(Field("business_address", "Business address", half), Field("business_city_state_zip", "City, state and ZIP", half), widths=[half + 12, half]))
    s.append(row(Field("owner_name", "Owner's name", third), Field("owner_title", "Title", third), Field("owner_phone", "Phone", third), widths=[third + 12, third + 12, third]))
    s.append(row(Field("owner_email", "Owner's email (their Dealer Center login)", half), Field("billing_contact", "Billing contact and email", half), widths=[half + 12, half]))
    s.append(Field("websites", "Websites that will show your 3D designer", FW))

    s.append(Spacer(1, 6))
    s.append(section_band("B.  WHAT YOU ARE BUYING"))
    s.append(Spacer(1, 6))
    s.append(row(Check("buy_designer", "<b>3D designer</b>, with your name, colors, logo, styles, sizes and prices", half),
                 Check("buy_dealer_center", "<b>Dealer Center</b>: price list, lots, team, customers, quotes, follow-ups and orders", half), widths=[half + 12, half]))
    s.append(row(Field("lots_included", "Open lots included", third), Field("extra_lot_price", "Each extra lot, a month ($)", third),
                 Check("white_label", "<b>White-label</b> (no \"3D designer by Barnwright\" line)", third), widths=[third + 12, third + 12, third]))
    s.append(Field("other_items", "Anything else included", FW))

    s.append(Spacer(1, 6))
    s.append(section_band("C.  SUPPORT AND YOUR NAME"))
    s.append(Spacer(1, 6))
    s.append(row(Field("support_how", "How to reach Barnwright for help", half), Field("support_hours", "Support hours", half), widths=[half + 12, half]))
    s.append(row(Paragraph("<b>May Barnwright name your business as a customer?</b>", body), Check("name_yes", "Yes", 60), Check("name_no", "No", 60),
                 widths=[half + 12, 80, 80]))

    s.append(PageBreak())
    s.append(section_band("D.  FEES AND PAYMENT"))
    s.append(Spacer(1, 6))
    s.append(row(Field("build_fee", "One-time build fee ($)", third), Field("build_fee_terms", "Build fee paid (for example, all at signing)", third * 2 + 12), widths=[third + 12, third * 2 + 12]))
    s.append(row(Field("monthly_fee", "Monthly fee ($), starting on the go-live date", half), Field("first_term", "First term (month to month, or number of months)", half), widths=[half + 12, half]))
    s.append(Paragraph("<b>Payment method</b>", label))
    s.append(Spacer(1, 3))
    s.append(row(Check("pay_card", "Card", third), Check("pay_bank", "Bank payment (ACH)", third), Check("pay_invoice", "Invoice, due in the days below", third), widths=[third + 12, third + 12, third]))
    s.append(row(Field("invoice_days", "Invoice due in (days)", third), Field("build_refund", "Build fee refund, if any (else none once work starts)", third * 2 + 12), widths=[third + 12, third * 2 + 12]))

    s.append(Spacer(1, 6))
    s.append(section_band("E.  PLEASE INITIAL EACH ONE"))
    s.append(Spacer(1, 8))
    for name, words in [  # each with a little space after
        ("init_prices", "I will check my price list. My business is responsible for every price our customers see and every quote we give (section 6)."),
        ("init_drawings", "The 3D pictures and floor plans are not construction drawings, engineered plans or permit documents (section 6.3)."),
        ("init_rto", "Rent-to-own figures are estimates. Barnwright is not a lender, and our rent-to-own contracts are our responsibility (section 6.4)."),
        ("init_texting", "My business is responsible for texting and emailing customers lawfully, with their permission (section 7)."),
        ("init_readonly", "If the monthly fee isn't paid, or the software can't check in for 7 days, changes stop and our 3D designer links close until it is fixed. We can still look at and download everything (section 9)."),
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
    sig.append(Paragraph("<b>For Barnwright's records:</b> go-live date ______________  (the monthly fee starts on this date, section 3.1)", small))
    s.append(KeepTogether(sig))
    build(path, s, "Sign-Up Form", "Barnwright Sign-Up Form")


# ================================================================ 3. SETUP STEPS
# ================================================================ 3. NEW CUSTOMER SETUP (for Alan)
CONTROL_ROOM = "barnwright-control-room.netlify.app"
REPO = "alanyoder-04261992/3d-model-demo-stand-alone-"

PARTS = [
    ("Part 1. The paperwork", "The day they say yes.", [
        ("Fill in their Sign-Up Form", [
            "Open your <b>Sign-Up Form (blank).pdf</b> template (Barnwright's details already typed in Section C and the provider box).",
            "Fill in <b>Section B</b> (3D designer, Dealer Center, how many open lots, white-label) and <b>Section D</b> (build fee, monthly fee, how they pay) with what you agreed. Save it as <b>Sign-Up Form - (their business).pdf</b>.",
        ]),
        ("Send it with the terms", [
            "Email them the Sign-Up Form <b>and</b> the <b>Barnwright Terms and Conditions.pdf</b> together.",
            "They type in Section A (their business and the <b>owner's email</b>, which becomes their Dealer Center login), initial Section E, sign with <b>Fill and Sign</b> and email it back. You sign it for Barnwright and send them the finished copy.",
            "Save the signed form in a folder for that company.",
        ]),
    ]),
    ("Part 2. The control room", CONTROL_ROOM, [
        ("Add the customer", [
            "Sign in to the control room and tap <b>Add customer</b>.",
            "Type the <b>Business name</b>, <b>Contact person</b>, <b>Email address</b> and <b>Phone</b> from their Sign-Up Form.",
            "<b>Dealership cap</b> is the number of open lots from Section B (the control room says dealerships; the Dealer Center says lots). <b>One-time build fee (USD)</b> and <b>Monthly subscription (USD)</b> are the amounts from Section D.",
            "Leave <b>Application URL</b> and <b>Netlify site ID</b> empty for now (you get them in Part 3). Save.",
        ]),
        ("Collect the build fee", [
            "On the customer, tap <b>Collect build fee</b> and copy the payment link. Email it to them.",
            "Wait until the control room shows the build fee as paid before you start building. The monthly fee does <b>not</b> start yet.",
        ]),
    ]),
    ("Part 3. Their Dealer Center site", "On netlify.com, about 15 minutes.", [
        ("Make their site", [
            "In Netlify: <b>Add new project</b>, <b>Import an existing project</b>, <b>GitHub</b>, then pick <b>" + REPO + "</b>. Keep the build settings it fills in and tap <b>Deploy</b>.",
            "<b>Project configuration, Change project name</b>: use their business, for example <b>cedar-ridge-sheds</b>. Their Dealer Center is then https://cedar-ridge-sheds.netlify.app/dealer (or connect their own web address under <b>Domain management</b>).",
            "Copy the <b>Project ID</b> (also called Site ID) from <b>Project configuration, General</b>. In the control room, open the customer and paste it in <b>Netlify site ID</b>, and paste their site's address in <b>Application URL</b>. Save.",
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
            "Open their site's <b>/dealer</b> address. The sign-in page shows, black and gold.",
            "In the control room, the customer's <b>Software connection</b> fills in after the owner first opens the Dealer Center. <b>Run check</b> confirms it.",
        ]),
    ]),
    ("Part 4. Their owner sets up", "With them on the phone or a screen share, about 30 minutes.", [
        ("Their first sign-in", [
            "Send the owner their link: https://(their site)/dealer. They tap <b>Make your login</b> with the owner's email, confirm it from their email, and sign in.",
            "<b>Step 1, Your business</b>: their name, business name, phone and email, and the box <b>I have read and agree to the Barnwright Software Terms and Conditions</b>. The Dealer Center records who ticked it and when; it shows in <b>Settings, Help from Barnwright</b>.",
            "<b>Step 2</b>: a starting price list. <b>Step 3</b>: their first lot.",
        ]),
        ("Their prices, look and lots", [
            "<b>Price list</b>: turn off the styles they don't sell and type their prices for every size, door, window and option.",
            "<b>Settings</b>: their logo, colors, the line under the price, rent to own, and what the quote form asks.",
            "<b>Lots</b>: add their other lots, up to the open lots in their plan. <b>Team</b>: add their managers and dealers; each gets a message saying how to sign in.",
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
            "Email it to them with their go-live date: \"Your Barnwright software is finished and ready to use as of (date). Your monthly fee of $(amount) starts today. Here is the link to set up the payment.\"",
            "Write the go-live date at the bottom of their signed Sign-Up Form.",
        ]),
        ("Follow up", [
            "Add a reminder in the control room to call them in two weeks.",
            "If something isn't working later, ask them to turn on <b>Help from Barnwright</b> in Settings, then use <b>Run check</b> on their customer in the control room.",
        ]),
    ]),
]


def steps_pdf(path):
    s = [Paragraph("Adding a new customer", title),
         Paragraph("From the day they say yes to the day they go live", subtitle), GoldRule()]
    s.append(Paragraph("Everything you do for a shed company that buys Barnwright, in order: the paperwork, the control room, "
                       "their Dealer Center site, their owner's setup, and the go-live. The words in <b>bold</b> are the buttons and boxes you will see.", lead))
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


# ---------------------------------------------------------------- where the files go
# With no argument: into the repository (legal/ is published on every
# business's site; docs/legal/ is Alan's and never published). With a folder:
# all three there, to look at first.
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
if len(sys.argv) > 1:
    terms_out = os.path.join(OUT, "Barnwright Terms and Conditions.pdf")
    form_out = os.path.join(OUT, "Barnwright Sign-Up Form.pdf")
    steps_out = os.path.join(OUT, "Barnwright Adding a New Customer.pdf")
else:
    os.makedirs(os.path.join(ROOT, "legal"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "docs", "legal"), exist_ok=True)
    terms_out = os.path.join(ROOT, "legal", "barnwright-terms.pdf")
    form_out = os.path.join(ROOT, "docs", "legal", "Barnwright-Sign-Up-Form.pdf")
    steps_out = os.path.join(ROOT, "docs", "legal", "Barnwright-Adding-a-New-Customer.pdf")
terms_pdf(terms_out)
signup_pdf(form_out)
steps_pdf(steps_out)
print("written:", terms_out, form_out, steps_out, sep="\n  ")
