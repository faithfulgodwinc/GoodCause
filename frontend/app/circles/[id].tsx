import React from "react";
import { View, ScrollView, StyleSheet, Pressable, Share as RNShare } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";

import { api } from "@/src/lib/api";
import { AppText, Avatar, LoadingView, EmptyState } from "@/src/components/ui";
import { CampaignCard } from "@/src/components/CampaignCard";
import { colors, spacing, radius, shadow } from "@/src/theme";
import { formatNaira } from "@/src/format";

export default function CircleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: c, isLoading } = useQuery({ queryKey: ["circle", id], queryFn: () => api<any>(`/circles/${id}`) });

  if (isLoading || !c) return <View style={{ flex: 1, backgroundColor: colors.surface }}><LoadingView /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ alignSelf: "center", width: "100%", maxWidth: 680, flex: 1 }}>
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={() => router.back()}><Feather name="arrow-left" size={24} color={colors.onSurface} /></Pressable>
          <AppText variant="title" numberOfLines={1} style={{ flex: 1, textAlign: "center", marginHorizontal: spacing.md }}>{c.name}</AppText>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <View style={styles.hero}>
          <View style={styles.icon}><Feather name="users" size={24} color={colors.onBrandPrimary} /></View>
          <AppText variant="h1" style={{ marginTop: spacing.md }}>{c.name}</AppText>
          {c.description ? <AppText variant="body" style={{ marginTop: 4 }}>{c.description}</AppText> : null}
          <View style={styles.statsRow}>
            <View style={styles.stat}><AppText variant="h2">{c.members_count}</AppText><AppText variant="caption">Members</AppText></View>
            <View style={styles.stat}><AppText variant="h2">{formatNaira(c.total_contributed_kobo || 0, { compact: true })}</AppText><AppText variant="caption">Given together</AppText></View>
            <View style={styles.stat}><AppText variant="h2">{c.campaigns?.length || 0}</AppText><AppText variant="caption">Causes</AppText></View>
          </View>
        </View>

        <View style={styles.inviteRow}>
          <View style={{ flex: 1 }}>
            <AppText variant="caption">Invite code</AppText>
            <AppText variant="h2" style={{ letterSpacing: 2 }}>{c.invite_code}</AppText>
          </View>
          <Pressable testID="copy-invite" onPress={() => Clipboard.setStringAsync(c.invite_code)} style={styles.inviteBtn}><Feather name="copy" size={18} color={colors.onSurface} /></Pressable>
          <Pressable testID="share-invite" onPress={() => RNShare.share({ message: `Join our GoodCause Circle "${c.name}" with code ${c.invite_code}` }).catch(() => {})} style={styles.inviteBtn}><Feather name="share-2" size={18} color={colors.onSurface} /></Pressable>
        </View>

        {c.members?.length ? (
          <View style={{ marginTop: spacing.xl }}>
            <AppText variant="h2" style={{ marginBottom: spacing.md }}>Members</AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
              {c.members.map((m: any) => (
                <View key={m.id} style={{ alignItems: "center", width: 64 }}>
                  <Avatar name={m.name} uri={m.picture} size={48} />
                  <AppText variant="caption" numberOfLines={1} style={{ marginTop: 4 }}>{m.name?.split(" ")[0]}</AppText>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ marginTop: spacing.xl }}>
          <AppText variant="h2" style={{ marginBottom: spacing.md }}>Causes supported</AppText>
          {c.campaigns?.length ? (
            <View style={{ gap: spacing.md }}>
              {c.campaigns.map((camp: any) => <CampaignCard key={camp.id} c={camp} onPress={() => router.push(`/campaign/${camp.id}`)} />)}
            </View>
          ) : (
            <EmptyState icon="heart" title="No activity yet" message="When members support causes, they'll show up here." />
          )}
        </View>
      </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  hero: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  icon: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.md },
  stat: { flex: 1 },
  inviteRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.md },
  inviteBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", marginLeft: spacing.sm },
});
