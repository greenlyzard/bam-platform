import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { z } from "zod";

const schema = z.object({
  items: z.array(
    z.object({
      classId: z.string(),
      className: z.string(),
      childName: z.string(),
      monthlyTuitionCents: z.number().min(0),
      registrationFeeCents: z.number().min(0),
    })
  ).min(1),
  parentEmail: z.string().email(),
  parentName: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { items, parentEmail, parentName } = parsed.data;

    // Calculate total: first month tuition + registration fees
    const tuitionTotal = items.reduce(
      (sum, item) => sum + item.monthlyTuitionCents,
      0
    );
    const registrationTotal = items.reduce(
      (sum, item) => sum + item.registrationFeeCents,
      0
    );
    const totalCents = tuitionTotal + registrationTotal;

    if (totalCents <= 0) {
      return NextResponse.json(
        { error: "No payable amount" },
        { status: 400 }
      );
    }

    // Build line item description
    const description = items
      .map((item) => `${item.className} (${item.childName})`)
      .join(", ");

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "usd",
      metadata: {
        type: "enrollment",
        class_ids: items.map((i) => i.classId).join(","),
        child_names: items.map((i) => i.childName).join(","),
        parent_email: parentEmail,
        parent_name: parentName,
      },
      receipt_email: parentEmail,
      description: `Enrollment: ${description}`,
      automatic_payment_methods: { enabled: true },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount: totalCents,
    });
  } catch (err) {
    console.error("[stripe:create-payment-intent]", err);
    return NextResponse.json(
      { error: "Failed to create payment. Please try again." },
      { status: 500 }
    );
  }
}
