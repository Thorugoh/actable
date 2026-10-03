import { useLayoutEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useViewModel } from '@actable/react-native';
import type { ListsViewModel } from '@todo/domain';
import { TextEntry } from '../../components/TextEntry';
import { sharedStyles } from '../../components/shared-styles';
import type { ScreenProps } from '../../navigation/stack-params';
import { useUserDispatch } from '../../runtime/use-user-dispatch';
import { useTheme } from '../../theme/theme';
import { ListRow } from './ListRow';

export function ListsScreen({ navigation }: ScreenProps<'lists'>) {
  const viewModel = useViewModel<ListsViewModel>({ name: 'lists' });
  const dispatch = useUserDispatch();
  const theme = useTheme();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => dispatch('nav.push', { route: { name: 'activity' } })} hitSlop={8} testID="open-activity">
          <Text style={{ color: theme.accent, fontSize: 16 }}>Activity</Text>
        </Pressable>
      ),
    });
  }, [navigation, dispatch, theme]);

  return (
    <View style={[sharedStyles.screen, { backgroundColor: theme.background }]}>
      <TextEntry placeholder="New list" onSubmit={(name) => dispatch('list.create', { name })} testID="new-list" />
      <FlashList
        data={viewModel.lists}
        keyExtractor={(list) => list.id}
        renderItem={({ item }) => (
          <ListRow list={item} onOpen={() => dispatch('nav.push', { route: { name: 'list', params: { listId: item.id } } })} />
        )}
      />
    </View>
  );
}
