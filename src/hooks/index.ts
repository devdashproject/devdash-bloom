import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Bead, GardenBead, Job, PaginatedResponse, Project, User } from '../types';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const r = await api.get<User>('/auth/me');
      if (!r.success) throw new Error(r.error);
      return r.data!;
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const r = await api.get<Project[]>('/projects');
      if (!r.success) throw new Error(r.error);
      return r.data!;
    },
    staleTime: 60_000,
  });
}

/** Every bead across the chosen project "beds", tagged with its project. Fans out per project. */
export function useGarden(projects: Project[], selectedIds: string[]) {
  const scope = projects.filter((p) => selectedIds.includes(p.id));
  const key = scope.map((p) => p.id).sort();
  return useQuery({
    queryKey: ['garden', key],
    enabled: scope.length > 0,
    refetchInterval: 15_000,
    staleTime: 8_000,
    queryFn: async () => {
      const results = await Promise.all(
        scope.map(async (p) => {
          const params = new URLSearchParams({ projectId: p.id, limit: '300' });
          const r = await api.get<PaginatedResponse<Bead>>(`/beads?${params}`);
          if (!r.success) return [] as GardenBead[];
          return r.data!.data.map(
            (b): GardenBead => ({
              id: b.id,
              subject: b.subject,
              status: b.status,
              projectId: p.id,
              projectName: p.name,
              priority: b.priority,
              createdAt: b.createdAt,
              updatedAt: b.updatedAt,
              staleMinutes: b.staleMinutes,
            })
          );
        })
      );
      return results.flat();
    },
  });
}

/** Running/queued agent jobs in the chosen scope — these become tending fireflies. */
export function useFireflies(selectedIds: string[]) {
  return useQuery({
    queryKey: ['fireflies'],
    refetchInterval: 10_000,
    staleTime: 5_000,
    queryFn: async () => {
      const r = await api.get<PaginatedResponse<Job>>('/jobs?limit=200');
      if (!r.success) return { running: 0, queued: 0 };
      const jobs = r.data!.data ?? [];
      const inScope = jobs.filter((j) => selectedIds.length === 0 || selectedIds.includes(j.project_id));
      return {
        running: inScope.filter((j) => j.status === 'running').length,
        queued: inScope.filter((j) => j.status === 'queued').length,
      };
    },
  });
}
