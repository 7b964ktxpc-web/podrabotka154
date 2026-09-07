import { createHmac, timingSafeEqual } from "node:crypto";
export function sign(body: string, timestamp: string, secret: string): string { return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex"); }
export function verifySignature(body: string, timestamp: string, signature: string, secret: string, now = Date.now()): boolean {
    if (!secret || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300 || !/^[a-f0-9]{64}$/i.test(signature))
        return false;
    return timingSafeEqual(Buffer.from(sign(body, timestamp, secret), "hex"), Buffer.from(signature, "hex"));
}
