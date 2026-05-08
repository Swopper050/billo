from datetime import date, datetime
from decimal import Decimal

from marshmallow import Schema, fields
from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.fields import UTCDateTime
from app.extensions import db


class CompanySettings(db.Model):
    """Per-workspace settings used as the sender on invoices."""

    __tablename__ = "company_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("workspace.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    company_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    email: Mapped[str | None] = mapped_column(String(150), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    vat_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    kvk_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    iban: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address_line1: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address_line2: Mapped[str | None] = mapped_column(String(200), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    default_vat_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("21.00"), nullable=False
    )
    invoice_prefix: Mapped[str | None] = mapped_column(String(20), nullable=True)
    next_invoice_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    footer_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_data_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now()
    )


class InvoiceStatus:
    DRAFT = "draft"
    SENT = "sent"
    PAID = "paid"


class CustomerInvoice(db.Model):
    __tablename__ = "customer_invoice"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("workspace.id", ondelete="CASCADE"), index=True, nullable=False
    )
    organization_id: Mapped[int | None] = mapped_column(
        ForeignKey("organization.id", ondelete="SET NULL"), nullable=True
    )
    invoice_number: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default=InvoiceStatus.DRAFT, nullable=False
    )
    issue_date: Mapped[date] = mapped_column(Date, default=func.current_date())
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="EUR", nullable=False)
    vat_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("21.00"), nullable=False
    )

    # Snapshot of recipient at time of creation (so editing the contact later
    # does not change historical invoices).
    recipient_name: Mapped[str] = mapped_column(String(200), nullable=False)
    recipient_email: Mapped[str | None] = mapped_column(String(150), nullable=True)
    recipient_address_line1: Mapped[str | None] = mapped_column(
        String(200), nullable=True
    )
    recipient_address_line2: Mapped[str | None] = mapped_column(
        String(200), nullable=True
    )
    recipient_postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    recipient_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    recipient_country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    recipient_vat_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    recipient_kvk_number: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Snapshot of sender (workspace company settings) at time of creation.
    sender_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    sender_email: Mapped[str | None] = mapped_column(String(150), nullable=True)
    sender_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sender_website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sender_vat_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sender_kvk_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sender_iban: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sender_address_line1: Mapped[str | None] = mapped_column(String(200), nullable=True)
    sender_address_line2: Mapped[str | None] = mapped_column(String(200), nullable=True)
    sender_postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    sender_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sender_country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sender_logo_data_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    sender_footer_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now()
    )

    lines: Mapped[list["CustomerInvoiceLine"]] = relationship(
        "CustomerInvoiceLine",
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="CustomerInvoiceLine.position",
    )
    organization: Mapped["db.Model | None"] = relationship("Organization")

    @property
    def vat_breakdown(self) -> list[dict]:
        """Aggregate net + VAT amounts per VAT rate for the totals block."""
        buckets: dict[Decimal, Decimal] = {}
        for line in self.lines:
            rate = line.vat_rate
            buckets[rate] = buckets.get(rate, Decimal("0.00")) + line.line_total
        result = []
        for rate in sorted(buckets.keys()):
            net = buckets[rate].quantize(Decimal("0.01"))
            vat = (net * rate / Decimal("100")).quantize(Decimal("0.01"))
            result.append({"rate": rate, "net": net, "vat": vat})
        return result

    @property
    def subtotal(self) -> Decimal:
        return sum(
            (line.line_total for line in self.lines),
            start=Decimal("0.00"),
        ).quantize(Decimal("0.01"))

    @property
    def vat_amount(self) -> Decimal:
        return sum(
            (bucket["vat"] for bucket in self.vat_breakdown),
            start=Decimal("0.00"),
        ).quantize(Decimal("0.01"))

    @property
    def total(self) -> Decimal:
        return (self.subtotal + self.vat_amount).quantize(Decimal("0.01"))


class CustomerInvoiceLine(db.Model):
    __tablename__ = "customer_invoice_line"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(
        ForeignKey("customer_invoice.id", ondelete="CASCADE"), nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(
        Numeric(12, 3), default=Decimal("1.000"), nullable=False
    )
    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0.00"), nullable=False
    )
    vat_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        default=Decimal("21.00"),
        server_default="21.00",
        nullable=False,
    )

    invoice: Mapped["CustomerInvoice"] = relationship(
        "CustomerInvoice", back_populates="lines"
    )

    @property
    def line_total(self) -> Decimal:
        return (self.quantity * self.unit_price).quantize(Decimal("0.01"))

    @property
    def line_vat(self) -> Decimal:
        return (self.line_total * self.vat_rate / Decimal("100")).quantize(
            Decimal("0.01")
        )


