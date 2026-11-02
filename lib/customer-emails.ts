import { getErrorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

export type CustomerEmail = {
  customer_code: string;
  email: string;
  updated_at: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export async function listCustomerEmails(): Promise<CustomerEmail[]> {
  const { data, error } = await supabase
    .from("customer_emails")
    .select("customer_code, email, updated_at")
    .order("customer_code");

  if (error) {
    throw new Error(
      getErrorMessage(error, "고객 이메일을 불러오지 못했습니다."),
    );
  }
  return data ?? [];
}

export async function upsertCustomerEmail(
  customerCode: string,
  email: string,
): Promise<CustomerEmail> {
  const code = customerCode.trim();
  const addr = email.trim();
  if (!code) throw new Error("고객 코드가 필요합니다.");
  if (!isValidEmail(addr)) throw new Error("올바른 이메일 주소를 입력하세요.");

  const { data, error } = await supabase
    .from("customer_emails")
    .upsert(
      {
        customer_code: code,
        email: addr,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "customer_code" },
    )
    .select("customer_code, email, updated_at")
    .single();

  if (error) {
    throw new Error(getErrorMessage(error, "이메일 저장에 실패했습니다."));
  }
  return data;
}

export async function deleteCustomerEmail(customerCode: string): Promise<void> {
  const { error } = await supabase
    .from("customer_emails")
    .delete()
    .eq("customer_code", customerCode);

  if (error) {
    throw new Error(getErrorMessage(error, "이메일 삭제에 실패했습니다."));
  }
}

/** Map customer_code → email for quick lookup. */
export function toEmailMap(
  rows: CustomerEmail[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.customer_code] = row.email;
  }
  return map;
}
