const icons = {
  dashboard: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" />,
  academy: (
    <>
      <path d="M12 5.5C9 3.5 5.5 3.5 3 4.5v15c2.5-1 6-1 9 1 3-2 6.5-2 9-1v-15c-2.5-1-6-1-9 1Z" />
      <path d="M12 5.5v15" />
    </>
  ),
  mentor: (
    <>
      <path d="M21 14a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8Z" />
      <path d="M7 8h10M7 12h6" />
    </>
  ),
  market: <path d="M3 3v18h18M7 15l4-5 4 3 6-8" />,
  live: (
    <>
      <rect x="2" y="5" width="14" height="14" rx="2" />
      <path d="m16 10 6-4v12l-6-4" />
    </>
  ),
  notifications: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </>
  ),
  admin: (
    <>
      <path d="m12 3 8 3v5c0 4.5-3 8-8 10-5-2-8-5.5-8-10V6l8-3Z" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M20 21v-2a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v2h16Z" />
    </>
  ),
  students: (
    <>
      <circle cx="9" cy="7" r="4" />
      <path d="M16 21v-2a5 5 0 0 0-5-5H7a5 5 0 0 0-5 5v2M17 3.2a4 4 0 0 1 0 7.6M22 21v-2a5 5 0 0 0-4-4.9" />
    </>
  ),
  exams: (
    <>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2M8 14l3 3 5-6" />
    </>
  ),
  lessons: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m10 8 6 4-6 4V8Z" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .75-1.5 1-1.5 2" />
      <circle cx="12" cy="16.5" r="0.75" fill="currentColor" stroke="none" />
    </>
  ),
  logout: (
    <>
      <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4M9 12h12M17 8l4 4-4 4" />
    </>
  ),
};

export type NavigationIconName = keyof typeof icons;

/** Shared outline style for student and admin navigation, including mobile. */
export function NavigationIcon({ name }: { name: NavigationIconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {icons[name]}
    </svg>
  );
}
