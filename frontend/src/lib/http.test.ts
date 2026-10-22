import { afterEach, describe, expect, it, vi } from 'vitest'
import { request } from './http'

function stubFetch(impl: () => Promise<unknown>) {
  const fetchMock = vi.fn(impl)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function jsonResponse(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('request', () => {
  it('prefixes the path with /api and merges headers', async () => {
    const fetchMock = stubFetch(async () => jsonResponse(200, { ok: true }))
    await expect(
      request('/todos', { headers: { 'X-Test': '1' } }),
    ).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith('/api/todos', {
      headers: { 'Content-Type': 'application/json', 'X-Test': '1' },
    })
  })

  it('resolves undefined for a 204 response', async () => {
    stubFetch(async () => new Response(null, { status: 204 }))
    await expect(request('/todos/1')).resolves.toBeUndefined()
  })

  it('reports a connection failure with a friendly message', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(request('/todos')).rejects.toThrow(
      'Cannot connect to the server. Please try again.',
    )
  })

  it('rethrows the original error when the request was aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const abortError = new DOMException('Aborted', 'AbortError')
    stubFetch(async () => {
      throw abortError
    })
    await expect(request('/todos', { signal: controller.signal })).rejects.toBe(
      abortError,
    )
  })

  it('maps a 422 to the validation guidance, ignoring the body', async () => {
    stubFetch(async () => jsonResponse(422, { detail: [{ msg: 'bad' }] }))
    await expect(request('/todos')).rejects.toThrow(/Check the task details/)
  })

  it('surfaces a string detail from an error body', async () => {
    stubFetch(async () => jsonResponse(404, { detail: 'Task not found.' }))
    await expect(request('/todos/9')).rejects.toThrow('Task not found.')
  })

  it('falls back to a generic message when the error body has no string detail', async () => {
    stubFetch(async () => new Response('not json', { status: 500 }))
    await expect(request('/todos')).rejects.toThrow(
      'The operation failed. Please try again.',
    )
  })
})
