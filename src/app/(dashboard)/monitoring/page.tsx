'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Wifi, WifiOff, Play, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { executionsApi } from '@/services/api';
import { useProjectStore } from '@/stores/projectStore';
import { cn, statusBgColors, formatDate, formatDuration } from '@/lib/utils';

interface ExecutionEvent {
  executionId: string;
  status: string;
  stepOrder?: number;
  testName?: string;
  timestamp: Date;
}

export default function MonitoringPage() {
  const { currentProject } = useProjectStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['executions-live', currentProject?._id],
    queryFn: () => executionsApi.list(currentProject!._id, { status: 'running', limit: 10 }),
    enabled: !!currentProject?._id,
    refetchInterval: 5000,
  });

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5000';
    const s = io(wsUrl, { transports: ['websocket'] });

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));

    s.on('execution:started', (data: ExecutionEvent) => {
      setEvents((e) => [{ ...data, timestamp: new Date() }, ...e].slice(0, 50));
      refetch();
    });

    s.on('execution:step', (data: ExecutionEvent) => {
      setEvents((e) => [{ ...data, timestamp: new Date() }, ...e].slice(0, 50));
    });

    s.on('execution:completed', (data: ExecutionEvent) => {
      setEvents((e) => [{ ...data, timestamp: new Date() }, ...e].slice(0, 50));
      refetch();
    });

    setSocket(s);
    return () => { s.disconnect(); };
  }, [refetch]);

  const runningExecutions = data?.data?.data || [];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Connection status */}
      <div className="flex items-center gap-2">
        <div className={cn('flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border',
          connected ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20'
        )}>
          {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {connected ? 'Live connected' : 'Disconnected'}
        </div>
        <span className="text-xs text-muted-foreground">Real-time execution monitoring</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active executions */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-medium">Active Executions</h3>
            {runningExecutions.length > 0 && (
              <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {runningExecutions.length} running
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-secondary rounded-lg animate-pulse" />)}
            </div>
          ) : runningExecutions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No active executions
            </div>
          ) : (
            <div className="space-y-2">
              {runningExecutions.map((exec: {
                _id: string;
                type: string;
                status: string;
                summary: { total: number; passed: number };
                createdAt: string;
              }) => (
                <div key={exec._id} className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono truncate text-muted-foreground">{exec._id.slice(-8)}</p>
                    <p className="text-xs capitalize">{exec.type} · {exec.summary?.total || 0} tests</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(exec.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live event stream */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Play className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-medium">Event Stream</h3>
            {connected && <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse ml-auto" />}
          </div>

          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            <AnimatePresence>
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Waiting for execution events...
                </p>
              ) : (
                events.map((event, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 text-xs"
                  >
                    {event.status === 'passed' ? (
                      <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    ) : event.status === 'failed' ? (
                      <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                    ) : (
                      <Loader2 className="w-3 h-3 text-blue-400 animate-spin flex-shrink-0" />
                    )}
                    <span className="font-mono text-muted-foreground">{event.executionId?.slice(-6)}</span>
                    {event.testName && <span className="truncate">{event.testName}</span>}
                    <span className={cn('capitalize', statusBgColors[event.status]?.split(' ')[0])}>{event.status}</span>
                    <span className="ml-auto text-muted-foreground">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
