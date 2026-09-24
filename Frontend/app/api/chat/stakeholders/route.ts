import { NextRequest, NextResponse } from "next/server";
import { dbClient } from "@/Backend/lib/db";
import { resolveUser } from "@/Backend/lib/preview";

export const dynamic = "force-dynamic";

/**
 * GET /api/chat/stakeholders
 * List all users / stakeholders that can be messaged.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const role = (searchParams.get("role")?.toUpperCase() as any) || "CLIENT";
  const currentUser = await resolveUser(role);

  const users: any[] = await dbClient.user.findMany();
  const architectProfiles: any[] = await dbClient.architectProfile.findMany();
  const vendorProfiles: any[] = await dbClient.vendorProfile.findMany();

  const archMap = new Map(architectProfiles.map((a) => [a.userId, a]));
  const vendorMap = new Map(vendorProfiles.map((v) => [v.userId, v]));

  // Exclude current user from the list
  const stakeholders = users
    .filter((u) => u.id !== currentUser.id)
    .map((u) => {
      const arch = archMap.get(u.id);
      const vendor = vendorMap.get(u.id);

      let subtitle = "";
      let statusBadge = "";

      if (u.role === "ARCHITECT") {
        subtitle = arch?.title || "Principal Architect";
        statusBadge = arch?.verificationStatus || "VERIFIED";
      } else if (u.role === "VENDOR") {
        subtitle = vendor?.businessName || "Building Materials Supplier";
        statusBadge = vendor?.verificationLevel || "VERIFIED_VENDOR";
      } else if (u.role === "ADMIN") {
        subtitle = "BuildSmart Platform Operations";
        statusBadge = "PLATFORM_ADMIN";
      } else {
        subtitle = "Project Client / Property Owner";
        statusBadge = "ACTIVE";
      }

      return {
        id: u.id,
        name: u.name ?? "User",
        email: u.email,
        role: u.role,
        subtitle,
        statusBadge,
        initials: (u.name ?? "U")
          .split(" ")
          .map((n: string) => n[0])
          .slice(0, 2)
          .join("")
          .toUpperCase(),
      };
    });

  return NextResponse.json({ stakeholders });
}
