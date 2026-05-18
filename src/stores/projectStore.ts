import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Project {
  _id: string;
  name: string;
  description?: string;
  owner: { _id: string; name: string; email: string };
  members: Array<{ user: { _id: string; name: string }; role: string }>;
  tags: string[];
}

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  setProjects: (projects: Project[]) => void;
  setCurrentProject: (project: Project | null) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projects: [],
      currentProject: null,
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),

      setProjects: (projects) => set({ projects }),
      setCurrentProject: (project) => set({ currentProject: project }),
      addProject: (project) => set((state) => ({ projects: [project, ...state.projects] })),
      updateProject: (id, updates) =>
        set((state) => ({
          projects: state.projects.map((p) => p._id === id ? { ...p, ...updates } : p),
          currentProject: state.currentProject?._id === id
            ? { ...state.currentProject, ...updates }
            : state.currentProject,
        })),
      removeProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p._id !== id),
          currentProject: state.currentProject?._id === id ? null : state.currentProject,
        })),
    }),
    {
      name: 'project-store',
      partialize: (state) => ({ currentProject: state.currentProject }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
