import base64
import io
import re
from datetime import date
from decimal import Decimal

from flask import request, send_file
from flask_login import current_user, login_required
from flask_restx import Resource
from fpdf import FPDF, XPos, YPos
from marshmallow import Schema, fields

from app.db.contacts import Organization
from app.db.invoicing import (
    CompanySettings,
    CompanySettingsSchema,
    CustomerInvoice,
    CustomerInvoiceLine,
    CustomerInvoiceListItemSchema,
    CustomerInvoiceSchema,
    InvoiceStatus,
)
from app.db.workspace import Workspace, WorkspaceMember
from app.errors import APIError, APIErrorEnum
from app.extensions import api, db


def _assert_workspace_member(workspace_id: int) -> Workspace:
    workspace = db.session.get(Workspace, workspace_id)
    if workspace is None:
        raise APIError(APIErrorEnum.workspace_not_found, "Workspace not found", 404)

    member = WorkspaceMember.query.filter_by(
        workspace_id=workspace_id, user_id=current_user.id
    ).first()
    if member is None:
        raise APIError(
            APIErrorEnum.not_workspace_member, "Not a member of this workspace", 403
        )
    return workspace


def _get_or_create_settings(workspace_id: int) -> CompanySettings:
    settings = CompanySettings.query.filter_by(workspace_id=workspace_id).first()
    if settings is None:
        settings = CompanySettings(workspace_id=workspace_id)
        db.session.add(settings)
        db.session.commit()
    return settings


# --- Company settings ---------------------------------------------------------


class CompanySettingsInputSchema(Schema):
    company_name = fields.String(load_default=None, allow_none=True)
    email = fields.String(load_default=None, allow_none=True)
    phone = fields.String(load_default=None, allow_none=True)
    website = fields.String(load_default=None, allow_none=True)
    vat_number = fields.String(load_default=None, allow_none=True)
    kvk_number = fields.String(load_default=None, allow_none=True)
    iban = fields.String(load_default=None, allow_none=True)
    address_line1 = fields.String(load_default=None, allow_none=True)
    address_line2 = fields.String(load_default=None, allow_none=True)
    postal_code = fields.String(load_default=None, allow_none=True)
    city = fields.String(load_default=None, allow_none=True)
    country = fields.String(load_default=None, allow_none=True)
    default_vat_rate = fields.Decimal(load_default=None, allow_none=True)
    invoice_prefix = fields.String(load_default=None, allow_none=True)
    next_invoice_number = fields.Integer(load_default=None, allow_none=True)
    footer_text = fields.String(load_default=None, allow_none=True)
    logo_data_url = fields.String(load_default=None, allow_none=True)


@api.route("/workspaces/<int:workspace_id>/company-settings")
class CompanySettingsResource(Resource):
    @login_required
    def get(self, workspace_id: int):
        _assert_workspace_member(workspace_id)
        settings = _get_or_create_settings(workspace_id)
        return CompanySettingsSchema().dump(settings)

    @login_required
    def put(self, workspace_id: int):
        _assert_workspace_member(workspace_id)
        settings = _get_or_create_settings(workspace_id)

        data: dict = CompanySettingsInputSchema().load(request.get_json() or {})
        for field in (
            "company_name",
            "email",
            "phone",
            "website",
            "vat_number",
            "kvk_number",
            "iban",
            "address_line1",
            "address_line2",
            "postal_code",
            "city",
            "country",
            "invoice_prefix",
            "footer_text",
            "logo_data_url",
        ):
            if field in data:
                setattr(settings, field, data[field])

        if data.get("default_vat_rate") is not None:
            settings.default_vat_rate = Decimal(str(data["default_vat_rate"]))
        if data.get("next_invoice_number") is not None:
            settings.next_invoice_number = int(data["next_invoice_number"])

        db.session.commit()
        return CompanySettingsSchema().dump(settings)


# --- Invoices -----------------------------------------------------------------


class InvoiceLineInputSchema(Schema):
    description = fields.String(required=True)
    quantity = fields.Decimal(load_default=Decimal("1"), allow_none=True)
    unit_price = fields.Decimal(load_default=Decimal("0"), allow_none=True)
    vat_rate = fields.Decimal(load_default=None, allow_none=True)


