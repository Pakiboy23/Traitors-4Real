export type AdminSection =
  | "operations"
  | "seasons"
  | "adjustments"
  | "submissions"
  | "roster"
  | "cast"
  | "database";

export interface AdminSectionTab {
  id: AdminSection;
  label: string;
  summary: string;
}

export type InlineEditMap = Record<
  string,
  {
    name: string;
    email: string;
    weeklyBanished: string;
    weeklyMurdered: string;
  }
>;
