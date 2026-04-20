/**
 * Quotation numbering (FSD v1.3 §3.2.7 + ADR-0007).
 * Format: `SAINS {dept}/{section}/{agentPrefix} Vol.{volume} ({running}{revision})`
 * Example: `SAINS 8-40/011/RYNC Vol.1 (140b)`
 *
 * Race safety: Postgres `SELECT ... FOR UPDATE` inside an explicit transaction. Running
 * number caps at 200 per volume; revisions use alphabetic suffix that overflows a→b→…z→aa.
 */
import { db, schema } from "@/db";
import { sql, eq } from "drizzle-orm";

export const RUNNING_NUMBER_CAP = 200;

export function nextRevisionLetter(current: string): string {
  if (!current) return "a";
  const chars = Array.from(current);
  for (let i = chars.length - 1; i >= 0; i--) {
    if (chars[i]! < "z") { chars[i] = String.fromCharCode(chars[i]!.charCodeAt(0) + 1); return chars.join(""); }
    chars[i] = "a";
  }
  return "a".repeat(chars.length + 1);
}

export function render(deptCode: string, sectionCode: string, agentPrefix: string,
                      volume: number, running: number, revisionLetter: string): string {
  return `SAINS ${deptCode}/${sectionCode}/${agentPrefix} Vol.${volume} (${running}${revisionLetter})`;
}

export interface AgentInfo {
  userId: string;
  staffPrefix: string;
  departmentCode: string;
  sectionCode: string;
}

/**
 * Allocates the next quotation number for a given agent. Transactional, serializable.
 * If the current volume's counter would exceed 200, rolls over to a new volume.
 */
export async function nextForAgent(agent: AgentInfo): Promise<{ quotationNo: string; volume: number; running: number; revisionLetter: string }> {
  return await db.transaction(async (tx) => {
    // Ensure sequence row exists
    await tx.execute(sql`
      INSERT INTO crm.quotation_sequences (agent_user_id, current_volume, next_running_no)
      VALUES (${agent.userId}::uuid, 1, 1)
      ON CONFLICT (agent_user_id) DO NOTHING
    `);

    // Lock the row
    const rows = await tx.execute(sql`
      SELECT current_volume, next_running_no
      FROM crm.quotation_sequences
      WHERE agent_user_id = ${agent.userId}::uuid
      FOR UPDATE
    `);
    const [row] = rows as unknown as Array<{ current_volume: number; next_running_no: number }>;
    if (!row) throw new Error("quotation_sequence row missing");

    let volume = row.current_volume;
    let running = row.next_running_no;
    if (running > RUNNING_NUMBER_CAP) { volume += 1; running = 1; }
    const nextRunning = running + 1;

    await tx.execute(sql`
      UPDATE crm.quotation_sequences
      SET current_volume = ${volume},
          next_running_no = ${nextRunning},
          updated_at = NOW()
      WHERE agent_user_id = ${agent.userId}::uuid
    `);

    return {
      quotationNo: render(agent.departmentCode, agent.sectionCode, agent.staffPrefix, volume, running, "a"),
      volume, running, revisionLetter: "a",
    };
  });
}
