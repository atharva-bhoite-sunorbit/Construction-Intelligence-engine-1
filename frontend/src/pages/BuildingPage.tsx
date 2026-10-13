import React, { useState } from 'react';
import { Project } from '../types';
import { PageHeader } from '../components/simple/ui';
import { BuildingProgress } from '../components/building/BuildingProgress';
import { ActivityDetailPanel } from '../components/activity/ActivityDetailPanel';

interface BuildingPageProps {
  project: Project;
  onNavigate: (tab: string) => void;
}

/** The 3D building on its own page, with room to turn it and click floors. */
export const BuildingPage: React.FC<BuildingPageProps> = ({ project, onNavigate }) => {
  const [openActivity, setOpenActivity] = useState<number | null>(null);
  return (
    <div>
      <PageHeader title="3D view" subtitle={project.name} />
      <BuildingProgress projectId={project.id} onOpenActivity={setOpenActivity} large />
      {openActivity !== null && (
        <ActivityDetailPanel activityId={openActivity} onClose={() => setOpenActivity(null)}
          onOpenTasks={() => { setOpenActivity(null); onNavigate('tasks'); }} onOpenProblems={() => { setOpenActivity(null); onNavigate('problems'); }} />
      )}
    </div>
  );
};
