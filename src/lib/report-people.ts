/** Display helpers for inspector / approver / reviewer lines on reports. */

export type ReportPerson = {
  name: string;
  registrationNumber?: string | null;
  level2Qualified?: boolean;
  level1Qualified?: boolean;
};

export function formatPersonCredential(person: ReportPerson): string {
  const bits: string[] = [person.name];
  if (person.registrationNumber?.trim()) {
    bits.push(`Reg. ${person.registrationNumber.trim()}`);
  }
  if (person.level2Qualified) bits.push("Level 2");
  else if (person.level1Qualified) bits.push("Level 1");
  return bits.join(" · ");
}

export function canApproveLevel2(user: {
  role: string;
  level2Qualified: boolean;
}): boolean {
  return user.role === "ADMIN" || Boolean(user.level2Qualified);
}
