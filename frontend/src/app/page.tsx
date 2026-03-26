'use client';

import Link from 'next/link';
import { Layers3, ShieldAlert, Sparkles, Wand2, Waves } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

const featureCards = [
  {
    title: 'Separate',
    description: 'Split songs into stems with selectable Demucs models and fast job tracking.',
    icon: <Layers3 size={18} />,
  },
  {
    title: 'Shape',
    description: 'Organize project assets, sketch ideas, and move only the right tracks into the mixer.',
    icon: <Wand2 size={18} />,
  },
  {
    title: 'Mix',
    description: 'Balance levels, pan, meters, and playback from a compact browser-first workspace.',
    icon: <Waves size={18} />,
  },
];

export default function HomePage() {
  return (
    <main className="flex h-screen flex-col overflow-hidden bg-transparent">
      <header className="border-b border-white/60 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 lg:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-300">
              AudioForge
            </p>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">AI Audio Workspace</h1>
          </div>
          <nav className="flex items-center gap-3">
            <Link
              href="/projects"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
            >
              Projects
            </Link>
            <Link
              href="/admin/jobs"
              className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white sm:inline-flex"
            >
              Admin Jobs
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <section className="mx-auto grid min-h-0 flex-1 max-w-7xl gap-5 overflow-hidden px-4 py-4 lg:grid-cols-[1.2fr_0.8fr] lg:px-6 lg:py-5">
        <div className="min-h-0 overflow-hidden rounded-[32px] border border-white/70 bg-white/80 p-5 shadow-[0_28px_90px_rgba(15,23,42,0.09)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/75 lg:p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300">
            <Sparkles size={14} />
            Studio-ready workflow
          </div>

          <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-slate-900 dark:text-white lg:text-4xl">
            Separate, shape, and mix audio without leaving the browser.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 lg:text-base">
            AudioForge keeps your originals, stems, generated ideas, and mix decisions inside one compact workspace.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/projects"
              className="rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Open Workspace
            </Link>
            <Link
              href="/admin/jobs"
              className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
            >
              Review Jobs
            </Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {featureCards.map((feature) => (
              <div
                key={feature.title}
                className="rounded-3xl border border-slate-200 bg-white/85 p-4 dark:border-slate-800 dark:bg-slate-900/80"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                  {feature.icon}
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 gap-4">
          <div className="overflow-hidden rounded-[30px] border border-white/70 bg-white/80 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/75">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Flow</p>
            <div className="mt-3 space-y-2.5">
              {[
                'Upload originals or create quick musical sketches',
                'Separate vocals, drums, bass, and accompaniment',
                'Preview assets and move only the right ones into the mixer',
                'Track long-running jobs from the admin console',
              ].map((step, index) => (
                <div key={step} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-amber-200 bg-amber-50/85 p-4 shadow-[0_20px_70px_rgba(148,93,0,0.08)] backdrop-blur dark:border-amber-900/40 dark:bg-amber-950/15">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm dark:bg-slate-900 dark:text-amber-300">
                <ShieldAlert size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Admin visibility built in</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Review queue state, inspect payloads, and recover from stuck or stale jobs quickly.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
