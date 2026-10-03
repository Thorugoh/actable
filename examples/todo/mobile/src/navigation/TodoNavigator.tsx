import { DarkTheme, DefaultTheme, NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme } from 'react-native';
import { useNavigationSync } from '@actable/react-native';
import { ActivityScreen } from '../screens/activity/ActivityScreen';
import { ListScreen } from '../screens/list/ListScreen';
import { ListsScreen } from '../screens/lists/ListsScreen';
import { TodoScreen } from '../screens/todo/TodoScreen';
import type { StackParams } from './stack-params';

const Stack = createNativeStackNavigator<StackParams>();

/** Renders the runtime's navigation stack. Never navigate with React Navigation directly: dispatch nav.*. */
export function TodoNavigator() {
  const ref = useNavigationContainerRef<StackParams>();
  const { initialState, onStateChange } = useNavigationSync(ref);
  const colorScheme = useColorScheme();

  return (
    <NavigationContainer
      ref={ref}
      initialState={initialState}
      onStateChange={onStateChange}
      theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
    >
      <Stack.Navigator screenOptions={{ fullScreenGestureEnabled: true }}>
        <Stack.Screen name="lists" component={ListsScreen} options={{ title: 'Lists' }} />
        <Stack.Screen name="list" component={ListScreen} />
        <Stack.Screen name="todo" component={TodoScreen} options={{ title: '' }} />
        <Stack.Screen name="activity" component={ActivityScreen} options={{ title: 'Activity' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
