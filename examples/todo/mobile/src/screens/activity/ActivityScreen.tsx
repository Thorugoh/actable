import { View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useViewModel } from '@actable/react-native';
import type { ActivityViewModel } from '@todo/domain';
import { EmptyState } from '../../components/EmptyState';
import { sharedStyles } from '../../components/shared-styles';
import { useUserDispatch } from '../../runtime/use-user-dispatch';
import { useTheme } from '../../theme/theme';
import { ActivityRow } from './ActivityRow';

export function ActivityScreen() {
  const { entries } = useViewModel<ActivityViewModel>({ name: 'activity' });
  const dispatch = useUserDispatch();
  const theme = useTheme();

  return (
    <View style={[sharedStyles.screen, { backgroundColor: theme.background }]}>
      <FlashList
        data={entries}
        keyExtractor={(entry) => entry.id}
        contentContainerStyle={{ paddingVertical: 12 }}
        ListEmptyComponent={<EmptyState message="No changes yet." />}
        renderItem={({ item }) => <ActivityRow entry={item} onUndo={() => dispatch('journal.undo', { entryId: item.id })} />}
      />
    </View>
  );
}
