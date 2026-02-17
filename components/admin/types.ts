export type AdminSection =
  | "operations"
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
