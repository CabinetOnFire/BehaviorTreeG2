import {
  BT_PARALLEL_FAILURE_POLICIES,
  BT_PARALLEL_SUCCESS_POLICIES,
  BT_PARALLEL_FAILURE_CHILD_ONE,
  BT_PARALLEL_SUCCESS_CHILD_ONE,
  BT_SUBPLAN_SUCCESS_POLICIES,
  BT_SUBPLAN_FAILURE_POLICIES,
  BT_SUBPLAN_SUCCEED_ON_SUCCESS,
  BT_SUBPLAN_FAIL_ON_FAILURE,
} from "./btConstants";

/**
 * Describes a single configurable property on a composite BT node.
 *
 * - `key`     : camelCase field name used in the BtNode AST and UI state
 * - `jsonKey` : snake_case key written to / read from .bt.json files
 * - `label`   : display label shown in the config panel and canvas tooltip
 */
export type PropSchema =
  | {
      type: "enum";
      key: string;
      jsonKey: string;
      label: string;
      values: readonly string[];
      default: string;
    }
  | {
      type: "boolean";
      key: string;
      jsonKey: string;
      label: string;
      default: boolean;
    }
  | {
      type: "text";
      key: string;
      jsonKey: string;
      label: string;
      optional: true;
      placeholder?: string;
    };

/**
 * Canonical property schemas for each composite node kind.
 * To add a new configurable property, add one entry here —
 * the config panel, canvas display, parser, and serializer all
 * derive their behaviour from this table.
 */
export const COMPOSITE_SCHEMAS: Record<string, PropSchema[]> = {
  parallel: [
    {
      type: "enum",
      key: "failurePolicy",
      jsonKey: "failure_policy",
      label: "Failure Policy",
      values: BT_PARALLEL_FAILURE_POLICIES,
      default: BT_PARALLEL_FAILURE_CHILD_ONE,
    },
    {
      type: "enum",
      key: "successPolicy",
      jsonKey: "success_policy",
      label: "Success Policy",
      values: BT_PARALLEL_SUCCESS_POLICIES,
      default: BT_PARALLEL_SUCCESS_CHILD_ONE,
    },
    {
      type: "boolean",
      key: "repeatSecondary",
      jsonKey: "repeat_secondary",
      label: "Repeat Secondary",
      default: false,
    },
    {
      type: "text",
      key: "repeatSecondaryDelay",
      jsonKey: "repeat_secondary_delay",
      label: "Repeat Secondary Delay",
      optional: true,
      placeholder: "default",
    },
    {
      type: "boolean",
      key: "finishOnPrimary",
      jsonKey: "finish_on_primary",
      label: "Finish on Primary",
      default: true,
    },
  ],

  subplan: [
    {
      type: "enum",
      key: "successPolicy",
      jsonKey: "success_policy",
      label: "Success Policy",
      values: BT_SUBPLAN_SUCCESS_POLICIES,
      default: BT_SUBPLAN_SUCCEED_ON_SUCCESS,
    },
    {
      type: "enum",
      key: "failurePolicy",
      jsonKey: "failure_policy",
      label: "Failure Policy",
      values: BT_SUBPLAN_FAILURE_POLICIES,
      default: BT_SUBPLAN_FAIL_ON_FAILURE,
    },
    {
      type: "text",
      key: "loopDelay",
      jsonKey: "loop_delay",
      label: "Loop Delay",
      optional: true,
      placeholder: "default",
    },
  ],
};
