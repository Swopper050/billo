"""Add vat_rate to customer_invoice_line

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-08 00:30:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("customer_invoice_line", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "vat_rate",
                sa.Numeric(precision=5, scale=2),
                server_default="21.00",
                nullable=False,
            )
        )


def downgrade():
    with op.batch_alter_table("customer_invoice_line", schema=None) as batch_op:
        batch_op.drop_column("vat_rate")
