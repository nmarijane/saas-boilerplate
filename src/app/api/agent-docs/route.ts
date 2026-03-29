import { NextResponse } from "next/server";

/**
 * GET /api/agent-docs
 *
 * Agent-readable API schema for this SaaS instance.
 * Designed to be consumed by AI coding agents (Claude, Codex, etc.)
 * so they can discover available endpoints, auth requirements,
 * and expected shapes without reading source code.
 *
 * This endpoint is intentionally public — API schemas are non-sensitive.
 */

const API_SCHEMA = {
  openai_plugin_compatible: false,
  schema_version: "1.0",
  generated_at: null as string | null, // injected at request time
  base_url: "/api",
  auth: {
    type: "bearer",
    header: "Authorization",
    format: "Bearer <api-key>",
    obtain: "Dashboard → Settings → API Keys",
  },
  endpoints: [
    {
      method: "GET",
      path: "/api/agent-docs",
      auth_required: false,
      description: "This document — machine-readable API schema for agents.",
      response_shape: { schema_version: "string", endpoints: "Endpoint[]" },
    },
    {
      method: "GET",
      path: "/api/health",
      auth_required: false,
      description: "Health check. Returns DB + Inngest readiness.",
      response_shape: {
        status: '"healthy" | "degraded"',
        checks: { database: '"ok" | "error"', inngest: '"ok" | "error"' },
        version: "string",
        timestamp: "ISO 8601",
      },
    },
    {
      method: "GET",
      path: "/api/features/:key",
      auth_required: false,
      description: "Check if a feature flag is enabled for a given key.",
      params: { key: "string — feature flag key (kebab-case)" },
      response_shape: { key: "string", enabled: "boolean" },
    },
    {
      method: "GET",
      path: "/api/notifications",
      auth_required: true,
      description: "List notifications for the authenticated user.",
      query_params: {
        limit: "number (default 20)",
        offset: "number (default 0)",
        countOnly: 'boolean — if "true", returns unread count only',
      },
      response_shape: {
        notifications: "Notification[]",
        "or (countOnly)": { count: "number" },
      },
    },
    {
      method: "PATCH",
      path: "/api/notifications",
      auth_required: true,
      description: "Mark notifications as read.",
      body_shape: {
        action: '"mark-read" | "mark-all-read"',
        notificationId: "string (required when action=mark-read)",
      },
    },
    {
      method: "POST",
      path: "/api/feedback",
      auth_required: true,
      description: "Submit user feedback.",
      body_shape: {
        type: '"bug" | "feature" | "general"',
        message: "string (required)",
        orgId: "string (optional)",
        screenshotId: "string (optional)",
      },
      response_shape: { id: "string", createdAt: "ISO 8601" },
    },
    {
      method: "POST",
      path: "/api/upload",
      auth_required: true,
      description: "Upload a file. Returns the uploaded file metadata.",
      body_shape: "multipart/form-data — field: file",
      response_shape: { id: "string", url: "string", name: "string", size: "number" },
    },
    {
      method: "GET",
      path: "/api/upload/:id",
      auth_required: true,
      description: "Retrieve metadata for a previously uploaded file.",
      params: { id: "string — file ID returned by POST /api/upload" },
    },
    {
      method: "POST",
      path: "/api/ai/chat",
      auth_required: true,
      description: "Streaming AI chat endpoint (Server-Sent Events).",
      body_shape: {
        messages: "{ role: 'user' | 'assistant', content: string }[]",
        orgId: "string (optional)",
      },
      response_shape: "text/event-stream — streamed tokens",
    },
    {
      method: "POST",
      path: "/api/stripe/webhook",
      auth_required: false,
      description: "Stripe webhook receiver. Requires Stripe-Signature header.",
      note: "Internal — do not call directly. Handled by Stripe.",
    },
  ],
};

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { ...API_SCHEMA, generated_at: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "X-Agent-Docs": "true",
      },
    },
  );
}
