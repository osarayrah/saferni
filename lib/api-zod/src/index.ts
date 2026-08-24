export * from "./generated/api";
export * from "./generated/types";
// Explicit re-export resolves the name collision between the generated zod
// schema (value) and the generated params type, both named GetBookingParams.
export { GetBookingParams } from "./generated/api";
export type { GetBookingParams as GetBookingParamsType } from "./generated/types";
