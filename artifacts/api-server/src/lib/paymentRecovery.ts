import { logger } from "./logger";
import { processDuePaymentBookings } from "../routes/bookings";

let timer: NodeJS.Timeout | undefined;

/** Recovers a payment completion, supplier fulfillment, or refund after a client or process interruption. */
export function startPaymentRecoveryProcessor(): void {
  const run = () => processDuePaymentBookings().catch((err) => logger.error({ err }, "Payment recovery cycle failed"));
  run();
  timer = setInterval(run, 60_000);
  timer.unref();
}