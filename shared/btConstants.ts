/**
 * Canonical string values for BT_* macro arguments used in /TG/ behavior trees.
 *
 * The constant VALUES must match the DM macro names exactly — they are written
 * verbatim into the AST and serialized back into .dm files.  Do NOT change them.
 *
 * To change what the UI shows in dropdowns, edit BT_LABELS at the bottom.
 * Add new entries there freely; the key must be one of the const values above.
 */

// ---------------------------------------------------------------------------
// BT_PARALLEL — failure policy (first argument)
// ---------------------------------------------------------------------------
export const BT_PARALLEL_FAILURE_CHILD_ONE = "BT_PARALLEL_FAILURE_CHILD_ONE";
export const BT_PARALLEL_FAILURE_ANY = "BT_PARALLEL_FAILURE_ANY";

export const BT_PARALLEL_FAILURE_POLICIES = [
  BT_PARALLEL_FAILURE_CHILD_ONE,
  BT_PARALLEL_FAILURE_ANY,
] as const;

// ---------------------------------------------------------------------------
// BT_PARALLEL — success policy (second argument)
// ---------------------------------------------------------------------------
export const BT_PARALLEL_SUCCESS_CHILD_ONE = "BT_PARALLEL_SUCCESS_CHILD_ONE";
export const BT_PARALLEL_SUCCESS_ALL = "BT_PARALLEL_SUCCESS_ALL";

export const BT_PARALLEL_SUCCESS_POLICIES = [
  BT_PARALLEL_SUCCESS_CHILD_ONE,
  BT_PARALLEL_SUCCESS_ALL,
] as const;

// ---------------------------------------------------------------------------
// BT_SUBPLAN — success policy
// ---------------------------------------------------------------------------
export const BT_SUBPLAN_SUCCEED_ON_SUCCESS = "BT_SUBPLAN_SUCCEED_ON_SUCCESS";
export const BT_SUBPLAN_LOOP_ON_SUCCESS = "BT_SUBPLAN_LOOP_ON_SUCCESS";

export const BT_SUBPLAN_SUCCESS_POLICIES = [
  BT_SUBPLAN_SUCCEED_ON_SUCCESS,
  BT_SUBPLAN_LOOP_ON_SUCCESS,
] as const;

// ---------------------------------------------------------------------------
// BT_SUBPLAN — failure policy
// ---------------------------------------------------------------------------
export const BT_SUBPLAN_FAIL_ON_FAILURE = "BT_SUBPLAN_FAIL_ON_FAILURE";
export const BT_SUBPLAN_LOOP_ON_FAILURE = "BT_SUBPLAN_LOOP_ON_FAILURE";

export const BT_SUBPLAN_FAILURE_POLICIES = [
  BT_SUBPLAN_FAIL_ON_FAILURE,
  BT_SUBPLAN_LOOP_ON_FAILURE,
] as const;

// ---------------------------------------------------------------------------
// BT_DECORATOR / observer_abort — abort policy values
// ---------------------------------------------------------------------------
export const BT_ABORT_NONE = "BT_ABORT_NONE";
export const BT_ABORT_SELF = "BT_ABORT_SELF";
export const BT_ABORT_LOWER_PRIORITY = "BT_ABORT_LOWER_PRIORITY";
export const BT_ABORT_BOTH = "BT_ABORT_BOTH";

export const BT_ABORT_POLICIES = [
  BT_ABORT_NONE,
  BT_ABORT_SELF,
  BT_ABORT_LOWER_PRIORITY,
  BT_ABORT_BOTH,
] as const;

// ---------------------------------------------------------------------------
// Human-readable labels — because fuck reading defines lol
// ---------------------------------------------------------------------------
export const BT_LABELS: Record<string, string> = {
  [BT_PARALLEL_FAILURE_CHILD_ONE]: "Fail when child 1 fails",
  [BT_PARALLEL_FAILURE_ANY]: "Fail when any child fails",
  [BT_PARALLEL_SUCCESS_CHILD_ONE]: "Succeed when child 1 succeeds",
  [BT_PARALLEL_SUCCESS_ALL]: "Succeed when all children succeed",
  [BT_SUBPLAN_SUCCEED_ON_SUCCESS]: "Succeed on success",
  [BT_SUBPLAN_LOOP_ON_SUCCESS]: "Loop on success",
  [BT_SUBPLAN_FAIL_ON_FAILURE]: "Fail on failure",
  [BT_SUBPLAN_LOOP_ON_FAILURE]: "Loop on failure",
  [BT_ABORT_NONE]: "Do not abort on condition change",
  [BT_ABORT_SELF]: "Abort self on condition change",
  [BT_ABORT_LOWER_PRIORITY]: "Abort lower priority branches on condition change",
  [BT_ABORT_BOTH]: "Abort both self and lower priority branches on condition change",
};
