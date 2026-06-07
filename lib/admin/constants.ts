/** Platform admin access level — keep in sync with product rules. */
export const ADMIN_ACCESS_LEVEL = 3;

export const ALLOWED_ACCESS_LEVELS = [1, 2, 3] as const;
export type AllowedAccessLevel = (typeof ALLOWED_ACCESS_LEVELS)[number];
