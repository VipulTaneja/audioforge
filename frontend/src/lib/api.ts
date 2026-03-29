const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export const DEMUCS_MODEL_OPTIONS: Array<{ value: DemucsModel; label: string; description: string }> = [
  { value: 'htdemucs', label: 'HT Demucs', description: 'Best overall quality. 4 stems: Vocals, Drums, Bass, Other.' },
  { value: 'htdemucs_ft', label: 'HT Demucs (Fine-tuned)', description: 'Slightly better quality but slower.' },
  { value: 'mdx', label: 'MDX', description: 'Faster inference, good quality.' },
  { value: 'mdx_extra', label: 'MDX Extra', description: 'Highest quality but much slower.' },
];

export const FOUR_STEM_MODELS = new Set<DemucsModel>(['htdemucs', 'htdemucs_ft']);
export const TWO_STEM_MODELS = new Set<DemucsModel>(['htdemucs', 'htdemucs_ft', 'mdx', 'mdx_extra']);

export const STEM_MODE_OPTIONS: Array<{ value: StemMode; label: string; description: string }> = [
  { value: 'four_stem', label: '4-Stem', description: 'Vocals, Drums, Bass, Other' },
  { value: 'two_stem_vocals', label: '2-Stem (Vocals)', description: 'Vocals and Accompaniment' },
];

export interface JobStemResult {
  stems?: Stem[];
  message?: string;
  demucs_model?: DemucsModel;
  stem_mode?: StemMode;
}

export type DemucsModel = 'htdemucs' | 'htdemucs_ft' | 'mdx' | 'mdx_extra';
export type StemMode = 'four_stem' | 'two_stem_vocals';

export interface SeparationParams {
  demucs_model?: DemucsModel;
  stem_mode?: StemMode;
  separator?: string;
}

export interface AssetResult {
  display_name?: string;
}

export interface Asset {
  id: string;
  project_id: string;
  type: 'original' | 'stem' | 'mix' | 'preset';
  stem_type?: string;
  parent_asset_id?: string;
  s3_key: string;
  s3_key_preview?: string;
  duration?: number;
  channels: number;
  sample_rate: number;
  result?: AssetResult;
  created_by?: string;
  created_at: string;
}

export interface Project {
  id: string;
  org_id: string;
  name: string;
  status: string;
  created_at: string;
}

export interface Job {
  id: string;
  project_id: string;
  type: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  progress: number;
  params?: Record<string, unknown>;
  result?: JobStemResult;
  error?: string;
  created_at: string;
  started_at?: string;
  ended_at?: string;
}

export interface JobUpdatePayload {
  status?: Job['status'];
  error?: string;
}

export interface Stem {
  stem_type: string;
  asset_id: string;
  s3_key: string;
}

