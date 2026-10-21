# Frontend test conventions

Stack: Vitest 4 (jsdom), Testing Library, `@testing-library/user-event`.
`src/test/setup.ts` already registers `jest-dom` matchers and `cleanup` after
each test, so no test file repeats that.

## A component test

Mock the design system and every sibling component, so a failure points at the
component under test.

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TodoForm } from './TodoForm'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))

describe('TodoForm', () => {
  it('rejects a whitespace-only title without submitting', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<TodoForm onSubmit={onSubmit} onCancel={vi.fn()} busy={false} error={null} />)
    await user.type(screen.getByLabelText(/Task title/), '   ')
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(screen.getByText('Enter a task title.')).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
```

The design-system mock renders plain elements: `Input` becomes a `<label>` with
an `<input>`, `Select` a real `<select>` with its options, `Drawer` a
`role="dialog"` when open, `Alert` a `<div data-testid="alert">`. That is why
`getByLabelText` and `getByRole` work in component tests.

## An API-client test

```ts
import { beforeEach, expect, it, vi } from 'vitest'
import { request } from '../../../lib/http'
import { todoFixture } from '../../../test/todoFixture'
import { todosApi } from './todos'

vi.mock('../../../lib/http', () => ({ request: vi.fn() }))
beforeEach(() => vi.clearAllMocks())

it('passes the abort signal when fetching tasks', async () => {
  const signal = new AbortController().signal
  vi.mocked(request).mockResolvedValue([todoFixture])
  await expect(todosApi.list(signal)).resolves.toEqual([todoFixture])
  expect(request).toHaveBeenCalledWith('/todos', { signal })
})
```

Use `todoFixture` from `src/test/todoFixture.ts` rather than hand-building a
`Todo`. Extend it with a spread when a case needs a different field.

## A react-query hook test

Hooks that call `useQuery`, `useMutation` or `useIsMutating` need a provider.
Create a fresh client per test so nothing leaks between them, and turn retries
off so a rejected query fails fast instead of after three attempts.

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { todosApi } from '../api/todos'
import { todoFixture } from '../../../test/todoFixture'
import { useTodosQuery } from './useTodosQuery'

vi.mock('../api/todos', () => ({ todosApi: { list: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

it('returns the tasks the API resolved with', async () => {
  vi.mocked(todosApi.list).mockResolvedValue([todoFixture])
  const { result } = renderHook(() => useTodosQuery(), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data).toEqual([todoFixture])
})
```

A mutation hook that writes to the cache is asserted through the cache, not
through internals: after `mutateAsync`, read `client.getQueryData(todoKeys.list)`
and check what landed there. Share one client between the wrapper and the
assertion in that case.

If several hook tests need the same wrapper, put it in
`src/test/queryWrapper.tsx` and import it — that path is a test file and is
yours to create.

## Mocking a hook that a component uses

When a component is the subject, replace its hooks rather than their transport,
and cast the return value, since a partial react-query result is not assignable:

```tsx
vi.mock('./hooks/useTodosQuery', () => ({ useTodosQuery: vi.fn() }))

vi.mocked(useTodosQuery).mockReturnValue({
  data: [],
  isPending: false,
  isError: true,
  error: new Error('The server is unavailable.'),
  refetch: vi.fn(),
} as unknown as ReturnType<typeof useTodosQuery>)
```

## Testing `lib/http.ts`

Here `fetch` is the subject. Stub it on `globalThis` and restore it afterwards:

```ts
vi.stubGlobal('fetch', vi.fn())
```

Cover what the module actually decides: the 422 message, the generic failure
message, `detail` from the body, a 204 resolving to `undefined`, and an aborted
request rethrowing the original error rather than the connection message.

## Things this repository does not do

- No snapshot tests.
- No `act()` wrapped by hand — `userEvent` and `waitFor` handle it.
- No assertions on class names or styled-components output.
- No real timers for debounce-free code; nothing here needs fake timers yet.
