"use client";

import { AlertTriangle, FileJson, FileText, ShieldCheck, Trash2, Workflow } from "lucide-react";
import type { ShowcaseAttachment } from "@/lib/types";

const fileUrl = (path: string) => `/api/files?path=${encodeURIComponent(path)}`;
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

function WorkflowPreview({ a }: { a: ShowcaseAttachment }) {
  const wf = a.workflow;
  if (!wf) {
    return (
      <div className="wf-preview wf-preview-error">
        <AlertTriangle size={15} strokeWidth={2.2} />
        <span>{a.parseError || "Could not read this as an n8n workflow."}</span>
      </div>
    );
  }

  return (
    <div className="wf-preview">
      <div className="wf-head">
        <Workflow size={16} strokeWidth={2.2} />
        <strong>{wf.name}</strong>
        <a href={fileUrl(a.storagePath)} target="_blank" rel="noopener noreferrer">Open JSON</a>
      </div>

      <div className="wf-stats">
        <div><strong>{wf.nodeCount}</strong><span>nodes</span></div>
        <div><strong>{wf.connectionCount}</strong><span>connections</span></div>
        <div><strong>{wf.triggers.length || "—"}</strong><span>triggers</span></div>
        <div className={wf.hasErrorHandling ? "wf-ok" : "wf-warn"}>
          <strong>{wf.hasErrorHandling ? "Yes" : "No"}</strong><span>error handling</span>
        </div>
      </div>

      {wf.triggers.length > 0 && (
        <p className="wf-line"><span>Triggered by</span> {wf.triggers.join(", ")}</p>
      )}
      {wf.integrations.length > 0 && (
        <div className="chip-row wf-chips">
          {wf.integrations.map((i) => <span className="chip" key={i}>{i}</span>)}
        </div>
      )}

      <details className="wf-nodes">
        <summary>All {wf.nodes.length} nodes</summary>
        <ol>
          {wf.nodes.map((n, i) => (
            <li key={`${n.name}-${i}`} className={n.disabled ? "is-disabled" : ""}>
              <span className="wf-node-name">{n.name}</span>
              <span className="wf-node-type">{n.label}</span>
              {n.isTrigger && <span className="wf-tag">trigger</span>}
              {n.disabled && <span className="wf-tag wf-tag-off">disabled</span>}
            </li>
          ))}
        </ol>
      </details>

      {wf.notes.length > 0 && <p className="wf-note">{wf.notes.join(" ")}</p>}

      <p className="wf-privacy">
        <ShieldCheck size={12} strokeWidth={2.2} />
        Structure only. Parameter values and credentials from the export are not stored or shown.
      </p>
    </div>
  );
}

export function ShowcaseAttachments({
  attachments,
  onRemove,
  busyId,
}: {
  attachments: ShowcaseAttachment[];
  onRemove?: (attachmentId: string) => void;
  busyId?: string;
}) {
  if (!attachments.length) return null;

  const images = attachments.filter((a) => a.kind === "image");
  const workflows = attachments.filter((a) => a.kind === "workflow");
  const others = attachments.filter((a) => a.kind !== "image" && a.kind !== "workflow");

  return (
    <div className="att-groups">
      {images.length > 0 && (
        <div className="att-gallery">
          {images.map((a) => (
            <figure key={a.id}>
              <a href={fileUrl(a.storagePath)} target="_blank" rel="noopener noreferrer">
                <img src={fileUrl(a.storagePath)} alt={a.name} loading="lazy" />
              </a>
              <figcaption>
                <span title={a.name}>{a.name}</span>
                {onRemove && (
                  <button type="button" onClick={() => onRemove(a.id)} disabled={busyId === `att-${a.id}`} aria-label={`Remove ${a.name}`}>
                    <Trash2 size={12} strokeWidth={2.2} />
                  </button>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {workflows.map((a) => (
        <div className="att-workflow" key={a.id}>
          <WorkflowPreview a={a} />
          {onRemove && (
            <button
              type="button"
              className="att-workflow-remove"
              onClick={() => onRemove(a.id)}
              disabled={busyId === `att-${a.id}`}
              aria-label={`Remove ${a.name}`}
            >
              <Trash2 size={13} strokeWidth={2.2} />
            </button>
          )}
        </div>
      ))}

      {others.length > 0 && (
        <ul className="attach-list">
          {others.map((a) => (
            <li key={a.id}>
              {a.kind === "workflow" ? <FileJson size={14} strokeWidth={2} /> : <FileText size={14} strokeWidth={2} />}
              <a href={fileUrl(a.storagePath)} target="_blank" rel="noopener noreferrer">{a.name}</a>
              <span>{mb(a.sizeBytes)}</span>
              {onRemove && (
                <button type="button" onClick={() => onRemove(a.id)} disabled={busyId === `att-${a.id}`} aria-label={`Remove ${a.name}`}>
                  <Trash2 size={12} strokeWidth={2.2} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