class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage: string;
      try {
        const errorJson = JSON.parse(errorBody);
        if (typeof errorJson.detail === 'string') {
          errorMessage = errorJson.detail;
        } else if (Array.isArray(errorJson.detail)) {
          errorMessage = errorJson.detail.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join(', ');
        } else {
          errorMessage = `HTTP ${response.status}: ${errorBody}`;
        }
      } catch {
        errorMessage = errorBody || `HTTP ${response.status}`;
      }
      throw new Error(errorMessage || `Request failed with status ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Projects
  async createProject(name: string): Promise<Project> {
    return this.request<Project>('/api/v1/projects/', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async getProjects(): Promise<Project[]> {
    return this.request<Project[]>('/api/v1/projects/');
  }

  async getProject(id: string): Promise<Project> {
    return this.request<Project>(`/api/v1/projects/${id}`);
  }

  async deleteProject(id: string): Promise<void> {
    return this.request<void>(`/api/v1/projects/${id}`, {
      method: 'DELETE',
    });
  }

  // Assets
  async getPresignedUploadUrl(
    projectId: string,
    filename: string,
    contentType: string
  ): Promise<{ upload_url: string; s3_key: string }> {
    return this.request<{ upload_url: string; s3_key: string }>(
      '/api/v1/assets/presign',
      {
        method: 'POST',
        body: JSON.stringify({
          project_id: projectId,
          filename,
          content_type: contentType,
        }),
      }
    );
  }

  async createAsset(
    projectId: string,
    s3Key: string,
    type: string = 'original',
    duration?: number
  ): Promise<Asset> {
    return this.request<Asset>('/api/v1/assets/', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        s3_key: s3Key,
        type,
        duration,
      }),
    });
  }

  async getProjectAssets(projectId: string): Promise<Asset[]> {
    return this.request<Asset[]>(`/api/v1/assets/project/${projectId}`);
  }

  async getAsset(id: string): Promise<Asset> {
    return this.request<Asset>(`/api/v1/assets/${id}`);
  }

  async updateAsset(id: string, updates: { display_name?: string }): Promise<Asset> {
    return this.request<Asset>(`/api/v1/assets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteAsset(id: string): Promise<void> {
    await this.request<void>(`/api/v1/assets/${id}`, {
      method: 'DELETE',
    });
  }

  async getAssetBpm(id: string): Promise<{ bpm: number | null; error?: string }> {
    return this.request<{ bpm: number | null; error?: string }>(`/api/v1/assets/${id}/bpm`);
  }

  async getAssetKey(id: string): Promise<{ key: string | null; mode?: string; error?: string }> {
    return this.request<{ key: string | null; mode?: string; error?: string }>(`/api/v1/assets/${id}/key`);
  }

  getAssetMixdownUrl(id: string, volumes?: number[], pans?: number[]): string {
    const params = new URLSearchParams();
    if (volumes) params.set('volumes', volumes.join(','));
    if (pans) params.set('pans', pans.join(','));
    return `${API_BASE_URL}/api/v1/assets/${id}/mixdown?${params.toString()}`;
  }

  async trimAsset(
    assetId: string,
    params: {
      start_time: number;
      end_time: number;
      output_name?: string;
    }
  ): Promise<Job> {
    return this.request<Job>(`/api/v1/assets/${assetId}/trim`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async validateAsset(assetId: string): Promise<{
    valid: boolean;
    duration?: number;
    sample_rate?: number;
    channels?: number;
    codec?: string;
    bitrate?: number;
    format_name?: string;
    errors?: string[];
  }> {
    return this.request(`/api/v1/assets/${assetId}/validate`, {
      method: 'POST',
    });
  }

  // Jobs
  async createSeparationJob(
    projectId: string,
    assetIds: string[],
    params: SeparationParams = {}
  ): Promise<Job> {
    return this.request<Job>('/api/v1/jobs/', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        type: 'separate',
        asset_ids: assetIds,
        params,
      }),
    });
  }

  async createDenoiseJob(
    projectId: string,
    assetIds: string[],
    params: {
      output_mode?: 'new' | 'overwrite';
      stationary?: boolean;
      noise_threshold?: number;
    } = {}
  ): Promise<Job> {
    return this.request<Job>('/api/v1/jobs/', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        type: 'denoise',
        asset_ids: assetIds,
        params,
      }),
    });
  }

  async getJob(jobId: string): Promise<Job> {
    return this.request<Job>(`/api/v1/jobs/${jobId}`);
  }

  async getAllJobs(): Promise<Job[]> {
    return this.request<Job[]>('/api/v1/jobs/');
  }

  async updateJob(jobId: string, updates: JobUpdatePayload): Promise<Job> {
    return this.request<Job>(`/api/v1/jobs/${jobId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async getJobStatus(jobId: string): Promise<{
    id: string;
    type: string;
    status: string;
    progress: number;
    result?: JobStemResult;
    error?: string;
  }> {
    return this.request(`/api/v1/jobs/${jobId}/status`);
  }

  async getProjectJobs(projectId: string, options?: { status?: Job['status']; limit?: number; offset?: number }): Promise<Job[]> {
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    const query = params.toString();
    return this.request<Job[]>(`/api/v1/jobs/project/${projectId}${query ? `?${query}` : ''}`);
  }

  // Upload file using presigned URL
  async uploadFile(
    file: File,
    projectId: string,
    onProgress?: (progress: number) => void
  ): Promise<{ s3_key: string; asset: Asset }> {
    // Get presigned URL
    const { upload_url, s3_key } = await this.getPresignedUploadUrl(
      projectId,
      file.name,
      file.type
    );

    // Upload directly to S3/MinIO
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress((e.loaded / e.total) * 100);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Upload failed'));
      
      xhr.open('PUT', upload_url);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });

    // Get audio duration
    const duration = await this.getAudioDuration(file);

    // Create asset record
    const asset = await this.createAsset(projectId, s3_key, 'original', duration);

    return { s3_key, asset };
  }

  private getAudioDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.src = URL.createObjectURL(file);
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(audio.src);
        resolve(audio.duration);
      };
      audio.onerror = () => resolve(180); // Default 3 minutes
    });
  }

  // Get presigned download URL for an asset
  getAssetDownloadUrl(assetId: string): string {
    return `${API_BASE_URL}/api/v1/assets/${assetId}/download`;
  }

  // Timeline Markers
  async listMarkers(projectId: string): Promise<TimelineMarker[]> {
    return this.request<TimelineMarker[]>(`/projects/${projectId}/markers`);
  }

  async createMarker(projectId: string, marker: TimelineMarkerCreate): Promise<TimelineMarker> {
    return this.request<TimelineMarker>(`/projects/${projectId}/markers`, {
      method: 'POST',
      body: JSON.stringify(marker),
    });
  }

  async updateMarker(projectId: string, markerId: string, marker: TimelineMarkerUpdate): Promise<TimelineMarker> {
    return this.request<TimelineMarker>(`/projects/${projectId}/markers/${markerId}`, {
      method: 'PUT',
      body: JSON.stringify(marker),
    });
  }

  async deleteMarker(projectId: string, markerId: string): Promise<void> {
    return this.request<void>(`/projects/${projectId}/markers/${markerId}`, {
      method: 'DELETE',
    });
  }

  async listSnapshots(projectId: string): Promise<ProjectSnapshot[]> {
    return this.request<ProjectSnapshot[]>(`/projects/${projectId}/snapshots`);
  }

  async createSnapshot(projectId: string, snapshot: ProjectSnapshotCreate): Promise<ProjectSnapshot> {
    return this.request<ProjectSnapshot>(`/projects/${projectId}/snapshots`, {
      method: 'POST',
      body: JSON.stringify(snapshot),
    });
  }

  async getSnapshot(projectId: string, snapshotId: string): Promise<ProjectSnapshot> {
    return this.request<ProjectSnapshot>(`/projects/${projectId}/snapshots/${snapshotId}`);
  }

  async deleteSnapshot(projectId: string, snapshotId: string): Promise<void> {
    return this.request<void>(`/projects/${projectId}/snapshots/${snapshotId}`, {
      method: 'DELETE',
    });
  }
}

export interface TimelineMarker {
  id: string;
  project_id: string;
  time: number;
  label?: string;
  color: string;
  created_by: string;
  created_at: string;
}

export interface TimelineMarkerCreate {
  time: number;
  label?: string;
  color?: string;
}

export interface TimelineMarkerUpdate {
  time?: number;
  label?: string;
  color?: string;
}

export interface ProjectSnapshot {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  data?: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

export interface ProjectSnapshotCreate {
  name: string;
  description?: string;
  data?: Record<string, unknown>;
}

export const api = new ApiService();
