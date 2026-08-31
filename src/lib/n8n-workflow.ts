/**
 * Summarises an exported n8n workflow for display.
 *
 * A workflow export carries parameter values and credential references —
 * API hosts, record ids, sometimes secrets people pasted into a field. None of
 * that is ever kept: this reads the structure and throws the rest away, so what
 * gets stored and rendered is a shape, not a payload.
 */

export interface N8nNodeSummary {
  name: string;
  type: string;
  label: string;
  isTrigger: boolean;
  disabled: boolean;
}

export interface N8nWorkflowSummary {
  name: string;
  nodeCount: number;
  connectionCount: number;
  triggers: string[];
  nodes: N8nNodeSummary[];
  /** Distinct integrations, derived from node types. */
  integrations: string[];
  hasErrorHandling: boolean;
  notes: string[];
}

/** `n8n-nodes-base.httpRequest` -> `HTTP Request`. */
export function friendlyNodeName(type: string): string {
  const last = String(type).split(".").pop() || String(type);
  const spaced = last
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  const titled = spaced.charAt(0).toUpperCase() + spaced.slice(1);
  return titled
    .replace(/\bHttp\b/g, "HTTP")
    .replace(/\bApi\b/g, "API")
    .replace(/\bAi\b/g, "AI")
    .replace(/\bUrl\b/g, "URL")
    .replace(/\bDb\b/g, "DB");
}

function isTriggerType(type: string): boolean {
  return /trigger|webhook|cron|interval|schedule/i.test(type);
}

const MAX_NODES = 200;

export function summariseWorkflow(raw: unknown): N8nWorkflowSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const wf = raw as Record<string, unknown>;

  // n8n exports either a single workflow or {workflows:[...]} from some tools.
  const source = Array.isArray(wf.workflows) && wf.workflows.length
    ? (wf.workflows[0] as Record<string, unknown>)
    : wf;

  const rawNodes = source.nodes;
  if (!Array.isArray(rawNodes)) return null;

  const nodes: N8nNodeSummary[] = rawNodes.slice(0, MAX_NODES).map((n) => {
    const node = (n && typeof n === "object" ? n : {}) as Record<string, unknown>;
    const type = typeof node.type === "string" ? node.type : "unknown";
    return {
      name: typeof node.name === "string" ? node.name.slice(0, 80) : "Unnamed",
      type: type.slice(0, 120),
      label: friendlyNodeName(type),
      isTrigger: isTriggerType(type),
      disabled: node.disabled === true,
    };
  });

  const connections = source.connections;
  let connectionCount = 0;
  if (connections && typeof connections === "object") {
    for (const outputs of Object.values(connections as Record<string, unknown>)) {
      if (!outputs || typeof outputs !== "object") continue;
      for (const branches of Object.values(outputs as Record<string, unknown>)) {
        if (!Array.isArray(branches)) continue;
        for (const branch of branches) if (Array.isArray(branch)) connectionCount += branch.length;
      }
    }
  }

  const settings = (source.settings && typeof source.settings === "object"
    ? source.settings
    : {}) as Record<string, unknown>;

  const hasErrorHandling =
    Boolean(settings.errorWorkflow) ||
    nodes.some((n) => /errorTrigger|stopAndError/i.test(n.type)) ||
    rawNodes.some((n) => {
      const node = (n && typeof n === "object" ? n : {}) as Record<string, unknown>;
      return node.onError !== undefined || node.continueOnFail === true || node.retryOnFail === true;
    });

  const integrations = [...new Set(
    nodes
      .filter((n) => !n.isTrigger && !/^n8n-nodes-base\.(set|if|switch|merge|code|function|noOp|stickyNote|splitInBatches|itemLists|filter)$/i.test(n.type))
      .map((n) => n.label),
  )].slice(0, 20);

  const notes: string[] = [];
  if (rawNodes.length > MAX_NODES) notes.push(`Only the first ${MAX_NODES} of ${rawNodes.length} nodes are listed.`);
  if (!hasErrorHandling) notes.push("No error handling detected in this export.");

  return {
    name: typeof source.name === "string" ? source.name.slice(0, 120) : "Untitled workflow",
    nodeCount: rawNodes.length,
    connectionCount,
    triggers: [...new Set(nodes.filter((n) => n.isTrigger).map((n) => n.label))],
    nodes,
    integrations,
    hasErrorHandling,
    notes,
  };
}

export function isImage(contentType: string): boolean {
  return /^image\/(png|jpe?g|webp|gif|svg\+xml)$/i.test(contentType);
}

export function looksLikeJson(name: string, contentType: string): boolean {
  return /json/i.test(contentType) || /\.json$/i.test(name);
}
