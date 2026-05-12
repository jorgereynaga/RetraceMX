from __future__ import annotations

from typing import Iterable


ROLE_PERMISSION_CODES: dict[str, list[str]] = {
    "superadmin": ["*"],
    "admin": ["*"],
    "weighing": [
        "materials.view_material",
        "parties.view_personorcompany",
        "parties.view_collectioncenter",
        "operations.add_purchaseoperation",
        "operations.change_purchaseoperation",
        "operations.view_purchaseoperation",
        "operations.add_ticketitem",
        "operations.change_ticketitem",
        "operations.view_ticketitem",
        "weighing.add_weighingsession",
        "weighing.change_weighingsession",
        "weighing.view_weighingsession",
        "weighing.add_scalereading",
        "weighing.change_scalereading",
        "weighing.view_scalereading",
        "evidence.add_printlog",
        "evidence.view_printlog",
    ],
    "purchasing": [
        "materials.view_material",
        "parties.view_personorcompany",
        "parties.view_collectioncenter",
        "operations.add_purchaseoperation",
        "operations.change_purchaseoperation",
        "operations.view_purchaseoperation",
        "operations.add_ticketitem",
        "operations.change_ticketitem",
        "operations.view_ticketitem",
        "weighing.add_weighingsession",
        "weighing.change_weighingsession",
        "weighing.view_weighingsession",
        "weighing.add_scalereading",
        "weighing.change_scalereading",
        "weighing.view_scalereading",
        "evidence.add_printlog",
        "evidence.view_printlog",
    ],
    "inventory": [
        "materials.view_material",
        "parties.view_collectioncenter",
        "processing.add_processtype",
        "processing.change_processtype",
        "processing.view_processtype",
        "processing.add_materialprocess",
        "processing.change_materialprocess",
        "processing.view_materialprocess",
        "processing.add_materialprocessinput",
        "processing.view_materialprocessinput",
        "processing.add_materialprocessoutput",
        "processing.view_materialprocessoutput",
        "processing.add_materialprocesswaste",
        "processing.view_materialprocesswaste",
        "inventory.add_inventorymovement",
        "inventory.change_inventorymovement",
        "inventory.view_inventorymovement",
        "inventory.view_inventorybalance",
    ],
    "cashier": [
        "commercialization.view_saleorder",
        "commercialization.change_saleorder",
        "commercialization.view_saleitem",
        "commercialization.add_salepayment",
        "commercialization.change_salepayment",
        "commercialization.view_salepayment",
        "payments.add_payment",
        "payments.change_payment",
        "payments.view_payment",
        "operations.view_purchaseoperation",
        "operations.view_ticketitem",
        "evidence.view_printlog",
    ],
    "sales": [
        "commercialization.add_saleorder",
        "commercialization.change_saleorder",
        "commercialization.view_saleorder",
        "commercialization.add_saleitem",
        "commercialization.change_saleitem",
        "commercialization.view_saleitem",
        "commercialization.add_salepayment",
        "commercialization.view_salepayment",
        "materials.view_material",
        "parties.view_personorcompany",
        "parties.view_collectioncenter",
        "materials.view_pricelist",
        "materials.view_pricelistitem",
    ],
    "logistics": [
        "logistics.add_route",
        "logistics.change_route",
        "logistics.view_route",
        "logistics.add_collectiontrip",
        "logistics.change_collectiontrip",
        "logistics.view_collectiontrip",
        "logistics.add_delivery",
        "logistics.change_delivery",
        "logistics.view_delivery",
        "logistics.add_deliveryitem",
        "logistics.change_deliveryitem",
        "logistics.view_deliveryitem",
        "logistics.add_deliveryevidence",
        "logistics.view_deliveryevidence",
        "logistics.add_deliveryincident",
        "logistics.change_deliveryincident",
        "logistics.view_deliveryincident",
        "logistics.view_gpsposition",
        "parties.view_vehicle",
        "parties.view_driver",
        "parties.view_collectioncenter",
        "commercialization.view_saleorder",
    ],
    "operator": [
        "logistics.view_route",
        "logistics.view_collectiontrip",
        "logistics.view_delivery",
        "logistics.add_deliveryevidence",
        "logistics.view_deliveryevidence",
        "logistics.view_deliveryincident",
        "logistics.add_deliveryincident",
        "logistics.view_gpsposition",
        "parties.view_vehicle",
        "parties.view_driver",
    ],
    "auditor": [
        "materials.view_material",
        "materials.view_materialfamily",
        "materials.view_pricelist",
        "materials.view_pricelistitem",
        "parties.view_personorcompany",
        "parties.view_collectioncenter",
        "parties.view_vehicle",
        "parties.view_driver",
        "processing.view_processtype",
        "processing.view_materialprocess",
        "processing.view_materialprocessinput",
        "processing.view_materialprocessoutput",
        "processing.view_materialprocesswaste",
        "operations.view_purchaseoperation",
        "operations.view_ticketitem",
        "commercialization.view_saleorder",
        "commercialization.view_saleitem",
        "commercialization.view_salepayment",
        "payments.view_payment",
        "inventory.view_inventorymovement",
        "logistics.view_route",
        "logistics.view_collectiontrip",
        "logistics.view_delivery",
        "logistics.view_deliveryitem",
        "logistics.view_deliveryevidence",
        "logistics.view_deliveryincident",
        "logistics.view_gpsposition",
        "evidence.view_printlog",
        "auditing.view_auditlog",
    ],
}


def _resolve_permission(permission_model, code: str):
    app_label, codename = code.split(".", 1)
    return permission_model.objects.filter(content_type__app_label=app_label, codename=codename).first()


def assign_minimal_role_permissions(apps):
    Role = apps.get_model("users", "Role")
    Permission = apps.get_model("auth", "Permission")

    roles = {role.code: role for role in Role.objects.all()}
    all_permissions = list(Permission.objects.all())

    for role_code, permission_codes in ROLE_PERMISSION_CODES.items():
        role = roles.get(role_code)
        if not role:
            continue
        if "*" in permission_codes:
            role.permissions.set(all_permissions)
            continue
        permissions = [perm for code in permission_codes if (perm := _resolve_permission(Permission, code))]
        role.permissions.set(permissions)
