import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RuntimeProvider } from '@actable/react-native';
import { todoApp } from '@todo/domain';
import { ConfirmationSheet } from '../components/ConfirmationSheet';
import { DevBridge } from '../dev/DevBridge';
import { TodoNavigator } from '../navigation/TodoNavigator';
import { todoPorts } from '../runtime/todo-ports';

const loading = (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <ActivityIndicator />
  </View>
);

/** The todo app: the shared domain running on the phone, rendered by React Native. */
export function TodoApp() {
  return (
    <SafeAreaProvider>
      <RuntimeProvider app={todoApp} ports={todoPorts} fallback={loading}>
        <TodoNavigator />
        <ConfirmationSheet />
        {__DEV__ ? <DevBridge /> : null}
      </RuntimeProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
