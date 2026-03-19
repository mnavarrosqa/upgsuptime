import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [userData] = await db
    .select({
      onboardingCompleted: user.onboardingCompleted,
      onboardingStep: user.onboardingStep,
    })
    .from(user)
    .where(eq(user.id, session.user.id));

  return NextResponse.json({
    onboardingCompleted: userData?.onboardingCompleted ?? null,
    onboardingStep: userData?.onboardingStep ?? null,
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { onboardingCompleted, onboardingStep } = body;

  const updateData: {
    onboardingCompleted?: boolean | null;
    onboardingStep?: string | null;
  } = {};

  if (typeof onboardingCompleted === "boolean") {
    updateData.onboardingCompleted = onboardingCompleted;
  }

  if (typeof onboardingStep === "string") {
    const validSteps = [
      "welcome",
      "add-monitor",
      "alerts",
      "status-page",
      "complete",
    ];
    if (!validSteps.includes(onboardingStep)) {
      return NextResponse.json(
        { error: "Invalid onboarding step" },
        { status: 400 }
      );
    }
    updateData.onboardingStep = onboardingStep;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  await db
    .update(user)
    .set(updateData)
    .where(eq(user.id, session.user.id));

  const [updatedUser] = await db
    .select({
      onboardingCompleted: user.onboardingCompleted,
      onboardingStep: user.onboardingStep,
    })
    .from(user)
    .where(eq(user.id, session.user.id));

  return NextResponse.json({
    onboardingCompleted: updatedUser?.onboardingCompleted ?? null,
    onboardingStep: updatedUser?.onboardingStep ?? null,
  });
}
