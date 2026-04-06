import { Platform, StyleSheet, Text, View } from 'react-native';

export function ScreenContainer({ children, contentContainerStyle, style }) {
  return (
    <View style={[styles.screen, style]}>
      <View style={[styles.content, contentContainerStyle]}>{children}</View>
    </View>
  );
}

export function SurfaceCard({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function HeroHeader({ eyebrow, title, subtitle, trailing }) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroCopy}>
        {eyebrow ? <View style={styles.eyebrowWrap}><TextLabel style={styles.eyebrow}>{eyebrow}</TextLabel></View> : null}
        <TextLabel style={styles.title}>{title}</TextLabel>
        {subtitle ? <TextLabel style={styles.subtitle}>{subtitle}</TextLabel> : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

export function SectionTitle({ children, style }) {
  return <TextLabel style={[styles.sectionTitle, style]}>{children}</TextLabel>;
}

export function EmptyState({ icon, title, subtitle, action }) {
  return (
    <SurfaceCard style={styles.emptyState}>
      {icon ? <TextLabel style={styles.emptyIcon}>{icon}</TextLabel> : null}
      <TextLabel style={styles.emptyTitle}>{title}</TextLabel>
      {subtitle ? <TextLabel style={styles.emptySubtitle}>{subtitle}</TextLabel> : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </SurfaceCard>
  );
}

export function TextLabel({ children, style, ...props }) {
  return (
    <Text style={style} {...props}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F5F0',
  },
  content: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'web' ? 28 : 56,
    paddingBottom: 36,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#2D1A14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  hero: {
    marginBottom: 20,
    gap: 12,
  },
  heroCopy: {
    gap: 8,
  },
  eyebrowWrap: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3E7E0',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  eyebrow: {
    color: '#7A4333',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    color: '#500000',
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 34,
  },
  subtitle: {
    color: '#6F6A66',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 520,
  },
  trailing: {
    alignSelf: 'flex-start',
  },
  sectionTitle: {
    color: '#332B28',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyTitle: {
    color: '#332B28',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#7B7672',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    maxWidth: 420,
  },
  emptyAction: {
    marginTop: 16,
  },
});
