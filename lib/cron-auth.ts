export type CronAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503 };

export function authorizeCronRequest(
  request: Request,
  cronSecret: string | undefined,
): CronAuthResult {
  if (!cronSecret) return { ok: false, status: 503 };
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return { ok: false, status: 401 };
  }
  return { ok: true };
}
