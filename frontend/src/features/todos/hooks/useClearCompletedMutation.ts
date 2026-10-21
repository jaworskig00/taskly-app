import { useMutation, useQueryClient } from '@tanstack/react-query'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import type { Todo } from '../types'

export function useClearCompletedMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: todoKeys.clearCompleted,
    mutationFn: () => todosApi.clearCompleted(),
    onSuccess: async () => {
      // Drop the completed tasks locally so the list does not flash the old rows.
      await queryClient.cancelQueries({ queryKey: todoKeys.list })
      queryClient.setQueryData<Todo[]>(todoKeys.list, (current = []) =>
        current.filter((todo) => !todo.completed),
      )
    },
  })
}
