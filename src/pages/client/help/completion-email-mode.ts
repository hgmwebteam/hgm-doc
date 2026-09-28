import { completionEmailMode } from "@/pages/client/help/request-rules";

/**
 * The completion email switch as the browser sees it: VITE_TICKET_COMPLETION_EMAIL on
 * docs-hgm, inlined by Vite at build (so a change needs a redeploy). Unset or "off" until the
 * platform can actually send; "staff" for the owner's own test; "on" for everyone. It decides
 * whether the Completion email field, its helper, the success card's sentence, the request
 * page's line and the guides' sentence exist at all, so nobody is promised an email that
 * cannot be sent. The functions read the same variable at call time (ticket-columns.mts).
 *
 * A module of its own because request-rules.ts is also bundled into the functions, where
 * import.meta.env does not exist.
 */
export const COMPLETION_EMAIL_MODE = completionEmailMode(import.meta.env.VITE_TICKET_COMPLETION_EMAIL as string | undefined);
