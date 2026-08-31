"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  ExternalLink,
  ImagePlus,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MAX_INTERVIEW_QUESTIONS } from "@/lib/interview-policy";
import { getDiscordBotInstallUrl } from "@/lib/discord-install";
import type { ApplicationField, Question, Server, ServerAdditionalRole } from "@/lib/types";

type Props = {
  server: Server;
  supabase: ReturnType<typeof createClient>;
  onBack: () => void;
  onSaved: () => void;
};

type ValidationIssue = {
  tab: "general" | "controls" | "fields" | "questions";
  id: string;
  message: string;
};

export default function ServerSettingsForm({
  server,
  supabase,
  onBack,
  onSaved,
}: Props) {
  const [activeTab, setActiveTab] = useState<
    "general" | "controls" | "fields" | "questions"
  >("general");
  const [serverName, setServerName] = useState(server.name);
  const [logoUrl, setLogoUrl] = useState(server.logo_url || "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState(server.logo_url || "");
  const [removeLogo, setRemoveLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [guildId, setGuildId] = useState(server.discord_guild_id || "");
  const [roleId, setRoleId] = useState(server.approved_role_id || "");
  const [roleName, setRoleName] = useState(
    server.approved_role_name || "Approved",
  );
  const [staffRoleId, setStaffRoleId] = useState(server.staff_role_id || "");
  const [staffRoleName, setStaffRoleName] = useState(
    server.staff_role_name || "Staff",
  );
  const [additionalRoles, setAdditionalRoles] = useState<ServerAdditionalRole[]>([]);
  const [additionalRoleName, setAdditionalRoleName] = useState("");
  const [additionalRoleId, setAdditionalRoleId] = useState("");
  const [showAdditionalRoleId, setShowAdditionalRoleId] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [webhookMaskedUrl, setWebhookMaskedUrl] = useState("");
  const [removeWebhook, setRemoveWebhook] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestMessage, setWebhookTestMessage] = useState("");
  const [showGuildId, setShowGuildId] = useState(false);
  const [showRoleId, setShowRoleId] = useState(false);
  const [showStaffRoleId, setShowStaffRoleId] = useState(false);
  const [showWebhookUrl, setShowWebhookUrl] = useState(false);
  const [discordConnected, setDiscordConnected] = useState(Boolean(server.discord_guild_id));
  const [retentionDays, setRetentionDays] = useState(
    server.application_retention_days ?? 90,
  );
  const [declinedCooldownDays, setDeclinedCooldownDays] = useState(
    server.declined_reapply_cooldown_days ?? 30,
  );
  const [fields, setFields] = useState<ApplicationField[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);

  useEffect(() => {
    (async () => {
      const [
        { data: fieldData, error: fieldError },
        { data: questionData, error: questionError },
        { data: additionalRoleData, error: additionalRoleError },
      ] = await Promise.all([
        supabase
          .from("application_fields")
          .select("*")
          .eq("server_id", server.id)
          .order("order_index"),
        supabase
          .from("question_bank")
          .select("*")
          .eq("server_id", server.id)
          .order("order_index"),
        supabase
          .from("server_additional_roles")
          .select("*")
          .eq("server_id", server.id)
          .order("created_at"),
      ]);
      if (fieldError || questionError || additionalRoleError)
        setError(
          fieldError?.message ||
            questionError?.message ||
            additionalRoleError?.message ||
            "Could not load configuration.",
        );
      setFields((fieldData || []) as ApplicationField[]);
      setQuestions((questionData || []) as Question[]);
      setAdditionalRoles((additionalRoleData || []) as ServerAdditionalRole[]);
      setLoading(false);
    })();
  }, [server.id]);

  useEffect(() => {
    let mounted = true;
    void fetch(`/api/servers/${encodeURIComponent(server.id)}/discord/connection`, { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json().catch(() => null)) as { connected?: boolean } | null;
        if (mounted && response.ok) setDiscordConnected(result?.connected === true);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [server.id]);

  useEffect(() => {
    let mounted = true;
    void fetch(`/api/servers/${encodeURIComponent(server.id)}/webhook`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const result = (await response.json().catch(() => null)) as {
          configured?: boolean;
          maskedUrl?: string | null;
        } | null;
        if (mounted && response.ok) {
          setWebhookConfigured(result?.configured === true);
          setWebhookMaskedUrl(result?.maskedUrl || "");
        }
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [server.id]);

  function addField() {
    setFields((current) => [
      ...current,
      {
        // Leave identity generation to Postgres. A new field has no row ID
        // until it is saved, which prevents client-generated IDs from ever
        // being reused or accidentally associated with another portal.
        id: "",
        server_id: server.id,
        field_key: "",
        label: "New application field",
        description: null,
        field_type: "textarea",
        placeholder: "",
        options: [],
        is_required: false,
        is_active: true,
        order_index: current.length,
      },
    ]);
  }
  function addQuestion() {
    if (questions.length >= MAX_INTERVIEW_QUESTIONS) {
      setError(`Each portal can configure up to ${MAX_INTERVIEW_QUESTIONS} interview questions.`);
      return;
    }
    setError("");
    setQuestions((current) => [
      ...current,
      {
        id: "",
        server_id: server.id,
        prompt: "New interview question",
        scenario: null,
        order_index: current.length,
        is_active: true,
      },
    ]);
  }
  function updateField(index: number, patch: Partial<ApplicationField>) {
    setFields((current) =>
      current.map((field, itemIndex) =>
        itemIndex === index ? { ...field, ...patch } : field,
      ),
    );
  }
  function updateQuestion(index: number, patch: Partial<Question>) {
    setQuestions((current) =>
      current.map((question, itemIndex) =>
        itemIndex === index ? { ...question, ...patch } : question,
      ),
    );
  }

  useEffect(() => {
    return () => {
      if (logoPreview.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setError("Please choose a PNG, JPG, WEBP, or GIF image.");
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Your server logo must be smaller than 2 MB.");
      event.target.value = "";
      return;
    }
    setError("");
    setLogoFile(file);
    setRemoveLogo(false);
    setLogoPreview(URL.createObjectURL(file));
  }

  function clearLogo() {
    setLogoFile(null);
    setLogoPreview("");
    setRemoveLogo(Boolean(logoUrl));
    if (logoInputRef.current) logoInputRef.current.value = "";
  }

  async function testWebhook() {
    setTestingWebhook(true);
    setWebhookTestMessage("");
    const response = await fetch(`/api/servers/${encodeURIComponent(server.id)}/webhook`, {
      method: "POST",
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    setWebhookTestMessage(response.ok ? "Test notification sent." : result?.error || "The test notification could not be sent.");
    setTestingWebhook(false);
  }

  function addAdditionalRole() {
    const name = additionalRoleName.trim();
    const roleId = additionalRoleId.trim();
    if (name.length < 1 || name.length > 80) {
      setError("Additional role names must be between 1 and 80 characters.");
      return;
    }
    if (!/^\d{15,25}$/.test(roleId)) {
      setError("Enter a valid Discord role ID (15 to 25 digits).");
      return;
    }
    if (additionalRoles.some((role) => role.role_id === roleId)) {
      setError("That Discord role is already configured for this portal.");
      return;
    }
    if (additionalRoles.some((role) => role.name.toLowerCase() === name.toLowerCase())) {
      setError("Additional role names must be unique.");
      return;
    }
    setAdditionalRoles((current) => [
      ...current,
      { id: crypto.randomUUID(), server_id: server.id, name, role_id: roleId },
    ]);
    setAdditionalRoleName("");
    setAdditionalRoleId("");
    setShowAdditionalRoleId(false);
    setError("");
  }

  async function save() {
    setBusy(true);
    setError("");
    setValidationIssues([]);
    const nextName = serverName.trim();
    if (nextName.length < 2 || nextName.length > 100) {
      setError("The server name must be between 2 and 100 characters.");
      setBusy(false);
      return;
    }
    if (retentionDays !== 0 && (retentionDays < 7 || retentionDays > 90)) {
      setError("Interview recordings must be kept for 7 to 90 days, or kept until manually deleted.");
      setBusy(false);
      return;
    }
    if (declinedCooldownDays < 0 || declinedCooldownDays > 365) {
      setError("The declined-player cooldown must be between 0 and 365 days.");
      setBusy(false);
      return;
    }
    if (questions.length > MAX_INTERVIEW_QUESTIONS) {
      setError(`Remove questions until no more than ${MAX_INTERVIEW_QUESTIONS} remain.`);
      setBusy(false);
      return;
    }
    if (additionalRoles.some((role) => !/^\d{15,25}$/.test(role.role_id) || role.name.trim().length < 1 || role.name.trim().length > 80)) {
      setError("Fix the additional Discord roles before saving.");
      setActiveTab("general");
      setBusy(false);
      return;
    }
    if (new Set(additionalRoles.map((role) => role.role_id)).size !== additionalRoles.length || new Set(additionalRoles.map((role) => role.name.trim().toLowerCase())).size !== additionalRoles.length) {
      setError("Additional Discord roles must have unique names and role IDs.");
      setActiveTab("general");
      setBusy(false);
      return;
    }

    const normalizedFields = fields.map((field, index) => ({
      ...field,
      // Existing keys are retained so saved application answers remain
      // readable. New keys are assigned by the database trigger.
      field_key: field.field_key.trim(),
      order_index: index,
    }));
    const fieldKeys = normalizedFields.map((field) => field.field_key);
    const nextValidationIssues: ValidationIssue[] = [];
    normalizedFields.forEach((field, index) => {
      const fieldPrefix = `application-field-${index}`;
      if (!field.label.trim()) {
        nextValidationIssues.push({
          tab: "fields",
          id: `${fieldPrefix}-label`,
          message: `Application field ${index + 1}: add a label so players know what to enter.`,
        });
      } else if (field.label.trim().length > 120) {
        nextValidationIssues.push({
          tab: "fields",
          id: `${fieldPrefix}-label`,
          message: `Application field ${index + 1}: keep the label under 120 characters.`,
        });
      }
      if (field.field_type === "select" && !(field.options || []).some((option) => option.trim())) {
        nextValidationIssues.push({
          tab: "fields",
          id: `${fieldPrefix}-options`,
          message: `Application field ${index + 1}: add at least one dropdown option.`,
        });
      }
    });
    const configuredFieldKeys = fieldKeys.filter(Boolean);
    if (new Set(configuredFieldKeys).size !== configuredFieldKeys.length) {
      nextValidationIssues.push({
        tab: "fields",
        id: "application-field-0-key",
        message: "Application form: each field needs a unique field key.",
      });
    }
    questions.forEach((question, index) => {
      if (question.is_active && !question.prompt.trim()) {
        nextValidationIssues.push({
          tab: "questions",
          id: `interview-question-${index}-prompt`,
          message: `Interview question ${index + 1}: add a question or turn it off.`,
        });
      }
    });
    if (nextValidationIssues.length) {
      setValidationIssues(nextValidationIssues);
      setError("Fix the highlighted details before saving.");
      setActiveTab(nextValidationIssues[0].tab);
      setBusy(false);
      return;
    }
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      setError("Your sign-in session has expired. Please sign in again before saving.");
      setBusy(false);
      return;
    }

    const nextGuildId = guildId.trim();
    const needsDiscordConnectionCheck = nextGuildId !== (server.discord_guild_id || "") || (Boolean(nextGuildId) && !discordConnected);
    if (needsDiscordConnectionCheck) {
      const connectionResponse = await fetch(`/api/servers/${encodeURIComponent(server.id)}/discord/connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId: nextGuildId || null }),
      });
      const connectionResult = (await connectionResponse.json().catch(() => null)) as { connected?: boolean; error?: string } | null;
      if (!connectionResponse.ok) {
        setError(connectionResult?.error || "Could not verify the Discord connection. Install Dexlyy in the server first.");
        setActiveTab("general");
        setBusy(false);
        return;
      }
      setDiscordConnected(connectionResult?.connected === true);
    }

    if (removeWebhook || webhookUrl.trim()) {
      const webhookResponse = await fetch(`/api/servers/${encodeURIComponent(server.id)}/webhook`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl.trim() || undefined, remove: removeWebhook }),
      });
      const webhookResult = (await webhookResponse.json().catch(() => null)) as { configured?: boolean; error?: string } | null;
      if (!webhookResponse.ok) {
        setError(webhookResult?.error || "Could not save Discord notifications.");
        setBusy(false);
        return;
      }
      setWebhookConfigured(webhookResult?.configured === true);
      setWebhookMaskedUrl("");
      setWebhookUrl("");
      setRemoveWebhook(false);
      setWebhookTestMessage("");
    }

    const { error: serverError } = await supabase
      .from("servers")
      .update({
        name: nextName,
         discord_guild_id: nextGuildId || null,
        approved_role_id: roleId.trim() || null,
        approved_role_name: roleName.trim() || null,
        staff_role_id: staffRoleId.trim() || null,
        staff_role_name: staffRoleName.trim() || null,
        application_retention_days: retentionDays,
        declined_reapply_cooldown_days: declinedCooldownDays,
      })
      .eq("id", server.id);
    if (serverError) {
      setError(`Could not save the server details: ${serverError.message}`);
      setBusy(false);
      return;
    }

    const { error: additionalRoleDeleteError } = await supabase
      .from("server_additional_roles")
      .delete()
      .eq("server_id", server.id);
    if (additionalRoleDeleteError) {
      setError(`Could not update the additional Discord roles: ${additionalRoleDeleteError.message}`);
      setBusy(false);
      return;
    }
    if (additionalRoles.length) {
      const { error: additionalRoleSaveError } = await supabase
        .from("server_additional_roles")
        .insert(additionalRoles.map((role) => ({
          id: role.id || crypto.randomUUID(),
          server_id: server.id,
          role_id: role.role_id,
          name: role.name.trim(),
        })));
      if (additionalRoleSaveError) {
        setError(`Could not save the additional Discord roles: ${additionalRoleSaveError.message}`);
        setBusy(false);
        return;
      }
    }

    let nextLogoUrl = logoUrl || null;
    if (logoFile) {
      const formData = new FormData();
      formData.append("file", logoFile, logoFile.name);
      const logoResponse = await fetch(`/api/servers/${encodeURIComponent(server.id)}/logo`, {
        method: "POST",
        body: formData,
      });
      const logoResult = (await logoResponse.json().catch(() => null)) as { publicUrl?: string; error?: string } | null;
      if (!logoResponse.ok || !logoResult?.publicUrl) {
        setError(logoResult?.error || "Could not upload the server logo.");
        setBusy(false);
        return;
      }
      nextLogoUrl = logoResult.publicUrl;
    } else if (removeLogo) {
      const logoResponse = await fetch(`/api/servers/${encodeURIComponent(server.id)}/logo`, { method: "DELETE" });
      const logoResult = (await logoResponse.json().catch(() => null)) as { error?: string } | null;
      if (!logoResponse.ok) {
        setError(logoResult?.error || "Could not remove the server logo.");
        setBusy(false);
        return;
      }
      nextLogoUrl = null;
    }
    setLogoUrl(nextLogoUrl || "");
    setLogoFile(null);
    setRemoveLogo(false);
    const keepFieldIds = normalizedFields
      .filter((field) => field.id)
      .map((field) => field.id);
    const fieldDelete = supabase
      .from("application_fields")
      .delete()
      .eq("server_id", server.id);
    const { error: fieldDeleteError } = keepFieldIds.length
      ? await fieldDelete.not("id", "in", `(${keepFieldIds.join(",")})`)
      : await fieldDelete;
    if (fieldDeleteError) {
      setError(`Could not remove the deleted application fields: ${fieldDeleteError.message}`);
      setBusy(false);
      return;
    }
    const existingFields = normalizedFields.filter((field) => field.id);
    const newFields = normalizedFields.filter((field) => !field.id);
    const fieldUpdateResults = await Promise.all(
      existingFields.map((field) =>
        supabase
          .from("application_fields")
          .update({
            server_id: server.id,
            field_key: field.field_key,
            label: field.label.trim(),
            description: field.description,
            field_type: field.field_type,
            placeholder: field.placeholder,
            options: field.options || [],
            is_required: field.is_required,
            is_active: field.is_active,
            order_index: field.order_index,
          })
          .eq("id", field.id)
          .eq("server_id", server.id),
      ),
    );
    const fieldUpdateError = fieldUpdateResults.find((result) => result.error)?.error;
    const newFieldRows = newFields.map((field) => ({
      server_id: server.id,
      ...(field.field_key ? { field_key: field.field_key } : {}),
      label: field.label.trim(),
      description: field.description,
      field_type: field.field_type,
      placeholder: field.placeholder,
      options: field.options || [],
      is_required: field.is_required,
      is_active: field.is_active,
      order_index: field.order_index,
    }));
    const { error: fieldInsertError } = newFieldRows.length
      ? await supabase.from("application_fields").insert(newFieldRows)
      : { error: null };
    const fieldSaveError = fieldUpdateError || fieldInsertError;
    if (fieldSaveError) {
      setError(
        `Could not save the application fields: ${fieldSaveError.message}`,
      );
      setBusy(false);
      return;
    }
    const normalizedQuestions = questions.map((question, index) => ({
      ...question,
      order_index: index,
    }));
    const existingQuestions = normalizedQuestions.filter(
      (question) => question.id,
    );
    const newQuestions = normalizedQuestions
      .filter((question) => !question.id)
      .map(({ id: _id, created_by: _createdBy, ...question }) => ({
        ...question,
        created_by: user.id,
      }));

    const keepQuestionIds = normalizedQuestions
      .filter((question) => question.id)
      .map((question) => question.id);
    const questionDelete = supabase
      .from("question_bank")
      .delete()
      .eq("server_id", server.id);
    const { error: questionDeleteError } = keepQuestionIds.length
      ? await questionDelete.not("id", "in", `(${keepQuestionIds.join(",")})`)
      : await questionDelete;
    if (questionDeleteError) {
      setError(`Could not remove the deleted interview questions: ${questionDeleteError.message}`);
      setBusy(false);
      return;
    }
    const questionUpdateResults = await Promise.all(
      existingQuestions.map((question) =>
        supabase
          .from("question_bank")
          .update({
            prompt: question.prompt,
            scenario: question.scenario,
            order_index: question.order_index,
            is_active: question.is_active,
          })
          .eq("id", question.id)
          .eq("server_id", server.id),
      ),
    );
    const questionUpdateError = questionUpdateResults.find(
      (result) => result.error,
    )?.error;
    const { error: questionInsertError } = newQuestions.length
      ? await supabase.from("question_bank").insert(newQuestions)
      : { error: null };
    const questionSaveError = questionUpdateError || questionInsertError;
    if (questionSaveError) {
      setError(
        `Could not save the interview questions: ${questionSaveError.message}`,
      );
      setBusy(false);
      return;
    }
    setBusy(false);
    onSaved();
  }

  function issueFor(id: string) {
    return validationIssues.find((issue) => issue.id === id)?.message;
  }

  function hasIssue(prefix: string) {
    return validationIssues.some((issue) => issue.id.startsWith(prefix));
  }

  function focusIssue(issue: ValidationIssue) {
    setActiveTab(issue.tab);
    window.requestAnimationFrame(() => document.getElementById(issue.id)?.focus());
  }

  const fieldsHaveIssues = validationIssues.some((issue) => issue.tab === "fields");
  const questionsHaveIssues = validationIssues.some((issue) => issue.tab === "questions");

  return (
    <section className="settings-card">
      <div className="settings-card-header">
        <div>
          <span className="eyebrow">Portal configuration</span>
          <h2>Shape the player journey</h2>
          <p className="subtle">
            Manage your server identity, application form, and interview from
            one focused workspace.
          </p>
        </div>
        <div className="settings-save-state">
          <span className="settings-live-dot" /> Ready for changes
        </div>
      </div>
      <div
        className="settings-tabs"
        role="tablist"
        aria-label="Server configuration sections"
      >
        <button
          className={`settings-tab ${activeTab === "general" ? "active" : ""}`}
          role="tab"
          aria-selected={activeTab === "general"}
          onClick={() => setActiveTab("general")}
        >
          <span className="settings-tab-number">01</span>
          <span>
            <strong>General setup</strong>
            <small>Identity, Discord, and roles</small>
          </span>
        </button>
        <button
          className={`settings-tab ${activeTab === "controls" ? "active" : ""}`}
          role="tab"
          aria-selected={activeTab === "controls"}
          onClick={() => setActiveTab("controls")}
        >
          <span className="settings-tab-number">02</span>
          <span>
            <strong>Application controls</strong>
            <small>Cooldowns, spam, and history</small>
          </span>
        </button>
        <button
          className={`settings-tab ${activeTab === "fields" ? "active" : ""} ${fieldsHaveIssues ? "has-issues" : ""}`}
          role="tab"
          aria-selected={activeTab === "fields"}
          onClick={() => setActiveTab("fields")}
        >
          <span className="settings-tab-number">03</span>
          <span>
            <strong>Application form</strong>
            <small>What players need to submit</small>
          </span>
          {fieldsHaveIssues && <span className="settings-tab-issue" aria-label="Application form needs attention">!</span>}
        </button>
        <button
          className={`settings-tab ${activeTab === "questions" ? "active" : ""} ${questionsHaveIssues ? "has-issues" : ""}`}
          role="tab"
          aria-selected={activeTab === "questions"}
          onClick={() => setActiveTab("questions")}
        >
          <span className="settings-tab-number">04</span>
          <span>
            <strong>AI interview</strong>
            <small>How the conversation should flow</small>
          </span>
          {questionsHaveIssues && <span className="settings-tab-issue" aria-label="AI interview needs attention">!</span>}
        </button>
      </div>
      {validationIssues.length > 0 && (
        <div className="settings-validation-summary" role="alert" aria-live="polite">
          <div className="settings-validation-summary-icon"><AlertCircle size={17} /></div>
          <div>
            <strong>A few details need your attention</strong>
            <p>Nothing has been saved yet. Select an item below to jump straight to it.</p>
            <div className="settings-validation-list">
              {validationIssues.map((issue) => (
                <button key={`${issue.id}-${issue.message}`} type="button" onClick={() => focusIssue(issue)}>
                  {issue.message}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {!loading && activeTab === "general" && (
      <div className="settings-general-panel" role="tabpanel">
        <div className="settings-content-heading settings-general-heading">
          <div>
            <span className="settings-kicker">PORTAL ESSENTIALS</span>
            <h3>Connect your community</h3>
            <p>
              Set the public identity players see and map the Discord roles
              Dexlyy uses behind the scenes.
            </p>
          </div>
        </div>
      <section className="settings-identity">
           <div className="settings-section-heading">
          <div className="settings-section-number">01</div>
          <div>
            <h3>Server identity</h3>
            <p>
              Choose the name and logo players will see when they open your
              interview portal.
            </p>
          </div>
        </div>
        <div className="settings-identity-grid">
          <div className="settings-logo-picker">
            <div className="settings-logo-preview" aria-hidden="true">
              {logoPreview ? (
                <img src={logoPreview} alt="" />
              ) : (
                <ImagePlus size={24} />
              )}
            </div>
            <div className="settings-logo-copy">
              <strong>Server logo</strong>
              <span>PNG, JPG, WEBP, or GIF · up to 2 MB</span>
              <div className="settings-logo-actions">
                <label className="btn btn-ghost btn-small settings-upload-button">
                  <ImagePlus size={14} />
                  {logoPreview ? "Change logo" : "Upload logo"}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleLogoChange}
                  />
                </label>
                {logoPreview && (
                  <button
                    type="button"
                    className="settings-remove-logo"
                    onClick={clearLogo}
                  >
                    <X size={13} /> Remove
                  </button>
                )}
              </div>
             </div>
           </div>
           <label className="label">
            Server name
            <input
              className="input"
              value={serverName}
              onChange={(event) => setServerName(event.target.value)}
              placeholder="My roleplay server"
              maxLength={100}
            />
            <span className="field-hint">
              This name appears across your owner workspace and player portal.
            </span>
          </label>
        </div>
      </section>
      <section className="settings-discord">
        <div className="settings-discord-group settings-discord-primary">
          <div className="settings-section-heading">
            <div className="settings-section-number">02</div>
            <div>
              <h3>Discord server</h3>
              <p>
                Connect the Discord server used for membership checks, role
                assignments, and community safety history.
              </p>
            </div>
           </div>
           <div className={`settings-discord-install ${discordConnected ? "connected" : ""}`}>
             <div className="settings-discord-install-icon"><ShieldCheck size={18} /></div>
             <div className="settings-discord-install-copy">
               <strong>{discordConnected ? "Dexlyy is connected" : "Install Dexlyy in your server"}</strong>
               <p>{discordConnected ? "The bot is securely bound to this portal. You can update the server ID below if you move the portal." : "Add the shared Dexlyy bot once. It never gives portal owners access to another community’s data."}</p>
             </div>
             <a className="btn btn-ghost btn-small settings-discord-install-button" href={getDiscordBotInstallUrl()} target="_blank" rel="noreferrer">
               {discordConnected ? "Reconnect bot" : "Install bot"} <ExternalLink size={14} />
             </a>
           </div>
           <label className="label">
             Discord server ID
            <div className="secret-input">
              <input
                className="input"
                type={showGuildId ? "text" : "password"}
                value={guildId}
                onChange={(e) => setGuildId(e.target.value)}
                placeholder="123456789012345678"
              />
              <button
                type="button"
                className="secret-toggle"
                onClick={() => setShowGuildId((current) => !current)}
                title={
                  showGuildId
                    ? "Hide Discord server ID"
                    : "Show Discord server ID"
                }
                aria-label={
                  showGuildId
                    ? "Hide Discord server ID"
                    : "Show Discord server ID"
                }
              >
                {showGuildId ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <span className="field-hint">
              Enable membership verification for applicants and staff.
            </span>
          </label>
           <div className="settings-safeguard-note">
             <strong>Secure connection</strong>
             <p>
               Dexlyy verifies that the bot is installed and that your Discord
               account owns or manages this server before binding it. The bot
               token stays server-side, and each portal can access only its own
               verified Discord server.
             </p>
           </div>
        </div>

        <div className="settings-discord-group">
          <div className="settings-section-heading">
            <div className="settings-section-number">03</div>
            <div>
              <h3>Approval role</h3>
              <p>
                This role is assigned automatically when an applicant is
                approved.
              </p>
            </div>
          </div>
          <div className="settings-form-grid">
            <label className="label">
              Approved role ID
              <div className="secret-input">
                <input
                  className="input"
                  type={showRoleId ? "text" : "password"}
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  placeholder="123456789012345678"
                />
                <button
                  type="button"
                  className="secret-toggle"
                  onClick={() => setShowRoleId((current) => !current)}
                  title={
                    showRoleId
                      ? "Hide approved role ID"
                      : "Show approved role ID"
                  }
                  aria-label={
                    showRoleId
                      ? "Hide approved role ID"
                      : "Show approved role ID"
                  }
                >
                  {showRoleId ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <span className="field-hint">
                The role granted to players after approval.
              </span>
            </label>
            <label className="label">
              Approved role name
              <input
                className="input"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="Approved"
              />
              <span className="field-hint">
                Shown in approval and applicant status messages.
              </span>
            </label>
          </div>
        </div>

        <div className="settings-discord-group">
          <div className="settings-section-heading">
            <div className="settings-section-number">04</div>
            <div>
              <h3>Staff access</h3>
              <p>
                Choose the Discord role trusted to review applications and
                manage the portal.
              </p>
            </div>
          </div>
          <div className="settings-form-grid">
            <label className="label">
              Staff role ID
              <div className="secret-input">
                <input
                  className="input"
                  type={showStaffRoleId ? "text" : "password"}
                  value={staffRoleId}
                  onChange={(e) => setStaffRoleId(e.target.value)}
                  placeholder="123456789012345678"
                />
                <button
                  type="button"
                  className="secret-toggle"
                  onClick={() => setShowStaffRoleId((current) => !current)}
                  title={
                    showStaffRoleId
                      ? "Hide staff role ID"
                      : "Show staff role ID"
                  }
                  aria-label={
                    showStaffRoleId
                      ? "Hide staff role ID"
                      : "Show staff role ID"
                  }
                >
                  {showStaffRoleId ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <span className="field-hint">
                Invited staff must hold this role in the Discord server.
              </span>
            </label>
            <label className="label">
              Staff role name
              <input
                className="input"
                value={staffRoleName}
                onChange={(e) => setStaffRoleName(e.target.value)}
                placeholder="Staff"
              />
              <span className="field-hint">
                Shown in the staff invitation instructions.
              </span>
            </label>
          </div>
        </div>

        <div className="settings-discord-group settings-additional-roles-group">
          <div className="settings-section-heading">
            <div className="settings-section-number">05</div>
            <div>
              <h3>Additional player roles</h3>
              <p>
                Create optional roles that reviewers can add from the approval screen, such as New Player or Verified.
              </p>
            </div>
          </div>
          <div className="additional-role-list">
            {additionalRoles.length ? additionalRoles.map((role) => (
              <div className="additional-role-row" key={role.id}>
                <div>
                  <strong>{role.name}</strong>
                </div>
                <button
                  type="button"
                  className="config-icon-remove"
                  onClick={() => setAdditionalRoles((current) => current.filter((item) => item.id !== role.id))}
                  title={`Remove ${role.name}`}
                  aria-label={`Remove ${role.name}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )) : <p className="additional-role-empty">No optional roles configured yet.</p>}
          </div>
          <div className="additional-role-form">
            <label className="label">
              Role name
              <input className="input" value={additionalRoleName} onChange={(event) => setAdditionalRoleName(event.target.value)} placeholder="New Player" maxLength={80} />
            </label>
            <label className="label">
              Discord role ID
              <div className="secret-input">
                <input className="input" type={showAdditionalRoleId ? "text" : "password"} value={additionalRoleId} onChange={(event) => setAdditionalRoleId(event.target.value)} placeholder="123456789012345678" inputMode="numeric" />
                <button type="button" className="secret-toggle" onClick={() => setShowAdditionalRoleId((current) => !current)} title={showAdditionalRoleId ? "Hide role ID" : "Show role ID"} aria-label={showAdditionalRoleId ? "Hide role ID" : "Show role ID"}>
                  {showAdditionalRoleId ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>
            <button type="button" className="btn btn-ghost btn-small additional-role-add" onClick={addAdditionalRole}>
              <Plus size={14} /> Add role
            </button>
          </div>
          <span className="field-hint">The bot must be able to manage each role. Keep the bot’s highest role above these roles in Discord.</span>
        </div>

        <div className="settings-discord-group settings-webhook-group">
          <div className="settings-section-heading">
            <div className="settings-section-number">06</div>
            <div>
              <h3>Discord notifications</h3>
              <p>
                Send a private update to a Discord channel when applications
                are submitted, approved, or declined.
              </p>
            </div>
          </div>
          <label className="label">
            Discord webhook URL
            <div className="secret-input">
              <input
                className="input"
                type={showWebhookUrl ? "text" : "password"}
                value={webhookUrl}
                onChange={(event) => {
                  setWebhookUrl(event.target.value);
                  setRemoveWebhook(false);
                  setWebhookTestMessage("");
                }}
                placeholder={webhookConfigured ? "Webhook configured · paste a new URL to replace it" : "https://discord.com/api/webhooks/..."}
                autoComplete="off"
              />
              <button
                type="button"
                className="secret-toggle"
                onClick={() => setShowWebhookUrl((current) => !current)}
                title={showWebhookUrl ? "Hide Discord webhook URL" : "Show Discord webhook URL"}
                aria-label={showWebhookUrl ? "Hide Discord webhook URL" : "Show Discord webhook URL"}
              >
                {showWebhookUrl ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <span className="field-hint">
              Create a channel webhook in Discord and paste its HTTPS URL here. Leave this blank to keep the current webhook.
            </span>
          </label>
          <div className="settings-webhook-actions">
            <span className={`settings-webhook-status ${webhookConfigured && !removeWebhook ? "configured" : ""}`}>
              <span className="settings-live-dot" />
              {removeWebhook ? "Will be removed when saved" : webhookConfigured ? (webhookMaskedUrl || "Webhook configured") : "Not configured"}
            </span>
            <div className="settings-logo-actions">
              {webhookConfigured && !removeWebhook && (
                <button type="button" className="btn btn-ghost btn-small" onClick={() => void testWebhook()} disabled={testingWebhook || busy}>
                  {testingWebhook ? "Sending test…" : "Send test notification"}
                </button>
              )}
              {webhookConfigured && (
                <button type="button" className="settings-remove-logo" onClick={() => setRemoveWebhook((current) => !current)}>
                  {removeWebhook ? "Keep webhook" : "Remove webhook"}
                </button>
              )}
            </div>
          </div>
          {webhookTestMessage && <p className="field-hint settings-webhook-message">{webhookTestMessage}</p>}
        </div>
      </section>
      </div>
      )}
      {loading ? (
        <div className="settings-loading-state"><span className="button-spinner button-spinner-dark" /> Loading configuration…</div>
      ) : activeTab === "controls" ? (
        <section className="settings-tab-content settings-controls-panel" role="tabpanel">
          <div className="settings-content-heading">
            <div>
              <span className="settings-kicker">APPLICATION SAFEGUARDS</span>
              <h3>Keep the queue useful and under control</h3>
              <p>
                Dexlyy already blocks duplicate pending applications. Choose
                how long declined players wait and how long decided history is kept.
              </p>
            </div>
          </div>
          <div className="settings-controls-grid">
            <article className="settings-control-card">
              <span className="settings-section-number">01</span>
              <div>
                <h4>Declined-player cooldown</h4>
                <p>How long a declined Discord account must wait before applying to this server again.</p>
              </div>
              <label className="label">
                Reapply after
                <select className="select" value={declinedCooldownDays} onChange={(event) => setDeclinedCooldownDays(Number(event.target.value))}>
                  <option value={0}>Immediately</option>
                  <option value={1}>1 day</option>
                  <option value={3}>3 days</option>
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                  <option value={180}>180 days</option>
                  <option value={365}>1 year</option>
                </select>
              </label>
            </article>
            <article className="settings-control-card">
              <span className="settings-section-number">02</span>
              <div>
                <h4>Interview recordings</h4>
                <p>Audio is deleted after this period. Application details, transcripts, decisions, and reviewer history stay until you delete them manually.</p>
              </div>
              <label className="label">
                Delete recordings after
                <select className="select" value={retentionDays} onChange={(event) => setRetentionDays(Number(event.target.value))}>
                  <option value={0}>Keep recordings until manually deleted</option>
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                </select>
              </label>
            </article>
          </div>
          <div className="settings-safeguard-note">
            <strong>Built-in spam protection</strong>
            <p>
              A Discord account can have only one active application per server.
              Membership is verified again on submission, repeated requests are rate-limited,
              and cooldowns remain active even if application history is manually deleted.
            </p>
          </div>
        </section>
      ) : activeTab === "fields" ? (
        <section className="settings-tab-content settings-fields-panel" role="tabpanel">
          <div className="settings-content-heading">
            <div>
              <span className="settings-kicker">PLAYER APPLICATION</span>
              <h3>Ask for the right context</h3>
              <p>
                Keep the application focused. Add only what your staff needs
                before the interview.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={addField}
            >
              <Plus size={14} /> Add field
            </button>
          </div>
          <div className="config-list">
            {fields.map((field, index) => (
              <div
                className={`config-card ${field.is_active ? "" : "config-card-muted"} ${hasIssue(`application-field-${index}`) ? "config-card-invalid" : ""}`}
                key={field.id || `new-field-${index}`}
              >
                <div className="config-card-head">
                  <div className="config-card-title">
                    <span className="drag-handle">
                      <ChevronDown size={14} />
                    </span>
                    <strong>Field {index + 1}</strong>
                  </div>
                  {hasIssue(`application-field-${index}`) && <span className="config-card-alert"><AlertCircle size={13} /> Needs attention</span>}
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={field.is_active}
                      onChange={(e) =>
                        updateField(index, { is_active: e.target.checked })
                      }
                    />{" "}
                    Visible
                  </label>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={field.is_required}
                      onChange={(e) =>
                        updateField(index, { is_required: e.target.checked })
                      }
                    />{" "}
                    Required
                  </label>
                  <button
                    type="button"
                    className="config-icon-remove"
                    onClick={() =>
                      setFields((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    title="Remove field"
                    aria-label="Remove field"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="config-grid">
                  <label className={`label ${issueFor(`application-field-${index}-label`) ? "label-invalid" : ""}`}>
                    Label
                    <input
                      id={`application-field-${index}-label`}
                      className="input"
                      value={field.label}
                      aria-invalid={Boolean(issueFor(`application-field-${index}-label`))}
                      onChange={(e) =>
                        updateField(index, { label: e.target.value })
                      }
                    />
                    {issueFor(`application-field-${index}-label`) && <span className="field-validation-message">{issueFor(`application-field-${index}-label`)}</span>}
                  </label>
                  <label className={`label ${issueFor(`application-field-${index}-key`) ? "label-invalid" : ""}`}>
                    Field key
                    <input
                      id={`application-field-${index}-key`}
                      className="input"
                      value={field.field_key}
                      readOnly
                      placeholder="Assigned automatically on save"
                      aria-invalid={Boolean(issueFor(`application-field-${index}-key`))}
                    />
                    <small className="field-help">Generated for this portal and kept private from other servers.</small>
                    {issueFor(`application-field-${index}-key`) && <span className="field-validation-message">This saved key needs attention.</span>}
                  </label>
                  <label className="label">
                    Type
                    <select
                      className="select"
                      value={field.field_type}
                      onChange={(e) =>
                        updateField(index, {
                          field_type: e.target
                            .value as ApplicationField["field_type"],
                        })
                      }
                    >
                      <option value="text">Short text</option>
                      <option value="textarea">Long text</option>
                      <option value="select">Dropdown</option>
                    </select>
                  </label>
                  <label className="label">
                    Placeholder
                    <input
                      className="input"
                      value={field.placeholder || ""}
                      onChange={(e) =>
                        updateField(index, { placeholder: e.target.value })
                      }
                      placeholder="What should the player enter?"
                    />
                  </label>
                </div>
                <label className="label">
                  Helper text
                  <input
                    className="input"
                    value={field.description || ""}
                    onChange={(e) =>
                      updateField(index, { description: e.target.value })
                    }
                    placeholder="Shown below the field"
                  />
                </label>
                {field.field_type === "select" && (
                  <label className={`label ${issueFor(`application-field-${index}-options`) ? "label-invalid" : ""}`}>
                    Dropdown options{" "}
                    <span className="field-hint inline">comma separated</span>
                    <input
                      id={`application-field-${index}-options`}
                      className="input"
                      value={(field.options || []).join(", ")}
                      aria-invalid={Boolean(issueFor(`application-field-${index}-options`))}
                      onChange={(e) =>
                        updateField(index, {
                          options: e.target.value
                            .split(",")
                            .map((option) => option.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Civilian, Police, EMS"
                    />
                    {issueFor(`application-field-${index}-options`) && <span className="field-validation-message">Add at least one option, separated by commas.</span>}
                  </label>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : activeTab === "questions" ? (
        <section className="settings-tab-content settings-questions-panel" role="tabpanel">
          <div className="settings-content-heading">
            <div>
              <span className="settings-kicker">GPT REALTIME GUIDE</span>
              <h3>Make the interview sound like your server</h3>
              <p>
                Configure up to {MAX_INTERVIEW_QUESTIONS} questions. Every
                interview has a firm 20-minute maximum, and your staff still
                makes the final decision.
              </p>
            </div>
            <div className="settings-question-actions">
              <span>{questions.length}/{MAX_INTERVIEW_QUESTIONS} questions</span>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={addQuestion}
                disabled={questions.length >= MAX_INTERVIEW_QUESTIONS}
              >
                <Plus size={14} /> Add question
              </button>
            </div>
          </div>
          <div className="config-list">
            {questions.map((question, index) => (
              <div
                className={`config-card ${question.is_active ? "" : "config-card-muted"} ${hasIssue(`interview-question-${index}`) ? "config-card-invalid" : ""}`}
                key={question.id || `new-question-${index}`}
              >
                <div className="config-card-head">
                  <div className="config-card-title">
                    <span className="question-index">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <strong>Interview question</strong>
                  </div>
                  {hasIssue(`interview-question-${index}`) && <span className="config-card-alert"><AlertCircle size={13} /> Needs attention</span>}
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={question.is_active}
                      onChange={(e) =>
                        updateQuestion(index, { is_active: e.target.checked })
                      }
                    />{" "}
                    Active
                  </label>
                  <button
                    type="button"
                    className="config-icon-remove"
                    onClick={() =>
                      setQuestions((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    title="Remove question"
                    aria-label="Remove question"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <label className={`label ${issueFor(`interview-question-${index}-prompt`) ? "label-invalid" : ""}`}>
                  Question
                  <textarea
                    id={`interview-question-${index}-prompt`}
                    className="textarea config-textarea"
                    value={question.prompt}
                    aria-invalid={Boolean(issueFor(`interview-question-${index}-prompt`))}
                    onChange={(e) =>
                      updateQuestion(index, { prompt: e.target.value })
                    }
                  />
                  {issueFor(`interview-question-${index}-prompt`) && <span className="field-validation-message">Add a question or turn this item off.</span>}
                </label>
                <label className="label">
                  Scenario guidance{" "}
                  <span className="field-hint inline">optional</span>
                  <textarea
                    className="textarea config-textarea"
                    value={question.scenario || ""}
                    onChange={(e) =>
                      updateQuestion(index, { scenario: e.target.value })
                    }
                    placeholder="What should the interviewer explore or test?"
                  />
                </label>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {error && (
        <div className="form-error" style={{ marginTop: 18 }}>
          {error}
        </div>
      )}
      <div className="settings-footer">
        <button className="btn btn-ghost" onClick={onBack}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={busy || loading}
        >
          {busy ? (
            <>
              <span className="button-spinner" /> Saving…
            </>
          ) : (
            <>
              <Check size={15} /> Save configuration
            </>
          )}
        </button>
      </div>
    </section>
  );
}
