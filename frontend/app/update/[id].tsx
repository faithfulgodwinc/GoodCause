import React, { useState } from "react";
import { View, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/lib/api";
import { AppText, Button } from "@/src/components/ui";
import { colors, spacing, radius, font } from "@/src/theme";

export default function NewUpdate() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!title.trim() || !body.trim()) { setError("Add a title and a message."); return; }
    setSaving(true); setError("");
    try {
      await api(`/campaigns/${id}/updates`, { method: "POST", body: { title: title.trim(), body: body.trim() } });
      qc.invalidateQueries({ queryKey: ["updates", id] });
      qc.invalidateQueries({ queryKey: ["campaign", id] });
      router.back();
    } catch (e: any) {
      setError(e?.message || "We couldn't post that update. Please try again.");
    } finally { setSaving(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()}><Feather name="x" size={24} color={colors.onSurface} /></Pressable>
        <AppText variant="title">Post an update</AppText>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
        <AppText variant="body" style={{ marginBottom: spacing.lg }}>Share progress with your supporters. Followers will be notified.</AppText>
        <TextInput value={title} onChangeText={setTitle} placeholder="Update title" placeholderTextColor={colors.muted} style={styles.input} testID="update-title" />
        <TextInput value={body} onChangeText={setBody} placeholder="What's new? e.g. Thank you — we reached ₦2M today." placeholderTextColor={colors.muted} multiline style={[styles.input, { height: 180, textAlignVertical: "top", paddingTop: spacing.md, marginTop: spacing.md }]} testID="update-body" />
        {error ? <AppText variant="caption" color={colors.error} style={{ marginTop: spacing.md }}>{error}</AppText> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Button title="Post update" loading={saving} onPress={submit} testID="update-submit" />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, height: 52, fontFamily: font.medium, fontSize: 15, color: colors.onSurface },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
});
