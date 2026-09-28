import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { roomagenService } from '@/Backend/services/roomagen/roomagen.service';

export const dynamic = 'force-dynamic';

const SendToClientSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  clientId: z.string().optional(),
  floorPlanIds: z.array(z.string()).optional().default([]),
  jobIds: z.array(z.string()).optional().default([]),
  message: z.string().max(2000).optional(),
  notifyClient: z.boolean().optional().default(true),
  postToChat: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const user = await resolveUser('ARCHITECT');
    const body = await req.json().catch(() => null);
    const parsed = SendToClientSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid parameters' },
        { status: 400 }
      );
    }

    const { projectId, clientId, floorPlanIds, jobIds, message, notifyClient, postToChat } = parsed.data;

    // 1. Resolve and verify project
    const project: any = await dbClient.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    if (project.architectId && project.architectId !== user.id) {
      return NextResponse.json({ success: false, error: 'You are not assigned to this project' }, { status: 403 });
    }

    // 2. Resolve client
    const targetClientId = clientId || project.ownerId;
    if (!targetClientId) {
      return NextResponse.json({ success: false, error: 'No client is assigned to this project' }, { status: 400 });
    }

    const clientUser: any = await dbClient.user.findUnique({ where: { id: targetClientId } });
    const clientName = clientUser?.name || 'Valued Client';

    // 3. Process any unsaved Roomagen Job IDs
    const resolvedPlanIds = new Set<string>(floorPlanIds);

    if (jobIds && jobIds.length > 0) {
      for (const jid of jobIds) {
        try {
          // Check if this job is already saved as a FloorPlan for this project
          const existingPlans = await dbClient.floorPlan.findMany({ where: { projectId } });
          const alreadySaved = existingPlans.find((p: any) => {
            if (!p.data) return false;
            try {
              const parsedData = typeof p.data === 'string' ? JSON.parse(p.data) : p.data;
              return parsedData?.jobId === jid;
            } catch {
              return false;
            }
          });

          if (alreadySaved) {
            resolvedPlanIds.add(alreadySaved.id);
          } else {
            // Save as official FloorPlan
            const promoted = await roomagenService.saveAsProjectFloorPlan({
              jobId: jid,
              projectId,
              userId: user.id,
            });
            if (promoted?.id) {
              resolvedPlanIds.add(promoted.id);
            }
          }
        } catch (jobErr: any) {
          console.warn(`[send-to-client] Failed to promote job ${jid}:`, jobErr.message);
        }
      }
    }

    if (resolvedPlanIds.size === 0) {
      return NextResponse.json(
        { success: false, error: 'Please select at least one floor plan or Roomagen generation to send.' },
        { status: 400 }
      );
    }

    // 4. Update all target floor plans to PUBLISHED and READY_FOR_REVIEW
    const deliveredPlans: any[] = [];
    const now = new Date();

    for (const planId of Array.from(resolvedPlanIds)) {
      try {
        const updated = await dbClient.floorPlan.update({
          where: { id: planId },
          data: {
            status: 'PUBLISHED',
            reviewStatus: 'READY_FOR_REVIEW',
            publishedAt: now,
            updatedAt: now,
          },
        });
        if (updated) deliveredPlans.push(updated);
      } catch (err: any) {
        console.warn(`[send-to-client] Error updating floor plan ${planId}:`, err.message);
      }
    }

    if (deliveredPlans.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to publish any of the selected floor plans.' },
        { status: 500 }
      );
    }

    // 5. Update Project status to CLIENT_REVIEW if currently in early stages
    if (['DRAFT', 'DESIGNING', 'AI_GENERATED', 'ARCHITECT_REVIEW'].includes(project.status)) {
      await dbClient.project.update({
        where: { id: projectId },
        data: { status: 'CLIENT_REVIEW', updatedAt: now },
      }).catch(() => {});
    }

    // 6. Summarize delivered kinds
    const has2D = deliveredPlans.some((p) => p.kind === '2D');
    const has3D = deliveredPlans.some((p) => p.kind === '3D');
    const kindsLabel = has2D && has3D ? '2D & 3D' : has3D ? '3D' : '2D';
    const planNames = deliveredPlans.map((p) => `${p.name} (V${p.version})`).join(', ');

    // 7. Send In-App Notification to Client
    if (notifyClient) {
      const primaryPlan = deliveredPlans[0];
      const viewLink = has3D
        ? `/client/3d?project=${projectId}&plan=${primaryPlan.id}`
        : `/client/floorplans?project=${projectId}&plan=${primaryPlan.id}`;

      await dbClient.notification.create({
        data: {
          userId: targetClientId,
          type: has3D ? '3D_FLOORPLAN' : 'DESIGN',
          title: `New ${kindsLabel} Floor Plan Deliverables Ready`,
          body: `Architect ${user.name} delivered ${deliveredPlans.length} floor plan(s) (${planNames}) for ${project.name}. Click to explore and visualize now.`,
          read: 0,
          link: viewLink,
          resourceId: primaryPlan.id,
        },
      }).catch((notifErr) => console.warn('[send-to-client] Notification failed:', notifErr.message));
    }

    // 8. Post message into Project Chat Room
    if (postToChat) {
      try {
        let chatRoom: any = await dbClient.chatRoom.findFirst({ where: { projectId } });
        if (!chatRoom) {
          chatRoom = await dbClient.chatRoom.create({
            data: {
              projectId,
              name: `${project.name} — Project Discussion`,
              createdAt: now,
            },
          });
        }

        // Ensure participants exist
        const participants = await dbClient.chatParticipant.findMany({ where: { roomId: chatRoom.id } });
        const participantUserIds = new Set(participants.map((p: any) => p.userId));

        if (!participantUserIds.has(user.id)) {
          await dbClient.chatParticipant.create({ data: { roomId: chatRoom.id, userId: user.id } }).catch(() => {});
        }
        if (!participantUserIds.has(targetClientId)) {
          await dbClient.chatParticipant.create({ data: { roomId: chatRoom.id, userId: targetClientId } }).catch(() => {});
        }

        // Post chat message with deliverable card link
        const deliverableSummary = `📐 **[DELIVERABLE SENT]**: Architect ${user.name} has submitted ${deliveredPlans.length} new ${kindsLabel} floor plan(s) for your review:\n` +
          deliveredPlans.map((p) => `• **${p.name}** [${p.kind} - Version ${p.version}]`).join('\n') +
          (message ? `\n\n💬 *Architect Note*: "${message}"` : '') +
          `\n\n👉 [Click here to visualize your floor plans](/client/floorplans?project=${projectId})`;

        await dbClient.message.create({
          data: {
            senderId: user.id,
            roomId: chatRoom.id,
            content: deliverableSummary,
            read: 0,
          },
        });
      } catch (chatErr: any) {
        console.warn('[send-to-client] Chat broadcast failed:', chatErr.message);
      }
    }

    // 9. Activity Log
    await dbClient.activity.create({
      data: {
        userId: user.id,
        projectId,
        type: 'DESIGN',
        title: `${kindsLabel} floor plan deliverables dispatched to client`,
        body: `Sent ${deliveredPlans.length} plan(s) to ${clientName}. ${message || ''}`.trim(),
      },
    }).catch(() => {});

    await dbClient.activity.create({
      data: {
        userId: targetClientId,
        projectId,
        type: 'DESIGN',
        title: `${kindsLabel} floor plan deliverables received`,
        body: `Delivered by architect ${user.name} for client review.`,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      deliveredCount: deliveredPlans.length,
      deliveredPlans,
      client: {
        id: targetClientId,
        name: clientName,
        email: clientUser?.email || '',
      },
      project: {
        id: project.id,
        name: project.name,
      },
      message: `Successfully delivered ${deliveredPlans.length} floor plan(s) to ${clientName}!`,
    });
  } catch (err: any) {
    console.error('[send-to-client] Fatal error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error while sending floor plans to client' },
      { status: 500 }
    );
  }
}
