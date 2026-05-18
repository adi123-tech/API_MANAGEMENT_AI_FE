'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { Plus, Trash2, Play, Sparkles, Save } from 'lucide-react';
import { testsApi, environmentsApi, aiApi } from '@/services/api';
import { useProjectStore } from '@/stores/projectStore';
import { cn, methodColors } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { parseCurl } from '@/lib/curlParser';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const TABS = ['Headers', 'Params', 'Body', 'Assertions', 'Chain Vars'];

interface Assertion {
  type: string;
  field?: string;
  operator: string;
  expected: string;
  description: string;
}

export default function NewTestPage() {
  const router = useRouter();
  const { currentProject } = useProjectStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [folder, setFolder] = useState('');
  const [activeTab, setActiveTab] = useState('Headers');
  const [headers, setHeaders] = useState<Record<string, string>>({ 'Content-Type': 'application/json' });
  const [queryParams, setQueryParams] = useState<Record<string, string>>({});
  const [body, setBody] = useState('{\n  \n}');
  const [assertions, setAssertions] = useState<Assertion[]>([
    { type: 'status', operator: 'equals', expected: '200', description: 'Status should be 200' },
  ]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [environmentId, setEnvironmentId] = useState('');

  const { data: environmentsData } = useQuery({
    queryKey: ['environments', currentProject?._id],
    queryFn: () => environmentsApi.list(currentProject!._id),
    enabled: !!currentProject?._id,
  });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => testsApi.create(currentProject!._id, data),
    onSuccess: () => {
      toast({ title: 'Test created successfully' });
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      router.push('/tests');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save test';
      toast({ title: msg, variant: 'destructive' });
    },
  });

  const executeMutation = useMutation({
    mutationFn: (testId: string) => testsApi.execute(currentProject!._id, testId, { environmentId: environmentId || undefined }),
    onSuccess: () => toast({ title: 'Test execution queued' }),
  });

  const handleSave = () => {
    if (!currentProject) {
      toast({ title: 'Please select or create a project first', variant: 'destructive' });
      return;
    }
    if (!name || !url) {
      toast({ title: 'Name and URL are required', variant: 'destructive' });
      return;
    }

    let parsedBody: unknown;
    try {
      parsedBody = method !== 'GET' ? JSON.parse(body) : undefined;
    } catch {
      parsedBody = body;
    }

    createMutation.mutate({
      name,
      folder: folder || undefined,
      method,
      url,
      headers,
      queryParams,
      body: parsedBody ? { type: 'json', content: parsedBody } : { type: 'none' },
      assertions: assertions.map((a) => ({
        ...a,
        expected: a.type === 'status' || a.type === 'responseTime'
          ? Number(a.expected)
          : a.expected,
      })),
    });
  };

  const generateAiAssertions = async () => {
    if (!url) return;
    setIsAiLoading(true);
    try {
      const { data } = await aiApi.generateAssertions(currentProject!._id, {
        method,
        url,
        response: { status: 200, body: {}, duration: 100 },
      });
      const generated = data.data.assertions || [];
      setAssertions((prev) => [...prev, ...generated.slice(0, 3).map((a: Assertion) => ({
        ...a,
        expected: String(a.expected),
      }))]);
      setAiSuggestions(data.data.assertions?.map((a: Assertion) => a.description) || []);
      toast({ title: `Generated ${generated.length} AI assertions` });
    } catch {
      toast({ title: 'AI generation failed', variant: 'destructive' });
    } finally {
      setIsAiLoading(false);
    }
  };

  const addHeader = () => setHeaders((h) => ({ ...h, '': '' }));
  const addQueryParam = () => setQueryParams((p) => ({ ...p, '': '' }));
  const addAssertion = () => setAssertions((a) => [...a, { type: 'status', operator: 'equals', expected: '200', description: '' }]);

  const environments = environmentsData?.data?.data || [];

  return (
    <div className="space-y-4 animate-fade-in max-w-5xl">
      {/* URL bar */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-3 mb-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Test name..."
            className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
          />
          <input
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="Folder (optional)"
            className="bg-secondary border border-border rounded-lg px-2 py-1 text-xs outline-none placeholder:text-muted-foreground w-36"
          />
          <select
            value={environmentId}
            onChange={(e) => setEnvironmentId(e.target.value)}
            className="bg-secondary border border-border rounded-lg px-2 py-1 text-xs outline-none text-muted-foreground"
          >
            <option value="">No environment</option>
            {environments.map((e: { _id: string; name: string }) => (
              <option key={e._id} value={e._id}>{e.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className={cn('bg-secondary border border-border rounded-lg px-3 py-2 text-xs font-bold outline-none', methodColors[method])}
          >
            {HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>

          <input
            value={url}
            onChange={(e) => {
              const val = e.target.value;
              // Auto-import if pasted value looks like a cURL command
              if (/^curl\s/i.test(val.trimStart())) {
                const parsed = parseCurl(val.trimStart());
                if (parsed) {
                  setMethod(parsed.method);
                  setUrl(parsed.url);
                  setHeaders(Object.keys(parsed.headers).length ? parsed.headers : { 'Content-Type': 'application/json' });
                  setQueryParams(parsed.queryParams);
                  if (parsed.body) { setBody(parsed.body); setActiveTab('Body'); }
                  toast({ title: 'cURL imported successfully' });
                  return;
                }
              }
              setUrl(val);
            }}
            placeholder="Paste cURL or enter URL..."
            className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
          />

          <button
            onClick={handleSave}
            disabled={createMutation.isPending}
            className="flex items-center gap-1.5 bg-secondary hover:bg-secondary/80 border border-border text-sm px-3 py-2 rounded-lg"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </button>

          <button
            onClick={() => {
              if (createMutation.data?.data?.data?._id) {
                executeMutation.mutate(createMutation.data.data.data._id);
              } else {
                toast({ title: 'Save the test first', variant: 'destructive' });
              }
            }}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-3 py-2 rounded-lg"
          >
            <Play className="w-3.5 h-3.5" />
            Run
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2.5 text-xs font-medium transition-colors',
                activeTab === tab
                  ? 'text-primary border-b-2 border-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === 'Headers' && (
            <div className="space-y-2">
              {Object.entries(headers).map(([key, value], i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={key}
                    onChange={(e) => {
                      const newHeaders = { ...headers };
                      delete newHeaders[key];
                      newHeaders[e.target.value] = value;
                      setHeaders(newHeaders);
                    }}
                    placeholder="Header name"
                    className="flex-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs outline-none"
                  />
                  <input
                    value={value}
                    onChange={(e) => setHeaders({ ...headers, [key]: e.target.value })}
                    placeholder="Value"
                    className="flex-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs outline-none"
                  />
                  <button onClick={() => {
                    const h = { ...headers };
                    delete h[key];
                    setHeaders(h);
                  }} className="text-muted-foreground hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button onClick={addHeader} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                <Plus className="w-3 h-3" /> Add header
              </button>
            </div>
          )}

          {activeTab === 'Params' && (
            <div className="space-y-2">
              {Object.entries(queryParams).map(([key, value], i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={key}
                    onChange={(e) => {
                      const p = { ...queryParams };
                      delete p[key];
                      p[e.target.value] = value;
                      setQueryParams(p);
                    }}
                    placeholder="Param name"
                    className="flex-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs outline-none"
                  />
                  <input
                    value={value}
                    onChange={(e) => setQueryParams({ ...queryParams, [key]: e.target.value })}
                    placeholder="Value"
                    className="flex-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs outline-none"
                  />
                  <button onClick={() => {
                    const p = { ...queryParams };
                    delete p[key];
                    setQueryParams(p);
                  }} className="text-muted-foreground hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button onClick={addQueryParam} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                <Plus className="w-3 h-3" /> Add param
              </button>
            </div>
          )}

          {activeTab === 'Body' && (
            <div>
              <MonacoEditor
                height="300px"
                language="json"
                value={body}
                onChange={(v) => setBody(v || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                }}
              />
            </div>
          )}

          {activeTab === 'Assertions' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground">{assertions.length} assertion(s)</span>
                <button
                  onClick={generateAiAssertions}
                  disabled={isAiLoading}
                  className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded-lg hover:bg-primary/20"
                >
                  <Sparkles className="w-3 h-3" />
                  {isAiLoading ? 'Generating...' : 'AI Generate'}
                </button>
              </div>

              {assertions.map((assertion, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    value={assertion.type}
                    onChange={(e) => {
                      const a = [...assertions];
                      a[i] = { ...a[i], type: e.target.value };
                      setAssertions(a);
                    }}
                    className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs outline-none"
                  >
                    {['status', 'body', 'header', 'responseTime'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {['body', 'header'].includes(assertion.type) && (
                    <input
                      value={assertion.field || ''}
                      onChange={(e) => {
                        const a = [...assertions];
                        a[i] = { ...a[i], field: e.target.value };
                        setAssertions(a);
                      }}
                      placeholder="field.path"
                      className="flex-1 bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs outline-none"
                    />
                  )}
                  <select
                    value={assertion.operator}
                    onChange={(e) => {
                      const a = [...assertions];
                      a[i] = { ...a[i], operator: e.target.value };
                      setAssertions(a);
                    }}
                    className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs outline-none"
                  >
                    {['equals', 'notEquals', 'contains', 'exists', 'greaterThan', 'lessThan'].map((op) => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                  <input
                    value={assertion.expected}
                    onChange={(e) => {
                      const a = [...assertions];
                      a[i] = { ...a[i], expected: e.target.value };
                      setAssertions(a);
                    }}
                    placeholder="expected value"
                    className="flex-1 bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs outline-none"
                  />
                  <button onClick={() => setAssertions(assertions.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button onClick={addAssertion} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                <Plus className="w-3 h-3" /> Add assertion
              </button>
            </div>
          )}

          {activeTab === 'Chain Vars' && (
            <div className="text-sm text-muted-foreground p-4 text-center">
              <p>Chain variables allow you to extract values from this response</p>
              <p className="mt-1 text-xs">e.g., extract <code className="bg-secondary px-1 rounded">token</code> from <code className="bg-secondary px-1 rounded">data.token</code></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
