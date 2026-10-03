import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { describeOrigin } from '@actable/core';
import { confirmations } from '../runtime/todo-ports';
import { useTheme } from '../theme/theme';

/** Shows "Claude wants to: Delete …?" when an agent asks for something that needs approval. */
export function ConfirmationSheet() {
  const theme = useTheme();
  const request = confirmations.useCurrentRequest();
  const decline = () => confirmations.answer(false);

  return (
    <Modal visible={Boolean(request)} transparent animationType="slide" onRequestClose={decline}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.card }]} testID="confirm-sheet">
          <Text style={[styles.requester, { color: theme.agent }]}>{request ? describeOrigin(request.origin) : ''} wants to:</Text>
          <Text style={[styles.question, { color: theme.text }]}>{request?.question}</Text>
          <View style={styles.buttons}>
            <Pressable style={[styles.button, { backgroundColor: theme.subtle }]} onPress={decline} testID="confirm-decline">
              <Text style={[styles.buttonLabel, { color: theme.text }]}>Decline</Text>
            </Pressable>
            <Pressable style={[styles.button, { backgroundColor: theme.danger }]} onPress={() => confirmations.answer(true)} testID="confirm-approve">
              <Text style={[styles.buttonLabel, { color: '#fff' }]}>Approve</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { padding: 24, paddingBottom: 40, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 8 },
  requester: { fontSize: 14, fontWeight: '600' },
  question: { fontSize: 20, fontWeight: '600', marginBottom: 16 },
  buttons: { flexDirection: 'row', gap: 12 },
  button: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
});
