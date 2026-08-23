import React, { useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Linking } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { uploadMedia } from "@/src/lib/api";
import { AppText } from "@/src/components/ui";
import { colors, spacing, radius } from "@/src/theme";

export type Media = { url: string; kind: "image" | "video" };

export function MediaUploader({ media, onChange }: { media: Media[]; onChange: (m: Media[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = async () => {
    setError("");
    // Check, then request contextually. Respect canAskAgain and dead-ends.
    let perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (perm.canAskAgain) {
        perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      }
      if (!perm.granted) {
        setError("Photo access is off. Enable it in Settings to add your own media.");
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.8,
      videoMaxDuration: 60,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const isVideo = asset.type === "video";
    const name = asset.fileName || `upload.${isVideo ? "mp4" : "jpg"}`;
    const type = asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg");
    setBusy(true);
    try {
      const uploaded = await uploadMedia(asset.uri, name, type);
      onChange([...media, { url: uploaded.url, kind: uploaded.kind as "image" | "video" }]);
    } catch (e: any) {
      setError(e?.message || "Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = (url: string) => onChange(media.filter((m) => m.url !== url));

  return (
    <View>
      <View style={styles.grid}>
        {media.map((m) => (
          <View key={m.url} style={styles.item}>
            {m.kind === "video" ? (
              <Pressable style={styles.video} onPress={() => Linking.openURL(m.url)}>
                <Feather name="play-circle" size={28} color="#fff" />
                <AppText variant="caption" color="#fff" style={{ marginTop: 4 }}>Video</AppText>
              </Pressable>
            ) : (
              <Image source={{ uri: m.url }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={150} />
            )}
            <Pressable testID={`remove-media`} onPress={() => remove(m.url)} style={styles.remove}>
              <Feather name="x" size={14} color="#fff" />
            </Pressable>
          </View>
        ))}
        <Pressable testID="upload-media-btn" onPress={pick} disabled={busy} style={styles.add}>
          {busy ? <ActivityIndicator color={colors.brandPrimary} /> : (
            <>
              <Feather name="upload" size={22} color={colors.brandPrimary} />
              <AppText variant="caption" color={colors.brandPrimary} style={{ marginTop: 4 }}>Upload</AppText>
            </>
          )}
        </Pressable>
      </View>
      {error ? <AppText variant="caption" color={colors.error} style={{ marginTop: spacing.sm }}>{error}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  item: { width: "31%", aspectRatio: 1, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surfaceTertiary },
  video: { flex: 1, backgroundColor: colors.surfaceInverse, alignItems: "center", justifyContent: "center" },
  remove: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(35,33,31,0.7)", alignItems: "center", justifyContent: "center" },
  add: { width: "31%", aspectRatio: 1, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.brandTertiary, borderStyle: "dashed", alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
});
