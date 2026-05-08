from flask import request
from flask_login import current_user, login_required
from flask_restx import Resource
from marshmallow import Schema, fields

from app.db.contacts import (
    Organization,
    OrganizationSchema,
    Person,
    PersonSchema,
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


class OrganizationInputSchema(Schema):
    name = fields.String(required=True)
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
    notes = fields.String(load_default=None, allow_none=True)


class PersonInputSchema(Schema):
    first_name = fields.String(required=True)
    last_name = fields.String(load_default=None, allow_none=True)
    email = fields.String(load_default=None, allow_none=True)
    phone = fields.String(load_default=None, allow_none=True)
    role = fields.String(load_default=None, allow_none=True)
    organization_id = fields.Integer(load_default=None, allow_none=True)
    notes = fields.String(load_default=None, allow_none=True)


def _apply_org_data(org: Organization, data: dict) -> None:
    for field in (
        "name",
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
        "notes",
    ):
        if field in data:
            setattr(org, field, data[field])


def _apply_person_data(person: Person, data: dict, workspace_id: int) -> None:
    for field in (
        "first_name",
        "last_name",
        "email",
        "phone",
        "role",
        "notes",
    ):
        if field in data:
            setattr(person, field, data[field])
    if "organization_id" in data:
        org_id = data["organization_id"]
        if org_id is not None:
            org = Organization.query.filter_by(
                id=org_id, workspace_id=workspace_id
            ).first()
            if org is None:
                raise APIError(APIErrorEnum.unknown_error, "Organization not found", 404)
        person.organization_id = org_id


@api.route("/workspaces/<int:workspace_id>/organizations")
class OrganizationList(Resource):
    @login_required
    def get(self, workspace_id: int):
        _assert_workspace_member(workspace_id)
        organizations = (
            Organization.query.filter_by(workspace_id=workspace_id)
            .order_by(Organization.name.asc())
            .all()
        )
        return OrganizationSchema(many=True).dump(organizations)

    @login_required
    def post(self, workspace_id: int):
        _assert_workspace_member(workspace_id)
        data: dict = OrganizationInputSchema().load(request.get_json() or {})
        org = Organization(workspace_id=workspace_id)
        _apply_org_data(org, data)
        db.session.add(org)
        db.session.commit()
        return OrganizationSchema().dump(org)


@api.route("/workspaces/<int:workspace_id>/organizations/<int:organization_id>")
class OrganizationDetail(Resource):
    @login_required
    def get(self, workspace_id: int, organization_id: int):
        _assert_workspace_member(workspace_id)
        org = Organization.query.filter_by(
            id=organization_id, workspace_id=workspace_id
        ).first()
        if org is None:
            raise APIError(APIErrorEnum.unknown_error, "Organization not found", 404)
        return OrganizationSchema().dump(org)

    @login_required
    def put(self, workspace_id: int, organization_id: int):
        _assert_workspace_member(workspace_id)
        org = Organization.query.filter_by(
            id=organization_id, workspace_id=workspace_id
        ).first()
        if org is None:
            raise APIError(APIErrorEnum.unknown_error, "Organization not found", 404)

        data: dict = OrganizationInputSchema().load(request.get_json() or {})
        _apply_org_data(org, data)
        db.session.commit()
        return OrganizationSchema().dump(org)

    @login_required
    def delete(self, workspace_id: int, organization_id: int):
        _assert_workspace_member(workspace_id)
        org = Organization.query.filter_by(
            id=organization_id, workspace_id=workspace_id
        ).first()
        if org is None:
            raise APIError(APIErrorEnum.unknown_error, "Organization not found", 404)
        db.session.delete(org)
        db.session.commit()
        return {"ok": True}


@api.route("/workspaces/<int:workspace_id>/people")
class PersonList(Resource):
    @login_required
    def get(self, workspace_id: int):
        _assert_workspace_member(workspace_id)
        people = (
            Person.query.filter_by(workspace_id=workspace_id)
            .order_by(Person.first_name.asc(), Person.last_name.asc())
            .all()
        )
        return PersonSchema(many=True).dump(people)

    @login_required
    def post(self, workspace_id: int):
        _assert_workspace_member(workspace_id)
        data: dict = PersonInputSchema().load(request.get_json() or {})
        person = Person(workspace_id=workspace_id, first_name=data["first_name"])
        _apply_person_data(person, data, workspace_id)
        db.session.add(person)
        db.session.commit()
        return PersonSchema().dump(person)


@api.route("/workspaces/<int:workspace_id>/people/<int:person_id>")
class PersonDetail(Resource):
    @login_required
    def get(self, workspace_id: int, person_id: int):
        _assert_workspace_member(workspace_id)
        person = Person.query.filter_by(id=person_id, workspace_id=workspace_id).first()
        if person is None:
            raise APIError(APIErrorEnum.unknown_error, "Person not found", 404)
        return PersonSchema().dump(person)

    @login_required
    def put(self, workspace_id: int, person_id: int):
        _assert_workspace_member(workspace_id)
        person = Person.query.filter_by(id=person_id, workspace_id=workspace_id).first()
        if person is None:
            raise APIError(APIErrorEnum.unknown_error, "Person not found", 404)

        data: dict = PersonInputSchema().load(request.get_json() or {})
        _apply_person_data(person, data, workspace_id)
        db.session.commit()
        return PersonSchema().dump(person)

    @login_required
    def delete(self, workspace_id: int, person_id: int):
        _assert_workspace_member(workspace_id)
        person = Person.query.filter_by(id=person_id, workspace_id=workspace_id).first()
        if person is None:
            raise APIError(APIErrorEnum.unknown_error, "Person not found", 404)
        db.session.delete(person)
        db.session.commit()
        return {"ok": True}
