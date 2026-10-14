import { flag, type ConfigOf } from "./flags.ts";

// Every flag the app reads: its type and the value it uses when the row is missing or has
// another type. Safe defaults: new things off.
export const FLAGS = {
  new_checkout: flag("boolean", false),
  max_items: flag("integer", 3),
  discount: flag("number", 0),
  banner_text: flag("string", ""),
  promo_code: flag("string", ""),
  theme: flag("json", { accent: "#111827", rounded: false }),
};

export type Config = ConfigOf<typeof FLAGS>;
