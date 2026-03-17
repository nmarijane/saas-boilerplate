"use client";

import {
  ActivityIcon,
  CreditCardIcon,
  FolderIcon,
  UsersIcon,
} from "lucide-react";

import { StatCard } from "@/shared/components/data/stat-card";

interface DashboardStatsProps {
  members: number;
  revenue: string;
  activity: number;
  projects: number;
}

export function DashboardStats({
  members,
  revenue,
  activity,
  projects,
}: DashboardStatsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard title="Members" value={members} icon={UsersIcon} />
      <StatCard title="Revenue" value={revenue} icon={CreditCardIcon} />
      <StatCard title="Activity" value={activity} icon={ActivityIcon} />
      <StatCard title="Projects" value={projects} icon={FolderIcon} />
    </div>
  );
}