class CompanySettingsSchema(Schema):
    id = fields.Integer()
    workspace_id = fields.Integer()
    company_name = fields.String(allow_none=True)
    email = fields.String(allow_none=True)
    phone = fields.String(allow_none=True)
    website = fields.String(allow_none=True)
    vat_number = fields.String(allow_none=True)
    kvk_number = fields.String(allow_none=True)
    iban = fields.String(allow_none=True)
    address_line1 = fields.String(allow_none=True)
    address_line2 = fields.String(allow_none=True)
    postal_code = fields.String(allow_none=True)
    city = fields.String(allow_none=True)
    country = fields.String(allow_none=True)
    default_vat_rate = fields.Decimal(as_string=True)
    invoice_prefix = fields.String(allow_none=True)
    next_invoice_number = fields.Integer()
    footer_text = fields.String(allow_none=True)
    logo_data_url = fields.String(allow_none=True)


class CustomerInvoiceLineSchema(Schema):
    id = fields.Integer()
    position = fields.Integer()
    description = fields.String()
    quantity = fields.Decimal(as_string=True)
    unit_price = fields.Decimal(as_string=True)
    vat_rate = fields.Decimal(as_string=True)
    line_total = fields.Method("get_line_total")
    line_vat = fields.Method("get_line_vat")

    def get_line_total(self, obj: CustomerInvoiceLine) -> str:
        return str(obj.line_total)

    def get_line_vat(self, obj: CustomerInvoiceLine) -> str:
        return str(obj.line_vat)


class CustomerInvoiceSchema(Schema):
    id = fields.Integer()
    workspace_id = fields.Integer()
    organization_id = fields.Integer(allow_none=True)
    invoice_number = fields.String()
    status = fields.String()
    issue_date = fields.Date()
    due_date = fields.Date(allow_none=True)
    currency = fields.String()
    vat_rate = fields.Decimal(as_string=True)

    recipient_name = fields.String()
    recipient_email = fields.String(allow_none=True)
    recipient_address_line1 = fields.String(allow_none=True)
    recipient_address_line2 = fields.String(allow_none=True)
    recipient_postal_code = fields.String(allow_none=True)
    recipient_city = fields.String(allow_none=True)
    recipient_country = fields.String(allow_none=True)
    recipient_vat_number = fields.String(allow_none=True)
    recipient_kvk_number = fields.String(allow_none=True)

    sender_name = fields.String(allow_none=True)
    sender_email = fields.String(allow_none=True)
    sender_phone = fields.String(allow_none=True)
    sender_website = fields.String(allow_none=True)
    sender_vat_number = fields.String(allow_none=True)
    sender_kvk_number = fields.String(allow_none=True)
    sender_iban = fields.String(allow_none=True)
    sender_address_line1 = fields.String(allow_none=True)
    sender_address_line2 = fields.String(allow_none=True)
    sender_postal_code = fields.String(allow_none=True)
    sender_city = fields.String(allow_none=True)
    sender_country = fields.String(allow_none=True)
    sender_footer_text = fields.String(allow_none=True)

    notes = fields.String(allow_none=True)
    created_at = UTCDateTime()
    updated_at = UTCDateTime()

    lines = fields.List(fields.Nested(CustomerInvoiceLineSchema))
    subtotal = fields.Method("get_subtotal")
    vat_amount = fields.Method("get_vat_amount")
    total = fields.Method("get_total")
    vat_breakdown = fields.Method("get_vat_breakdown")

    def get_subtotal(self, obj: CustomerInvoice) -> str:
        return str(obj.subtotal)

    def get_vat_amount(self, obj: CustomerInvoice) -> str:
        return str(obj.vat_amount)

    def get_total(self, obj: CustomerInvoice) -> str:
        return str(obj.total)

    def get_vat_breakdown(self, obj: CustomerInvoice) -> list[dict]:
        return [
            {
                "rate": str(bucket["rate"]),
                "net": str(bucket["net"]),
                "vat": str(bucket["vat"]),
            }
            for bucket in obj.vat_breakdown
        ]


class CustomerInvoiceListItemSchema(Schema):
    id = fields.Integer()
    invoice_number = fields.String()
    status = fields.String()
    issue_date = fields.Date()
    due_date = fields.Date(allow_none=True)
    currency = fields.String()
    recipient_name = fields.String()
    organization_id = fields.Integer(allow_none=True)
    total = fields.Method("get_total")
    created_at = UTCDateTime()

    def get_total(self, obj: CustomerInvoice) -> str:
        return str(obj.total)
