import type { Student, WeeklyUpdateAccessTier } from "@/lib/types";

export type WeeklyUpdateAccessOption = {
  value: WeeklyUpdateAccessTier;
  label: string;
  description: string;
  minAccessLevel: number | null;
  selectable: boolean;
};

export const WEEKLY_UPDATE_ACCESS_OPTIONS: WeeklyUpdateAccessOption[] = [
  {
    value: "free",
    label: "Iedereen",
    description: "Alle ingelogde accounts, inclusief gratis accounts.",
    minAccessLevel: 0,
    selectable: true,
  },
  {
    value: "full_course",
    label: "Full course en hoger",
    description: "Alle accounts met access level 2 of hoger.",
    minAccessLevel: 2,
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
  if (!option.selectable || option.minAccessLevel === null) return false;
  if (!student) return false;
  return student.access_level >= option.minAccessLevel;
}

