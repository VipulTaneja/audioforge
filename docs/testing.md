# Testing Guidelines

## Backend

- **Framework**: pytest + pytest-asyncio
- **Location**: `backend/tests/`
- **Test client**: `httpx.AsyncClient`
- **Naming**: `test_module_name.py`

## Frontend

- **Framework**: Tests alongside components (`filename.test.ts`)
- **Library**: React Testing Library
- **API mocking**: MSW (Mock Service Worker)

### Testing Dependencies

```bash
pip install pytest pytest-asyncio httpx
```

### Running Tests

```bash
# Backend - all tests
pytest

# Backend - single test
pytest tests/test_file.py::test_name

# Backend - verbose
pytest -v

# Frontend - all tests
npm test

# Frontend - single test file
npm test -- filename.test.ts

# Frontend - watch mode
npm test -- --watch
```
