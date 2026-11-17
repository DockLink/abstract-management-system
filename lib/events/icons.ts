import {
  Archive,
  CalendarClock,
  Cog,
  Copy,
  ExternalLink,
  FileText,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  Tags,
  Users,
} from "lucide-react";

export const EventIcons = {
  dashboard: LayoutDashboard,
  setup: Settings2,
  categories: Tags,
  submissionTypes: FileText,
  eligibility: ShieldCheck,
  members: Users,
  settings: Cog,
  deadline: CalendarClock,
  clone: Copy,
  archive: Archive,
  preview: ExternalLink,
} as const;
