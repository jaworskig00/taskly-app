import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatDate, isOverdue, selectTodos, validateTodo } from './todos'
import type { Todo } from '../types'

const base: Todo = {
  id: 1,
  title: 'Sprint plan',
  description: '',
  priority: 'medium',
  completed: false,
  due_date: null,
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
}

describe('selectTodos', () => {
  it('combines status with a case-insensitive search in the description', () => {
    const matching = { ...base, description: 'Discuss the API' }
    const todos = [
      matching,
      { ...matching, id: 2, completed: true },
      { ...base, id: 3 },
    ]
    expect(selectTodos(todos, 'active', ' api ', 'newest')).toEqual([matching])
  })

  it('sorts by priority without changing the source array', () => {
    const high: Todo = { ...base, id: 2, priority: 'high' }
    const todos = [base, high]
    expect(selectTodos(todos, 'all', '', 'priority')).toEqual([high, base])
    expect(todos).toEqual([base, high])
  })
})

describe('selectTodos ordering and filters', () => {
  it('keeps only completed tasks for the completed filter', () => {
    const done = { ...base, id: 2, completed: true }
    expect(selectTodos([base, done], 'completed', '', 'newest')).toEqual([done])
  })

  it('sorts by due date with undated tasks last', () => {
    const early = { ...base, id: 2, due_date: '2026-01-01' }
    const late = { ...base, id: 3, due_date: '2026-06-01' }
    expect(selectTodos([base, late, early], 'all', '', 'due')).toEqual([
      early,
      late,
      base,
    ])
  })

  it('sorts newest first, breaking ties by higher id', () => {
    const newer = { ...base, id: 2, created_at: '2026-10-02T12:00:00Z' }
    const tie = { ...base, id: 3 }
    expect(selectTodos([base, newer, tie], 'all', '', 'newest')).toEqual([
      newer,
      tie,
      base,
    ])
  })
})

describe('validateTodo', () => {
  const valid = {
    title: 'Task',
    description: '',
    priority: 'low' as const,
    due_date: null as string | null,
    completed: false,
  }

  it('accepts valid input', () => {
    expect(validateTodo(valid)).toEqual({})
  })

  it('rejects a whitespace-only title', () => {
    expect(validateTodo({ ...valid, title: '   ' }).title).toBe(
      'Enter a task title.',
    )
  })

  it('accepts a 120 character title and rejects 121', () => {
    expect(
      validateTodo({ ...valid, title: 'x'.repeat(120) }).title,
    ).toBeUndefined()
    expect(validateTodo({ ...valid, title: 'x'.repeat(121) }).title).toBe(
      'The title must be at most 120 characters.',
    )
  })

  it('rejects a description over 2000 characters', () => {
    expect(
      validateTodo({ ...valid, description: 'x'.repeat(2000) }).description,
    ).toBeUndefined()
    expect(
      validateTodo({ ...valid, description: 'x'.repeat(2001) }).description,
    ).toBe('The description must be at most 2000 characters.')
  })

  it.each(['2026-02-30', '2026-2-3', 'tomorrow'])(
    'rejects the date %s',
    (due_date) => {
      expect(validateTodo({ ...valid, due_date }).due_date).toBe(
        'Enter a valid date.',
      )
    },
  )

  it('accepts a real date', () => {
    expect(validateTodo({ ...valid, due_date: '2026-02-28' })).toEqual({})
  })
})

describe('isOverdue', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('is overdue only for incomplete tasks due before today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 15, 12))
    expect(isOverdue({ ...base, due_date: '2026-10-14' })).toBe(true)
    expect(isOverdue({ ...base, due_date: '2026-10-15' })).toBe(false)
    expect(isOverdue({ ...base, due_date: null })).toBe(false)
    expect(
      isOverdue({ ...base, due_date: '2026-10-14', completed: true }),
    ).toBe(false)
  })
})

describe('formatDate', () => {
  it('formats an ISO date in en-GB short style', () => {
    expect(formatDate('2026-10-05')).toBe('5 Oct 2026')
  })
})
