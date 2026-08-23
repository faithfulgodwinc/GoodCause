import React, { useState } from "react";
import { View, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/lib/api";
import { useSubscription } from "@/src/lib/revenuecat";
import { AppText, Button, ProgressBar, VerifiedBadge, LoadingView, EmptyState } from "@/src/components/ui";
import { colors, spacing, radius, font, shadow } from "@/src/theme";
import { formatNaira, formatAmountInput } from "@/src/format";
import { CampaignCard } from "@/src/components/CampaignCard";
import { MediaUploader, Media } from "@/src/components/MediaUploader";

const RELATIONSHIPS = ["self", "family", "friend", "community", "organization"];
const STEPS = ["Cause", "Story", "Goal", "Budget", "Beneficiary", "Media", "Verification", "Preview", "Submit"];

export default function CreateCampaign() {
  const params = useLocalSearchParams<{ mine?: string; tab?: string }>();
  if (params.mine || params.tab === "mine") return <MyCampaigns />;
  return <Builder />;
}

function MyCampaigns() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useQuery({ queryKey: ["myCampaigns"], queryFn: () => api<{ items: any[] }>("/campaigns?mine=true&limit=50") });
  const items = data?.items || [];
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()}><Feather name="arrow-left" size={24} color={colors.onSurface} /></Pressable>
        <AppText variant="title">My campaigns</AppText>
        <Pressable onPress={() => router.replace("/campaign/new")}><Feather name="plus" size={24} color={colors.brandPrimary} /></Pressable>
      </View>
      {isLoading ? <LoadingView /> : items.length === 0 ? (
        <EmptyState icon="flag" title="No campaigns yet" message="Start a fundraiser and rally your community around a cause you care about." actionLabel="Start a campaign" onAction={() => router.replace("/campaign/new")} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
          {items.map((c) => (
            <View key={c.id}>
              <View style={styles.statusRow}>
                <VerifiedBadge status={c.verification_status} />
                <AppText variant="caption" style={{ marginLeft: spacing.sm }}>{c.status}</AppText>
              </View>
              <CampaignCard c={c} onPress={() => router.push(`/campaign/${c.id}`)} />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function Builder() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { isSubscribed } = useSubscription();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNote, setAiNote] = useState("");
  const [aiInput, setAiInput] = useState("");

  const { data: cats } = useQuery({ queryKey: ["categories"], queryFn: () => api<any[]>("/categories") });

  const [form, setForm] = useState<any>({
    title: "", summary: "", story: "", category_id: null, goal: "",
    budget: [] as { item: string; amount: string }[],
    beneficiary: { name: "", relationship: "self", type: "individual" },
    cover_image: "", location: { city: "", country: "NG" },
    media: [] as Media[],
    hero_video: null as string | null,
    deadlineDays: "30",
  });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const setMedia = (m: Media[]) => setForm((f: any) => {
    const firstImage = m.find((x) => x.kind === "image");
    const firstVideo = m.find((x) => x.kind === "video");
    return {
      ...f,
      media: m,
      cover_image: firstImage ? firstImage.url : (m[0]?.url || ""),
      hero_video: firstVideo ? firstVideo.url : null,
    };
  });

  const runAI = async () => {
    if (aiInput.trim().length < 10) { setError("Tell the assistant a bit more about the cause."); return; }
    setError(""); setAiLoading(true);
    try {
      const res = await api<any>("/ai/campaign-assistant", { method: "POST", body: { raw_text: aiInput } });
      setForm((f: any) => ({
        ...f,
        title: res.title || f.title,
        summary: res.summary || f.summary,
        story: res.story || f.story,
        budget: (res.expense_categories || []).length ? res.expense_categories.map((e: any) => ({ item: e.item, amount: "" })) : f.budget,
      }));
      setAiNote(res.review_note || "Please review and edit the AI draft before publishing.");
    } catch (e: any) {
      setError(e?.message || "The assistant is unavailable right now.");
    } finally { setAiLoading(false); }
  };

  const validateStep = (): boolean => {
    setError("");
    if (step === 0 && (!form.title.trim() || !form.category_id)) { setError("Add a title and pick a category."); return false; }
    if (step === 1 && form.story.trim().length < 20) { setError("Tell your story (at least a couple of sentences)."); return false; }
    if (step === 2 && (!form.goal || parseFloat(form.goal) < 1000)) { setError("Set a goal of at least ₦1,000."); return false; }
    if (step === 4 && !form.beneficiary.name.trim()) { setError("Who is this campaign for?"); return false; }
    if (step === 5 && (!form.media || form.media.length === 0)) { setError("Please upload at least one photo or video for your campaign."); return false; }
    return true;
  };

  const submit = async () => {
    setSaving(true); setError("");
    try {
      const body = {
        title: form.title.trim(),
        summary: form.summary.trim(),
        story: form.story,
        category_id: form.category_id,
        goal_kobo: Math.round(parseFloat(form.goal) * 100),
        cover_image: form.cover_image,
        gallery: [form.cover_image, ...(form.media || []).map((m: any) => m.url)].filter((v: string, i: number, a: string[]) => v && a.indexOf(v) === i),
        hero_video: form.hero_video || null,
        budget: form.budget.filter((b: any) => b.item).map((b: any) => ({ item: b.item, amount_kobo: Math.round(parseFloat(b.amount || "0") * 100) })),
        beneficiary: form.beneficiary,
        deadline: new Date(Date.now() + parseInt(form.deadlineDays || "30") * 86400000).toISOString(),
        location: form.location,
      };
      const created = await api<any>("/campaigns", { method: "POST", body });
      await api(`/campaigns/${created.id}/submit`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["myCampaigns"] });
      router.replace(`/campaign/${created.id}`);
    } catch (e: any) {
      setError(e?.message || "We couldn't save that campaign. Please try again.");
    } finally { setSaving(false); }
  };

  const next = () => { if (validateStep()) setStep((s) => Math.min(STEPS.length - 1, s + 1)); };
  const back = () => (step === 0 ? router.back() : setStep((s) => s - 1));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={back} testID="builder-back"><Feather name={step === 0 ? "x" : "arrow-left"} size={24} color={colors.onSurface} /></Pressable>
        <AppText variant="title">Start a campaign</AppText>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.progressWrap}>
        <ProgressBar percent={((step + 1) / STEPS.length) * 100} />
        <AppText variant="caption" style={{ marginTop: 6 }}>Step {step + 1} of {STEPS.length} · {STEPS[step]}</AppText>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {step === 0 && (
          <StepWrap title="What's the cause?" subtitle="Give it a clear, honest title people can rally behind.">
            <Label text="Category" />
            <View style={styles.chipsWrap}>
              {cats?.map((cat) => (
                <Pressable key={cat.id} testID={`cat-${cat.slug}`} onPress={() => set("category_id", cat.id)} style={[styles.pickChip, form.category_id === cat.id && styles.pickChipActive]}>
                  <AppText variant="label" color={form.category_id === cat.id ? "#fff" : colors.onSurface}>{cat.name}</AppText>
                </Pressable>
              ))}
            </View>
            <Label text="Title" />
            <Input value={form.title} onChangeText={(v: string) => set("title", v)} placeholder="e.g. Help Amaka walk again" testID="input-title" />
            <Label text="Short summary" />
            <Input value={form.summary} onChangeText={(v: string) => set("summary", v)} placeholder="One sentence that captures the need" testID="input-summary" />
            <Label text="City" />
            <Input value={form.location.city} onChangeText={(v: string) => set("location", { ...form.location, city: v })} placeholder="e.g. Lagos" testID="input-city" />
          </StepWrap>
        )}

        {step === 1 && (
          <StepWrap title="Tell the story" subtitle="Explain what's happening, who it helps, and why it matters.">
            <View style={styles.aiBox}>
              <View style={styles.rowBetween}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Feather name="zap" size={16} color={colors.brandPrimary} />
                  <AppText variant="label" style={{ marginLeft: 6 }}>AI Campaign Assistant</AppText>
                </View>
                {!isSubscribed ? <Feather name="star" size={14} color={colors.warning} /> : null}
              </View>
              <AppText variant="caption" style={{ marginTop: 4 }}>{"Describe the situation in your own words and we'll draft a title, summary and story for you to review."}</AppText>
              <TextInput testID="ai-input" value={aiInput} onChangeText={setAiInput} multiline placeholder="e.g. My sister needs surgery for a spinal injury after an accident..." placeholderTextColor={colors.muted} style={styles.aiInput} />
              <Button title="Draft with AI" icon="zap" small loading={aiLoading} onPress={runAI} style={{ marginTop: spacing.sm, alignSelf: "flex-start", paddingHorizontal: spacing.xl }} testID="ai-draft-button" />
              {aiNote ? <View style={styles.aiNote}><Feather name="info" size={12} color={colors.info} /><AppText variant="caption" color={colors.onSurfaceSecondary} style={{ marginLeft: 6, flex: 1 }}>{aiNote}</AppText></View> : null}
            </View>
            <Label text="Your story" />
            <Input value={form.story} onChangeText={(v: string) => set("story", v)} placeholder="Share the full story here..." multiline height={180} testID="input-story" />
          </StepWrap>
        )}

        {step === 2 && (
          <StepWrap title="Set your goal" subtitle="How much do you need to raise? You can adjust later.">
            <View style={styles.goalBox}>
              <AppText variant="h1" color={colors.muted}>₦</AppText>
              <TextInput
                testID="input-goal"
                value={form.goal ? formatAmountInput(form.goal) : ""}
                onChangeText={(v: string) => set("goal", v.replace(/\D/g, ""))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.muted}
                style={styles.goalInput}
              />
            </View>
            <Label text="Campaign length (days)" />
            <View style={styles.chipsWrap}>
              {["14", "30", "60", "90"].map((d) => (
                <Pressable key={d} onPress={() => set("deadlineDays", d)} style={[styles.pickChip, form.deadlineDays === d && styles.pickChipActive]}>
                  <AppText variant="label" color={form.deadlineDays === d ? "#fff" : colors.onSurface}>{d} days</AppText>
                </Pressable>
              ))}
            </View>
          </StepWrap>
        )}

        {step === 3 && (
          <StepWrap title="Budget breakdown" subtitle="Optional, but transparency builds trust. Show how funds will be used.">
            {form.budget.map((b: any, i: number) => (
              <View key={i} style={styles.budgetRow}>
                <Input value={b.item} onChangeText={(v: string) => { const nb = [...form.budget]; nb[i].item = v; set("budget", nb); }} placeholder="Item" style={{ flex: 1 }} />
                <Input
                  value={b.amount ? formatAmountInput(b.amount) : ""}
                  onChangeText={(v: string) => {
                    const nb = [...form.budget];
                    nb[i].amount = v.replace(/\D/g, "");
                    set("budget", nb);
                  }}
                  placeholder="₦ Amount"
                  keyboardType="number-pad"
                  style={{ width: 130, marginLeft: spacing.sm }}
                />
                <Pressable onPress={() => set("budget", form.budget.filter((_: any, j: number) => j !== i))} style={{ marginLeft: spacing.sm }}><Feather name="trash-2" size={18} color={colors.error} /></Pressable>
              </View>
            ))}
            <Button title="Add budget item" icon="plus" variant="secondary" small onPress={() => set("budget", [...form.budget, { item: "", amount: "" }])} style={{ marginTop: spacing.sm }} testID="add-budget" />
          </StepWrap>
        )}

        {step === 4 && (
          <StepWrap title="Who benefits?" subtitle="Identify the beneficiary and your relationship to them.">
            <Label text="Beneficiary name" />
            <Input value={form.beneficiary.name} onChangeText={(v: string) => set("beneficiary", { ...form.beneficiary, name: v })} placeholder="Person, family or organization" testID="input-beneficiary" />
            <Label text="Your relationship to them" />
            <View style={styles.chipsWrap}>
              {RELATIONSHIPS.map((r) => (
                <Pressable key={r} testID={`rel-${r}`} onPress={() => set("beneficiary", { ...form.beneficiary, relationship: r })} style={[styles.pickChip, form.beneficiary.relationship === r && styles.pickChipActive]}>
                  <AppText variant="label" color={form.beneficiary.relationship === r ? "#fff" : colors.onSurface} style={{ textTransform: "capitalize" }}>{r}</AppText>
                </Pressable>
              ))}
            </View>
          </StepWrap>
        )}

        {step === 5 && (
          <StepWrap title="Add photos & video" subtitle="Upload your own photos or a short video — genuine media builds trust.">
            <MediaUploader media={form.media} onChange={setMedia} />
          </StepWrap>
        )}

        {step === 6 && (
          <StepWrap title="Verification" subtitle="GoodCause reviews campaigns to build trust. Here's what we check.">
            <View style={styles.verifyCard}>
              {["Organizer identity", "Beneficiary information", "Supporting documentation", "Organizer/beneficiary relationship"].map((t) => (
                <View key={t} style={styles.verifyRow}>
                  <Feather name="shield" size={16} color={colors.brandPrimary} />
                  <AppText variant="body" style={{ marginLeft: spacing.sm, flex: 1 }}>{t}</AppText>
                </View>
              ))}
              <View style={styles.aiNote}><Feather name="info" size={12} color={colors.info} /><AppText variant="caption" color={colors.onSurfaceSecondary} style={{ marginLeft: 6, flex: 1 }}>After you submit, our team completes verification checks before your campaign goes live. Verification confirms checks were completed — it is not a guarantee.</AppText></View>
            </View>
          </StepWrap>
        )}

        {step === 7 && (
          <StepWrap title="Preview" subtitle="Here's how supporters will see your campaign.">
            <View style={styles.previewCard}>
              <Image source={{ uri: form.cover_image }} style={styles.previewCover} contentFit="cover" />
              <View style={{ padding: spacing.md }}>
                <AppText variant="title">{form.title || "Untitled campaign"}</AppText>
                <AppText variant="body" style={{ marginTop: 4 }}>{form.summary}</AppText>
                <View style={{ marginTop: spacing.md }}>
                  <ProgressBar percent={0} />
                  <AppText variant="caption" style={{ marginTop: 6 }}>₦0 of {formatNaira(Math.round(parseFloat(form.goal || "0") * 100))}</AppText>
                </View>
              </View>
            </View>
          </StepWrap>
        )}

        {step === 8 && (
          <StepWrap title="Ready to submit" subtitle="Submit your campaign for verification. We'll notify you once it's approved to go live.">
            <View style={styles.verifyCard}>
              <SummaryRow label="Title" value={form.title} />
              <SummaryRow label="Category" value={cats?.find((c) => c.id === form.category_id)?.name || "—"} />
              <SummaryRow label="Goal" value={formatNaira(Math.round(parseFloat(form.goal || "0") * 100))} />
              <SummaryRow label="Beneficiary" value={form.beneficiary.name} />
              <SummaryRow label="Relationship" value={form.beneficiary.relationship} />
            </View>
          </StepWrap>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={14} color={colors.error} />
            <AppText variant="caption" color={colors.error} style={{ marginLeft: 6, flex: 1 }}>{error}</AppText>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {step < STEPS.length - 1 ? (
          <Button title="Continue" onPress={next} testID="builder-next" />
        ) : (
          <Button title="Submit for verification" loading={saving} onPress={submit} testID="builder-submit" />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function StepWrap({ title, subtitle, children }: any) {
  return (
    <View>
      <AppText variant="h1">{title}</AppText>
      <AppText variant="body" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>{subtitle}</AppText>
      {children}
    </View>
  );
}
function Label({ text }: { text: string }) {
  return <AppText variant="label" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>{text}</AppText>;
}
function Input({ multiline, height, style, ...rest }: any) {
  return (
    <TextInput
      {...rest}
      multiline={multiline}
      placeholderTextColor={colors.muted}
      style={[styles.input, multiline && { height: height || 100, textAlignVertical: "top", paddingTop: spacing.md }, style]}
    />
  );
}
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={[styles.verifyRow, { justifyContent: "space-between" }]}>
      <AppText variant="caption">{label}</AppText>
      <AppText variant="label" style={{ flex: 1, textAlign: "right", textTransform: label === "Relationship" ? "capitalize" : "none" }} numberOfLines={1}>{value || "—"}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  progressWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, height: 52, fontFamily: font.medium, fontSize: 15, color: colors.onSurface },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pickChip: { paddingHorizontal: spacing.lg, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  pickChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  aiBox: { backgroundColor: colors.brandTertiary + "55", borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.brandTertiary },
  aiInput: { minHeight: 70, backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, padding: spacing.md, marginTop: spacing.sm, fontFamily: font.regular, fontSize: 14, color: colors.onSurface, textAlignVertical: "top" },
  aiNote: { flexDirection: "row", alignItems: "flex-start", marginTop: spacing.sm, backgroundColor: colors.surfaceTertiary, padding: spacing.sm, borderRadius: radius.sm },
  goalBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: spacing.lg },
  goalInput: { fontFamily: font.display, fontSize: 40, color: colors.onSurface, minWidth: 120, textAlign: "center" },
  budgetRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  coverGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  coverItem: { width: "31%", aspectRatio: 1, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surfaceTertiary, borderWidth: 2, borderColor: "transparent" },
  coverActive: { borderColor: colors.brandPrimary },
  coverCheck: { position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  verifyCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  verifyRow: { flexDirection: "row", alignItems: "center" },
  previewCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden", ...shadow.card },
  previewCover: { width: "100%", height: 160, backgroundColor: colors.surfaceTertiary },
  errorBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#FBEBEB", padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
  statusRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xs },
});
