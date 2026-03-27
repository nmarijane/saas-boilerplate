const CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const CODE_LENGTH = 8;
const REFERRAL_BONUS = 5;

export function generateReferralCode(): string {
  let code = "";
  const array = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(array);
  for (const byte of array) {
    code += CHARS[byte % CHARS.length];
  }
  return code;
}

export function calculatePosition(rank: number, referralCount: number): number {
  return Math.max(1, rank - referralCount * REFERRAL_BONUS);
}
