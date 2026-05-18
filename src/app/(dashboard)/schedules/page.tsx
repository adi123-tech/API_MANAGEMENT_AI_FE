'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Clock, Plus, Trash2, Play, Pause, Calendar } from 'lucide-react';
import { schedulesApi } from '@/services/api';
import { useProjectStore } from '@/stores/projectStore';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';

export default function SchedulesPage() {
  const { currentProject } = useProjectStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['schedules', currentProject?._id],
    queryFn: () => schedulesApi.list(currentProject!._id),
    enabled: !!currentProject?._id,
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => schedulesApi.toggle(currentProject!._id, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast({ title: 'Schedule updated' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => schedulesApi.delete(currentProject!._id, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast({ title: 'Schedule deleted' });
    },
  });

  const schedules = data?.data?.data || [];

  return (
    <div className="space-y-4 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{schedules.length} schedule(s)</p>
        <button className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-3 py-2 rounded-lg">
          <Plus className="w-3.5 h-3.5" /> New Schedule
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />)}
        </div>
      ) : schedules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Clock className="w-10 h-10 text-muted-foreground mb-3" />
          <h3 className="font-medium mb-1">No schedules</h3>
          <p className="text-sm text-muted-foreground">Automate test execution on a cron schedule</p>
        </div>
      ) : (
        <div className="space-y-2">
          {schedules.map((schedule: {
            _id: string;
            name: string;
            cronExpression: string;
            isActive: boolean;
            lastRun?: string;
            nextRun?: string;
            runCount: number;
            failureCount: number;
            target: { type: string };
          }) => (
            <motion.div key={schedule._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-card border border-border rounded-xl p-4 group hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className={cn('w-2 h-2 rounded-full flex-shrink-0', schedule.isActive ? 'bg-emerald-400' : 'bg-gray-500')} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium">{schedule.name}</h4>
                    <code className="text-xs bg-secondary px-2 py-0.5 rounded text-muted-foreground">{schedule.cronExpression}</code>
                    <span className="text-xs text-muted-foreground capitalize">{schedule.target?.type}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    {schedule.lastRun && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Last: {formatDate(schedule.lastRun)}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {schedule.runCount} runs · {schedule.failureCount} failures
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => toggleMutation.mutate(schedule._id)}
                    className={cn(
                      'p-1.5 rounded-md transition-colors',
                      schedule.isActive
                        ? 'text-muted-foreground hover:text-yellow-400 hover:bg-yellow-500/10'
                        : 'text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10'
                    )}
                  >
                    {schedule.isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(schedule._id)}
                    className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-md"
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
