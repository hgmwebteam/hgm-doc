import { completionEmailMode } from "@/pages/client/help/request-rules";

/**
 * The completion email switch as the browser sees it: VITE_TICKET_COMPLETION_EMAIL on
 * docs-hgm, inlined by Vite at build (so a change needs a redeploy). "off" (or unset): no field;
 * "staff": the field for staff only; "on": for everyone. Wherever the field is shown it is
 * required. It decides whether the Completion email field, its helper, the success card's row,
 * the request page's line and the guides' sentence exist at all. The owner turns it on before
 * the platform can send (28 Sep 2026), so each of those says where the completion notice goes
 * and never that one was sent. The functions read the same variable at call time
 * (ticket-columns.mts).
 *
 * A module of its own because request-rules.ts is also bundled into the functions, where
 * import.meta.env does not exist.
 */
export const COMPLETION_EMAIL_MODE = completionEmailMode(import.meta.env.VITE_TICKET_COMPLETION_EMAIL as string | undefined);
