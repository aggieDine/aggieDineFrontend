import { Pressable, StyleSheet, Text, View } from 'react-native';

export function PrimaryButton({ label, onPress, style, textStyle }) {
  return (
    <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed, style]} onPress={onPress}>
      <Text style={[styles.primaryButtonText, textStyle]}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, style, textStyle }) {
  return (
    <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed, style]} onPress={onPress}>
      <Text style={[styles.secondaryButtonText, textStyle]}>{label}</Text>
    </Pressable>
  );
}

export function InfoBanner({ title, body, style }) {
  return (
    <View style={[styles.banner, style]}>
      <Text style={styles.bannerTitle}>{title}</Text>
      <Text style={styles.bannerBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  primaryButton: {
    backgroundColor: '#500000',
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#500000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#F3E7E0',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonPressed: {
    opacity: 0.92,
  },
  secondaryButtonText: {
    color: '#7A4333',
    fontSize: 14,
    fontWeight: '700',
  },
  banner: {
    backgroundColor: '#FFF8F3',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0DDD0',
    marginBottom: 18,
  },
  bannerTitle: {
    color: '#7A4333',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  bannerBody: {
    color: '#6F625C',
    fontSize: 14,
    lineHeight: 20,
  },
});
