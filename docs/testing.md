# Testing Guidelines

## Backend

- **Framework**: pytest + pytest-asyncio
- **Location**: `backend/tests/`
- **Test client**: `httpx.AsyncClient`
- **Naming**: `test_module_name.py`

### Testing Dependencies

```bash
# Backend
pip install pytest pytest-asyncio pytest-cov httpx

# Frontend
cd frontend
npm install
```

### Running Tests

```bash
# Backend - all tests
cd backend
pytest

# Backend - with coverage
pytest --cov=app --cov-report=html

# Backend - single test
pytest tests/test_file.py::test_name

# Backend - verbose
pytest -v

# Frontend - all tests
cd frontend
npm test

# Frontend - single test file
npm test -- lib/api.test.ts

# Frontend - watch mode
npm test -- --watch

# Frontend - with coverage
npm test -- --coverage
```

## Test Structure

### Backend Tests

```
backend/tests/
├── __init__.py
├── conftest.py           # Shared fixtures
├── test_projects.py      # Project API tests
├── test_assets.py        # Asset API tests
├── test_jobs.py          # Job API tests
└── test_schemas.py       # Schema validation tests
```

### Frontend Tests

```
frontend/src/
├── lib/
│   └── api.test.ts       # API service tests
└── test/
    └── setup.ts          # Test setup
```

## Writing Tests

### Backend API Test Example

```python
@pytest.mark.asyncio
async def test_create_project(client):
    response = await client.post("/api/v1/projects/", json={"name": "Test"})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test"
```

### Frontend API Test Example

```typescript
it('getProjects should fetch all projects', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([{ id: '1', name: 'Test' }])
  })
  
  const projects = await getProjects()
  expect(projects).toHaveLength(1)
})
```
