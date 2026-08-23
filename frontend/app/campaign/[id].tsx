import React, { useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, Modal, Share as RNShare, Linking, FlatList, TextInput } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";

import { api, track } from "@/src/lib/api";
import { useAuth } from "@/src/context/auth";
import { AppText, Button, ProgressBar, VerifiedBadge, CommunityBackedBadge, Avatar, LoadingView, ErrorView } from "@/src/components/ui";
import { TrustCard } from "@/src/components/TrustCard";
import { MediaUploader, Media } from "@/src/components/MediaUploader";
import { useResponsive } from "@/src/lib/responsive";
import { colors, spacing, radius, shadow, CATEGORY_COLORS, font } from "@/src/theme";
import { formatNaira, daysLeft, timeAgo } from "@/src/format";

const REASONS = ["Suspected fraud", "Misleading information", "Impersonation", "Inappropriate content", "Illegal activity", "Harassment"];

export default function CampaignDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { maxContentWidth } = useResponsive();
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [reportDone, setReportDone] = useState(false);
  const [thankFor, setThankFor] = useState<any>(null);
  const [thankMsg, setThankMsg] = useState("");
  const [thankMedia, setThankMedia] = useState<Media[]>([]);
  const [thankDone, setThankDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const campaign = useQuery({ queryKey: ["campaign", id], queryFn: () => api<any>(`/campaigns/${id}`) });
  const updates = useQuery({ queryKey: ["updates", id], queryFn: () => api<any[]>(`/campaigns/${id}/updates`), enabled: !!id });
  const supporters = useQuery({ queryKey: ["supporters", id], queryFn: () => api<any[]>(`/campaigns/${id}/donations`), enabled: !!id });

  const c = campaign.data;
  const shareUrl = `https://goodcause.ng/c/${id}`;
  const heroVideo = campaign.data?.hero_video || null;
  const player = useVideoPlayer(null, (p) => { p.loop = true; p.muted = true; });
  React.useEffect(() => {
    if (!heroVideo) return;
    try { player.replace(heroVideo); player.loop = true; player.muted = true; player.play(); } catch {}
  }, [heroVideo]);

  const followMut = useMutation({
    mutationFn: () => api(`/campaigns/${id}/follow`, { method: c?.is_following ? "DELETE" : "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaign", id] }),
  });
  const saveMut = useMutation({
    mutationFn: () => api(`/campaigns/${id}/save`, { method: c?.is_saved ? "DELETE" : "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaign", id] }),
  });
  const reportMut = useMutation({
    mutationFn: () => api(`/campaigns/${id}/report`, { method: "POST", body: { reason: reportReason } }),
    onSuccess: () => setReportDone(true),
  });
  const thankMut = useMutation({
    mutationFn: () => api(`/campaigns/${id}/thank`, {
      method: "POST",
      body: { donation_id: thankFor?.id, message: thankMsg.trim(), image: thankMedia[0]?.url || null },
    }),
    onSuccess: () => { setThankDone(true); qc.invalidateQueries({ queryKey: ["supporters", id] }); },
  });

  if (campaign.isLoading) return <View style={styles.full}><LoadingView /></View>;
  if (campaign.isError || !c) return <View style={styles.full}><ErrorView message="Campaign not found." onRetry={campaign.refetch} /></View>;

  const dl = daysLeft(c.deadline);
  const ageDays = c.published_at ? Math.max(0, Math.floor((Date.now() - new Date(c.published_at).getTime()) / 86400000)) : null;
  const catColor = CATEGORY_COLORS[(c.category_name || "").toLowerCase()] || colors.brandPrimary;
  const isOrganizer = c.is_organizer;
  const canDonate = c.status === "LIVE" || c.status === "COMPLETED";

  const nativeShare = async () => {
    track("campaign_shared", { campaign_id: id });
    try { await RNShare.share({ message: `I'm supporting “${c.title}” on GoodCause. Join me: ${shareUrl}` }); } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Hero */}
        <View style={styles.hero}>
          {c.hero_video ? (
            <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} allowsFullscreen={false} />
          ) : (
            <Image source={{ uri: c.cover_image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
          )}
          <LinearGradient colors={["rgba(17,24,39,0.35)", "transparent", "rgba(17,24,39,0.15)"]} style={StyleSheet.absoluteFill} />
          <View style={[styles.heroTop, { paddingTop: insets.top + spacing.sm }]}>
            <IconBtn icon="arrow-left" onPress={() => router.back()} testID="detail-back" />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <IconBtn icon={c.is_saved ? "bookmark" : "bookmark"} filled={c.is_saved} onPress={() => user ? saveMut.mutate() : router.push("/auth")} testID="detail-save" />
              <IconBtn icon="share-2" onPress={() => setShareOpen(true)} testID="detail-share" />
            </View>
          </View>
        </View>

        <View style={[styles.body, { maxWidth: maxContentWidth, alignSelf: "center", width: "100%" }]}>
          <View style={[styles.catPill, { backgroundColor: catColor }]}>
            <AppText variant="caption" color="#fff">{c.category_name}</AppText>
          </View>
          <AppText variant="h1" style={{ marginTop: spacing.md }}>{c.title}</AppText>

          {/* Organizer */}
          <View style={styles.orgRow}>
            <Avatar name={c.organizer?.name} uri={c.organizer?.picture} size={36} />
            <AppText variant="body" style={{ flex: 1, marginLeft: spacing.sm }}>
              by <AppText variant="label">{c.organizer?.name}</AppText>
            </AppText>
            <View style={{ flexDirection: "row", gap: spacing.xs, alignItems: "center" }}>
              {c.community_backed ? <CommunityBackedBadge /> : null}
              <VerifiedBadge status={c.verification_status} />
            </View>
          </View>

          {/* Progress */}
          <View style={styles.progressBox}>
            <View style={styles.rowBetween}>
              <AppText variant="h2" color={colors.brandPrimary}>{formatNaira(c.raised_kobo)}</AppText>
              <AppText variant="label" color={colors.onSurfaceTertiary}>{c.percent}%</AppText>
            </View>
            <AppText variant="caption" style={{ marginTop: 2 }}>raised of {formatNaira(c.goal_kobo)} goal</AppText>
            <View style={{ marginTop: spacing.md }}>
              <ProgressBar percent={c.percent} height={10} />
            </View>
            <View style={[styles.rowBetween, { marginTop: spacing.md }]}>
              <Meta icon="users" text={`${c.supporters_count} supporters`} />
              {dl != null ? <Meta icon="clock" text={`${dl} days left`} /> : <Meta icon="check-circle" text="Ongoing" />}
              {c.location?.city ? <Meta icon="map-pin" text={c.location.city} /> : null}
            </View>
          </View>

          {/* GoFundMe Early Momentum Checklist for Organizer */}
          {isOrganizer ? (
            <View style={styles.momentumCard}>
              <View style={styles.rowBetween}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Feather name={c.community_backed ? "check-circle" : "trending-up"} size={17} color={colors.brandPrimary} />
                  <AppText variant="title" style={{ marginLeft: spacing.sm }}>
                    {c.community_backed ? "Community Backed 🎉" : "Build Early Momentum"}
                  </AppText>
                </View>
                <AppText variant="label" color={colors.brandPrimary}>
                  {Math.min(c.supporters_count, 3)} / 3 supporters
                </AppText>
              </View>
              <View style={{ marginTop: spacing.sm }}>
                <ProgressBar
                  percent={(Math.min(c.supporters_count, 3) / 3) * 100}
                  color={colors.brandPrimary}
                  height={6}
                />
              </View>
              <AppText variant="caption" color={colors.onSurfaceSecondary} style={{ marginTop: spacing.sm, lineHeight: 18 }}>
                {c.community_backed
                  ? "Your campaign is validated by your community and unlocked for discovery on Explore and Top Causes."
                  : "Fundraisers backed by 3+ close friends or family are 3x more likely to reach their goal. Share directly on WhatsApp to get started!"}
              </AppText>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                <Button
                  title="Share on WhatsApp"
                  icon="share-2"
                  small
                  onPress={() => {
                    const msg = encodeURIComponent(`Hi! I just started a campaign for “${c.title}” on GoodCause. Every little bit helps: ${shareUrl}`);
                    Linking.openURL(`whatsapp://send?text=${msg}`).catch(() => nativeShare());
                  }}
                  style={{ flex: 1.2, backgroundColor: colors.brandPrimary }}
                />
                <Button
                  title={copied ? "Copied!" : "Copy link"}
                  variant="outline"
                  small
                  onPress={async () => {
                    await Clipboard.setStringAsync(shareUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  style={{ flex: 0.8 }}
                />
              </View>
            </View>
          ) : null}

          {/* Beneficiary */}
          {c.beneficiary ? (
            <Block title="Who this helps">
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <AppText variant="label">{c.beneficiary.name}</AppText>
                  <AppText variant="caption" style={{ marginTop: 2, textTransform: "capitalize" }}>
                    {c.beneficiary.relationship} · {c.beneficiary.type}
                  </AppText>
                </View>
                <Feather name="user" size={18} color={colors.onSurfaceTertiary} />
              </View>
            </Block>
          ) : null}

          {/* Story */}
          <Block title="The story">
            <AppText variant="body" style={{ lineHeight: 22 }}>{c.story}</AppText>
          </Block>

          {/* Gallery */}
          {Array.isArray(c.gallery) && c.gallery.filter((u: string) => u !== c.cover_image).length > 0 ? (
            <View style={{ marginTop: spacing.xl }}>
              <AppText variant="h2" style={{ marginBottom: spacing.md }}>Photos & video</AppText>
              <FlatList
                horizontal
                data={c.gallery.filter((u: string) => u !== c.cover_image)}
                keyExtractor={(u: string, i: number) => `${u}-${i}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.sm }}
                renderItem={({ item }) => {
                  const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(item);
                  return isVideo ? (
                    <Pressable onPress={() => Linking.openURL(item)} style={styles.galVideo}>
                      <Feather name="play-circle" size={30} color="#fff" />
                    </Pressable>
                  ) : (
                    <Image source={{ uri: item }} style={styles.galImg} contentFit="cover" transition={150} />
                  );
                }}
              />
            </View>
          ) : null}

          {/* Budget */}
          {c.budget && c.budget.length > 0 ? (
            <Block title="How funds will be used">
              {c.budget.map((b: any, i: number) => (
                <View key={i} style={[styles.budgetRow, i < c.budget.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
                  <AppText variant="body" style={{ flex: 1 }}>{b.item}</AppText>
                  <AppText variant="label">{formatNaira(b.amount_kobo)}</AppText>
                </View>
              ))}
            </Block>
          ) : null}

          {/* Trust */}
          <View style={{ marginTop: spacing.xl }}>
            <AppText variant="h2" style={{ marginBottom: spacing.md }}>Why you can trust this</AppText>
            <TrustCard
              status={c.verification?.status}
              checks={c.verification?.checks}
              campaignAgeDays={ageDays}
              updatesCount={c.updates_count}
              relationship={c.beneficiary?.relationship}
              onReport={() => { setReportDone(false); setReportReason(null); setReportOpen(true); }}
            />
          </View>

          {/* Updates */}
          <View style={{ marginTop: spacing.xl }}>
            <View style={styles.rowBetween}>
              <AppText variant="h2">Updates {updates.data?.length ? `(${updates.data.length})` : ""}</AppText>
              {isOrganizer ? (
                <Pressable testID="detail-add-update" onPress={() => router.push(`/update/${id}`)}>
                  <AppText variant="label" color={colors.brandPrimary}>Post update</AppText>
                </Pressable>
              ) : null}
            </View>
            {updates.data && updates.data.length > 0 ? (
              <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                {updates.data.map((u) => (
                  <View key={u.id} style={styles.update}>
                    <View style={styles.rowBetween}>
                      <AppText variant="label">{u.title}</AppText>
                      <AppText variant="caption">{timeAgo(u.created_at)}</AppText>
                    </View>
                    <AppText variant="body" style={{ marginTop: 4 }}>{u.body}</AppText>
                  </View>
                ))}
              </View>
            ) : (
              <AppText variant="body" style={{ marginTop: spacing.sm }}>No updates yet — the organizer will share progress here.</AppText>
            )}
          </View>

          {/* Supporters */}
          {supporters.data && supporters.data.length > 0 ? (
            <View style={{ marginTop: spacing.xl }}>
              <AppText variant="h2" style={{ marginBottom: spacing.md }}>Recent supporters</AppText>
              <View style={{ gap: spacing.sm }}>
                {supporters.data.slice(0, 8).map((s) => (
                  <View key={s.id} style={styles.supporter}>
                    <Avatar name={s.anonymous ? "A" : s.name} size={32} />
                    <View style={{ flex: 1, marginLeft: spacing.sm }}>
                      <AppText variant="label">{s.name}</AppText>
                      {s.message ? <AppText variant="caption" numberOfLines={1}>{s.message}</AppText> : null}
                    </View>
                    {isOrganizer && s.can_thank ? (
                      s.thanked ? (
                        <View style={styles.thankedPill}><Feather name="check" size={12} color={colors.success} /><AppText variant="caption" color={colors.success} style={{ marginLeft: 4 }}>Thanked</AppText></View>
                      ) : (
                        <Pressable testID={`thank-${s.id}`} onPress={() => { setThankFor(s); setThankMsg(""); setThankMedia([]); setThankDone(false); }} style={styles.thankBtn}>
                          <Feather name="mail" size={13} color={colors.brandPrimary} />
                          <AppText variant="caption" color={colors.brandPrimary} style={{ marginLeft: 4 }}>Thank</AppText>
                        </Pressable>
                      )
                    ) : (
                      <AppText variant="label" color={colors.success}>{formatNaira(s.amount_kobo, { compact: true })}</AppText>
                    )}
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Pressable onPress={() => user ? followMut.mutate() : router.push("/auth")} style={styles.followBtn} testID="detail-follow">
          <Feather name="heart" size={20} color={c.is_following ? colors.error : colors.onSurface} />
        </Pressable>
        {isOrganizer ? (
          <View style={{ flex: 1, flexDirection: "row", gap: spacing.sm }}>
            <Button
              title="Withdraw"
              icon="credit-card"
              onPress={() => router.push({ pathname: "/payouts/[id]", params: { id } } as any)}
              style={{ flex: 1, backgroundColor: colors.brandPrimary }}
              testID="detail-organizer-withdraw"
            />
            <Button
              title="Share"
              icon="share-2"
              variant="outline"
              onPress={() => setShareOpen(true)}
              style={{ flex: 1 }}
              testID="detail-organizer-share"
            />
          </View>
        ) : (
          <Button
            title={canDonate ? "Support this cause" : "Not accepting donations"}
            icon="heart"
            disabled={!canDonate}
            onPress={() => user ? router.push(`/donate/${id}`) : router.push("/auth")}
            style={{ flex: 1 }}
            testID="detail-support-button"
          />
        )}
      </View>

      {/* Share modal */}
      <Modal visible={shareOpen} transparent animationType="slide" onRequestClose={() => setShareOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShareOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText variant="h2" style={{ marginBottom: spacing.xs }}>Share this cause</AppText>
          <AppText variant="caption">{`"I supported a GoodCause today."`}</AppText>

          <View style={styles.shareCard}>
            <Image source={{ uri: c.cover_image }} style={styles.shareCover} contentFit="cover" />
            <View style={{ padding: spacing.md }}>
              <AppText variant="label" numberOfLines={1}>{c.title}</AppText>
              <View style={{ marginTop: spacing.sm }}>
                <ProgressBar percent={c.percent} />
                <AppText variant="caption" style={{ marginTop: 4 }}>{formatNaira(c.raised_kobo, { compact: true })} of {formatNaira(c.goal_kobo, { compact: true })} · {c.percent}%</AppText>
              </View>
            </View>
          </View>

          <View style={styles.shareRow}>
            <ShareBtn icon="message-circle" label="Share" onPress={() => { setShareOpen(false); nativeShare(); }} />
            <ShareBtn icon="copy" label="Copy link" onPress={async () => { await Clipboard.setStringAsync(shareUrl); track("campaign_shared", { via: "copy" }); }} />
            <ShareBtn icon="grid" label="QR code" onPress={() => {}} qr={<QRCode value={shareUrl} size={44} backgroundColor="transparent" color={colors.onSurface} />} />
          </View>
        </View>
      </Modal>

      {/* Report modal */}
      <Modal visible={reportOpen} transparent animationType="slide" onRequestClose={() => setReportOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setReportOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.grabber} />
          {reportDone ? (
            <View style={{ alignItems: "center", paddingVertical: spacing.lg }}>
              <Feather name="check-circle" size={36} color={colors.success} />
              <AppText variant="h2" style={{ marginTop: spacing.md }}>Thank you</AppText>
              <AppText variant="body" style={{ textAlign: "center", marginTop: spacing.xs }}>Our team will review this campaign.</AppText>
              <Button title="Done" onPress={() => setReportOpen(false)} style={{ marginTop: spacing.lg, alignSelf: "stretch" }} />
            </View>
          ) : (
            <>
              <AppText variant="h2">Report campaign</AppText>
              <AppText variant="caption" style={{ marginBottom: spacing.md }}>Help us keep GoodCause trustworthy.</AppText>
              <View style={{ gap: spacing.sm }}>
                {REASONS.map((r) => (
                  <Pressable key={r} testID={`report-reason-${r}`} onPress={() => setReportReason(r)} style={[styles.reason, reportReason === r && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}>
                    <AppText variant="bodyMedium">{r}</AppText>
                    {reportReason === r ? <Feather name="check" size={18} color={colors.brandPrimary} /> : null}
                  </Pressable>
                ))}
              </View>
              <Button title="Submit report" disabled={!reportReason} loading={reportMut.isPending} onPress={() => reportMut.mutate()} style={{ marginTop: spacing.lg }} testID="report-submit" />
            </>
          )}
        </View>
      </Modal>

      {/* Thank-you modal */}
      <Modal visible={!!thankFor} transparent animationType="slide" onRequestClose={() => setThankFor(null)}>
        <Pressable style={styles.backdrop} onPress={() => setThankFor(null)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.grabber} />
          {thankDone ? (
            <View style={{ alignItems: "center", paddingVertical: spacing.lg }}>
              <Feather name="mail" size={36} color={colors.brandPrimary} />
              <AppText variant="h2" style={{ marginTop: spacing.md }}>Thank-you sent</AppText>
              <AppText variant="body" style={{ textAlign: "center", marginTop: spacing.xs }}>{thankFor?.name} will see your message.</AppText>
              <Button title="Done" onPress={() => setThankFor(null)} style={{ marginTop: spacing.lg, alignSelf: "stretch" }} />
            </View>
          ) : (
            <>
              <AppText variant="h2">Thank {thankFor?.name}</AppText>
              <AppText variant="caption" style={{ marginBottom: spacing.md }}>Send a personal note (and a photo) to this supporter.</AppText>
              <TextInput
                testID="thank-message"
                value={thankMsg}
                onChangeText={setThankMsg}
                placeholder="e.g. Thank you so much — your gift means the world to us."
                placeholderTextColor={colors.muted}
                multiline
                style={styles.thankInput}
              />
              <AppText variant="label" style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>Add a photo (optional)</AppText>
              <MediaUploader media={thankMedia} onChange={(m) => setThankMedia(m.slice(-1))} />
              <Button title="Send thank-you" icon="send" disabled={thankMsg.trim().length < 1} loading={thankMut.isPending} onPress={() => thankMut.mutate()} style={{ marginTop: spacing.lg }} testID="thank-submit" />
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

function IconBtn({ icon, onPress, filled, testID }: { icon: any; onPress: () => void; filled?: boolean; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.iconBtn}>
      <Feather name={icon} size={20} color={filled ? colors.brandPrimary : colors.onSurface} />
    </Pressable>
  );
}
function Meta({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Feather name={icon} size={13} color={colors.onSurfaceTertiary} />
      <AppText variant="caption" style={{ marginLeft: 4 }}>{text}</AppText>
    </View>
  );
}
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <AppText variant="h2" style={{ marginBottom: spacing.md }}>{title}</AppText>
      <View style={styles.blockCard}>{children}</View>
    </View>
  );
}
function ShareBtn({ icon, label, onPress, qr }: { icon: any; label: string; onPress: () => void; qr?: React.ReactNode }) {
  return (
    <Pressable testID={`share-${label}`} onPress={onPress} style={styles.shareBtn}>
      <View style={styles.shareIcon}>{qr || <Feather name={icon} size={22} color={colors.onSurface} />}</View>
      <AppText variant="caption" style={{ marginTop: 6 }}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: colors.surface },
  hero: { height: 300, backgroundColor: colors.surfaceTertiary },
  heroTop: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center", ...shadow.card },
  body: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  catPill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  orgRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.md },
  progressBox: { marginTop: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  momentumCard: {
    marginTop: spacing.md,
    backgroundColor: "#F0FDF4",
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  blockCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  budgetRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.md },
  galImg: { width: 130, height: 100, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  galVideo: { width: 130, height: 100, borderRadius: radius.md, backgroundColor: colors.surfaceInverse, alignItems: "center", justifyContent: "center" },
  update: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  supporter: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cta: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
  followBtn: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  backdrop: { flex: 1, backgroundColor: "rgba(35,33,31,0.5)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  shareCard: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden", marginTop: spacing.md },
  shareCover: { width: 90, height: 90, backgroundColor: colors.surfaceTertiary },
  shareRow: { flexDirection: "row", justifyContent: "space-around", marginTop: spacing.lg },
  shareBtn: { alignItems: "center" },
  shareIcon: { width: 60, height: 60, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  reason: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary },
  thankBtn: { flexDirection: "row", alignItems: "center", backgroundColor: colors.brandTertiary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  thankedPill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4 },
  thankInput: { minHeight: 90, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontFamily: font.regular, fontSize: 14, color: colors.onSurface, textAlignVertical: "top" },
});
