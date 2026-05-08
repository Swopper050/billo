"""Add contacts and invoicing tables

Revision ID: a1b2c3d4e5f6
Revises: 826709b8f4a1
Create Date: 2026-05-08 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "826709b8f4a1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "organization",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("workspace_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("email", sa.String(length=150), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("website", sa.String(length=255), nullable=True),
        sa.Column("vat_number", sa.String(length=50), nullable=True),
        sa.Column("kvk_number", sa.String(length=50), nullable=True),
        sa.Column("iban", sa.String(length=50), nullable=True),
        sa.Column("address_line1", sa.String(length=200), nullable=True),
        sa.Column("address_line2", sa.String(length=200), nullable=True),
        sa.Column("postal_code", sa.String(length=20), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("country", sa.String(length=100), nullable=True),
        sa.Column("notes", sa.String(length=2000), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["workspace.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("organization", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_organization_workspace_id"),
            ["workspace_id"],
            unique=False,
        )

    op.create_table(
        "person",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("workspace_id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=True),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=True),
        sa.Column("email", sa.String(length=150), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("role", sa.String(length=100), nullable=True),
        sa.Column("notes", sa.String(length=2000), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["workspace.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organization.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("person", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_person_workspace_id"),
            ["workspace_id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_person_organization_id"),
            ["organization_id"],
            unique=False,
        )

    op.create_table(
        "company_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("workspace_id", sa.Integer(), nullable=False),
        sa.Column("company_name", sa.String(length=150), nullable=True),
        sa.Column("email", sa.String(length=150), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("website", sa.String(length=255), nullable=True),
        sa.Column("vat_number", sa.String(length=50), nullable=True),
        sa.Column("kvk_number", sa.String(length=50), nullable=True),
        sa.Column("iban", sa.String(length=50), nullable=True),
        sa.Column("address_line1", sa.String(length=200), nullable=True),
        sa.Column("address_line2", sa.String(length=200), nullable=True),
        sa.Column("postal_code", sa.String(length=20), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("country", sa.String(length=100), nullable=True),
        sa.Column(
            "default_vat_rate",
            sa.Numeric(precision=5, scale=2),
            nullable=False,
        ),
        sa.Column("invoice_prefix", sa.String(length=20), nullable=True),
        sa.Column("next_invoice_number", sa.Integer(), nullable=False),
        sa.Column("footer_text", sa.Text(), nullable=True),
        sa.Column("logo_data_url", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["workspace.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("workspace_id"),
    )

    op.create_table(
        "customer_invoice",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("workspace_id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=True),
        sa.Column("invoice_number", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("issue_date", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("vat_rate", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("recipient_name", sa.String(length=200), nullable=False),
        sa.Column("recipient_email", sa.String(length=150), nullable=True),
        sa.Column("recipient_address_line1", sa.String(length=200), nullable=True),
        sa.Column("recipient_address_line2", sa.String(length=200), nullable=True),
        sa.Column("recipient_postal_code", sa.String(length=20), nullable=True),
        sa.Column("recipient_city", sa.String(length=100), nullable=True),
        sa.Column("recipient_country", sa.String(length=100), nullable=True),
        sa.Column("recipient_vat_number", sa.String(length=50), nullable=True),
        sa.Column("recipient_kvk_number", sa.String(length=50), nullable=True),
        sa.Column("sender_name", sa.String(length=150), nullable=True),
        sa.Column("sender_email", sa.String(length=150), nullable=True),
        sa.Column("sender_phone", sa.String(length=50), nullable=True),
        sa.Column("sender_website", sa.String(length=255), nullable=True),
        sa.Column("sender_vat_number", sa.String(length=50), nullable=True),
        sa.Column("sender_kvk_number", sa.String(length=50), nullable=True),
        sa.Column("sender_iban", sa.String(length=50), nullable=True),
        sa.Column("sender_address_line1", sa.String(length=200), nullable=True),
        sa.Column("sender_address_line2", sa.String(length=200), nullable=True),
        sa.Column("sender_postal_code", sa.String(length=20), nullable=True),
        sa.Column("sender_city", sa.String(length=100), nullable=True),
        sa.Column("sender_country", sa.String(length=100), nullable=True),
        sa.Column("sender_logo_data_url", sa.Text(), nullable=True),
        sa.Column("sender_footer_text", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["workspace.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organization.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("customer_invoice", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_customer_invoice_workspace_id"),
            ["workspace_id"],
            unique=False,
        )

    op.create_table(
        "customer_invoice_line",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("invoice_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=12, scale=3), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.ForeignKeyConstraint(
            ["invoice_id"], ["customer_invoice.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade():
    op.drop_table("customer_invoice_line")
    with op.batch_alter_table("customer_invoice", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_customer_invoice_workspace_id"))
    op.drop_table("customer_invoice")
    op.drop_table("company_settings")
    with op.batch_alter_table("person", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_person_organization_id"))
        batch_op.drop_index(batch_op.f("ix_person_workspace_id"))
    op.drop_table("person")
    with op.batch_alter_table("organization", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_organization_workspace_id"))
    op.drop_table("organization")
