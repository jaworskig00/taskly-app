import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TodoEmptyState } from './TodoEmptyState'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))

describe('TodoEmptyState', () => {
  it('invites the user to add a first task and calls onCreate', () => {
    const onCreate = vi.fn()
    render(
      <TodoEmptyState hasTodos={false} disabled={false} onCreate={onCreate} />,
    )
    expect(
      screen.getByRole('heading', { name: 'Add your first task' }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add your first task' }))
    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  it('disables the create button when disabled', () => {
    render(<TodoEmptyState hasTodos={false} disabled onCreate={vi.fn()} />)
    expect(
      (
        screen.getByRole('button', {
          name: 'Add your first task',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true)
  })

  it('explains that filters match nothing and offers no create button', () => {
    render(<TodoEmptyState hasTodos disabled={false} onCreate={vi.fn()} />)
    expect(
      screen.getByRole('heading', { name: 'No matching tasks' }),
    ).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
