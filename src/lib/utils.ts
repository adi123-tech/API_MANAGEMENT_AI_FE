import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const statusColors: Record<string, string> = {
  passed: 'text-emerald-400',
  failed: 'text-red-400',
  error: 'text-orange-400',
  running: 'text-blue-400',
  pending: 'text-yellow-400',
  cancelled: 'text-gray-400',
};

export const statusBgColors: Record<string, string> = {
  passed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  error: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  running: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  cancelled: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

export const methodColors: Record<string, string> = {
  GET: 'text-emerald-400',
  POST: 'text-blue-400',
  PUT: 'text-yellow-400',
  PATCH: 'text-orange-400',
  DELETE: 'text-red-400',
  HEAD: 'text-purple-400',
  OPTIONS: 'text-gray-400',
};