class InvoiceInputSchema(Schema):
    organization_id = fields.Integer(load_default=None, allow_none=True)
    invoice_number = fields.String(load_default=None, allow_none=True)
    status = fields.String(load_default=None, allow_none=True)
    issue_date = fields.Date(load_default=None, allow_none=True)
    due_date = fields.Date(load_default=None, allow_none=True)
    currency = fields.String(load_default=None, allow_none=True)
    vat_rate = fields.Decimal(load_default=None, allow_none=True)
    notes = fields.String(load_default=None, allow_none=True)
    lines = fields.List(fields.Nested(InvoiceLineInputSchema), load_default=list)

    # Recipient (free-form override; if organization_id is set the snapshot is
    # taken from the organization unless these fields are explicitly provided).
    recipient_name = fields.String(load_default=None, allow_none=True)
    recipient_email = fields.String(load_default=None, allow_none=True)
    recipient_address_line1 = fields.String(load_default=None, allow_none=True)
    recipient_address_line2 = fields.String(load_default=None, allow_none=True)
    recipient_postal_code = fields.String(load_default=None, allow_none=True)
    recipient_city = fields.String(load_default=None, allow_none=True)
    recipient_country = fields.String(load_default=None, allow_none=True)
    recipient_vat_number = fields.String(load_default=None, allow_none=True)
    recipient_kvk_number = fields.String(load_default=None, allow_none=True)


def _next_invoice_number(settings: CompanySettings) -> str:
    prefix = settings.invoice_prefix or ""
    number = settings.next_invoice_number or 1
    settings.next_invoice_number = number + 1
    formatted = f"{prefix}{str(number).zfill(4)}" if prefix else str(number).zfill(4)
    return formatted


def _resolve_recipient(
    workspace_id: int, data: dict
) -> tuple[Organization | None, dict]:
    organization: Organization | None = None
    if data.get("organization_id"):
        organization = Organization.query.filter_by(
            id=data["organization_id"], workspace_id=workspace_id
        ).first()
        if organization is None:
            raise APIError(APIErrorEnum.unknown_error, "Organization not found", 404)

    snapshot: dict = {}
    if organization is not None:
        snapshot = {
            "recipient_name": organization.name,
            "recipient_email": organization.email,
            "recipient_address_line1": organization.address_line1,
            "recipient_address_line2": organization.address_line2,
            "recipient_postal_code": organization.postal_code,
            "recipient_city": organization.city,
            "recipient_country": organization.country,
            "recipient_vat_number": organization.vat_number,
            "recipient_kvk_number": organization.kvk_number,
        }

    for key in (
        "recipient_name",
        "recipient_email",
        "recipient_address_line1",
        "recipient_address_line2",
        "recipient_postal_code",
        "recipient_city",
        "recipient_country",
        "recipient_vat_number",
        "recipient_kvk_number",
    ):
        if data.get(key) is not None:
            snapshot[key] = data[key]

    if not snapshot.get("recipient_name"):
        raise APIError(
            APIErrorEnum.unknown_error,
            "A recipient name (or organization) is required",
            400,
        )
    return organization, snapshot


def _sender_snapshot(settings: CompanySettings) -> dict:
    return {
        "sender_name": settings.company_name,
        "sender_email": settings.email,
        "sender_phone": settings.phone,
        "sender_website": settings.website,
        "sender_vat_number": settings.vat_number,
        "sender_kvk_number": settings.kvk_number,
        "sender_iban": settings.iban,
        "sender_address_line1": settings.address_line1,
        "sender_address_line2": settings.address_line2,
        "sender_postal_code": settings.postal_code,
        "sender_city": settings.city,
        "sender_country": settings.country,
        "sender_logo_data_url": settings.logo_data_url,
        "sender_footer_text": settings.footer_text,
    }


