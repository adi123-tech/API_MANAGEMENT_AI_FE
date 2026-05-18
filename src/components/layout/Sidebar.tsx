'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, FlaskConical, GitBranch, FileBarChart2,
  Server, Clock, Activity, Zap, LogOut, ChevronDown, Plus, Check,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { projectsApi } from '@/services/api';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/tests', icon: FlaskConical, label: 'API Tests' },
  { href: '/workflows', icon: GitBranch, label: 'Workflows' },
  { href: '/environments', icon: Server, label: 'Environments' },
  { href: '/reports', icon: FileBarChart2, label: 'Reports' },
  { href: '/monitoring', icon: Activity, label: 'Monitoring' },
  { href: '/schedules', icon: Clock, label: 'Schedules' },
];

interface Project {
  _id: string;
  name: string;
  description?: string;
  owner: { _id: string; name: string; email: string };
  members: Array<{ user: { _id: string; name: string }; role: string }>;
  tags: string[];
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { currentProject, setCurrentProject, setProjects } = useProjectStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
  });

  const projects: Project[] = projectsData?.data?.data || [];

  // Auto-select first project when projects load and none is selected
  useEffect(() => {
    if (projects.length > 0) {
      setProjects(projects);
      if (!currentProject) {
        setCurrentProject(projects[0]);
      }
    }
  }, [projects, currentProject, setCurrentProject, setProjects]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setShowCreateForm(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const createProjectMutation = useMutation({
    mutationFn: (data: { name: string; description: string }) => projectsApi.create(data),
    onSuccess: (res) => {
      const project = res.data.data;
      setCurrentProject(project);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: `Project "${project.name}" created` });
      setNewProjectName('');
      setNewProjectDesc('');
      setShowCreateForm(false);
      setDropdownOpen(false);
    },
    onError: () => toast({ title: 'Failed to create project', variant: 'destructive' }),
  });

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    createProjectMutation.mutate({ name: newProjectName.trim(), description: newProjectDesc.trim() });
  };

  return (
    <motion.aside
      className="h-full w-60 bg-card border-r border-border flex flex-col overflow-hidden flex-shrink-0"
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-border flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Zap className="w-3.5 h-3.5 text-primary-foreground" />
        </div>
        <span className="ml-2.5 font-semibold text-sm truncate">AI API Tester</span>
      </div>

      {/* Project selector */}
      <div className="px-3 py-3 border-b border-border relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary text-sm text-left transition-colors"
        >
          <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] text-primary font-bold">
              {currentProject?.name?.[0]?.toUpperCase() || 'P'}
            </span>
          </div>
          <span className="flex-1 truncate text-xs text-muted-foreground">
            {currentProject?.name || 'Select project'}
          </span>
          <ChevronDown className={cn('w-3 h-3 text-muted-foreground transition-transform', dropdownOpen && 'rotate-180')} />
        </button>

        <AnimatePresence>
          {dropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute left-3 right-3 top-full mt-1 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden"
            >
              {/* Project list */}
              <div className="max-h-48 overflow-y-auto py-1">
                {projects.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-3 py-2">No projects yet</p>
                ) : (
                  projects.map((p) => (
                    <button
                      key={p._id}
                      onClick={() => { setCurrentProject(p); setDropdownOpen(false); setShowCreateForm(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-secondary transition-colors text-left"
                    >
                      <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] text-primary font-bold">{p.name[0].toUpperCase()}</span>
                      </div>
                      <span className="flex-1 truncate">{p.name}</span>
                      {currentProject?._id === p._id && <Check className="w-3 h-3 text-primary" />}
                    </button>
                  ))
                )}
              </div>

              <div className="border-t border-border p-2">
                {!showCreateForm ? (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-primary hover:bg-primary/10 rounded-md transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New project
                  </button>
                ) : (
                  <div className="space-y-2">
                    <input
                      autoFocus
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                      placeholder="Project name"
                      className="w-full bg-secondary border border-border rounded-md px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                      value={newProjectDesc}
                      onChange={(e) => setNewProjectDesc(e.target.value)}
                      placeholder="Description (optional)"
                      className="w-full bg-secondary border border-border rounded-md px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={handleCreateProject}
                        disabled={!newProjectName.trim() || createProjectMutation.isPending}
                        className="flex-1 bg-primary text-primary-foreground text-xs rounded-md py-1.5 disabled:opacity-50 hover:bg-primary/90 transition-colors"
                      >
                        {createProjectMutation.isPending ? 'Creating...' : 'Create'}
                      </button>
                      <button
                        onClick={() => { setShowCreateForm(false); setNewProjectName(''); setNewProjectDesc(''); }}
                        className="flex-1 bg-secondary text-xs rounded-md py-1.5 hover:bg-secondary/80 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-primary">{user?.name?.[0]?.toUpperCase() || 'U'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{user?.name}</p>
            <p className="text-[10px] text-muted-foreground capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-2.5 py-2 rounded-md text-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors w-full"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
    </motion.aside>
  );
}
