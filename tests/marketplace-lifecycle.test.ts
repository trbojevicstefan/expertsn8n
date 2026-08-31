import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateInviteResponse,
  evaluateProposalLifecycle,
  privateJobInviteAccess,
} from "../src/lib/marketplace-policy.ts";

test("expert can withdraw only their actionable proposal", () => {
  assert.deepEqual(
    evaluateProposalLifecycle({
      action: "withdraw",
      viewerUid: "expert-1",
      viewerAdmin: false,
      expertUid: "expert-1",
      clientId: "client-1",
      status: "SHORTLISTED",
    }),
    { ok: true },
  );
  assert.equal(
    evaluateProposalLifecycle({
      action: "withdraw",
      viewerUid: "expert-2",
      viewerAdmin: false,
      expertUid: "expert-1",
      clientId: "client-1",
      status: "SUBMITTED",
    }).ok,
    false,
  );
  assert.equal(
    evaluateProposalLifecycle({
      action: "withdraw",
      viewerUid: "expert-1",
      viewerAdmin: false,
      expertUid: "expert-1",
      clientId: "client-1",
      status: "ACCEPTED",
    }).ok,
    false,
  );
});

test("owning client can shortlist submitted and decline actionable proposals", () => {
  assert.deepEqual(
    evaluateProposalLifecycle({
      action: "shortlist",
      viewerUid: "client-1",
      viewerAdmin: false,
      expertUid: "expert-1",
      clientId: "client-1",
      status: "SUBMITTED",
    }),
    { ok: true },
  );
  assert.deepEqual(
    evaluateProposalLifecycle({
      action: "decline",
      viewerUid: "client-1",
      viewerAdmin: false,
      expertUid: "expert-1",
      clientId: "client-1",
      status: "SHORTLISTED",
    }),
    { ok: true },
  );
  assert.equal(
    evaluateProposalLifecycle({
      action: "shortlist",
      viewerUid: "client-2",
      viewerAdmin: false,
      expertUid: "expert-1",
      clientId: "client-1",
      status: "SUBMITTED",
    }).ok,
    false,
  );
});

test("invite response requires ownership, live SENT invite and open job", () => {
  const base = {
    action: "accept" as const,
    viewerUid: "expert-1",
    expertUid: "expert-1",
    status: "SENT",
    expiresAt: "2030-01-01T00:00:00.000Z",
    jobStatus: "OPEN",
    nowMs: Date.parse("2026-08-31T00:00:00.000Z"),
  };
  assert.deepEqual(evaluateInviteResponse(base), { ok: true });
  assert.equal(evaluateInviteResponse({ ...base, viewerUid: "expert-2" }).ok, false);
  assert.equal(evaluateInviteResponse({ ...base, jobStatus: "CLOSED" }).ok, false);
  assert.equal(evaluateInviteResponse({ ...base, expiresAt: "2026-01-01T00:00:00.000Z" }).ok, false);
});

test("private job SENT invites can view but only ACCEPTED invites can apply", () => {
  const base = {
    expiresAt: "2030-01-01T00:00:00.000Z",
    jobStatus: "OPEN",
    nowMs: Date.parse("2026-08-31T00:00:00.000Z"),
  };
  assert.deepEqual(privateJobInviteAccess({ ...base, inviteStatus: "SENT" }), { canView: true, canApply: false });
  assert.deepEqual(privateJobInviteAccess({ ...base, inviteStatus: "ACCEPTED" }), { canView: true, canApply: true });
  assert.deepEqual(privateJobInviteAccess({ ...base, inviteStatus: "DECLINED" }), { canView: false, canApply: false });
  assert.deepEqual(privateJobInviteAccess({ ...base, inviteStatus: "ACCEPTED", jobStatus: "CLOSED" }), { canView: false, canApply: false });
});
