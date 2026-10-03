import { OriginSchema, type Origin } from '@actable/core';

export function parseOrigin(raw: string): Origin {
  const parsed = OriginSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`Invalid --as "${raw}": use user, system or agent:<id>`);
  return parsed.data;
}
