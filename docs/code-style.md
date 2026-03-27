# Code Style Guidelines

## Python (Backend)

- **Imports**: Absolute, group: stdlib → third-party → local, sort alphabetically
- **Formatting**: Max 100 chars/line, 4 spaces, use Black
- **Types**: Type hints for all args/returns, Pydantic for schemas, SQLAlchemy for models
- **Naming**: snake_case (vars/functions), PascalCase (classes), UPPER_SNAKE_CASE (constants)
- **Error Handling**: HTTPException, try/except, log appropriately, never expose secrets
- **Database**: Async SQLAlchemy + asyncpg, dependency injection (`db: AsyncSession = Depends(get_db)`), use `await db.flush()` after add, `await db.refresh()` before return, UUIDs for PKs
- **Response Models**: Always use Pydantic schemas (`response_model`) for API endpoints
- **Async**: Use `async def` for all route handlers and database operations

## TypeScript/React (Frontend)

- **Imports**: Absolute with `@/` prefix (e.g., `@/lib/api`), group: React/next → libs → components → types
- **Formatting**: 2 spaces, single quotes, trailing commas, semicolons
- **Types**: TypeScript interfaces, explicit props/state, avoid `any`
- **Naming**: camelCase (vars/functions), PascalCase (components/types)
- **Components**: Functional + hooks, `'use client'` for client-side
- **State**: useState (local), useEffect (side effects), cleanup in useEffect
- **Error Handling**: try/catch async ops, user-friendly messages
