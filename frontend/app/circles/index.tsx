import React, { useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, Modal, TextInput } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/lib/api";
import { AppText, Button, EmptyState, LoadingView } from "@/src/components/ui";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

export default function Circles() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["circles"], queryFn: () => api<{ mine: any[]; discover: any[] }>("/circles") });

  const createMut = useMutation({
    mutationFn: () => api("/circles", { method: "POST", body: { name, description: desc } }),
    onSuccess: () => { setCreateOpen(false); setName(""); setDesc(""); qc.invalidateQueries({ queryKey: ["circles"] }); },
  });
  const joinMut = useMutation({
    mutationFn: () => api("/circles/join", { method: "POST", body: { invite_code: code } }),
    onSuccess: () => { setJoinOpen(false); setCode(""); setErr(""); qc.invalidateQueries({ queryKey: ["circles"] }); },
    onError: (e: any) => setErr(e?.message || "No circle found with that code."),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()}><Feather name="arrow-left" size={24} color={colors.onSurface} /></Pressable>
        <AppText variant="title">Circles</AppText>
        <Pressable testID="join-circle-btn" onPress={() => { setErr(""); setJoinOpen(true); }}><Feather name="log-in" size={22} color={colors.brandPrimary} /></Pressable>
      </View>

      {isLoading ? <LoadingView /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
          <View style={styles.introCard}>
            <AppText variant="h2" color="#fff">Give together</AppText>
            <AppText variant="body" color="rgba(255,255,255,0.85)" style={{ marginTop: 4 }}>
              Circles are groups — alumni, church, family, friends — supporting causes together.
            </AppText>
            <Button title="Create a Circle" icon="plus" variant="secondary" small onPress={() => setCreateOpen(true)} style={{ marginTop: spacing.md, alignSelf: "flex-start", paddingHorizontal: spacing.xl }} testID="create-circle-btn" />
          </View>

          {data?.mine && data.mine.length > 0 ? (
            <>
              <AppText variant="h2" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Your Circles</AppText>
              {data.mine.map((c) => <CircleRow key={c.id} c={c} onPress={() => router.push(`/circles/${c.id}`)} />)}
            </>
          ) : (
            <EmptyState icon="users" title="No Circles yet" message="Create one and invite people to rally around causes together." />
          )}

          {data?.discover && data.discover.length > 0 ? (
            <>
              <AppText variant="h2" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Discover</AppText>
              {data.discover.map((c) => <CircleRow key={c.id} c={c} onPress={() => router.push(`/circles/${c.id}`)} />)}
            </>
          ) : null}
        </ScrollView>
      )}

      <SheetModal visible={createOpen} onClose={() => setCreateOpen(false)} title="Create a Circle">
        <TextInput value={name} onChangeText={setName} placeholder="Circle name (e.g. FUTO Alumni)" placeholderTextColor={colors.muted} style={styles.input} testID="circle-name-input" />
        <TextInput value={desc} onChangeText={setDesc} placeholder="Description (optional)" placeholderTextColor={colors.muted} style={[styles.input, { marginTop: spacing.sm }]} />
        <Button title="Create Circle" loading={createMut.isPending} disabled={name.trim().length < 2} onPress={() => createMut.mutate()} style={{ marginTop: spacing.lg }} testID="circle-create-submit" />
      </SheetModal>

      <SheetModal visible={joinOpen} onClose={() => setJoinOpen(false)} title="Join a Circle">
        <TextInput value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="Enter invite code" autoCapitalize="characters" placeholderTextColor={colors.muted} style={styles.input} testID="circle-code-input" />
        {err ? <AppText variant="caption" color={colors.error} style={{ marginTop: spacing.sm }}>{err}</AppText> : null}
        <Button title="Join" loading={joinMut.isPending} disabled={!code} onPress={() => joinMut.mutate()} style={{ marginTop: spacing.lg }} testID="circle-join-submit" />
      </SheetModal>
    </View>
  );
}

function CircleRow({ c, onPress }: { c: any; onPress: () => void }) {
  return (
    <Pressable testID={`circle-${c.id}`} onPress={onPress} style={styles.circleRow}>
      <View style={styles.circleIcon}><Feather name="users" size={20} color={colors.brandPrimary} /></View>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <AppText variant="label" numberOfLines={1}>{c.name}</AppText>
        <AppText variant="caption" style={{ marginTop: 2 }}>{c.members_count} {c.members_count === 1 ? "member" : "members"}{c.is_member ? " · Joined" : ""}</AppText>
      </View>
      <Feather name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
  );
}

export function SheetModal({ visible, onClose, title, children }: any) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.grabber} />
        <AppText variant="h2" style={{ marginBottom: spacing.md }}>{title}</AppText>
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  introCard: { backgroundColor: colors.surfaceInverse, borderRadius: radius.lg, padding: spacing.lg, ...shadow.card },
  circleRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  circleIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  backdrop: { flex: 1, backgroundColor: "rgba(35,33,31,0.5)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, height: 52, fontFamily: font.medium, fontSize: 15, color: colors.onSurface },
});
