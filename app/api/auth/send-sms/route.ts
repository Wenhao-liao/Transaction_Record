import crypto from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TENCENT_SMS_HOST = "sms.tencentcloudapi.com";
const TENCENT_SMS_SERVICE = "sms";
const TENCENT_SMS_VERSION = "2021-01-11";
const TENCENT_SMS_ACTION = "SendSms";
const MAX_WEBHOOK_AGE_SECONDS = 5 * 60;

type SupabaseSmsHookPayload = {
  phone?: string;
  token?: string;
  otp?: string;
  user?: {
    phone?: string;
  };
  sms?: {
    otp?: string;
    token?: string;
  };
};

type TencentSmsResponse = {
  Response?: {
    Error?: {
      Code?: string;
      Message?: string;
    };
    SendStatusSet?: Array<{
      Code?: string;
      Message?: string;
    }>;
  };
};

function sha256(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: crypto.BinaryLike | crypto.KeyObject, value: string) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest();
}

function hmacHex(key: crypto.BinaryLike | crypto.KeyObject, value: string) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest("hex");
}

function getUtcDate(timestamp: number) {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} 尚未配置`);
  }

  return value;
}

function normalizeWebhookSecret(secret: string) {
  const normalized = secret.trim().replace(/^v\d+,/, "").replace(/^whsec_/, "");

  try {
    return Buffer.from(normalized, "base64");
  } catch {
    return Buffer.from(secret, "utf8");
  }
}

function parseWebhookSignatures(headerValue: string) {
  return headerValue
    .split(" ")
    .flatMap((part) => part.split(","))
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^v\d+$/.test(part));
}

function safeEqualBase64(signature: string, expected: string) {
  try {
    const signatureBytes = Buffer.from(signature, "base64");
    const expectedBytes = Buffer.from(expected, "base64");

    return signatureBytes.length === expectedBytes.length && crypto.timingSafeEqual(signatureBytes, expectedBytes);
  } catch {
    return false;
  }
}

function verifySupabaseWebhook(request: Request, rawBody: string) {
  const hookSecret = process.env.SUPABASE_AUTH_HOOK_SECRET?.trim();
  const bearerToken = process.env.SMS_HOOK_BEARER_TOKEN?.trim();

  if (hookSecret) {
    const webhookId = request.headers.get("webhook-id");
    const webhookTimestamp = request.headers.get("webhook-timestamp");
    const webhookSignature = request.headers.get("webhook-signature");

    if (!webhookId || !webhookTimestamp || !webhookSignature) {
      return false;
    }

    const timestamp = Number(webhookTimestamp);
    const now = Math.floor(Date.now() / 1000);

    if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > MAX_WEBHOOK_AGE_SECONDS) {
      return false;
    }

    const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac("sha256", normalizeWebhookSecret(hookSecret))
      .update(signedContent, "utf8")
      .digest("base64");

    return parseWebhookSignatures(webhookSignature).some((signature) => safeEqualBase64(signature, expectedSignature));
  }

  if (bearerToken) {
    return request.headers.get("authorization") === `Bearer ${bearerToken}`;
  }

  throw new Error("短信 Hook 安全密钥未配置");
}

function getSmsPayload(payload: SupabaseSmsHookPayload) {
  return {
    phone: payload.user?.phone || payload.phone,
    otp: payload.sms?.otp || payload.sms?.token || payload.otp || payload.token
  };
}

async function sendTencentSms(phone: string, otp: string) {
  const secretId = getRequiredEnv("TENCENTCLOUD_SECRET_ID");
  const secretKey = getRequiredEnv("TENCENTCLOUD_SECRET_KEY");
  const smsSdkAppId = getRequiredEnv("TENCENT_SMS_SDK_APP_ID");
  const signName = getRequiredEnv("TENCENT_SMS_SIGN_NAME");
  const templateId = getRequiredEnv("TENCENT_SMS_TEMPLATE_ID");
  const region = process.env.TENCENT_SMS_REGION?.trim() || "ap-guangzhou";
  const timestamp = Math.floor(Date.now() / 1000);
  const date = getUtcDate(timestamp);
  const requestBody = JSON.stringify({
    PhoneNumberSet: [phone],
    SmsSdkAppId: smsSdkAppId,
    SignName: signName,
    TemplateId: templateId,
    TemplateParamSet: [otp]
  });
  const canonicalHeaders = [
    "content-type:application/json; charset=utf-8",
    `host:${TENCENT_SMS_HOST}`,
    "x-tc-action:sendsms"
  ].join("\n");
  const signedHeaders = "content-type;host;x-tc-action";
  const canonicalRequest = [
    "POST",
    "/",
    "",
    `${canonicalHeaders}\n`,
    signedHeaders,
    sha256(requestBody)
  ].join("\n");
  const credentialScope = `${date}/${TENCENT_SMS_SERVICE}/tc3_request`;
  const stringToSign = [
    "TC3-HMAC-SHA256",
    String(timestamp),
    credentialScope,
    sha256(canonicalRequest)
  ].join("\n");
  const secretDate = hmac(`TC3${secretKey}`, date);
  const secretService = hmac(secretDate, TENCENT_SMS_SERVICE);
  const secretSigning = hmac(secretService, "tc3_request");
  const signature = hmacHex(secretSigning, stringToSign);
  const authorization = [
    `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`
  ].join(", ");

  const response = await fetch(`https://${TENCENT_SMS_HOST}`, {
    body: requestBody,
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json; charset=utf-8",
      Host: TENCENT_SMS_HOST,
      "X-TC-Action": TENCENT_SMS_ACTION,
      "X-TC-Region": region,
      "X-TC-Timestamp": String(timestamp),
      "X-TC-Version": TENCENT_SMS_VERSION
    },
    method: "POST"
  });

  const data = (await response.json()) as TencentSmsResponse;
  const responseError = data.Response?.Error;

  if (!response.ok || responseError) {
    throw new Error(responseError?.Message || "腾讯云短信发送失败");
  }

  const sendStatus = data.Response?.SendStatusSet?.[0];

  if (sendStatus?.Code && sendStatus.Code !== "Ok") {
    throw new Error(sendStatus.Message || sendStatus.Code);
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    if (!verifySupabaseWebhook(request, rawBody)) {
      return NextResponse.json({ error: "短信 Hook 签名校验失败" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as SupabaseSmsHookPayload;
    const { phone, otp } = getSmsPayload(payload);

    if (!phone || !otp) {
      return NextResponse.json({ error: "短信 Hook 缺少手机号或验证码" }, { status: 400 });
    }

    await sendTencentSms(phone, otp);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "短信发送失败"
      },
      { status: 500 }
    );
  }
}
