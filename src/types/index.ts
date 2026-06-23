export interface ApiResponse<T> { success: boolean; data?: T; error?: string; code?: string; }
export interface PaginatedResponse<T> { data: T[]; nextCursor: string | null; hasMore: boolean; }

export interface User { id: string; username: string; displayName: string; avatarUrl: string; email?: string; }

export type BeadStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'failed' | 'archived';

export interface Bead {
  id: string; subject: string; description: string; status: BeadStatus;
  assignedTo?: string | null; assigneeName?: string | null;
  blockedBy: string[]; blocks: string[]; priority: number;
  createdAt: string; updatedAt: string; staleMinutes?: number | null;
}

export interface Project { id: string; name: string; }

export interface Job { id: string; project_id: string; status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'; }

/** A bead tagged with its project, the unit the garden plants. */
export interface GardenBead {
  id: string;
  subject: string;
  status: BeadStatus;
  projectId: string;
  projectName: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
  staleMinutes?: number | null;
}
