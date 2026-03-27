'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api, Job, Project } from '@/lib/api';
import { formatBrowserDateTime, getBrowserTimeZone } from '@/lib/datetime';
import { getStatusTone, InfoRow, DetailSection, SummaryTile } from '@/lib/ui';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AlertTriangle, Ban, CheckCircle2, Loader2, RefreshCcw, Search, ShieldAlert } from 'lucide-react';

function formatDateTime(value?: string): string {
  if (!value) {
    return 'Not recorded';
  }

  return formatBrowserDateTime(value);
}

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [projectsById, setProjectsById] = useState<Record<string, Project>>({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Job['status']>('all');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeActionJobId, setActiveActionJobId] = useState<string | null>(null);
  const browserTimeZone = getBrowserTimeZone();

  const loadJobs = async (withSpinner = true) => {
    if (withSpinner) {
      setIsRefreshing(true);
    }

    try {
      const [allJobs, allProjects] = await Promise.all([
        api.getAllJobs(),
        api.getProjects(),
      ]);

      setProjectsById(
        allProjects.reduce<Record<string, Project>>((accumulator, project) => {
          accumulator[project.id] = project;
          return accumulator;
        }, {})
      );
      setJobs(allJobs);
      setSelectedJobId((current) =>
        current && allJobs.some((job) => job.id === current) ? current : allJobs[0]?.id ?? null
      );
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadJobs(false);
  }, []);

  const getProjectName = (projectId: string): string =>
    projectsById[projectId]?.name || `Project ${projectId.slice(0, 8)}`;

  const filteredJobs = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return jobs.filter((job) => {
      const projectName = projectsById[job.project_id]?.name.toLowerCase() || '';
      const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
      const matchesSearch =
        searchTerm.length === 0 ||
        job.id.toLowerCase().includes(searchTerm) ||
        job.project_id.toLowerCase().includes(searchTerm) ||
        projectName.includes(searchTerm) ||
        job.type.toLowerCase().includes(searchTerm);

      return matchesStatus && matchesSearch;
    });
  }, [jobs, projectsById, search, statusFilter]);

  const selectedJob =
    filteredJobs.find((job) => job.id === selectedJobId) ??
    jobs.find((job) => job.id === selectedJobId) ??
    null;

  const handleJobAction = async (jobId: string, mode: 'stop' | 'fail') => {
    setActiveActionJobId(jobId);

    try {
      const nextError =
        mode === 'stop'
          ? 'Stopped by admin from the jobs console.'
          : 'Marked failed by admin from the jobs console.';

      await api.updateJob(jobId, {
        status: 'failed',
        error: nextError,
      });
      await loadJobs(false);
    } catch (error) {
      console.error(`Failed to ${mode} job:`, error);
    } finally {
      setActiveActionJobId(null);
    }
  };

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-white">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-400">
              Admin Console
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Job Monitor</h1>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/projects" className="text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
              Projects
            </Link>
            <button
              type="button"
              onClick={() => void loadJobs(true)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
            >
              <RefreshCcw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <div className="mx-auto min-h-0 flex-1 max-w-7xl overflow-hidden px-4 py-4">
        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Queue visibility and admin overrides</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Inspect every job, review its payload and result, and stop or administratively fail work when needed.
              </p>
              <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                Showing times in {browserTimeZone || 'browser local time'}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px] lg:w-[460px]">
              <label className="relative block">
                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by job, project name, ID, or type"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-sky-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:focus:border-sky-500"
                />
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | Job['status'])}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:focus:border-sky-500"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="running">Running</option>
                <option value="succeeded">Succeeded</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <SummaryTile label="Total" value={jobs.length} tone="slate" />
            <SummaryTile label="Running" value={jobs.filter((job) => job.status === 'running').length} tone="amber" />
            <SummaryTile label="Failed" value={jobs.filter((job) => job.status === 'failed').length} tone="rose" />
          </div>
        </section>

        <section className="mt-4 grid min-h-0 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="min-h-0 rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <h3 className="font-semibold">Jobs</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{filteredJobs.length} visible</p>
              </div>
              <ShieldAlert size={18} className="text-sky-500" />
            </div>

            {isLoading ? (
              <div className="flex min-h-[360px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                <Loader2 size={18} className="mr-2 animate-spin" />
                Loading jobs...
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="flex min-h-[360px] items-center justify-center px-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No jobs match the current filters.
              </div>
            ) : (
              <div className="max-h-[calc(100vh-240px)] space-y-3 overflow-y-auto p-4">
                {filteredJobs.map((job) => {
                  const isSelected = job.id === selectedJobId;
                  return (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => setSelectedJobId(job.id)}
                      className={`w-full rounded-3xl border p-4 text-left transition ${
                        isSelected
                          ? 'border-sky-400 bg-sky-50 shadow-sm dark:border-sky-500 dark:bg-sky-950/20'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-950'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{job.type}</p>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            {getProjectName(job.project_id)}
                          </p>
                          <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">{job.id}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusTone(job.status)}`}>
                          {job.status}
                        </span>
                      </div>
                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>Progress</span>
                          <span>{job.progress}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                          <div
                            className={`h-full rounded-full ${
                              job.status === 'failed'
                                ? 'bg-rose-500'
                                : job.status === 'succeeded'
                                  ? 'bg-emerald-500'
                                  : 'bg-sky-500'
                            }`}
                            style={{ width: `${Math.min(Math.max(job.progress, 4), 100)}%` }}
                          />
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                        {getProjectName(job.project_id)} · Created {formatDateTime(job.created_at)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="min-h-0 rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:max-h-[calc(100vh-240px)] lg:overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <h3 className="font-semibold">Job Details</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Review payloads, timestamps, results, and apply admin overrides.
                </p>
              </div>
            </div>

            {!selectedJob ? (
              <div className="flex min-h-[420px] items-center justify-center px-6 text-center text-sm text-slate-500 dark:text-slate-400">
                Select a job from the list to inspect it.
              </div>
            ) : (
              <div className="space-y-6 p-5">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex flex-wrap items-center gap-3">
                      <h4 className="text-xl font-semibold">{selectedJob.type}</h4>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusTone(selectedJob.status)}`}>
                        {selectedJob.status}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <InfoRow label="Job ID" value={selectedJob.id} mono />
                      <InfoRow label="Project" value={getProjectName(selectedJob.project_id)} />
                      <InfoRow label="Project ID" value={selectedJob.project_id} mono />
                      <InfoRow label="Created" value={formatDateTime(selectedJob.created_at)} />
                      <InfoRow label="Started" value={formatDateTime(selectedJob.started_at)} />
                      <InfoRow label="Ended" value={formatDateTime(selectedJob.ended_at)} />
                      <InfoRow label="Progress" value={`${selectedJob.progress}%`} />
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Admin Actions</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Use stop for in-flight work, or force a failed terminal state when cleanup is needed.
                    </p>
                    <div className="mt-4 space-y-3">
                      {(selectedJob.status === 'pending' || selectedJob.status === 'running') && (
                        <button
                          type="button"
                          onClick={() => void handleJobAction(selectedJob.id, 'stop')}
                          disabled={activeActionJobId === selectedJob.id}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Ban size={16} />
                          {activeActionJobId === selectedJob.id ? 'Stopping...' : 'Stop Job'}
                        </button>
                      )}
                      {selectedJob.status !== 'failed' && (
                        <button
                          type="button"
                          onClick={() => void handleJobAction(selectedJob.id, 'fail')}
                          disabled={activeActionJobId === selectedJob.id}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:bg-rose-950/30 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <AlertTriangle size={16} />
                          {activeActionJobId === selectedJob.id ? 'Updating...' : 'Mark Failed'}
                        </button>
                      )}
                      {selectedJob.status === 'succeeded' && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
                          <div className="flex items-center gap-2 font-medium">
                            <CheckCircle2 size={16} />
                            Completed successfully
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <DetailSection title="Params" content={selectedJob.params} emptyLabel="No params recorded for this job." />
                <DetailSection title="Result" content={selectedJob.result} emptyLabel="No result payload recorded yet." />
                <DetailSection title="Error" content={selectedJob.error ?? null} emptyLabel="No error recorded." />
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}


