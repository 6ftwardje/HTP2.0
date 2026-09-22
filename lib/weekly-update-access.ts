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
    label: "Iedereen (legacy)",
    description: "Oude publieke doelgroep; niet gebruiken voor nieuwe marktcontent.",
    minAccessLevel: 0,
    selectable: false,
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

export function getWeeklyUpdateAccessLabel(value: WeeklyUpdateAccessTier) {
  return getWeeklyUpdateAccessOption(value).label;
}

export function canStudentAccessWeeklyUpdate(
  accessTier: WeeklyUpdateAccessTier,
  student: Pick<Student, "access_level"> | null
) {
  const option = getWeeklyUpdateAccessOption(accessTier);
  if (option.entitlementKey || !option.selectable || option.minAccessLevel === null) {
    return false;
  }
  if (!student) return false;
  return student.access_level >= option.minAccessLevel;
}