def _apply_lines(
    invoice: CustomerInvoice,
    lines_data: list[dict],
    default_vat_rate: Decimal,
) -> None:
    invoice.lines.clear()
    for index, line_data in enumerate(lines_data):
        description = (line_data.get("description") or "").strip()
        if not description:
            continue
        quantity = line_data.get("quantity")
        if quantity is None:
            quantity = Decimal("1")
        unit_price = line_data.get("unit_price")
        if unit_price is None:
            unit_price = Decimal("0")
        vat_rate = line_data.get("vat_rate")
        if vat_rate is None:
            vat_rate = default_vat_rate
        invoice.lines.append(
            CustomerInvoiceLine(
                position=index,
                description=description,
                quantity=Decimal(str(quantity)),
                unit_price=Decimal(str(unit_price)),
                vat_rate=Decimal(str(vat_rate)),
            )
        )


@api.route("/workspaces/<int:workspace_id>/invoices")
class InvoiceList(Resource):
    @login_required
    def get(self, workspace_id: int):
        _assert_workspace_member(workspace_id)
        invoices = (
            CustomerInvoice.query.filter_by(workspace_id=workspace_id)
            .order_by(CustomerInvoice.created_at.desc())
            .all()
        )
        return CustomerInvoiceListItemSchema(many=True).dump(invoices)

    @login_required
    def post(self, workspace_id: int):
        _assert_workspace_member(workspace_id)
        settings = _get_or_create_settings(workspace_id)

        data: dict = InvoiceInputSchema().load(request.get_json() or {})
        organization, recipient_snapshot = _resolve_recipient(workspace_id, data)

        invoice_number = data.get("invoice_number")
        if not invoice_number:
            invoice_number = _next_invoice_number(settings)

        vat_rate = data.get("vat_rate")
        if vat_rate is None:
            vat_rate = settings.default_vat_rate or Decimal("21.00")

        invoice = CustomerInvoice(
            workspace_id=workspace_id,
            organization_id=organization.id if organization is not None else None,
            invoice_number=invoice_number,
            status=data.get("status") or InvoiceStatus.DRAFT,
            issue_date=data.get("issue_date") or date.today(),
            due_date=data.get("due_date"),
            currency=data.get("currency") or "EUR",
            vat_rate=Decimal(str(vat_rate)),
            notes=data.get("notes"),
            **recipient_snapshot,
            **_sender_snapshot(settings),
        )

        _apply_lines(invoice, data.get("lines") or [], invoice.vat_rate)

        db.session.add(invoice)
        db.session.commit()
        return CustomerInvoiceSchema().dump(invoice)


@api.route("/workspaces/<int:workspace_id>/invoices/<int:invoice_id>")
class InvoiceDetail(Resource):
    @login_required
    def get(self, workspace_id: int, invoice_id: int):
        _assert_workspace_member(workspace_id)
        invoice = CustomerInvoice.query.filter_by(
            id=invoice_id, workspace_id=workspace_id
        ).first()
        if invoice is None:
            raise APIError(APIErrorEnum.unknown_error, "Invoice not found", 404)
        return CustomerInvoiceSchema().dump(invoice)

    @login_required
    def put(self, workspace_id: int, invoice_id: int):
        _assert_workspace_member(workspace_id)
        invoice = CustomerInvoice.query.filter_by(
            id=invoice_id, workspace_id=workspace_id
        ).first()
        if invoice is None:
            raise APIError(APIErrorEnum.unknown_error, "Invoice not found", 404)

        data: dict = InvoiceInputSchema().load(request.get_json() or {})
        organization, recipient_snapshot = _resolve_recipient(workspace_id, data)
        invoice.organization_id = organization.id if organization is not None else None
        for key, value in recipient_snapshot.items():
            setattr(invoice, key, value)

        if data.get("invoice_number"):
            invoice.invoice_number = data["invoice_number"]
        if data.get("status"):
            invoice.status = data["status"]
        if data.get("issue_date"):
            invoice.issue_date = data["issue_date"]
        if "due_date" in data:
            invoice.due_date = data["due_date"]
        if data.get("currency"):
            invoice.currency = data["currency"]
        if data.get("vat_rate") is not None:
            invoice.vat_rate = Decimal(str(data["vat_rate"]))
        if "notes" in data:
            invoice.notes = data["notes"]

        if "lines" in data:
            _apply_lines(invoice, data.get("lines") or [], invoice.vat_rate)

        db.session.commit()
        return CustomerInvoiceSchema().dump(invoice)

    @login_required
    def delete(self, workspace_id: int, invoice_id: int):
        _assert_workspace_member(workspace_id)
        invoice = CustomerInvoice.query.filter_by(
            id=invoice_id, workspace_id=workspace_id
        ).first()
        if invoice is None:
            raise APIError(APIErrorEnum.unknown_error, "Invoice not found", 404)
        db.session.delete(invoice)
        db.session.commit()
        return {"ok": True}


