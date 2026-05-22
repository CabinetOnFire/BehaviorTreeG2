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
export const BT_PARALLEL_FAILURE_ONE = "BT_PARALLEL_FAILURE_ONE";
export const BT_PARALLEL_FAILURE_ALL = "BT_PARALLEL_FAILURE_ALL";

export const BT_PARALLEL_FAILURE_POLICIES = [
  BT_PARALLEL_FAILURE_ONE,
  BT_PARALLEL_FAILURE_ALL,
] as const;

// ---------------------------------------------------------------------------
// BT_PARALLEL — success policy (second argument)
// ---------------------------------------------------------------------------
export const BT_PARALLEL_SUCCESS_ALL = "BT_PARALLEL_SUCCESS_ALL";
export const BT_PARALLEL_SUCCESS_ONE = "BT_PARALLEL_SUCCESS_ONE";

export const BT_PARALLEL_SUCCESS_POLICIES = [
  BT_PARALLEL_SUCCESS_ALL,
  BT_PARALLEL_SUCCESS_ONE,
] as const;

// ---------------------------------------------------------------------------
// BT_DECORATOR / observer_abort — abort policy values
// ---------------------------------------------------------------------------
export const BT_ABORT_NONE = "BT_ABORT_NONE";
export const BT_ABORT_SELF = "BT_ABORT_SELF";
export const BT_ABORT_LOWER = "BT_ABORT_LOWER";
export const BT_ABORT_BOTH = "BT_ABORT_BOTH";

export const BT_ABORT_POLICIES = [
  BT_ABORT_NONE,
  BT_ABORT_SELF,
  BT_ABORT_LOWER,
  BT_ABORT_BOTH,
] as const;

// ---------------------------------------------------------------------------
// Human-readable labels — edit these freely, they only affect the UI dropdowns
// ---------------------------------------------------------------------------
export const BT_LABELS: Record<string, string> = {
  [BT_PARALLEL_FAILURE_ONE]: "Fail if at least one child fails",
  [BT_PARALLEL_FAILURE_ALL]: "Fail if all children fail",
  [BT_PARALLEL_SUCCESS_ALL]: "Succeed if all children succeed",
  [BT_PARALLEL_SUCCESS_ONE]: "Succeed if at least one child succeeds",
  [BT_ABORT_NONE]: "Do not abort on condition change",
  [BT_ABORT_SELF]: "Abort self on condition change",
  [BT_ABORT_LOWER]: "Abort lower priority branches on condition change",
  [BT_ABORT_BOTH]: "Abort both self and lower priority branches on condition change",
};
