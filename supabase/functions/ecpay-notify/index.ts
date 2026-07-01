// 速來得網購團購網 - 綠界 ECPay 付款結果通知 (Server 對 Server Webhook)
// 綠界會直接 POST 到這個網址，驗證 CheckMacValue 正確後更新訂單付款狀態。
// 這裡刻意不驗證 Supabase JWT（verify_jwt=false），改用 CheckMacValue 做來源驗證。
import { createHash } from "node:crypto";

const ECPAY_HASH_KEY = "pwFHCqoQZGmho4w6";
const ECPAY_HASH_IV = "EkRm7iFT261dpevs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function dotNetUrlEncode(str: string): string {
  return encodeURIComponent(str)
    .toLowerCase()
    .replace(/%20/g, "+")
    .replace(/%2d/g, "-")
    .replace(/%5f/g, "_")
    .replace(/%2e/g, ".")
    .replace(/%21/g, "!")
    .replace(/%2a/g, "*")
    .replace(/%28/g, "(")
    .replace(/%29/g, ")");
}

function generateCheckMacValue(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  let raw = `HashKey=${ECPAY_HASH_KEY}`;
  for (const key of sortedKeys) raw += `&${key}=${params[key]}`;
  raw += `&HashIV=${ECPAY_HASH_IV}`;
  const encoded = dotNetUrlEncode(raw);
  return createHash("md5").update(encoded, "utf8").digest("hex").toUpperCase();
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("0|MethodNotAllowed", { headers: { "Content-Type": "text/plain" } });
  }

  const bodyText = await req.text();
  const formParams = new URLSearchParams(bodyText);
  const data: Record<string, string> = {};
  for (const [key, value] of formParams.entries()) {
    if (key !== "CheckMacValue") data[key] = value;
  }
  const receivedMac = formParams.get("CheckMacValue") || "";
  const computedMac = generateCheckMacValue(data);

  if (computedMac !== receivedMac) {
    return new Response("0|CheckMacValueError", { headers: { "Content-Type": "text/plain" } });
  }

  const rtnCode = data["RtnCode"];
  const merchantTradeNo = data["MerchantTradeNo"];
  const paymentStatus = rtnCode === "1" ? "付款成功" : "付款失敗";

  await fetch(`${SUPABASE_URL}/rest/v1/frozen_orders?merchant_trade_no=eq.${merchantTradeNo}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      payment_status: paymentStatus,
      payment_method: data["PaymentType"] || null,
      paid_at: rtnCode === "1" ? new Date().toISOString() : null,
      ecpay_rtn_msg: data["RtnMsg"] || null,
    }),
  });

  return new Response("1|OK", { headers: { "Content-Type": "text/plain" } });
});
