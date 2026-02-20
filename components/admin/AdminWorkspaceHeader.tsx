import React from "react";
import { AdminSection, AdminSectionTab } from "./types";

interface AdminWorkspaceHeaderProps {
  saveStatus: string;
  playersCount: number;
  activeCastCount: number;
  totalCastCount: number;
  pendingVotes: number;
  sectionTabs: AdminSectionTab[];
  activeSection: AdminSection;
  onSectionChange: (section: AdminSection) => void;
}

const AdminWorkspaceHeader: React.FC<AdminWorkspaceHeaderProps> = ({
  saveStatus,
  playersCount,
  activeCastCount,
  totalCastCount,
  pendingVotes,
  sectionTabs,
  activeSection,
  onSectionChange,
}) => {
  return (
    <header className="soft-card rounded-3xl p-5 md:p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
            Admin Workspace
          </p>
          <h2 className="headline text-3xl">Control Center</h2>
        </div>
        <div className="status-pill">{saveStatus}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="soft-card soft-card-subtle rounded-2xl p-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">Players</p>
          <p className="headline text-2xl mt-1">{playersCount}</p>
        </div>
        <div className="soft-card soft-card-subtle rounded-2xl p-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">Active Cast</p>
          <p className="headline text-2xl mt-1">
            {activeCastCount}/{totalCastCount}
          </p>
        </div>
        <div className="soft-card soft-card-subtle rounded-2xl p-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">Pending Votes</p>
          <p className="headline text-2xl mt-1">{pendingVotes}</p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2">
        {sectionTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSectionChange(tab.id)}
            className={`px-4 py-2 rounded-full text-[11px] uppercase tracking-[0.14em] ${
              activeSection === tab.id ? "btn-primary" : "btn-secondary"
            }`}
            title={tab.summary}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
};

export default AdminWorkspaceHeader;
