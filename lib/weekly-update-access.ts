import type { Student, WeeklyUpdateAccessTier } from "@/lib/types";

export type WeeklyUpdateAccessOption = {
  value: WeeklyUpdateAccessTier;
  label: string;
  description: string;
  minAccessLevel: number | null;
  entitlementKey?: string;
  selectable: boolean;
};

export const WEEKLY_UPDATE_ACCESS_OPTIONS: WeeklyUpdateAccessOption[] = [
  {
    value: "free",
    label: "Iedereen op het platform (ook free)",
    description: "Alle ingelogde accounts kunnen deze video bekijken, inclusief free accounts.",
    minAccessLevel: 0,
    selectable: true,
  },
  {
    value: "full_course",
    label: "Academy (legacy)",
    description: "Oude Academy-doelgroep; subscription staat los van Academy.",
    minAccessLevel: 2,
    selectable: false,
  },
  {
    value: "subscription",
    label: "Subscription",
    description: "Actieve betalende subscription of geldige Academybonus.",
    minAccessLevel: null,
    entitlementKey: "subscriber_content",
    selectable: true,
  },
  {
    value: "premium",
    label: "Premium (legacy)",
    description:
      "Legacy doelgroep zonder actieve student-RLS. Niet gebruiken voor nieuwe publicaties.",
    minAccessLevel: null,
    selectable: false,
  },
  {
    value: "mentor_membership",
    label: "Mentorship (legacy)",
    description:
      "Legacy doelgroep zonder actieve student-RLS. Niet gebruiken voor nieuwe publicaties.",
    minAccessLevel: null,
    selectable: false,
  },
];

export const SELECTABLE_WEEKLY_UPDATE_ACCESS_TIERS =
  WEEKLY_UPDATE_ACCESS_OPTIONS.filter((option) => option.selectable).map(
    (option) => option.value
  );

export function getWeeklyUpdateAccessOption(value: WeeklyUpdateAccessTier) {
  return (
    WEEKLY_UPDATE_ACCESS_OPTIONS.find((option) => option.value === value) ??
    WEEKLY_UPDATE_ACCESS_OPTIONS[0]
  );
}

export function getWeeklyUpdateAccessLabel(
  value: WeeklyUpdateAccessTier,
  paidProductsActive = true
) {
  if (value === "subscription" && !paidProductsActive) return "Academy";
  return getWeeklyUpdateAccessOption(value).label;
}

/** Publication recipients must match the actual reader gate during the dormant billing phase. */
export function getWeeklyUpdateNotificationAudience(
  value: WeeklyUpdateAccessTier,
  paidProductsActive: boolean
): { kind: "access_level"; minAccessLevel: number } | { kind: "entitlement"; key: string } | null {
  const option = getWeeklyUpdateAccessOption(value);
  if (!option.selectable) return null;
  if (value === "subscription" && !paidProductsActive) {
    return { kind: "access_level", minAccessLevel: 2 };
  }
  if (option.entitlementKey) return { kind: "entitlement", key: option.entitlementKey };
  if (option.minAccessLevel !== null) {
    return { kind: "access_level", minAccessLevel: option.minAccessLevel };
  }
  return null;
}

export function canStudentAccessWeeklyUpdate(
  accessTier: WeeklyUpdateAccessTier,
  student: Pick<Student, "access_level"> | null,
  hasSubscriberAccess = false
) {
  if (!student) return false;
  return accessTier === "free" || hasSubscriberAccess;
}
