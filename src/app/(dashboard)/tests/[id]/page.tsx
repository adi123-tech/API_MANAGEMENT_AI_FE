'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { Plus, Trash2, Play, Sparkles, ArrowLeft, CheckCircle2, XCircle, Clock, Loader2, Zap, Copy, Check, ShieldCheck } from 'lucide-react';
import { testsApi, environmentsApi, aiApi } from '@/services/api';
import { useProjectStore } from '@/stores/projectStore';
import { cn, methodColors } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { parseCurl } from '@/lib/curlParser';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const TABS = ['Headers', 'Params', 'Body', 'Assertions', 'Pre-Auth', 'Chain Vars'];

interface PreAuth {
  enabled: boolean;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  tokenPath: string;
  headerName: string;
}

interface Assertion {
  type: string;
  field?: string;
  operator: string;
  expected: string;
  description: string;
}

export default function TestDetailPage() {
  const { id } = useParams<{ id: string }>();
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
  const [preAuth, setPreAuth] = useState<PreAuth>({
    enabled: false, url: '', method: 'POST', headers: {}, body: '{}', tokenPath: 'data.accessToken', headerName: 'x-authorization',
  });
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [environmentId, setEnvironmentId] = useState('');
  const [initialized, setInitialized] = useState(false);
  // result panel state
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [genResults, setGenResults] = useState<GenRunResult[] | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSmart, setIsSmart] = useState(false);

  const { data: testData, isLoading } = useQuery({
    queryKey: ['test', id],
    queryFn: () => testsApi.get(currentProject!._id, id),
    enabled: !!currentProject?._id && !!id,
  });

  const { data: environmentsData } = useQuery({
    queryKey: ['environments', currentProject?._id],
    queryFn: () => environmentsApi.list(currentProject!._id),
    enabled: !!currentProject?._id,
  });

  // Populate fields once test data loads
  useEffect(() => {
    const test = testData?.data?.data;
    if (!test || initialized) return;
    setName(test.name || '');
    setMethod(test.method || 'GET');
    setUrl(test.url || '');
    setFolder(test.folder || '');
    setHeaders(test.headers || { 'Content-Type': 'application/json' });
    setQueryParams(test.queryParams || {});
    if (test.body?.content) {
      try {
        setBody(JSON.stringify(test.body.content, null, 2));
      } catch {
        setBody(String(test.body.content));
      }
    }
    if (test.assertions?.length) {
      setAssertions(test.assertions.map((a: Assertion & { expected: unknown }) => ({
        ...a,
        expected: String(a.expected),
      })));
    }
    if (test.preAuth) {
      setPreAuth({
        enabled: test.preAuth.enabled ?? false,
        url: test.preAuth.url || '',
        method: test.preAuth.method || 'POST',
        headers: test.preAuth.headers || {},
        body: test.preAuth.body ? JSON.stringify(test.preAuth.body, null, 2) : '{}',
        tokenPath: test.preAuth.tokenPath || 'data.accessToken',
        headerName: test.preAuth.headerName || 'x-authorization',
      });
    }
    setInitialized(true);
  }, [testData, initialized]);

  const updateMutation = useMutation({
    mutationFn: (data: unknown) => testsApi.update(currentProject!._id, id, data),
    onSuccess: () => {
      toast({ title: 'Test updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      queryClient.invalidateQueries({ queryKey: ['test', id] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update test';
      toast({ title: msg, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => testsApi.delete(currentProject!._id, id),
    onSuccess: () => {
      toast({ title: 'Test deleted' });
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      router.push('/tests');
    },
    onError: () => toast({ title: 'Failed to delete test', variant: 'destructive' }),
  });

  const handleRun = async () => {
    if (!currentProject) return;
    setIsRunning(true);
    setSyncResult(null);
    setGenResults(null);
    try {
      await saveTest();
      const res = await testsApi.runSync(currentProject._id, id, { environmentId: environmentId || undefined });
      setSyncResult(res.data.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Run failed';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setIsRunning(false);
    }
  };

  const handleGenerateAndRun = async () => {
    if (!currentProject) return;
    setIsGenerating(true);
    setSyncResult(null);
    setGenResults(null);
    try {
      await saveTest();
      const res = await testsApi.generateAndRun(currentProject._id, id, { environmentId: environmentId || undefined, count: 5 });
      setGenResults(res.data.data.results);
      toast({ title: `${res.data.data.total} AI test cases generated & executed` });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Generation failed';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSmartRun = async () => {
    if (!currentProject) return;
    setIsSmart(true);
    setSyncResult(null);
    setGenResults(null);
    try {
      await saveTest();
      const res = await testsApi.generateSmartRun(currentProject._id, id, { environmentId: environmentId || undefined });
      setGenResults(res.data.data.results);
      toast({ title: `${res.data.data.total} smart test cases executed` });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Smart generate failed';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setIsSmart(false);
    }
  };

  const handleUrlChange = (value: string) => {
    // cURL auto-import: detect if pasted value starts with "curl"
    const trimmed = value.trimStart();
    if (/^curl\s/i.test(trimmed)) {
      const parsed = parseCurl(trimmed);
      if (parsed) {
        setMethod(parsed.method);
        setUrl(parsed.url);
        setHeaders(Object.keys(parsed.headers).length ? parsed.headers : { 'Content-Type': 'application/json' });
        setQueryParams(parsed.queryParams);
        if (parsed.body) {
          setBody(parsed.body);
          setActiveTab('Body');
        }
        toast({ title: 'cURL imported successfully' });
        return;
      }
    }
    setUrl(value);
  };

  const saveTest = (): Promise<void> => {
    if (!currentProject) return Promise.reject(new Error('No project selected'));
    if (!name || !url) return Promise.reject(new Error('Name and URL are required'));
    let parsedBody: unknown;
    try {
      parsedBody = method !== 'GET' ? JSON.parse(body) : undefined;
    } catch {
      parsedBody = body;
    }
    return new Promise((resolve, reject) => {
      updateMutation.mutate(
        {
          name,
          folder: folder || undefined,
          method,
          url,
          headers,
          queryParams,
          body: parsedBody ? { type: 'json', content: parsedBody } : { type: 'none' },
          assertions: assertions.map((a) => ({
            ...a,
            expected: a.type === 'status' || a.type === 'responseTime' ? Number(a.expected) : a.expected,
          })),
          preAuth: {
            enabled: preAuth.enabled,
            url: preAuth.url,
            method: preAuth.method,
            headers: preAuth.headers,
            body: preAuth.body ? (() => { try { return JSON.parse(preAuth.body); } catch { return preAuth.body; } })() : undefined,
            tokenPath: preAuth.tokenPath,
            headerName: preAuth.headerName,
          },
        },
        { onSuccess: () => resolve(), onError: (e) => reject(e) }
      );
    });
  };

  const generateAiAssertions = async () => {
    if (!url || !currentProject) return;
    setIsAiLoading(true);
    try {
      const { data } = await aiApi.generateAssertions(currentProject._id, {
        method,
        url,
        response: { status: 200, body: {}, duration: 100 },
      });
      const generated = data.data.assertions || [];
      setAssertions((prev) => [
        ...prev,
        ...generated.slice(0, 3).map((a: Assertion) => ({ ...a, expected: String(a.expected) })),
      ]);
      toast({ title: `Generated ${generated.length} AI assertions` });
    } catch {
      toast({ title: 'AI generation failed', variant: 'destructive' });
    } finally {
      setIsAiLoading(false);
    }
  };

  const addHeader = () => setHeaders((h) => ({ ...h, '': '' }));
  const addQueryParam = () => setQueryParams((p) => ({ ...p, '': '' }));
  const addAssertion = () =>
    setAssertions((a) => [...a, { type: 'status', operator: 'equals', expected: '200', description: '' }]);

  const environments = environmentsData?.data?.data || [];

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-5xl">
        <div className="h-24 bg-card border border-border rounded-xl animate-pulse" />
        <div className="h-64 bg-card border border-border rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in max-w-5xl">
      {/* Back + name bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/tests')}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium truncate">{name || 'Test Detail'}</span>
      </div>

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
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="Paste cURL or enter URL..."
            className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
          />

          <button
            onClick={handleRun}
            disabled={isRunning || isGenerating}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm px-3 py-2 rounded-lg transition-colors"
          >
            {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Run
          </button>

          <button
            onClick={handleSmartRun}
            disabled={isRunning || isGenerating || isSmart}
            className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm px-3 py-2 rounded-lg transition-colors"
          >
            {isSmart ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {isSmart ? 'Running...' : 'Smart Generate'}
          </button>

          <button
            onClick={handleGenerateAndRun}
            disabled={isRunning || isGenerating || isSmart}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground text-sm px-3 py-2 rounded-lg transition-colors"
          >
            {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {isGenerating ? 'Generating...' : 'AI Generate & Run'}
          </button>

          <button
            onClick={() => { if (confirm('Delete this test?')) deleteMutation.mutate(); }}
            className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-sm px-2 py-2 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
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
                      const h = { ...headers };
                      delete h[key];
                      h[e.target.value] = value;
                      setHeaders(h);
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
                  <button
                    onClick={() => { const h = { ...headers }; delete h[key]; setHeaders(h); }}
                    className="text-muted-foreground hover:text-red-400"
                  >
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
                  <button
                    onClick={() => { const p = { ...queryParams }; delete p[key]; setQueryParams(p); }}
                    className="text-muted-foreground hover:text-red-400"
                  >
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
                    {['status', 'body', 'header', 'responseTime'].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
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
                  <button
                    onClick={() => setAssertions(assertions.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button onClick={addAssertion} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                <Plus className="w-3 h-3" /> Add assertion
              </button>
            </div>
          )}

          {activeTab === 'Pre-Auth' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Pre-request Authentication</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-muted-foreground">{preAuth.enabled ? 'Enabled' : 'Disabled'}</span>
                  <button
                    onClick={() => setPreAuth((p) => ({ ...p, enabled: !p.enabled }))}
                    className={cn(
                      'relative inline-flex w-11 h-6 flex-shrink-0 rounded-full transition-colors duration-200',
                      preAuth.enabled ? 'bg-primary' : 'bg-muted border border-border'
                    )}
                  >
                    <span className={cn(
                      'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200',
                      preAuth.enabled ? 'translate-x-5' : 'translate-x-0'
                    )} />
                  </button>
                </label>
              </div>

              {preAuth.enabled && (
                <div className="space-y-3 p-3 bg-secondary/40 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground">
                    Before each run, this login request will be made and the token will be injected into your headers automatically.
                  </p>

                  <div className="flex gap-2">
                    <select
                      value={preAuth.method}
                      onChange={(e) => setPreAuth((p) => ({ ...p, method: e.target.value }))}
                      className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs outline-none"
                    >
                      {['POST', 'GET', 'PUT'].map((m) => <option key={m}>{m}</option>)}
                    </select>
                    <input
                      value={preAuth.url}
                      onChange={(e) => {
                        const val = e.target.value.trimStart();
                        if (/^curl\s/i.test(val)) {
                          const parsed = parseCurl(val);
                          if (parsed) {
                            setPreAuth((p) => ({
                              ...p,
                              method: parsed.method,
                              url: parsed.url,
                              headers: parsed.headers || {},
                              body: parsed.body || '{}',
                            }));
                            toast({ title: 'cURL imported into Pre-Auth' });
                            return;
                          }
                        }
                        setPreAuth((p) => ({ ...p, url: val }));
                      }}
                      placeholder="Paste cURL or enter login URL..."
                      className="flex-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs font-mono outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Headers captured from cURL */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-muted-foreground">
                        Login headers
                        {Object.keys(preAuth.headers).length > 0 && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]">
                            {Object.keys(preAuth.headers).length}
                          </span>
                        )}
                      </label>
                      <button
                        onClick={() => setPreAuth((p) => ({ ...p, headers: { ...p.headers, '': '' } }))}
                        className="text-[10px] text-primary hover:underline"
                      >
                        + Add
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {Object.keys(preAuth.headers).length === 0 && (
                        <p className="text-[11px] text-muted-foreground italic">No headers — paste a cURL above to auto-fill</p>
                      )}
                      {Object.entries(preAuth.headers).map(([k, v], i) => (
                        <div key={i} className="flex gap-2">
                          <input
                            value={k}
                            onChange={(e) => {
                              const h = { ...preAuth.headers };
                              delete h[k];
                              h[e.target.value] = v;
                              setPreAuth((p) => ({ ...p, headers: h }));
                            }}
                            placeholder="Header name"
                            className="flex-1 bg-secondary border border-border rounded-lg px-2 py-1 text-xs font-mono outline-none"
                          />
                          <input
                            value={v}
                            onChange={(e) => setPreAuth((p) => ({ ...p, headers: { ...p.headers, [k]: e.target.value } }))}
                            placeholder="Value"
                            className="flex-1 bg-secondary border border-border rounded-lg px-2 py-1 text-xs font-mono outline-none"
                          />
                          <button
                            onClick={() => {
                              const h = { ...preAuth.headers };
                              delete h[k];
                              setPreAuth((p) => ({ ...p, headers: h }));
                            }}
                            className="text-muted-foreground hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Login request body (JSON)</label>
                    <textarea
                      value={preAuth.body}
                      onChange={(e) => setPreAuth((p) => ({ ...p, body: e.target.value }))}
                      rows={4}
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs font-mono outline-none resize-none"
                      placeholder='{"username": "...", "password": "..."}'
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Token path in response</label>
                      <input
                        value={preAuth.tokenPath}
                        onChange={(e) => setPreAuth((p) => ({ ...p, tokenPath: e.target.value }))}
                        placeholder="data.accessToken"
                        className="w-full bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs font-mono outline-none"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Dot-notation path to token in response body</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Inject into header</label>
                      <input
                        value={preAuth.headerName}
                        onChange={(e) => setPreAuth((p) => ({ ...p, headerName: e.target.value }))}
                        placeholder="x-authorization"
                        className="w-full bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs font-mono outline-none"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Header name to inject the token into</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Chain Vars' && (
            <div className="text-sm text-muted-foreground p-4 text-center">
              <p>Chain variables allow you to extract values from this response</p>
              <p className="mt-1 text-xs">
                e.g., extract <code className="bg-secondary px-1 rounded">token</code> from{' '}
                <code className="bg-secondary px-1 rounded">data.token</code>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Run result */}
      {(isRunning || syncResult) && (
        <SyncResultPanel result={syncResult} loading={isRunning} />
      )}

      {/* Generate & Run results */}
      {(isGenerating || isSmart || genResults) && (
        <GenRunPanel results={genResults} loading={isGenerating || isSmart} />
      )}
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface AssertionResult {
  description: string;
  passed: boolean;
  expected?: unknown;
  actual?: unknown;
  message?: string;
}

interface ExecStep {
  testName?: string;
  status: string;
  duration: number;
  assertionResults: AssertionResult[];
  response?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: unknown;
    duration: number;
    size: number;
  };
  error?: string;
}

interface SyncResult {
  status: string;
  assertionResults: AssertionResult[];
  response?: ExecStep['response'];
  duration: number;
  error?: string;
  preAuthError?: string;
  preAuthCurl?: string;
}

interface GenRunResult {
  name: string;
  description?: string;
  scenario?: string;
  status: string;
  curl?: string;
  request?: { method: string; url: string; headers?: Record<string, string>; body?: unknown };
  response?: ExecStep['response'];
  assertionResults: AssertionResult[];
  error?: string;
}

const HTTP_STATUS_COLOR = (code: number) => {
  if (code >= 500) return 'text-red-400';
  if (code >= 400) return 'text-orange-400';
  if (code >= 300) return 'text-yellow-400';
  return 'text-emerald-400';
};

// ─── Sync Result Panel ────────────────────────────────────────────────────────

function SyncResultPanel({ result, loading }: { result: SyncResult | null; loading: boolean }) {
  const [activeTab, setActiveTab] = useState<'assertions' | 'body' | 'headers'>('assertions');

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin text-primary" /> Executing request...
      </div>
    );
  }
  if (!result) return null;

  const passed = result.status === 'passed';
  const res = result.response;
  const assertions = result.assertionResults || [];
  const passedCount = assertions.filter((a) => a.passed).length;
  const failedCount = assertions.length - passedCount;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl overflow-hidden">
      <div className={cn('flex items-center gap-3 px-4 py-3 border-b border-border',
        passed ? 'bg-emerald-500/5' : 'bg-red-500/5')}>
        {passed
          ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          : <XCircle className="w-4 h-4 text-red-400" />}
        <span className={cn('text-sm font-semibold capitalize', passed ? 'text-emerald-400' : 'text-red-400')}>
          {result.status}
        </span>
        {res?.status && (
          <span className={cn('text-xs font-mono font-bold px-2 py-0.5 rounded bg-secondary', HTTP_STATUS_COLOR(res.status))}>
            {res.status} {res.statusText}
          </span>
        )}
        <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
          {res?.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{res.duration} ms</span>}
          {res?.size !== undefined && <span>{(res.size / 1024).toFixed(1)} KB</span>}
          <span className="flex items-center gap-2">
            <span className="text-emerald-400 font-medium">{passedCount} passed</span>
            {failedCount > 0 && <span className="text-red-400 font-medium">{failedCount} failed</span>}
          </span>
        </div>
      </div>

      <div className="flex border-b border-border">
        {(['assertions', 'body', 'headers'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn('px-4 py-2 text-xs font-medium capitalize transition-colors',
              activeTab === tab ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground')}>
            {tab}
            {tab === 'assertions' && assertions.length > 0 && (
              <span className={cn('ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold',
                failedCount > 0 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400')}>
                {assertions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="p-4">
        {activeTab === 'assertions' && (
          <div className="space-y-2">
            {result.preAuthError && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-xs text-yellow-400 space-y-2">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span><strong>Pre-Auth failed:</strong> {result.preAuthError} — test ran with existing headers.</span>
                </div>
                {result.preAuthCurl && <CurlBlock curl={result.preAuthCurl} />}
              </div>
            )}
            {result.error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400 font-mono">{result.error}</div>}
            {assertions.length === 0 && !result.error && <p className="text-xs text-muted-foreground text-center py-4">No assertions defined</p>}
            {assertions.map((a, i) => (
              <div key={i} className={cn('flex items-start gap-3 p-3 rounded-lg border text-xs',
                a.passed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20')}>
                {a.passed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" /> : <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />}
                <div className="flex-1">
                  <p className={cn('font-medium', a.passed ? 'text-emerald-300' : 'text-red-300')}>{a.description}</p>
                  {!a.passed && <div className="mt-1 flex gap-3 text-muted-foreground font-mono text-[11px]">
                    <span>expected: <span className="text-foreground">{String(a.expected ?? '—')}</span></span>
                    <span>actual: <span className="text-red-400">{String(a.actual ?? '—')}</span></span>
                  </div>}
                </div>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'body' && (
          res?.body !== undefined
            ? <pre className="bg-secondary rounded-lg p-4 text-xs font-mono overflow-auto max-h-96 text-foreground leading-relaxed">
                {typeof res.body === 'string' ? res.body : JSON.stringify(res.body, null, 2)}
              </pre>
            : <p className="text-xs text-muted-foreground text-center py-8">No response body</p>
        )}
        {activeTab === 'headers' && (
          res?.headers && Object.keys(res.headers).length > 0
            ? <div className="space-y-1">{Object.entries(res.headers).map(([k, v]) => (
                <div key={k} className="flex gap-3 text-xs py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-primary font-mono w-48 flex-shrink-0 truncate">{k}</span>
                  <span className="text-muted-foreground font-mono truncate">{v}</span>
                </div>))}</div>
            : <p className="text-xs text-muted-foreground text-center py-8">No response headers</p>
        )}
      </div>
    </motion.div>
  );
}

// ─── Generate & Run Panel ────────────────────────────────────────────────────

const SCENARIO_COLOR: Record<string, string> = {
  happy_path: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  edge_case: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  negative: 'text-red-400 bg-red-500/10 border-red-500/20',
  security: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  performance: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
};

function CurlBlock({ curl }: { curl: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(curl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative mt-2 rounded-lg bg-[#0d0d0d] border border-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide">cURL</span>
        <button onClick={copy} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="px-3 py-2.5 text-[11px] font-mono text-foreground/80 overflow-x-auto whitespace-pre leading-relaxed">{curl}</pre>
    </div>
  );
}

function GenRunPanel({ results, loading }: { results: GenRunResult[] | null; loading: boolean }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm text-primary">
          <Zap className="w-4 h-4 animate-pulse" />
          <span>Generating test cases with AI and running them...</span>
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-secondary rounded-lg animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
        ))}
      </div>
    );
  }
  if (!results) return null;

  const passedCount = results.filter((r) => r.status === 'passed').length;
  const failedCount = results.filter((r) => r.status !== 'passed').length;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Summary header */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-primary/5">
        <Zap className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">{results.length} AI-generated test cases</span>
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-emerald-400 font-medium"><CheckCircle2 className="w-3 h-3" />{passedCount} passed</span>
          {failedCount > 0 && <span className="flex items-center gap-1 text-red-400 font-medium"><XCircle className="w-3 h-3" />{failedCount} failed</span>}
        </div>
      </div>

      {/* Test case rows */}
      <div className="divide-y divide-border">
        {results.map((r, i) => {
          const isOpen = expanded === i;
          const rPassed = r.status === 'passed';
          const rAssertions = r.assertionResults || [];
          const rPassedCount = rAssertions.filter((a) => a.passed).length;
          return (
            <div key={i}>
              <button
                onClick={() => setExpanded(isOpen ? null : i)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
              >
                {rPassed
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.name}</p>
                  {r.description && <p className="text-xs text-muted-foreground truncate">{r.description}</p>}
                </div>
                {r.scenario && (
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border capitalize flex-shrink-0',
                    SCENARIO_COLOR[r.scenario] || 'text-muted-foreground bg-secondary border-border')}>
                    {r.scenario.replace('_', ' ')}
                  </span>
                )}
                {r.response?.status && (
                  <span className={cn('text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-secondary flex-shrink-0', HTTP_STATUS_COLOR(r.response.status))}>
                    {r.response.status}
                  </span>
                )}
                {r.response?.duration && (
                  <span className="text-xs text-muted-foreground flex-shrink-0">{r.response.duration}ms</span>
                )}
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {rPassedCount}/{rAssertions.length} assertions
                </span>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-2 bg-secondary/20">
                  {r.curl && <CurlBlock curl={r.curl} />}
                  {r.error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400 font-mono mt-2">{r.error}</div>}
                  {rAssertions.map((a, j) => (
                    <div key={j} className={cn('flex items-start gap-3 p-3 rounded-lg border text-xs',
                      a.passed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20')}>
                      {a.passed
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        : <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />}
                      <div className="flex-1">
                        <p className={cn('font-medium', a.passed ? 'text-emerald-300' : 'text-red-300')}>{a.description}</p>
                        {!a.passed && <div className="mt-1 flex gap-3 text-muted-foreground font-mono text-[11px]">
                          <span>expected: <span className="text-foreground">{String(a.expected ?? '—')}</span></span>
                          <span>actual: <span className="text-red-400">{String(a.actual ?? '—')}</span></span>
                        </div>}
                      </div>
                    </div>
                  ))}
                  {r.response?.body !== undefined && (
                    <details className="group">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground py-1">Response body</summary>
                      <pre className="mt-2 bg-secondary rounded-lg p-3 text-xs font-mono overflow-auto max-h-48 text-foreground">
                        {typeof r.response.body === 'string' ? r.response.body : JSON.stringify(r.response.body, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

