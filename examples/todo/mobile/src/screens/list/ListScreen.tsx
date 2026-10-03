import { useLayoutEffect } from 'react';
import { Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useViewModel } from '@actable/react-native';
import type { Filter, ListViewModel } from '@todo/domain';
import { EmptyState } from '../../components/EmptyState';
import { SegmentedControl } from '../../components/SegmentedControl';
import { TextEntry } from '../../components/TextEntry';
import { sharedStyles } from '../../components/shared-styles';
import type { ScreenProps } from '../../navigation/stack-params';
import { useUserDispatch } from '../../runtime/use-user-dispatch';
import { useTheme } from '../../theme/theme';
import { TodoRow } from './TodoRow';

const FILTERS: Filter[] = ['all', 'open', 'done'];

export function ListScreen({ navigation, route }: ScreenProps<'list'>) {
  const { listId } = route.params;
  const viewModel = useViewModel<ListViewModel>({ name: 'list', params: { listId } });
  const dispatch = useUserDispatch();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'notFound' in viewModel ? '' : viewModel.title });
  }, [navigation, viewModel]);

  if ('notFound' in viewModel) return <EmptyState message="This list no longer exists." />;

  return (
    <View style={[sharedStyles.screen, { backgroundColor: theme.background }]}>
      <TextEntry
        placeholder={`Add to ${viewModel.title}`}
        onSubmit={(title) => dispatch('todo.create', { listId, title })}
        testID="new-todo"
      />
      <SegmentedControl value={viewModel.filter} options={FILTERS} onChange={(filter) => dispatch('ui.setFilter', { filter })} />
      <FlashList
        data={viewModel.items}
        keyExtractor={(todo) => todo.id}
        ListEmptyComponent={<EmptyState message={viewModel.filter === 'done' ? 'Nothing done yet.' : 'All clear.'} />}
        renderItem={({ item }) => (
          <TodoRow
            todo={item}
            onOpen={() => dispatch('nav.push', { route: { name: 'todo', params: { todoId: item.id } } })}
            onToggle={() => dispatch('todo.toggle', { id: item.id })}
            onDelete={() => dispatch('todo.delete', { id: item.id })}
          />
        )}
      />
      <Text style={{ color: theme.muted, textAlign: 'center', padding: 12, paddingBottom: 12 + insets.bottom }}>
        {viewModel.counts.open} open · {viewModel.counts.done} done
      </Text>
    </View>
  );
}
