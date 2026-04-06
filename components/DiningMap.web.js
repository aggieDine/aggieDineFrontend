import { StyleSheet, Text, View } from 'react-native';

export default function DiningMap({ diningHalls, suggestion }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Campus Dining</Text>
      <Text style={styles.subtitle}>Map view is available on the mobile app.</Text>
      {diningHalls.map((hall) => {
        if (!hall.coordinates?.latitude) return null;
        const isSuggested = suggestion && hall.id === suggestion.id;
        return (
          <View key={hall.id} style={[styles.hallRow, isSuggested && styles.suggested]}>
            <Text style={styles.hallName}>{hall.name}</Text>
            <Text style={[styles.status, hall.status.isOpen ? styles.open : styles.closed]}>
              {hall.status.isOpen ? "Open" : "Closed"}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#500000', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 16 },
  hallRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  suggested: { borderLeftWidth: 4, borderLeftColor: '#500000' },
  hallName: { fontSize: 16, fontWeight: '600' },
  status: { fontSize: 13, fontWeight: '600' },
  open: { color: 'green' },
  closed: { color: 'red' },
});
