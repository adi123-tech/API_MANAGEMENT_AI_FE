'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { FlaskConical, CheckCircle, XCircle, Clock, Zap, TrendingUp, AlertTriangle } from 'lucide-react';
import { reportsApi, projectsApi } from '@/services/api';
import { useProjectStore } from '@/stores/projectStore';
import { useEffect } from 'react';
import { formatDate, formatDuration, statusBgColors } from '@/lib/utils';
import { cn } from '@/lib/utils';

const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#6b7280'];

export default function DashboardPage() {
  const { currentProject, setCurrentProject, setProjects } = useProjectStore();

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
  });

  useEffect(() => {
    if (projectsData?.data?.data?.length && !currentProject) {
      const projects = projectsData.data.data;
      setProjects(projects);
      setCurrentProject(projects[0]);
    }
  }, [projectsData, currentProject, setCurrentProject, setProjects]);

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard', currentProject?._id],
    queryFn: () => reportsApi.dashboard(currentProject!._id),
    enabled: !!currentProject?._id,
  });

  const stats = dashboardData?.data?.data;

  const cards = [
    { label: 'Total Executions', value: stats?.totalExecutions || 0, icon: FlaskConical, color: 'text-blue-400' },
    { label: 'Passed', value: stats?.recentPassed || 0, icon: CheckCircle, color: 'text-emerald-400' },
    { label: 'Failed', value: stats?.recentFailed || 0, icon: XCircle, color: 'text-red-400' },
    { label: 'Pass Rate', value: `${(stats?.passRate || 0).toFixed(1)}%`, icon: TrendingUp, color: 'text-primary' },
  ];

  const trendData = stats?.passRateTrend?.map((t: { _id: string; avgPassRate: number; avgDuration: number; totalRuns: number }) => ({
    date: t._id,
    passRate: Math.round(t.avgPassRate || 0),
    duration: Math.round(t.avgDuration || 0),
    runs: t.totalRuns,
  })) || [];

  const pieData = [
    { name: 'Passed', value: stats?.recentPassed || 0 },
    { name: 'Failed', value: stats?.recentFailed || 0 },
  ];

  if (!currentProject && !isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No project selected</h3>
          <p className="text-muted-foreground text-sm">Create or select a project to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground">{label}</span>
              <Icon className={cn('w-4 h-4', color)} />
            </div>
            <p className="text-2xl font-bold">{isLoading ? '...' : value}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pass rate trend */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-medium mb-4">Pass Rate Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="passRateGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
              />
              <Area type="monotone" dataKey="passRate" stroke="#3b82f6" fill="url(#passRateGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pass/fail pie */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-medium mb-4">Recent Results</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {pieData.map((entry, i) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                {entry.name}: {entry.value}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent executions */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium">Recent Executions</h3>
          <a href="/reports" className="text-xs text-primary hover:underline">View all</a>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-secondary rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {(stats?.recentExecutions || []).slice(0, 6).map((exec: {
              _id: string;
              type: string;
              status: string;
              summary: { passRate: number; total: number; duration: number };
              createdAt: string;
            }) => (
              <div key={exec._id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors">
                <span className={cn('text-xs px-2 py-0.5 rounded border', statusBgColors[exec.status] || statusBgColors.pending)}>
                  {exec.status}
                </span>
                <span className="text-xs text-muted-foreground capitalize">{exec.type}</span>
                <span className="text-xs text-muted-foreground flex-1">
                  {exec.summary?.total || 0} tests · {(exec.summary?.passRate || 0).toFixed(0)}% pass
                </span>
                <span className="text-xs text-muted-foreground">
                  {exec.summary?.duration ? formatDuration(exec.summary.duration) : '—'}
                </span>
                <span className="text-xs text-muted-foreground">{formatDate(exec.createdAt)}</span>
              </div>
            ))}
            {!stats?.recentExecutions?.length && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No executions yet. Run your first test!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
