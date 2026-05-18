'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Server, Plus, Trash2, Eye, EyeOff, Edit2, Check, X } from 'lucide-react';
import { environmentsApi } from '@/services/api';
import { useProjectStore } from '@/stores/projectStore';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const ENV_TYPES = ['development', 'uat', 'staging', 'production', 'custom'];
const ENV_TYPE_COLORS: Record<string, string> = {
  development: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  uat: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  staging: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  production: 'text-red-400 bg-red-500/10 border-red-500/20',
  custom: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
};

export default function EnvironmentsPage() {
  const { currentProject } = useProjectStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [creatingNew, setCreatingNew] = useState(false);
  const [newEnv, setNewEnv] = useState({ name: '', type: 'development' });

  const { data, isLoading } = useQuery({
    queryKey: ['environments', currentProject?._id],
    queryFn: () => environmentsApi.list(currentProject!._id),
    enabled: !!currentProject?._id,
  });

  const createMutation = useMutation({
    mutationFn: (envData: unknown) => environmentsApi.create(currentProject!._id, envData),
    onSuccess: () => {
      toast({ title: 'Environment created' });
      queryClient.invalidateQueries({ queryKey: ['environments'] });
      setCreatingNew(false);
      setNewEnv({ name: '', type: 'development' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => environmentsApi.delete(currentProject!._id, id),
    onSuccess: () => {
      toast({ title: 'Environment deleted' });
      queryClient.invalidateQueries({ queryKey: ['environments'] });
    },
  });

  const environments = data?.data?.data || [];

  return (
    <div className="space-y-4 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{environments.length} environment(s)</p>
        <button
          onClick={() => setCreatingNew(true)}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-3 py-2 rounded-lg"
        >
          <Plus className="w-3.5 h-3.5" /> New Environment
        </button>
      </div>

      {/* New environment form */}
      {creatingNew && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-primary/30 rounded-xl p-4">
          <h4 className="text-sm font-medium mb-3">New Environment</h4>
          <div className="flex gap-3">
            <input
              value={newEnv.name}
              onChange={(e) => setNewEnv({ ...newEnv, name: e.target.value })}
              placeholder="Environment name"
              className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm outline-none"
            />
            <select
              value={newEnv.type}
              onChange={(e) => setNewEnv({ ...newEnv, type: e.target.value })}
              className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm outline-none"
            >
              {ENV_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button
              onClick={() => createMutation.mutate({ name: newEnv.name, type: newEnv.type, variables: [] })}
              className="bg-primary text-primary-foreground px-3 py-2 rounded-lg"
            >
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => setCreatingNew(false)} className="text-muted-foreground hover:text-foreground px-2">
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-card border border-border rounded-xl animate-pulse" />)}
        </div>
      ) : environments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Server className="w-10 h-10 text-muted-foreground mb-3" />
          <h3 className="font-medium mb-1">No environments</h3>
          <p className="text-sm text-muted-foreground">Create DEV, UAT, and PROD environments</p>
        </div>
      ) : (
        <div className="space-y-3">
          {environments.map((env: {
            _id: string;
            name: string;
            type: string;
            isDefault: boolean;
            variables: Array<{ key: string; value: string; isSecret: boolean }>;
          }) => (
            <motion.div key={env._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium">{env.name}</h4>
                  <span className={cn('text-xs px-2 py-0.5 rounded border capitalize', ENV_TYPE_COLORS[env.type] || '')}>
                    {env.type}
                  </span>
                  {env.isDefault && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">default</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowSecrets({ ...showSecrets, [env._id]: !showSecrets[env._id] })}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-md"
                  >
                    {showSecrets[env._id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(env._id)}
                    className="p-1.5 text-muted-foreground hover:text-red-400 rounded-md"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {env.variables.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {env.variables.map((v) => (
                    <div key={v.key} className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-1.5">
                      <code className="text-xs text-muted-foreground">{'{{'}
                        <span className="text-primary">{v.key}</span>
                        {'}}'}
                      </code>
                      <span className="text-xs flex-1 text-right font-mono">
                        {v.isSecret && !showSecrets[env._id]
                          ? '••••••••'
                          : v.value}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No variables defined</p>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
