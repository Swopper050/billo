from datetime import datetime

from marshmallow import Schema, fields
from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.fields import UTCDateTime
from app.extensions import db


class Organization(db.Model):
    __tablename__ = "organization"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("workspace.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
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
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now()
    )

    people: Mapped[list["Person"]] = relationship(
        "Person", back_populates="organization"
    )


class Person(db.Model):
    __tablename__ = "person"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("workspace.id", ondelete="CASCADE"), index=True, nullable=False
    )
    organization_id: Mapped[int | None] = mapped_column(
        ForeignKey("organization.id", ondelete="SET NULL"), nullable=True, index=True
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    email: Mapped[str | None] = mapped_column(String(150), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    role: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now()
    )

    organization: Mapped["Organization | None"] = relationship(
        "Organization", back_populates="people"
    )


class OrganizationSchema(Schema):
    id = fields.Integer()
    workspace_id = fields.Integer()
    name = fields.String()
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
    notes = fields.String(allow_none=True)
    created_at = UTCDateTime()
    updated_at = UTCDateTime()
    people_count = fields.Method("get_people_count")

    def get_people_count(self, obj: Organization) -> int:
        return len(obj.people) if obj.people is not None else 0


class PersonSchema(Schema):
    id = fields.Integer()
    workspace_id = fields.Integer()
    organization_id = fields.Integer(allow_none=True)
    organization_name = fields.Method("get_organization_name")
    first_name = fields.String()
    last_name = fields.String(allow_none=True)
    email = fields.String(allow_none=True)
    phone = fields.String(allow_none=True)
    role = fields.String(allow_none=True)
    notes = fields.String(allow_none=True)
    created_at = UTCDateTime()
    updated_at = UTCDateTime()

    def get_organization_name(self, obj: Person) -> str | None:
        return obj.organization.name if obj.organization is not None else None
