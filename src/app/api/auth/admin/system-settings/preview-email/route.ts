import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import {
  renderTemplate,
  getCodeBlockHtml,
  DEFAULT_EMAIL_TEMPLATES,
} from "@/lib/auth/mail";
import { getSetting } from "@/lib/auth/settings";
import { getApiT } from "@/lib/i18n-api";

const previewSchema = z.object({
  verifySubject: z.string().max(500).optional(),
  verifyHtml: z.string().max(50000).optional(),
});

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;
  const t = await getApiT();

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = previewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const brandName = getSetting("brand_name") || "RabbitDocs";
    const sampleCode = "384726";
    const sampleVerifyUrl =
      "https://example.com/verify-email?token=sample-token";
    const codeBlockHtml = getCodeBlockHtml(sampleCode);

    const vars = {
      brandName,
      code: sampleCode,
      verifyUrl: sampleVerifyUrl,
      codeBlock: codeBlockHtml,
    };

    const subjectTpl =
      parsed.data.verifySubject ?? DEFAULT_EMAIL_TEMPLATES.verifySubject;
    const htmlTpl =
      parsed.data.verifyHtml ?? DEFAULT_EMAIL_TEMPLATES.verifyHtml;

    return NextResponse.json({
      preview: {
        subject: renderTemplate(subjectTpl, vars),
        html: renderTemplate(htmlTpl, vars),
      },
    });
  } catch (error) {
    console.error("[auth] preview-email error:", error);
    return NextResponse.json(
      { error: t('api.internalError') },
      { status: 500 }
    );
  }
}
