import { Pressable, ScrollView, Text } from 'react-native';
import { useViewModel } from '@actable/react-native';
import type { TodoViewModel } from '@todo/domain';
import { EmptyState } from '../../components/EmptyState';
import { sharedStyles } from '../../components/shared-styles';
import type { ScreenProps } from '../../navigation/stack-params';
import { useUserDispatch } from '../../runtime/use-user-dispatch';
import { useTheme } from '../../theme/theme';
import { DueDateCard } from './DueDateCard';
import { TitleCard } from './TitleCard';

export function TodoScreen({ route }: ScreenProps<'todo'>) {
  const { todoId } = route.params;
  const todo = useViewModel<TodoViewModel>({ name: 'todo', params: { todoId } });
  const dispatch = useUserDispatch();
  const theme = useTheme();

  if ('notFound' in todo) return <EmptyState message="This todo no longer exists." />;

  return (
    <ScrollView style={[sharedStyles.screen, { backgroundColor: theme.background }]} contentContainerStyle={{ paddingVertical: 16, gap: 12 }}>
      <TitleCard
        title={todo.title}
        done={todo.done}
        onToggle={() => dispatch('todo.toggle', { id: todo.id })}
        onRename={(title) => dispatch('todo.update', { id: todo.id, title })}
      />
      <DueDateCard due={todo.due} onChange={(due) => dispatch('todo.update', { id: todo.id, due })} />
      <Text style={{ color: theme.muted, marginHorizontal: 16 }}>In {todo.list.name}</Text>
      <Pressable onPress={() => dispatch('todo.delete', { id: todo.id })} style={{ alignSelf: 'center', padding: 16 }} testID="delete-todo">
        <Text style={{ color: theme.danger, fontSize: 16, fontWeight: '600' }}>Delete todo</Text>
      </Pressable>
    </ScrollView>
  );
}
