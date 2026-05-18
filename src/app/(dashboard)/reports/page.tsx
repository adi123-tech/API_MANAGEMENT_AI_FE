'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FileBarChart2, CheckCircle, XCircle, Clock, TrendingUp, Download } from 'lucide-react';
import { reportsApi, executionsApi } from '@/services/api';
import { useProjectStore } from '@/stores/projectStore';
import { cn, statusBgColors, formatDate, formatDuration } from '@/lib/utils';

export default function ReportsPage() {
  const { currentProject } = useProjectStore();

  const { data: executionsData, isLoading } = useQuery({
    queryKey: ['executions', currentProject?._id],
    queryFn: () => executionsApi.list(currentProject!._id, { limit: 50 }),
    enabled: !!currentProject?._id,
  });

  const executions = executionsData?.data?.data || [];
  const total = executions.length;
  const passed = executions.filter((e: { status: string }) => e.status === 'passed').length;
  const failed = executions.filter((e: { status: string }) => e.status === 'failed').length;
  const avgPassRate = total > 0
    ? (executions.reduce((sum: number, e: { summary?: { passRate?: number } }) => sum + (e.summary?.passRate || 0), 0) / total).toFixed(1)
    : '0';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Runs', value: total, icon: FileBarChart2, color: 'text-blue-400' },
          { label: 'Passed', value: passed, icon: CheckCircle, color: 'text-emerald-400' },
          { label: 'Failed', value: failed, icon: XCircle, color: 'text-red-400' },
          { label: 'Avg Pass Rate', value: `${avgPassRate}%`, icon: TrendingUp, color: 'text-primary' },
        ].map(({ label, value, icon: Icon, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-4"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-muted-foreground">{label}</span>
              <Icon className={cn('w-4 h-4', color)} />
            </div>
            <p className="text-2xl font-bold">{isLoading ? '...' : value}</p>
          </motion.div>
        ))}
      </div>

      {/* Execution history */}
      <div className="bg-card border border-border rounded-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-medium">Execution History</h3>
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-secondary rounded-lg animate-pulse" />)}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {executions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No executions yet</div>
            ) : (
              executions.map((exec: {
                _id: string;
                type: string;
                status: string;
                summary: { total: number; passed: number; failed: number; passRate: number; duration: number };
                triggeredBy: string;
                createdAt: string;
              }) => (
                <div key={exec._id} className="flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors">
                  <span className={cn('text-xs px-2 py-0.5 rounded border capitalize', statusBgColors[exec.status] || '')}>
                    {exec.status}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize w-16">{exec.type}</span>
                  <div className="flex-1 grid grid-cols-4 gap-4">
                    <div className="text-xs">
                      <span className="text-muted-foreground">Tests: </span>
                      <span>{exec.summary?.total || 0}</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-emerald-400">{exec.summary?.passed || 0} pass</span>
                      {' / '}
                      <span className="text-red-400">{exec.summary?.failed || 0} fail</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {exec.summary?.duration ? formatDuration(exec.summary.duration) : '��'}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">{exec.triggeredBy}</div>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(exec.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
