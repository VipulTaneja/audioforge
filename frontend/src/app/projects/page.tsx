'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FolderPlus, Layers3, Search, ShieldAlert, Trash2 } from 'lucide-react';
import { api, Project } from '@/lib/api';
import { formatBrowserDateTime } from '@/lib/datetime';
import { ThemeToggle } from '@/components/ThemeToggle';

interface LocalProject extends Project {
  tracks: number;
  lastModified: string;
}

const STORAGE_KEY = 'audioforge_projects';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    void loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const backendProjects = await api.getProjects();
      const mapped: LocalProject[] = backendProjects.map((project) => ({
        ...project,
        tracks: 0,
        lastModified: formatBrowserDateTime(project.created_at, {
          year: 'numeric',
        }),
      }));
      setProjects(mapped);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
    } catch {
      const savedProjects = localStorage.getItem(STORAGE_KEY);
      if (savedProjects) {
        setProjects(JSON.parse(savedProjects));
      }
    }

    setIsLoaded(true);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || isCreating) {
      return;
    }

    setIsCreating(true);
    try {
      const createdProject = await api.createProject(newProjectName.trim());
      const nextProject: LocalProject = {
        ...createdProject,
        tracks: 0,
        lastModified: 'Just now',
      };
      const nextProjects = [nextProject, ...projects];
      setProjects(nextProjects);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProjects));
      setNewProjectName('');
      setShowModal(false);
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const filteredProjects = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return projects;
    }

    return projects.filter((project) =>
      project.name.toLowerCase().includes(normalizedSearch) ||
      project.id.toLowerCase().includes(normalizedSearch),
    );
  }, [projects, search]);

  if (!isLoaded) {
    return (
      <main className="flex h-screen flex-col overflow-hidden">
        <div className="mx-auto flex min-h-0 flex-1 max-w-7xl items-center justify-center px-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading projects...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden">
      <header className="border-b border-white/60 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 lg:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-300">
              AudioForge
            </p>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Projects</h1>
          </div>
          <nav className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
            >
              Home
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

      <div className="mx-auto min-h-0 flex-1 max-w-7xl overflow-hidden px-4 py-4 lg:px-6">
        <section className="rounded-[30px] border border-white/70 bg-white/80 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/75">
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr] xl:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300">
                Workspace Hub
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                Keep projects compact, searchable, and ready to mix.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Jump straight into recent work, create a fresh workspace, or open the admin queue when a processing job needs attention.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label="Projects" value={projects.length.toString()} icon={<Layers3 size={18} />} />
              <MetricCard label="Visible" value={filteredProjects.length.toString()} icon={<Search size={18} />} />
              <MetricCard label="Ops" value="Admin" icon={<ShieldAlert size={18} />} />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block lg:w-[380px]">
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by project name or ID"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-sky-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-sky-500"
              />
            </label>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              <FolderPlus size={16} />
              New Project
            </button>
          </div>
        </section>

        <section className="mt-4 min-h-0">
          {filteredProjects.length === 0 ? (
            <div className="rounded-[30px] border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center shadow-sm dark:border-slate-700 dark:bg-slate-950/60">
              <p className="text-lg font-semibold text-slate-900 dark:text-white">
                {projects.length === 0 ? 'No projects yet' : 'No projects match your search'}
              </p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Create a new workspace to start uploading, separating, and mixing.
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                <FolderPlus size={16} />
                Create Project
              </button>
            </div>
          ) : (
            <div className="grid max-h-[calc(100vh-255px)] gap-4 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </section>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/95 p-6 shadow-[0_28px_90px_rgba(15,23,42,0.18)] dark:border-slate-800 dark:bg-slate-950/95">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Create New Project</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Give this workspace a clear name so assets and jobs stay easy to scan later.
            </p>
            <input
              type="text"
              placeholder="Project name"
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              className="mt-5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-sky-500"
              autoFocus
              onKeyDown={(event) => event.key === 'Enter' && handleCreateProject()}
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={isCreating}
                className="rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/85 p-4 dark:border-slate-800 dark:bg-slate-900/75">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
        {icon}
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function ProjectCard({ project }: { project: LocalProject }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDeleting(true);
    try {
      await api.deleteProject(project.id);
      setShowConfirm(false);
      router.push('/projects');
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete project');
      setIsDeleting(false);
    }
  };

  return (
    <Link href={`/projects/${project.id}`} className="group">
      <article className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_80px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-950/75">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-slate-900 dark:text-white">{project.name}</p>
            <p className="mt-1 font-mono text-xs text-slate-400 dark:text-slate-500">{project.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowConfirm(true);
              }}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-red-800 dark:hover:bg-red-950 dark:hover:text-red-400"
              title="Delete project"
            >
              <Trash2 size={16} />
            </button>
            <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              Open
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-900/70">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Tracks</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{project.tracks}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-900/70">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Updated</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{project.lastModified}</p>
          </div>
        </div>
      </article>
      
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[24px] border border-white/70 bg-white/95 p-5 shadow-[0_28px_90px_rgba(15,23,42,0.18)] dark:border-slate-800 dark:bg-slate-950/95">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Delete Project?</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              This will permanently delete &quot;{project.name}&quot; and all its assets and jobs. This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowConfirm(false);
                }}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Link>
  );
}
