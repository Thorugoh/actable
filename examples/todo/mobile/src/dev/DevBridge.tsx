import { StyleSheet, Text, View } from 'react-native';
import * as Device from 'expo-device';
import { captureScreen } from 'react-native-view-shot';
import { useDevBridge, useRuntime } from '@actable/react-native';

const deviceName = process.env.EXPO_PUBLIC_ACTABLE_DEVICE ?? `${Device.osName === 'Android' ? 'android' : 'ios'}-${Device.isDevice ? 'device' : 'sim'}`;
const takeScreenshot = () => captureScreen({ format: 'png', result: 'base64' });

/**
 * Development only: connects this app to the relay (`todo serve`) so the CLI and agents can drive it,
 * and shows a "● remote" badge while connected. Optional env: EXPO_PUBLIC_ACTABLE_RELAY_URL,
 * EXPO_PUBLIC_ACTABLE_RELAY_TOKEN, EXPO_PUBLIC_ACTABLE_DEVICE.
 */
export function DevBridge() {
  const status = useDevBridge(useRuntime(), {
    name: deviceName,
    url: process.env.EXPO_PUBLIC_ACTABLE_RELAY_URL,
    token: process.env.EXPO_PUBLIC_ACTABLE_RELAY_TOKEN,
    screenshot: takeScreenshot,
  });
  if (status !== 'open') return null;
  return (
    <View pointerEvents="none" style={styles.badge} testID="dev-bridge-badge">
      <Text style={styles.label}>● remote</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', left: 12, bottom: 40, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(139,63,217,0.9)' },
  label: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
