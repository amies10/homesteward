"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppHeader from "@/app/components/AppHeader";
import { PageSkeleton } from "@/app/components/Skeleton";
import SkillLevelPicker from "@/app/components/SkillLevelPicker";
import AccountTypePicker from "@/app/components/AccountTypePicker";
import Modal from "@/app/components/Modal";
import { CheckIcon, ChevronRightIcon, CameraIcon } from "@/app/components/icons";
import { loadUserProfile, updateProfileFields, loadReports, loadAllMyCompletions } from "@/lib/data";
import { computeEffectiveSkill } from "@/lib/skill";
import { uploadAvatar, downscaleImage, getSignedUrl } from "@/lib/storage";
import { supabase } from "@/lib/supabase-client";
import { sections, normalize, type SkillLevel, type UserProfile } from "@/lib/sections";

const SKILL_LABEL: Record<SkillLevel, string> = {
  beginner: "Beginner",
  some_experience: "Some Experience",
  experienced: "Experienced",
  expert: "Expert",
};

const ACCOUNT_TYPE_LABEL: Record<NonNullable<UserProfile["accountType"]>, string> = {
  owner: "Owner",
  renter: "Renter",
  prebuy: "Evaluating a home to buy",
};

export default function ProfilePage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(null);
  const [earnedSkillLevel, setEarnedSkillLevel] = useState<SkillLevel | null>(null);
  const [location, setLocation] = useState("");
  const [accountType, setAccountType] = useState<UserProfile["accountType"]>("owner");
  const [showAccountTypeModal, setShowAccountTypeModal] = useState(false);
  const [pendingAccountType, setPendingAccountType] = useState<UserProfile["accountType"] | null>(null);
  const [savingAccountType, setSavingAccountType] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email);
    });
    Promise.all([loadUserProfile(), loadReports(), loadAllMyCompletions()]).then(
      async ([profile, reports, myCompletions]) => {
        if (profile) {
          setDisplayName(profile.displayName ?? "");
          setSkillLevel(profile.skillLevel);
          setLocation(profile.location);
          setAccountType(profile.accountType ?? "owner");
          if (profile.avatarPath) {
            const url = await getSignedUrl(profile.avatarPath);
            setAvatarUrl(url);
          }
          const lookupIssue = (reportId: string, issueSlug: string, index: number) => {
            const report = reports.find((r) => r.id === reportId);
            const cfg = sections.find((sc) => sc.slug === issueSlug);
            const sec = report?.sections.find(
              (s) => s.slug === issueSlug || (cfg && normalize(s.name) === normalize(cfg.label))
            );
            return sec?.issues[index];
          };
          const result = computeEffectiveSkill(profile.skillLevel, myCompletions, lookupIssue);
          if (result.earned) setEarnedSkillLevel(result.effective);
        }
        setLoaded(true);
      }
    );
  }, []);

  async function handleAvatarSelect(file: File) {
    setUploadingAvatar(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user.id;
      if (!userId) return;
      const blob = await downscaleImage(file, 512);
      const path = await uploadAvatar(userId, blob);
      if (path) {
        await updateProfileFields({ avatarPath: path });
        const url = await getSignedUrl(path);
        setAvatarUrl(url);
      }
    } finally {
      setUploadingAvatar(false);
    }
  }

  function openAccountTypeModal() {
    setPendingAccountType(accountType);
    setShowAccountTypeModal(true);
  }

  async function handleConfirmAccountType() {
    if (!pendingAccountType || pendingAccountType === accountType) {
      setShowAccountTypeModal(false);
      return;
    }
    setSavingAccountType(true);
    await updateProfileFields({ accountType: pendingAccountType });
    setAccountType(pendingAccountType);
    setSavingAccountType(false);
    setShowAccountTypeModal(false);
  }

  async function handleSave() {
    if (!skillLevel || !location.trim()) return;
    setSaving(true);
    await updateProfileFields({
      displayName: displayName.trim(),
      skillLevel,
      location: location.trim(),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  const inputClass =
    "w-full rounded-[10px] border border-porch-border-input bg-porch-surface px-3.5 py-3 text-[14.5px] text-porch-text placeholder:text-porch-text-tertiary focus:outline-none";

  return (
    <div className="mx-auto min-h-screen max-w-[430px] bg-porch-bg pb-10 text-porch-text">
      <AppHeader backHref="/settings" backLabel="Settings" />

      <div className="px-5 pb-1 pt-5">
        <span className="font-display text-[22px] font-semibold text-porch-text">Profile</span>
      </div>

      {!loaded ? (
        <PageSkeleton />
      ) : (
        <>
          <div className="flex justify-center px-5 pt-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAvatarSelect(file);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              aria-label="Change profile photo"
              className="btn-press relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-[1.5px] border-porch-border bg-porch-accent-tint"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <CameraIcon size={24} />
              )}
              {uploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </div>
              )}
            </button>
          </div>

          <div className="mx-5 mt-6 space-y-3.5 rounded-2xl border border-porch-border bg-porch-surface p-[18px]">
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-porch-text">Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-porch-text">Email</label>
              <div className="rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-3 text-[14.5px] text-porch-text-secondary">
                {email}
              </div>
            </div>
          </div>

          <div className="px-5 pb-1 pt-[26px]">
            <div className="flex items-center gap-2">
              <div className="text-[15.5px] font-semibold text-porch-text">Skill Level</div>
              {earnedSkillLevel && (
                <span className="rounded-full bg-porch-accent-tint px-2.5 py-0.5 text-[11.5px] font-semibold text-porch-accent">
                  {SKILL_LABEL[earnedSkillLevel]} (earned)
                </span>
              )}
            </div>
            <div className="mt-0.5 text-[13.5px] text-porch-text-secondary">
              How comfortable are you with home repairs?
            </div>
            <div className="mt-2.5">
              <SkillLevelPicker value={skillLevel} onChange={setSkillLevel} />
            </div>
          </div>

          <div className="px-5 pb-1 pt-[26px]">
            <div className="text-[15.5px] font-semibold text-porch-text">Location</div>
            <div className="mb-2.5 mt-0.5 text-[13.5px] text-porch-text-secondary">
              Used to find local pros and estimate repair costs.
            </div>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="ZIP code"
              className={inputClass}
            />
          </div>

          <div className="px-5 pb-1 pt-[26px]">
            <div className="text-[15.5px] font-semibold text-porch-text">Account type</div>
            <div className="mt-2.5 flex items-center justify-between rounded-2xl border border-porch-border bg-porch-surface px-4 py-4">
              <span className="text-[14.5px] text-porch-text">{ACCOUNT_TYPE_LABEL[accountType ?? "owner"]}</span>
              <button
                onClick={openAccountTypeModal}
                className="btn-press rounded-[8px] px-2 py-1.5 text-[13.5px] font-semibold text-porch-accent focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1"
              >
                Change
              </button>
            </div>
          </div>

          <div className="px-5 pt-[26px] space-y-2.5">
            <Link
              href="/toolbox"
              className="btn-press flex items-center justify-between rounded-2xl border border-porch-border bg-porch-surface px-4 py-4 no-underline"
            >
              <span className="text-[14.5px] font-semibold text-porch-text">Your Toolbox</span>
              <ChevronRightIcon />
            </Link>
            <Link
              href="/property"
              className="btn-press flex items-center justify-between rounded-2xl border border-porch-border bg-porch-surface px-4 py-4 no-underline"
            >
              <span className="text-[14.5px] font-semibold text-porch-text">Property Details</span>
              <ChevronRightIcon />
            </Link>
          </div>

          <div className="px-5 pt-[26px]">
            <button
              onClick={handleSave}
              disabled={!skillLevel || !location.trim() || saving}
              className="btn-press flex w-full items-center justify-center gap-2 rounded-[10px] border-none py-[13px] text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: saved ? "#3E7A4F" : "#7D234A" }}
            >
              {saved && <CheckIcon size={16} strokeWidth={2.6} />}
              {saving ? "Saving…" : saved ? "Saved" : "Save Changes"}
            </button>
          </div>
        </>
      )}

      {showAccountTypeModal && (
        <Modal onClose={() => setShowAccountTypeModal(false)} maxWidth={400} maxHeight="80vh">
          <div className="mb-3.5 flex items-center justify-between">
            <span className="font-display text-lg font-semibold text-porch-text">Account type</span>
          </div>
          <AccountTypePicker value={pendingAccountType} onChange={setPendingAccountType} />
          <button
            onClick={handleConfirmAccountType}
            disabled={!pendingAccountType || savingAccountType}
            className="btn-press mt-4 flex w-full items-center justify-center rounded-[10px] border-none bg-porch-accent py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {savingAccountType ? "Saving…" : "Confirm"}
          </button>
        </Modal>
      )}
    </div>
  );
}
