import assert from "node:assert/strict";
import test from "node:test";
import { evaluateMilestoneAction, evaluateProposalAward } from "../src/lib/marketplace-policy.ts";

const awardBase = {
  viewerUid: "client-1",
  viewerAdmin: false,
  proposalClientId: "client-1",
  proposalStatus: "SUBMITTED",
  proposalJobId: "job-1",
  proposalPrice: 1500,
  jobClientId: "client-1",
  jobStatus: "OPEN",
};

test("proposal award allows the owning client on an open job", () => {
  assert.deepEqual(evaluateProposalAward(awardBase), { ok: true });
});

test("proposal award is idempotent after acceptance", () => {
  assert.deepEqual(evaluateProposalAward({ ...awardBase, proposalStatus: "ACCEPTED" }), {
    ok: true,
    idempotent: true,
  });
});

test("proposal award rejects the wrong client and already-filled jobs", () => {
  assert.deepEqual(evaluateProposalAward({ ...awardBase, viewerUid: "client-2" }), {
    ok: false,
    status: 403,
    message: "This proposal is not on your job.",
  });
  assert.deepEqual(evaluateProposalAward({ ...awardBase, jobStatus: "FILLED" }), {
    ok: false,
    status: 409,
    message: "This job already has an accepted proposal.",
  });
});

test("proposal award rejects terminal proposals and invalid money", () => {
  assert.equal(evaluateProposalAward({ ...awardBase, proposalStatus: "WITHDRAWN" }).ok, false);
  assert.equal(evaluateProposalAward({ ...awardBase, proposalPrice: 0 }).ok, false);
  assert.equal(evaluateProposalAward({ ...awardBase, proposalPrice: Number.NaN }).ok, false);
});

test("milestone funding is client-only and state-gated", () => {
  assert.deepEqual(
    evaluateMilestoneAction({
      action: "fund",
      milestoneStatus: "AWAITING_FUNDING",
      isClient: true,
      isExpert: false,
      isAdmin: false,
    }),
    { ok: true },
  );

  assert.deepEqual(
    evaluateMilestoneAction({
      action: "fund",
      milestoneStatus: "AWAITING_FUNDING",
      isClient: false,
      isExpert: true,
      isAdmin: false,
    }),
    { ok: false, status: 403, message: "Only the client funds a milestone." },
  );
});

test("milestone submission is expert-only and requires funded work", () => {
  assert.equal(
    evaluateMilestoneAction({
      action: "submit",
      milestoneStatus: "FUNDED",
      isClient: false,
      isExpert: true,
      isAdmin: false,
    }).ok,
    true,
  );

  assert.deepEqual(
    evaluateMilestoneAction({
      action: "submit",
      milestoneStatus: "DRAFT",
      isClient: false,
      isExpert: true,
      isAdmin: false,
    }),
    { ok: false, status: 409, message: "This milestone is not funded yet." },
  );
});

test("milestone release is client-only and requires a submission", () => {
  assert.equal(
    evaluateMilestoneAction({
      action: "release",
      milestoneStatus: "SUBMITTED",
      isClient: true,
      isExpert: false,
      isAdmin: false,
    }).ok,
    true,
  );

  assert.deepEqual(
    evaluateMilestoneAction({
      action: "release",
      milestoneStatus: "FUNDED",
      isClient: true,
      isExpert: false,
      isAdmin: false,
    }),
    { ok: false, status: 409, message: "Nothing has been submitted for this milestone." },
  );
});

test("outsiders cannot perform any contract milestone action", () => {
  assert.deepEqual(
    evaluateMilestoneAction({
      action: "submit",
      milestoneStatus: "FUNDED",
      isClient: false,
      isExpert: false,
      isAdmin: false,
    }),
    { ok: false, status: 403, message: "This contract is not yours." },
  );
});
