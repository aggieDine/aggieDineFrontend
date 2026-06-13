import { useState, useEffect } from 'react';
import {
  Image, Modal, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SurfaceCard } from './ui/app-surface';

// ---------------------------------------------------------------------------
// Follow List Screen (Instagram-style pageSheet)
// ---------------------------------------------------------------------------

function FollowListScreen({ visible, onClose, userId, idToken, initialTab = 'followers' }) {
  const [activeTab, setActiveTab]   = useState(initialTab);
  const [followers, setFollowers]   = useState([]);
  const [following, setFollowing]   = useState([]);
  const [search, setSearch]         = useState('');
  const [loadedTabs, setLoadedTabs] = useState(new Set());

  const API_URL = 'https://nh19d71sp8.execute-api.us-east-2.amazonaws.com';

  useEffect(() => {
    if (visible) {
      setActiveTab(initialTab);
      setSearch('');
      setLoadedTabs(new Set());
      setFollowers([]);
      setFollowing([]);
    }
  }, [visible, initialTab]);

  useEffect(() => {
    if (!visible || !userId || !idToken) return;
    loadTab(activeTab);
  }, [activeTab, visible]);

  const loadTab = async (tab) => {
    if (loadedTabs.has(tab)) return;
    try {
      const res = await fetch(
        `${API_URL}/users/${userId}/${tab}`,
        { headers: { Authorization: `Bearer ${idToken}` } }
      );
      if (res.ok) {
        const data = await res.json();
        if (tab === 'followers') setFollowers(data.users || []);
        else setFollowing(data.users || []);
        setLoadedTabs(prev => new Set([...prev, tab]));
      }
    } catch (e) {
      console.error(`load ${tab} error:`, e);
    }
  };

  const list    = activeTab === 'followers' ? followers : following;
  const q       = search.toLowerCase();
  const filtered = q
    ? list.filter(u => u.display_name?.toLowerCase().includes(q))
    : list;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={llStyles.container}>
        {/* Header */}
        <View style={llStyles.header}>
          <Pressable onPress={onClose} style={llStyles.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color="#2B2320" />
          </Pressable>
          <Text style={llStyles.headerTitle}>
            {activeTab === 'followers' ? 'Followers' : 'Following'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Tabs */}
        <View style={llStyles.tabs}>
          {['followers', 'following'].map(tab => (
            <Pressable
              key={tab}
              style={[llStyles.tab, activeTab === tab && llStyles.tabActive]}
              onPress={() => { setSearch(''); setActiveTab(tab); }}
            >
              <Text style={[llStyles.tabText, activeTab === tab && llStyles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Search */}
        <View style={llStyles.searchRow}>
          <Ionicons name="search" size={16} color="#999" style={llStyles.searchIcon} />
          <TextInput
            style={llStyles.searchInput}
            placeholder="Search"
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>

        {/* List */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {filtered.length === 0 ? (
            <Text style={llStyles.empty}>
              {search ? 'No results' : `No ${activeTab} yet`}
            </Text>
          ) : (
            filtered.map(u => (
              <View key={u.user_id} style={llStyles.row}>
                <View style={llStyles.avatar}>
                  <Text style={llStyles.avatarText}>
                    {u.display_name?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={llStyles.rowInfo}>
                  <Text style={llStyles.rowName}>{u.display_name}</Text>
                  <Text style={llStyles.rowId} numberOfLines={1}>{u.user_id}</Text>
                </View>
              </View>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const llStyles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#FAF8F5' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0ECE6',
    backgroundColor: '#FFFFFF',
  },
  backBtn:     { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#2B2320' },

  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F0ECE6',
  },
  tab: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive:     { borderBottomColor: '#500000' },
  tabText:       { fontSize: 15, fontWeight: '600', color: '#999' },
  tabTextActive: { color: '#500000' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    margin: 12, backgroundColor: '#F0ECE6',
    borderRadius: 12, paddingHorizontal: 12,
  },
  searchIcon:  { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#333' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0ECE6',
    backgroundColor: '#FFFFFF',
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#F3E7E0',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  avatarText:  { fontSize: 18, fontWeight: '700', color: '#500000' },
  rowInfo:     { flex: 1 },
  rowName:     { fontSize: 15, fontWeight: '700', color: '#2B2320' },
  rowId:       { fontSize: 13, color: '#999', marginTop: 2 },

  empty: {
    textAlign: 'center', color: '#999',
    fontSize: 15, padding: 40,
  },
});

// ---------------------------------------------------------------------------
// UserProfileCard
// ---------------------------------------------------------------------------

export default function UserProfileCard({
  profile,
  isCurrentUser,
  isFollowing,
  onFollow,
  onUnfollow,
  idToken,
  style,
}) {
  const [showFollowList, setShowFollowList] = useState(false);
  const [initialTab, setInitialTab]         = useState('followers');

  const openFollowers = () => { setInitialTab('followers'); setShowFollowList(true); };
  const openFollowing = () => { setInitialTab('following'); setShowFollowList(true); };

  const initials = profile?.display_name
    ? profile.display_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  return (
    <>
      <SurfaceCard style={[styles.card, style]}>
        {/* Avatar + name */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            {profile?.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>

          <View style={styles.info}>
            <Text style={styles.name}>{profile?.display_name || '—'}</Text>
            {profile?.email ? (
              <Text style={styles.email}>{profile.email}</Text>
            ) : null}
          </View>

          {!isCurrentUser && (
            <Pressable
              style={[styles.followBtn, isFollowing && styles.followingBtn]}
              onPress={isFollowing ? onUnfollow : onFollow}
            >
              <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Stats */}
        <View style={styles.stats}>
          <Pressable style={styles.stat} onPress={openFollowers}>
            <Text style={styles.statNumber}>{profile?.follower_count ?? 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </Pressable>
          <View style={styles.statDivider} />
          <Pressable style={styles.stat} onPress={openFollowing}>
            <Text style={styles.statNumber}>{profile?.following_count ?? 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </Pressable>
        </View>
      </SurfaceCard>

      <FollowListScreen
        visible={showFollowList}
        onClose={() => setShowFollowList(false)}
        userId={profile?.user_id}
        idToken={idToken}
        initialTab={initialTab}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 20 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#500000',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg:  { width: '100%', height: '100%' },
  avatarText: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },

  info:  { flex: 1, gap: 4 },
  name:  { fontSize: 18, fontWeight: '800', color: '#2B2320' },
  email: { fontSize: 13, color: '#6F6A66' },

  followBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 999, backgroundColor: '#500000',
  },
  followingBtn:     { backgroundColor: '#F0ECE6', borderWidth: 1, borderColor: '#E0D9CF' },
  followBtnText:    { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  followingBtnText: { color: '#6F6A66' },

  stats: {
    flexDirection: 'row', borderTopWidth: 1,
    borderTopColor: '#F0ECE6', paddingTop: 14,
  },
  stat:        { flex: 1, alignItems: 'center', gap: 2 },
  statNumber:  { fontSize: 20, fontWeight: '800', color: '#2B2320' },
  statLabel:   { fontSize: 12, color: '#6F6A66', fontWeight: '600' },
  statDivider: { width: 1, backgroundColor: '#F0ECE6', marginVertical: 4 },
});