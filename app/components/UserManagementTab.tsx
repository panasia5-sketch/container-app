"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { USER_ROLES, type UserRole } from "@/lib/auth/permissions";
import {
  fetchAllUserProfiles,
  updateUserRole,
  type UserProfileRow,
} from "@/lib/auth/users";
import { formatDate } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

function AlertBanner({
  type,
  message,
  onClose,
  closeLabel,
}: {
  type: "success" | "error";
  message: string;
  onClose: () => void;
  closeLabel: string;
}) {
  const styles =
    type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${styles}`}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 opacity-60 hover:opacity-100"
        aria-label={closeLabel}
      >
        ✕
      </button>
    </div>
  );
}

export default function UserManagementTab() {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<UserProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [pendingRoles, setPendingRoles] = useState<Record<string, UserRole>>(
    {},
  );
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const rows = await fetchAllUserProfiles();
      setProfiles(rows);
      setPendingRoles(
        Object.fromEntries(rows.map((row) => [row.user_id, row.role])),
      );
    } catch (err) {
      setMessage({
        type: "error",
        text: getErrorMessage(err, t("users.loadFailed")),
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const handleSaveRole = async (profile: UserProfileRow) => {
    const nextRole = pendingRoles[profile.user_id];
    if (!nextRole || nextRole === profile.role) return;

    if (profile.user_id === user?.id && nextRole !== "admin") {
      setMessage({ type: "error", text: t("users.cannotDemoteSelf") });
      return;
    }

    setSavingUserId(profile.user_id);
    setMessage(null);

    try {
      await updateUserRole(profile.user_id, nextRole);
      setMessage({
        type: "success",
        text: t("users.roleUpdated", { email: profile.email }),
      });
      await loadProfiles();
    } catch (err) {
      setMessage({
        type: "error",
        text: getErrorMessage(err, t("users.updateFailed")),
      });
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">{t("users.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("users.hint")}</p>
      </div>

      <div className="p-5">
        {message && (
          <div className="mb-4">
            <AlertBanner
              type={message.type}
              message={message.text}
              onClose={() => setMessage(null)}
              closeLabel={t("common.close")}
            />
          </div>
        )}

        {loading ? (
          <p className="py-10 text-center text-sm text-slate-400">
            {t("common.loading")}
          </p>
        ) : profiles.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            {t("users.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("users.email")}</th>
                  <th className="px-4 py-3 font-medium">{t("users.role")}</th>
                  <th className="px-4 py-3 font-medium">{t("users.joined")}</th>
                  <th className="px-4 py-3 font-medium text-right">
                    {t("users.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profiles.map((profile) => {
                  const isSelf = profile.user_id === user?.id;
                  const pendingRole = pendingRoles[profile.user_id] ?? profile.role;
                  const isDirty = pendingRole !== profile.role;

                  return (
                    <tr key={profile.user_id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {profile.email}
                          {isSelf && (
                            <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                              {t("users.you")}
                            </span>
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={pendingRole}
                          onChange={(e) =>
                            setPendingRoles((prev) => ({
                              ...prev,
                              [profile.user_id]: e.target.value as UserRole,
                            }))
                          }
                          disabled={savingUserId === profile.user_id}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                        >
                          {USER_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {t(`roles.${role}`)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(profile.created_at.slice(0, 10), locale)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleSaveRole(profile)}
                          disabled={
                            !isDirty || savingUserId === profile.user_id
                          }
                          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {savingUserId === profile.user_id
                            ? t("users.saving")
                            : t("users.saveRole")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-xs text-slate-400">{t("users.footerNote")}</p>
      </div>
    </section>
  );
}