# --- PDF generation -----------------------------------------------------------

_DATA_URL_RE = re.compile(r"^data:image/(?P<ext>[a-zA-Z0-9+.-]+);base64,(?P<data>.+)$")


def _decode_logo(data_url: str | None) -> tuple[bytes, str] | None:
    if not data_url:
        return None
    match = _DATA_URL_RE.match(data_url.strip())
    if not match:
        return None
    ext = match.group("ext").lower()
    if ext == "jpeg":
        ext = "jpg"
    if ext not in ("png", "jpg", "gif"):
        return None
    try:
        raw = base64.b64decode(match.group("data"))
    except Exception:
        return None
    return raw, ext


def _latin1(text: str | None) -> str:
    """Encode for FPDF's standard fonts (cp1252 covers €, plus common quotes)."""
    if text is None:
        return ""
    replacements = {
        "—": "-",
        "–": "-",
        "•": "*",
        "·": "*",
        "’": "'",
        "‘": "'",
        "“": '"',
        "”": '"',
        "…": "...",
    }
    for char, sub in replacements.items():
        text = text.replace(char, sub)
    return text.encode("cp1252", errors="replace").decode("cp1252")


_CURRENCY_SYMBOLS = {"EUR": "€", "USD": "$", "GBP": "£"}


def _currency_symbol(currency: str) -> str:
    return _CURRENCY_SYMBOLS.get(currency.upper(), currency)


def _format_money(amount: Decimal, currency: str) -> str:
    # Dutch number formatting: thousands with '.', decimals with ','.
    formatted = f"{amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return _latin1(f"{_currency_symbol(currency)} {formatted}")


