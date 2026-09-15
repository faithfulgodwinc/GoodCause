import React, { useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, Linking, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Card } from "@/src/components/ui";
import { colors, spacing, radius } from "@/src/theme";
import { useResponsive } from "@/src/lib/responsive";
import { useAuth } from "@/src/context/auth";

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { feedMaxWidth } = useResponsive();
  const { user, deleteAccount } = useAuth();
  const [activeTab, setActiveTab] = useState<"privacy" | "terms" | "deletion">("privacy");
  const [deleting, setDeleting] = useState(false);

  const handleAccountDeletionRequest = () => {
    Alert.alert(
      "Delete Account Permanently",
      "Are you sure you want to permanently delete your account? This will immediately remove your profile, campaign drafts, and saved items. Historical donation records are retained strictly anonymously for financial audit logs. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete My Account",
          style: "destructive",
          onPress: async () => {
            try {
              setDeleting(true);
              await deleteAccount();
              Alert.alert(
                "Account Deleted",
                "Your account and associated personal data have been permanently deleted.",
                [{ text: "OK", onPress: () => router.replace("/auth") }]
              );
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Failed to delete account. Please try again.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={[styles.headerInner, { maxWidth: feedMaxWidth }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} testID="privacy-back-btn">
            <Feather name="arrow-left" size={22} color={colors.onSurface} />
          </Pressable>
          <AppText variant="h2" style={{ flex: 1, textAlign: "center", marginRight: 36 }}>
            Legal & Privacy
          </AppText>
        </View>

        {/* Sub-tabs */}
        <View style={[styles.tabsRow, { maxWidth: feedMaxWidth }]}>
          <Pressable
            onPress={() => setActiveTab("privacy")}
            style={[styles.tabBtn, activeTab === "privacy" && styles.tabBtnActive]}
          >
            <AppText
              variant="label"
              color={activeTab === "privacy" ? colors.brandPrimary : colors.onSurfaceSecondary}
            >
              Privacy Policy
            </AppText>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("terms")}
            style={[styles.tabBtn, activeTab === "terms" && styles.tabBtnActive]}
          >
            <AppText
              variant="label"
              color={activeTab === "terms" ? colors.brandPrimary : colors.onSurfaceSecondary}
            >
              Terms of Service
            </AppText>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("deletion")}
            style={[styles.tabBtn, activeTab === "deletion" && styles.tabBtnActive]}
          >
            <AppText
              variant="label"
              color={activeTab === "deletion" ? colors.error : colors.onSurfaceSecondary}
            >
              Data & Deletion
            </AppText>
          </Pressable>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 60 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignSelf: "center", width: "100%", maxWidth: feedMaxWidth }}>
          {activeTab === "privacy" && (
            <Card style={styles.card}>
              <AppText variant="display" style={{ fontSize: 24, marginBottom: 4 }}>
                Privacy Policy
              </AppText>
              <AppText variant="caption" color={colors.muted} style={{ marginBottom: spacing.lg }}>
                Effective Date: September 13, 2026
              </AppText>

              <SectionTitle icon="shield" title="1. Overview" />
              <Paragraph>
                GoodCause (we, our, or us) is dedicated to protecting your personal privacy while enabling transparent, impactful giving. This Privacy Policy explains how we collect, use, store, and safeguard your information when you use our mobile app and services.
              </Paragraph>

              <SectionTitle icon="database" title="2. Information We Collect" />
              <Paragraph>
                To provide safe and verifiable fundraising services, we collect the following categories of information:
              </Paragraph>
              <BulletPoint title="Account Credentials">
                Name, email address, profile picture (via Google Sign-In, Apple Authentication, or direct OTP).
              </BulletPoint>
              <BulletPoint title="Campaign & Impact Content">
                Campaign titles, stories, goals, photos uploaded from your Photo Library (`READ_MEDIA_IMAGES`), and voice updates recorded using your device microphone (`RECORD_AUDIO`).
              </BulletPoint>
              <BulletPoint title="Financial & Subscription Data">
                Donation records, transaction history, and subscription status. Apple or Google processes native subscription payments, RevenueCat manages subscription data and entitlements, and Paystack processes direct campaign donations.
              </BulletPoint>
              <BulletPoint title="Technical & Device Identifiers">
                Device OS version, app version, crash logs, and network connection status used solely for service reliability and fraud prevention.
              </BulletPoint>

              <SectionTitle icon="cpu" title="3. How We Use Your Information" />
              <BulletPoint title="App Functionality">
                Creating and managing fundraising campaigns, processing donations, and generating verified receipt cards.
              </BulletPoint>
              <BulletPoint title="Trust & Security">
                Verifying organizer identity, preventing fraudulent campaigns, and ensuring legal compliance.
              </BulletPoint>
              <BulletPoint title="GoodCause Pro Features">
                Powering campaign performance analytics and transparent impact reports for subscribed organizers.
              </BulletPoint>

              <SectionTitle icon="share-2" title="4. Third-Party Services" />
              <Paragraph>
                We do not sell, rent, or trade your personal data. We share necessary data with trusted infrastructure providers solely to operate the app:
              </Paragraph>
              <BulletPoint title="Supabase Cloud">Secure database and file storage infrastructure.</BulletPoint>
              <BulletPoint title="RevenueCat">In-app subscription and entitlement management.</BulletPoint>
              <BulletPoint title="Google & Apple Auth">OAuth authentication providers.</BulletPoint>

              <SectionTitle icon="lock" title="5. Data Retention & Security" />
              <Paragraph>
                We employ industry-standard encryption (TLS in transit, AES-256 at rest) to protect your data. Personal account data is retained as long as your account remains active.
              </Paragraph>

              <SectionTitle icon="mail" title="6. Contact Us" />
              <Paragraph>
                If you have questions regarding this Privacy Policy, please contact our Data Protection team at:
              </Paragraph>
              <Pressable
                onPress={() => Linking.openURL("mailto:privacy@goodcause.app")}
                style={styles.contactBadge}
              >
                <Feather name="mail" size={16} color={colors.brandPrimary} />
                <AppText variant="button" color={colors.brandPrimary} style={{ marginLeft: spacing.xs }}>
                  privacy@goodcause.app
                </AppText>
              </Pressable>
            </Card>
          )}

          {activeTab === "terms" && (
            <Card style={styles.card}>
              <AppText variant="display" style={{ fontSize: 24, marginBottom: 4 }}>
                Terms of Service
              </AppText>
              <AppText variant="caption" color={colors.muted} style={{ marginBottom: spacing.lg }}>
                Effective Date: September 13, 2026
              </AppText>

              <SectionTitle icon="file-text" title="1. Acceptance of Terms" />
              <Paragraph>
                By creating an account or using GoodCause, you agree to comply with and be bound by these Terms of Service and all applicable laws and regulations.
              </Paragraph>

              <SectionTitle icon="heart" title="2. Organizer & Donor Code of Conduct" />
              <BulletPoint title="Truthful Campaigns">
                Organizers must present accurate, non-misleading information regarding their cause and campaign funds.
              </BulletPoint>
              <BulletPoint title="Prohibited Content">
                Campaigns promoting hate speech, illegal activities, violence, or fraud are strictly prohibited and subject to immediate termination.
              </BulletPoint>

              <SectionTitle icon="refresh-cw" title="3. Subscriptions & Payouts" />
              <Paragraph>
                GoodCause Pro subscriptions auto-renew according to App Store and Google Play billing rules. Payouts to campaign creators are subject to identity verification and compliance audits.
              </Paragraph>
              <Paragraph>
                Membership is a purchase of ongoing GoodCause benefits and is not a direct charitable donation. GoodCause commits 80% of confirmed net membership proceeds to eligible verified causes and retains 20% for platform operations. Amounts that cannot be distributed become restricted rollover for future eligible causes. Direct Paystack donations are separate and designated for the selected campaign. GoodCause does not represent payments as tax-deductible.
              </Paragraph>

              <SectionTitle icon="alert-circle" title="4. Limitation of Liability" />
              <Paragraph>
                GoodCause provides a platform facilitating direct giving. While we enforce verifications, donors support campaigns at their discretion.
              </Paragraph>
            </Card>
          )}

          {activeTab === "deletion" && (
            <Card style={styles.card}>
              <AppText variant="display" style={{ fontSize: 24, marginBottom: 4 }}>
                Data Rights & Account Deletion
              </AppText>
              <AppText variant="caption" color={colors.muted} style={{ marginBottom: spacing.lg }}>
                In compliance with Google Play Store & Global Data Protection Regulations (GDPR/CCPA)
              </AppText>

              <SectionTitle icon="trash-2" title="Delete Your Account & Personal Data" />
              <Paragraph>
                You have the right to request permanent deletion of your account and all associated personal data stored on GoodCause servers at any time.
              </Paragraph>

              <View style={styles.deletionBox}>
                <Feather name="alert-triangle" size={20} color={colors.error} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <AppText variant="title" color={colors.error}>
                    What happens when you delete your account?
                  </AppText>
                  <AppText variant="caption" style={{ marginTop: 4 }}>
                    • Your profile, saved causes, and campaign drafts are permanently removed.{"\n"}
                    • You will no longer receive notifications or cause updates.{"\n"}
                    • Financial records of past donations are retained strictly in an anonymized, aggregated format required by financial regulations.
                  </AppText>
                </View>
              </View>

              <Pressable
                onPress={handleAccountDeletionRequest}
                style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.85 }]}
                testID="privacy-request-deletion-btn"
              >
                <Feather name="trash-2" size={18} color="#fff" />
                <AppText variant="button" color="#fff" style={{ marginLeft: spacing.xs }}>
                  Request Account Deletion
                </AppText>
              </Pressable>

              <SectionTitle icon="help-circle" title="Alternative Deletion Request" />
              <Paragraph>
                You can also submit an account deletion request via web browser by emailing our privacy desk at <AppText variant="bodyMedium" color={colors.brandPrimary}>privacy@goodcause.app</AppText> with your registered account email. Requests are processed within 48 hours.
              </Paragraph>
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function SectionTitle({ icon, title }: { icon: keyof typeof Feather.glyphMap; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Feather name={icon} size={18} color={colors.brandPrimary} />
      <AppText variant="h2" style={{ marginLeft: spacing.xs, fontSize: 18 }}>
        {title}
      </AppText>
    </View>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.paragraph}>
      {children}
    </AppText>
  );
}

function BulletPoint({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <AppText variant="body" color={colors.onSurfaceSecondary} style={{ flex: 1 }}>
        <AppText variant="bodyMedium" color={colors.onSurface}>
          {title}:{" "}
        </AppText>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerInner: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    width: "100%",
    height: 44,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  tabsRow: {
    flexDirection: "row",
    alignSelf: "center",
    width: "100%",
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    alignItems: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabBtnActive: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandTertiary,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  card: {
    padding: spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  paragraph: {
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.xs,
    paddingLeft: spacing.xs,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brandPrimary,
    marginTop: 8,
    marginRight: spacing.xs + 2,
  },
  contactBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  deletionBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF0F0",
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.2)",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.error,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginVertical: spacing.md,
  },
});
