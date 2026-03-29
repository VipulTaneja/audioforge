import { describe, it, expect, vi, beforeEach } from 'vitest'


describe('ApiService', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = vi.fn()
  })

  it('should export api singleton', async () => {
    const { api } = await import('@/lib/api')
    expect(api).toBeDefined()
    expect(api.getProjects).toBeDefined()
    expect(api.getProject).toBeDefined()
    expect(api.createProject).toBeDefined()
  })

  describe('Projects', () => {
    beforeEach(() => {
      vi.resetAllMocks()
      global.fetch = vi.fn()
    })

    it('getProjects should fetch all projects', async () => {
      const { api } = await import('@/lib/api')
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ id: '1', name: 'Test Project' }])
      })

      const projects = await api.getProjects()
      expect(projects).toHaveLength(1)
      expect(projects[0].name).toBe('Test Project')
    })

    it('getProject should fetch single project', async () => {
      const { api } = await import('@/lib/api')
      const mockProject = { id: '1', name: 'Test Project' }
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockProject)
      })

      const project = await api.getProject('1')
      expect(project.name).toBe('Test Project')
    })

    it('createProject should create new project', async () => {
      const { api } = await import('@/lib/api')
      const mockProject = { id: '1', name: 'New Project' }
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockProject)
      })

      const project = await api.createProject('New Project')
      expect(project.name).toBe('New Project')
    })

    it('deleteProject should delete project', async () => {
      const { api } = await import('@/lib/api')
      global.fetch.mockResolvedValue({
        ok: true,
        status: 204
      })

      await expect(api.deleteProject('1')).resolves.not.toThrow()
    })
  })

  describe('Assets', () => {
    beforeEach(() => {
      vi.resetAllMocks()
      global.fetch = vi.fn()
    })

    it('getProjectAssets should fetch assets for project', async () => {
      const { api } = await import('@/lib/api')
      const mockAssets = [{ id: '1', type: 'original', filename: 'test.mp3' }]
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockAssets)
      })

      const assets = await api.getProjectAssets('project-1')
      expect(assets).toHaveLength(1)
      expect(assets[0].type).toBe('original')
    })

    it('createAsset should create new asset', async () => {
      const { api } = await import('@/lib/api')
      const mockAsset = { id: '1', type: 'original', filename: 'test.mp3' }
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockAsset)
      })

      const asset = await api.createAsset({
        project_id: 'project-1',
        type: 'original',
        s3_key: 'test/test.mp3',
        filename: 'test.mp3'
      })
      expect(asset.filename).toBe('test.mp3')
    })

    it('updateAsset should update asset', async () => {
      const { api } = await import('@/lib/api')
      const mockAsset = { id: '1', display_name: 'Updated Name' }
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockAsset)
      })

      const asset = await api.updateAsset('1', { display_name: 'Updated Name' })
      expect(asset.display_name).toBe('Updated Name')
    })

    it('deleteAsset should delete asset', async () => {
      const { api } = await import('@/lib/api')
      global.fetch.mockResolvedValue({
        ok: true,
        status: 204
      })

      await expect(api.deleteAsset('1')).resolves.not.toThrow()
    })

    it('getPresignedUploadUrl should return upload URL', async () => {
      const { api } = await import('@/lib/api')
      const mockResponse = { upload_url: 'https://minio.test/upload', s3_key: 'test/key' }
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const response = await api.getPresignedUploadUrl('project-1', 'test.mp3', 'audio/mpeg')
      expect(response.upload_url).toBeDefined()
    })
  })

  describe('Jobs', () => {
    beforeEach(() => {
      vi.resetAllMocks()
      global.fetch = vi.fn()
    })

    it('getJobStatus should fetch job status', async () => {
      const { api } = await import('@/lib/api')
      const mockStatus = { status: 'running', progress: 50 }
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockStatus)
      })

      const status = await api.getJobStatus('job-1')
      expect(status.status).toBe('running')
      expect(status.progress).toBe(50)
    })

    it('createSeparationJob should create separation job', async () => {
      const { api } = await import('@/lib/api')
      const mockJob = { id: '1', type: 'separate', status: 'pending' }
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockJob)
      })

      const job = await api.createSeparationJob({
        project_id: 'project-1',
        asset_id: 'asset-1',
        demucs_model: 'htdemucs',
        stem_mode: 'four_stem'
      })
      expect(job.type).toBe('separate')
    })

    it('createDenoiseJob should create denoise job', async () => {
      const { api } = await import('@/lib/api')
      const mockJob = { id: '1', type: 'denoise', status: 'pending' }
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockJob)
      })

      const job = await api.createDenoiseJob({
        project_id: 'project-1',
        asset_id: 'asset-1',
        output_mode: 'new',
        stationary: true,
        noise_threshold: 1.5
      })
      expect(job.type).toBe('denoise')
    })

    it('getJob should fetch job', async () => {
      const { api } = await import('@/lib/api')
      const mockJob = { id: 'job-1', type: 'separate', status: 'running' }
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockJob)
      })

      const job = await api.getJob('job-1')
      expect(job.id).toBe('job-1')
    })

    it('getAllJobs should fetch all jobs', async () => {
      const { api } = await import('@/lib/api')
      const mockJobs = [{ id: '1', type: 'separate', status: 'pending' }]
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockJobs)
      })

      const jobs = await api.getAllJobs()
      expect(jobs).toHaveLength(1)
    })

    it('getProjectJobs should fetch jobs for project', async () => {
      const { api } = await import('@/lib/api')
      const mockJobs = [{ id: '1', type: 'separate', status: 'pending' }]
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockJobs)
      })

      const jobs = await api.getProjectJobs('project-1')
      expect(jobs).toHaveLength(1)
    })
  })

  describe('Audio Analysis', () => {
    beforeEach(() => {
      vi.resetAllMocks()
      global.fetch = vi.fn()
    })

    it('getAssetBpm should fetch BPM', async () => {
      const { api } = await import('@/lib/api')
      const mockResponse = { bpm: 120 }
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const response = await api.getAssetBpm('asset-1')
      expect(response.bpm).toBe(120)
    })

    it('getAssetKey should fetch musical key', async () => {
      const { api } = await import('@/lib/api')
      const mockResponse = { key: 'C', mode: 'major' }
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const response = await api.getAssetKey('asset-1')
      expect(response.key).toBe('C')
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      vi.resetAllMocks()
      global.fetch = vi.fn()
    })

    it('should throw error on failed request', async () => {
      const { api } = await import('@/lib/api')
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('Not Found')
      })

      await expect(api.getProject('nonexistent')).rejects.toThrow()
    })

    it('should handle network errors', async () => {
      const { api } = await import('@/lib/api')
      global.fetch.mockRejectedValue(new Error('Network error'))

      await expect(api.getProjects()).rejects.toThrow('Network error')
    })
  })
})
