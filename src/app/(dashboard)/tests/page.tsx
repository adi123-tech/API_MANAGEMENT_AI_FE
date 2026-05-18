'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { FlaskConical, Plus, Play, Copy, Trash2, Search, Filter, Folder } from 'lucide-react';
import { testsApi, executionsApi } from '@/services/api';
import { useProjectStore } from '@/stores/projectStore';
import { cn, methodColors, statusBgColors } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function TestsPage() {
  const { currentProject, _hasHydrated: projectHydrated } = useProjectStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('');

  const { data: testsData, isLoading } = useQuery({
    queryKey: ['tests', currentProject?._id, search, selectedFolder],
    queryFn: () => testsApi.list(currentProject!._id, { search, folder: selectedFolder || undefined }),
    enabled: !!currentProject?._id,
  });

  const { data: foldersData } = useQuery({
    queryKey: ['folders', currentProject?._id],
    queryFn: () => testsApi.getFolders(currentProject!._id),
    enabled: !!currentProject?._id,
  });

  const executeMutation = useMutation({
    mutationFn: ({ testId }: { testId: string }) =>
      testsApi.execute(currentProject!._id, testId),
    onSuccess: () => {
      toast({ title: 'Test queued for execution' });
      queryClient.invalidateQueries({ queryKey: ['executions'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (testId: string) => testsApi.delete(currentProject!._id, testId),
    onSuccess: () => {
      toast({ title: 'Test deleted' });
      queryClient.invalidateQueries({ queryKey: ['tests'] });
    },
  });

  const cloneMutation = useMutation({
    mutationFn: (testId: string) => testsApi.clone(currentProject!._id, testId),
    onSuccess: () => {
      toast({ title: 'Test cloned' });
      queryClient.invalidateQueries({ queryKey: ['tests'] });
    },
  });

  const tests = testsData?.data?.data || [];
  const folders = foldersData?.data?.data || [];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tests..."
            className="bg-transparent text-xs outline-none flex-1 placeholder:text-muted-foreground"
          />
        </div>

        <select
          value={selectedFolder}
          onChange={(e) => setSelectedFolder(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-xs outline-none text-muted-foreground"
        >
          <option value="">All folders</option>
          {folders.map((f: string) => <option key={f} value={f}>{f}</option>)}
        </select>

        <div className="flex-1" />

        <Link
          href="/tests/new"
          className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium px-3 py-2 rounded-lg"
        >
          <Plus className="w-3.5 h-3.5" />
          New Test
        </Link>
      </div>

      {/* Tests list */}
      {!projectHydrated || isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : tests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FlaskConical className="w-10 h-10 text-muted-foreground mb-3" />
          <h3 className="font-medium mb-1">No tests yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first API test to get started</p>
          <Link href="/tests/new" className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-lg">
            Create test
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {tests.map((test: {
            _id: string;
            name: string;
            method: string;
            url: string;
            folder?: string;
            tags: string[];
            aiGenerated: boolean;
          }, i: number) => (
            <motion.div
              key={test._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <span className={cn('text-xs font-mono font-bold w-14 flex-shrink-0', methodColors[test.method] || 'text-muted-foreground')}>
                  {test.method}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/tests/${test._id}`} className="text-sm font-medium hover:text-primary truncate">
                      {test.name}
                    </Link>
                    {test.aiGenerated && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">AI</span>
                    )}
                    {test.folder && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Folder className="w-3 h-3" />{test.folder}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{test.url}</p>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => executeMutation.mutate({ testId: test._id })}
                    disabled={executeMutation.isPending}
                    className="p-1.5 hover:bg-emerald-500/10 hover:text-emerald-400 rounded-md transition-colors text-muted-foreground"
                    title="Run test"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => cloneMutation.mutate(test._id)}
                    className="p-1.5 hover:bg-secondary text-muted-foreground rounded-md transition-colors"
                    title="Clone"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(test._id)}
                    className="p-1.5 hover:bg-red-500/10 hover:text-red-400 rounded-md transition-colors text-muted-foreground"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
