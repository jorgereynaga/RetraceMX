import type { User } from "../types";

export type AppPermission =
  | "catalog.export"
  | "catalog.import"
  | "catalog.import.preview"
  | "catalog.import.execute"
  | "users.manage"
  | "materials.manage"
  | "parties.manage"
  | "centers.manage"
  | "price-lists.manage"
  | "purchases.manage"
  | "processing.manage"
  | "cashier.manage"
  | "inventory.manage"
  | "sales.manage"
  | "logistics.manage"
  | "routes.manage"
  | "auditor.view";

const ROLE_PERMISSION_MATRIX: Record<string, AppPermission[]> = {
  superadmin: ["catalog.export", "catalog.import", "catalog.import.preview", "catalog.import.execute", "users.manage", "materials.manage", "parties.manage", "centers.manage", "price-lists.manage", "purchases.manage", "processing.manage", "cashier.manage", "inventory.manage", "sales.manage", "logistics.manage", "routes.manage", "auditor.view"],
  admin: ["catalog.export", "catalog.import", "catalog.import.preview", "catalog.import.execute", "users.manage", "materials.manage", "parties.manage", "centers.manage", "price-lists.manage", "purchases.manage", "processing.manage", "cashier.manage", "inventory.manage", "sales.manage", "logistics.manage", "routes.manage", "auditor.view"],
  weighing: ["materials.manage", "parties.manage", "centers.manage", "purchases.manage"],
  purchasing: ["materials.manage", "parties.manage", "centers.manage", "purchases.manage"],
  inventory: ["materials.manage", "parties.manage", "centers.manage", "processing.manage", "inventory.manage"],
  cashier: ["cashier.manage", "purchases.manage", "sales.manage"],
  sales: ["sales.manage", "materials.manage", "parties.manage", "price-lists.manage"],
  logistics: ["logistics.manage", "routes.manage", "sales.manage"],
  operator: ["logistics.manage"],
  auditor: ["auditor.view"],
};

const ROLE_NAME_TO_CODE: Record<string, string> = {
  "Superadministrador": "superadmin",
  "Administrador / Gerente": "admin",
  "Báscula / Recepción": "weighing",
  "Compras": "purchasing",
  "Inventarios / Almacén": "inventory",
  "Caja": "cashier",
  "Ventas / Comercial": "sales",
  "Logística / Rutas": "logistics",
  "Operador / Chofer": "operator",
  "Auditor / Consulta": "auditor",
};

export function getUserRoleCodes(user: User | null | undefined) {
  const roleCodes = new Set<string>(user?.role_codes ?? []);
  for (const roleName of user?.role_names ?? []) {
    const mapped = ROLE_NAME_TO_CODE[roleName];
    if (mapped) roleCodes.add(mapped);
  }
  return Array.from(roleCodes);
}

export function userHasRole(user: User | null | undefined, roleCode: string) {
  if (!user) return false;
  if (user.is_superuser) return true;
  return getUserRoleCodes(user).includes(roleCode);
}

export function userCan(user: User | null | undefined, permission: AppPermission) {
  if (!user) return false;
  if (user.is_superuser) return true;
  return getUserRoleCodes(user).some((roleCode) => (ROLE_PERMISSION_MATRIX[roleCode] ?? []).includes(permission));
}

export function getRolePermissionMatrix() {
  return ROLE_PERMISSION_MATRIX;
}