def _generate_invoice_pdf(invoice: CustomerInvoice) -> bytes:
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    page_w = pdf.w
    margin = 20
    content_w = page_w - 2 * margin

    dark = (26, 26, 46)
    gray = (107, 114, 128)
    light_gray = (156, 163, 175)
    border_color = (229, 231, 235)
    strong_border = (160, 160, 170)

    header_y = 20
    pdf.set_y(header_y)

    logo = _decode_logo(invoice.sender_logo_data_url)
    logo_offset = 0
    if logo is not None:
        raw, ext = logo
        try:
            pdf.image(io.BytesIO(raw), x=margin, y=header_y, w=24, h=24)
            logo_offset = 28
        except Exception:
            logo_offset = 0

    sender_name = invoice.sender_name or ""
    pdf.set_xy(margin + logo_offset, header_y)
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(*dark)
    pdf.cell(
        100,
        7,
        _latin1(sender_name),
        new_x=XPos.LMARGIN,
        new_y=YPos.NEXT,
    )

    pdf.set_xy(margin + logo_offset, header_y + 8)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*gray)
    sender_address_lines = [
        invoice.sender_address_line1,
        invoice.sender_address_line2,
        " ".join(
            part for part in (invoice.sender_postal_code, invoice.sender_city) if part
        )
        or None,
        invoice.sender_country,
    ]
    line_y = header_y + 8
    for line in sender_address_lines:
        if not line:
            continue
        pdf.set_xy(margin + logo_offset, line_y)
        pdf.cell(100, 4.5, _latin1(line))
        line_y += 4.5

    pdf.set_font("Helvetica", "", 28)
    pdf.set_text_color(*dark)
    pdf.set_xy(page_w - margin - 80, header_y - 2)
    pdf.cell(80, 14, "Factuur", align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*gray)
    pdf.set_xy(page_w - margin - 80, header_y + 14)
    pdf.cell(
        80,
        5,
        f"#{_latin1(invoice.invoice_number)}",
        align="R",
        new_x=XPos.LMARGIN,
        new_y=YPos.NEXT,
    )

    block_bottom = max(line_y, header_y + 24) + 6
    pdf.set_y(block_bottom)
    pdf.set_draw_color(*border_color)
    pdf.set_line_width(0.3)
    pdf.line(margin, pdf.get_y(), page_w - margin, pdf.get_y())
    pdf.ln(8)

    meta_y = pdf.get_y()
    col_w = content_w / 2

    # Invoice details (left)
    pdf.set_xy(margin, meta_y)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(*light_gray)
    pdf.cell(col_w, 5, "FACTUURGEGEVENS", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def detail_row(y_offset: float, label: str, value: str) -> None:
        pdf.set_xy(margin, meta_y + y_offset)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*gray)
        pdf.cell(32, 5.5, label)
        pdf.set_text_color(*dark)
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(col_w - 32, 5.5, _latin1(value))

    status_labels = {"draft": "Concept", "sent": "Verzonden", "paid": "Betaald"}
    issue = invoice.issue_date.strftime("%d-%m-%Y") if invoice.issue_date else "-"
    due = invoice.due_date.strftime("%d-%m-%Y") if invoice.due_date else "-"
    detail_row(8, "Factuurdatum:", issue)
    detail_row(15, "Vervaldatum:", due)
    detail_row(22, "Status:", status_labels.get(invoice.status, invoice.status))

    # Bill to (right)
    bill_x = margin + col_w
    pdf.set_xy(bill_x, meta_y)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(*light_gray)
    pdf.cell(col_w, 5, "FACTUURADRES", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_xy(bill_x, meta_y + 8)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*dark)
    pdf.cell(col_w, 5.5, _latin1(invoice.recipient_name))

    bill_lines = [
        invoice.recipient_address_line1,
        invoice.recipient_address_line2,
        " ".join(
            part
            for part in (invoice.recipient_postal_code, invoice.recipient_city)
            if part
        )
        or None,
        invoice.recipient_country,
        invoice.recipient_email,
    ]
    bill_y = meta_y + 14
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*gray)
    for line in bill_lines:
        if not line:
            continue
        pdf.set_xy(bill_x, bill_y)
        pdf.cell(col_w, 4.5, _latin1(line))
        bill_y += 4.5

    if invoice.recipient_vat_number:
        pdf.set_xy(bill_x, bill_y)
        pdf.cell(col_w, 4.5, _latin1(f"BTW: {invoice.recipient_vat_number}"))
        bill_y += 4.5

    table_top = max(meta_y + 32, bill_y) + 6
    pdf.set_y(table_top)

    # Line items table — minimal style: bold header on white, bottom border.
    hdr_h = 9

    col_desc = content_w * 0.40
    col_qty = content_w * 0.10
    col_unit = content_w * 0.14
    col_vat_pct = content_w * 0.08
    col_vat_amt = content_w * 0.13
    col_amount = content_w * 0.15

    pdf.set_xy(margin, table_top)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*dark)
    pdf.cell(col_desc, hdr_h, "Omschrijving")
    pdf.cell(col_qty, hdr_h, "Aantal", align="R")
    pdf.cell(col_unit, hdr_h, "Prijs", align="R")
    pdf.cell(col_vat_pct, hdr_h, "BTW %", align="R")
    pdf.cell(col_vat_amt, hdr_h, "BTW", align="R")
    pdf.cell(
        col_amount,
        hdr_h,
        "Bedrag",
        align="R",
        new_x=XPos.LMARGIN,
        new_y=YPos.NEXT,
    )

    pdf.set_draw_color(*strong_border)
    pdf.set_line_width(0.4)
    pdf.line(margin, table_top + hdr_h, page_w - margin, table_top + hdr_h)

    row_y = table_top + hdr_h
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*dark)

    for line in invoice.lines:
        row_h = 9
        pdf.set_xy(margin, row_y)
        pdf.set_text_color(*dark)
        pdf.cell(col_desc, row_h, _latin1(line.description))
        pdf.cell(col_qty, row_h, f"{line.quantity.normalize():f}", align="R")
        pdf.cell(
            col_unit,
            row_h,
            _format_money(line.unit_price, invoice.currency),
            align="R",
        )
        pdf.cell(col_vat_pct, row_h, f"{line.vat_rate.normalize():f}%", align="R")
        pdf.set_text_color(*gray)
        pdf.cell(
            col_vat_amt,
            row_h,
            _format_money(line.line_vat, invoice.currency),
            align="R",
        )
        pdf.set_text_color(*dark)
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(
            col_amount,
            row_h,
            _format_money(line.line_total, invoice.currency),
            align="R",
            new_x=XPos.LMARGIN,
            new_y=YPos.NEXT,
        )
        pdf.set_font("Helvetica", "", 9)
        row_y += row_h

    pdf.set_draw_color(*border_color)
    pdf.set_line_width(0.2)
    pdf.line(margin, row_y, page_w - margin, row_y)

    # Totals
    totals_y = row_y + 8
    totals_x = page_w - margin - 80

    subtotal = invoice.subtotal
    breakdown = invoice.vat_breakdown
    total = invoice.total

    pdf.set_xy(totals_x, totals_y)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*gray)
    pdf.cell(40, 6, "Subtotaal")
    pdf.set_text_color(*dark)
    pdf.cell(
        40,
        6,
        _format_money(subtotal, invoice.currency),
        align="R",
        new_x=XPos.LMARGIN,
        new_y=YPos.NEXT,
    )

    cursor_y = totals_y + 7
    for bucket in breakdown:
        pdf.set_xy(totals_x, cursor_y)
        pdf.set_text_color(*gray)
        pdf.cell(40, 6, f"BTW ({bucket['rate'].normalize():f}%)")
        pdf.set_text_color(*dark)
        pdf.cell(
            40,
            6,
            _format_money(bucket["vat"], invoice.currency),
            align="R",
            new_x=XPos.LMARGIN,
            new_y=YPos.NEXT,
        )
        cursor_y += 6

    div_y = cursor_y + 2
    pdf.set_draw_color(*strong_border)
    pdf.set_line_width(0.4)
    pdf.line(totals_x, div_y, page_w - margin, div_y)

    pdf.set_xy(totals_x, div_y + 3)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*dark)
    pdf.cell(40, 8, "Totaal")
    pdf.set_text_color(*dark)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(
        40,
        8,
        _format_money(total, invoice.currency),
        align="R",
        new_x=XPos.LMARGIN,
        new_y=YPos.NEXT,
    )

    if invoice.notes:
        pdf.ln(12)
        pdf.set_x(margin)
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(*light_gray)
        pdf.cell(content_w, 5, "OPMERKINGEN", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*dark)
        pdf.set_x(margin)
        pdf.multi_cell(content_w, 5, _latin1(invoice.notes))

    if invoice.sender_iban or invoice.sender_footer_text:
        pdf.ln(6)
        pdf.set_x(margin)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*gray)
        if invoice.sender_iban:
            pdf.cell(
                content_w,
                4.5,
                _latin1(f"Gelieve over te maken naar: {invoice.sender_iban}"),
                new_x=XPos.LMARGIN,
                new_y=YPos.NEXT,
            )
        if invoice.sender_footer_text:
            pdf.set_x(margin)
            pdf.multi_cell(content_w, 4.5, _latin1(invoice.sender_footer_text))

    return bytes(pdf.output())


@api.route("/workspaces/<int:workspace_id>/invoices/<int:invoice_id>/pdf")
class InvoicePdf(Resource):
    @login_required
    def get(self, workspace_id: int, invoice_id: int):
        _assert_workspace_member(workspace_id)
        invoice = CustomerInvoice.query.filter_by(
            id=invoice_id, workspace_id=workspace_id
        ).first()
        if invoice is None:
            raise APIError(APIErrorEnum.unknown_error, "Invoice not found", 404)

        pdf_bytes = _generate_invoice_pdf(invoice)
        filename = f"invoice-{invoice.invoice_number or invoice.id}.pdf"
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename,
        )
