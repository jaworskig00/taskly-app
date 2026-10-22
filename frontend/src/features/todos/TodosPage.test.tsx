import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { useNotice } from '../../hooks/useNotice'
import { useClearCompletedMutation } from './hooks/useClearCompletedMutation'
import { useTodoFilters } from './hooks/useTodoFilters'
import { useTodosBusy } from './hooks/useTodosBusy'
import { useTodosQuery } from './hooks/useTodosQuery'
import { useUpdateTodoMutation } from './hooks/useUpdateTodoMutation'
import { TodosPage } from './TodosPage'

vi.mock('../../design-system', () => import('../../design-system/mocks'))
vi.mock('../../hooks/useNotice', () => ({ useNotice: vi.fn() }))
vi.mock('./hooks/useTodoFilters', () => ({ useTodoFilters: vi.fn() }))
vi.mock('./hooks/useClearCompletedMutation', () => ({
  useClearCompletedMutation: vi.fn(),
}))
vi.mock('./hooks/useTodosBusy', () => ({ useTodosBusy: vi.fn() }))
vi.mock('./hooks/useTodosQuery', () => ({ useTodosQuery: vi.fn() }))
vi.mock('./hooks/useUpdateTodoMutation', () => ({
  useUpdateTodoMutation: vi.fn(),
}))
vi.mock('./components/TodosHeader', () => ({
  TodosHeader: ({ onClearCompleted }: { onClearCompleted: () => void }) => (
    <>
      <h1>Tasks</h1>
      <button onClick={onClearCompleted}>Clear completed</button>
    </>
  ),
}))
vi.mock('./components/TodoFilters', () => ({ TodoFilters: () => null }))
vi.mock('./components/TodoList', () => ({ TodoList: () => <p>Task list</p> }))
vi.mock('./components/TodoEditor', () => ({ TodoEditor: () => null }))
vi.mock('./components/DeleteTodoDialog', () => ({
  DeleteTodoDialog: () => null,
}))
vi.mock('../../components/SuccessNotice', () => ({ SuccessNotice: () => null }))

function setup({
  busy = false,
  clear = {},
  notify = vi.fn(),
}: {
  busy?: boolean
  clear?: object
  notify?: (message: string) => void
} = {}) {
  const refetch = vi.fn().mockResolvedValue(undefined)
  const resetToggle = vi.fn()
  const clearCompleted = {
    error: null,
    reset: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({ deleted: 1 }),
    ...clear,
  }
  vi.mocked(useTodosQuery).mockReturnValue({
    data: [],
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch,
  } as unknown as ReturnType<typeof useTodosQuery>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    error: null,
    reset: resetToggle,
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  vi.mocked(useClearCompletedMutation).mockReturnValue(
    clearCompleted as unknown as ReturnType<typeof useClearCompletedMutation>,
  )
  vi.mocked(useTodosBusy).mockReturnValue(busy)
  vi.mocked(useNotice).mockReturnValue({ message: '', notify })
  vi.mocked(useTodoFilters).mockReturnValue({
    filter: 'all',
    search: '',
    sort: 'newest',
    visible: [],
    setFilter: vi.fn(),
    setSearch: vi.fn(),
    setSort: vi.fn(),
  })
  return { refetch, clearCompleted }
}

it('displays a query failure and resets mutation errors before retrying', async () => {
  const user = userEvent.setup()
  setup()
  const refetch = vi.fn().mockResolvedValue(undefined)
  const reset = vi.fn()
  vi.mocked(useTodosQuery).mockReturnValue({
    data: [],
    isPending: false,
    isFetching: false,
    isError: true,
    error: new Error('The server is unavailable.'),
    refetch,
  } as unknown as ReturnType<typeof useTodosQuery>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    error: null,
    reset,
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  vi.mocked(useTodosBusy).mockReturnValue(false)
  vi.mocked(useNotice).mockReturnValue({ message: '', notify: vi.fn() })
  vi.mocked(useTodoFilters).mockReturnValue({
    filter: 'all',
    search: '',
    sort: 'newest',
    visible: [],
    setFilter: vi.fn(),
    setSearch: vi.fn(),
    setSort: vi.fn(),
  })
  render(<TodosPage />)
  expect(screen.getByTestId('alert')).toHaveTextContent(
    'The server is unavailable.',
  )
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1))
  expect(reset).toHaveBeenCalledTimes(1)
  expect(reset.mock.invocationCallOrder[0]).toBeLessThan(
    refetch.mock.invocationCallOrder[0],
  )
})

it('announces a singular notice when one completed task is removed', async () => {
  const user = userEvent.setup()
  const notify = vi.fn()
  const { clearCompleted } = setup({ notify })
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Clear completed' }))
  await waitFor(() => expect(notify).toHaveBeenCalledTimes(1))
  expect(clearCompleted.mutateAsync).toHaveBeenCalledTimes(1)
  expect(notify).toHaveBeenCalledWith('One completed task removed.')
})

it('announces the plural count when several completed tasks are removed', async () => {
  const user = userEvent.setup()
  const notify = vi.fn()
  setup({
    notify,
    clear: { mutateAsync: vi.fn().mockResolvedValue({ deleted: 3 }) },
  })
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Clear completed' }))
  await waitFor(() =>
    expect(notify).toHaveBeenCalledWith('3 completed tasks removed.'),
  )
})

it('does not clear while another operation is busy', async () => {
  const user = userEvent.setup()
  const notify = vi.fn()
  const { clearCompleted } = setup({ busy: true, notify })
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Clear completed' }))
  expect(clearCompleted.mutateAsync).not.toHaveBeenCalled()
  expect(notify).not.toHaveBeenCalled()
})

it('shows the clear error in the alert without a notice, and resets it on retry', async () => {
  const user = userEvent.setup()
  const notify = vi.fn()
  const reset = vi.fn()
  const { refetch } = setup({
    notify,
    clear: {
      error: new Error('Could not clear.'),
      reset,
      mutateAsync: vi.fn().mockRejectedValue(new Error('Could not clear.')),
    },
  })
  render(<TodosPage />)
  expect(screen.getByTestId('alert')).toHaveTextContent('Could not clear.')
  await user.click(screen.getByRole('button', { name: 'Clear completed' }))
  expect(notify).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1))
  expect(reset).toHaveBeenCalledTimes(1)
})
