'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { GitBranch, Plus, Play, Trash2, ArrowRight } from 'lucide-react';
import { workflowsApi, testsApi } from '@/services/api';
import { useProjectStore } from '@/stores/projectStore';
import { cn, methodColors } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function WorkflowsPage() {
  const { currentProject } = useProjectStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['workflows', currentProject?._id],
    queryFn: () => workflowsApi.list(currentProject!._id),
    enabled: !!currentProject?._id,
  });

  const executeMutation = useMutation({
    mutationFn: (workflowId: string) => workflowsApi.execute(currentProject!._id, workflowId),
    onSuccess: () => {
      toast({ title: 'Workflow execution queued' });
      queryClient.invalidateQueries({ queryKey: ['executions'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workflowsApi.delete(currentProject!._id, id),
    onSuccess: () => {
      toast({ title: 'Workflow deleted' });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  const workflows = data?.data?.data || [];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{workflows.length} workflow(s)</p>
        <button className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-3 py-2 rounded-lg">
          <Plus className="w-3.5 h-3.5" /> New Workflow
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-card border border-border rounded-xl animate-pulse" />)}
        </div>
      ) : workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <GitBranch className="w-10 h-10 text-muted-foreground mb-3" />
          <h3 className="font-medium mb-1">No workflows</h3>
          <p className="text-sm text-muted-foreground mb-4">Chain API tests into automated workflows</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workflows.map((workflow: {
            _id: string;
            name: string;
            description?: string;
            steps: Array<{ order: number; testId: { name: string; method: string; url: string } | null }>;
            tags: string[];
          }) => (
            <motion.div key={workflow._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-card border border-border rounded-xl p-4 group hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-sm font-medium">{workflow.name}</h4>
                  {workflow.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{workflow.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => executeMutation.mutate(workflow._id)}
                    className="p-1.5 hover:bg-emerald-500/10 hover:text-emerald-400 rounded-md text-muted-foreground"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(workflow._id)}
                    className="p-1.5 hover:bg-red-500/10 hover:text-red-400 rounded-md text-muted-foreground"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Steps visualization */}
              <div className="flex items-center gap-2 flex-wrap">
                {workflow.steps.sort((a, b) => a.order - b.order).map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-secondary rounded-lg px-2.5 py-1.5">
                      {step.testId ? (
                        <>
                          <span className={cn('text-xs font-mono font-bold', methodColors[step.testId.method] || '')}>
                            {step.testId.method}
                          </span>
                          <span className="text-xs truncate max-w-24">{step.testId.name}</span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unknown test</span>
                      )}
                    </div>
                    {i < workflow.steps.length - 1 && (
                      <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
