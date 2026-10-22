import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { request } from '../../../lib/http'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { useClearCompletedMutation } from './useClearCompletedMutation'

vi.mock('../../../lib/http', () => ({ request: vi.fn() }))
beforeEach(() => vi.clearAllMocks())

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
  return {
    queryClient,
    ...renderHook(() => useClearCompletedMutation(), { wrapper }),
  }
}

it('removes completed tasks from the cached list on success', async () => {
  const done = { ...todoFixture, id: 8, completed: true }
  vi.mocked(request).mockResolvedValue({ deleted: 1 })
  const { queryClient, result } = setup()
  queryClient.setQueryData(todoKeys.list, [todoFixture, done])
  const cancel = vi.spyOn(queryClient, 'cancelQueries')
  await expect(result.current.mutateAsync()).resolves.toEqual({ deleted: 1 })
  expect(request).toHaveBeenCalledWith('/todos/completed', {
    method: 'DELETE',
  })
  expect(cancel).toHaveBeenCalledWith({ queryKey: todoKeys.list })
  expect(queryClient.getQueryData(todoKeys.list)).toEqual([todoFixture])
})

it('leaves the cached list untouched when the request fails', async () => {
  const done = { ...todoFixture, id: 8, completed: true }
  vi.mocked(request).mockRejectedValue(new Error('Server down'))
  const { queryClient, result } = setup()
  queryClient.setQueryData(todoKeys.list, [todoFixture, done])
  await expect(result.current.mutateAsync()).rejects.toThrow('Server down')
  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(queryClient.getQueryData(todoKeys.list)).toEqual([todoFixture, done])
})
