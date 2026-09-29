// Data-layer smoke test — exercises many dbClient methods against a seeded
// throwaway PostgreSQL database. This is intentionally guarded so it can never
// accidentally mutate your real BuildSmart database.
//
// The safe workflow is:
//   1. Create/point at a test database, e.g. buildsmoke.
//   2. Run `DATABASE_URL=postgresql://.../buildsmoke npm run db:seed`.
//   3. Run `DATABASE_URL=postgresql://.../buildsmoke npm run db:smoke`.
import { dbClient } from '../lib/db.ts';

if (!process.env.DATABASE_URL && !process.env.PRISMA_DATABASE_URL && !process.env.POSTGRES_URL) {
  console.error('Refusing to run db-smoke without a DATABASE_URL.');
  console.error('Point it at a throwaway database first, then run:');
  console.error('  DATABASE_URL=postgresql://postgres:12345678@localhost:5432/buildsmoke npm run db:seed');
  console.error('  DATABASE_URL=postgresql://postgres:12345678@localhost:5432/buildsmoke npm run db:smoke');
  process.exit(1);
}

let failures = 0;
function check(label: string, ok: boolean, extra?: any) {
  if (ok) {
    console.log('  PASS', label);
  } else {
    failures++;
    console.log('  FAIL', label, extra === undefined ? '' : JSON.stringify(extra));
  }
}

async function main() {
  // ---- users ----
  const users = await dbClient.user.findMany();
  check('user.findMany returns seeded users', Array.isArray(users) && users.length >= 6, users.length);

  const byId = await dbClient.user.findUnique({ where: { id: 'u_client' } });
  check('user.findUnique by id', byId?.email === 'jordan@buildsmart.ai', byId);

  const byEmail = await dbClient.user.findUnique({ where: { email: 'elena@buildsmart.ai' } });
  check('user.findUnique by email', byEmail?.id === 'u_architect', byEmail);

  // Clean up any leftovers from prior aborted runs
  const stale = await dbClient.user.findUnique({ where: { email: 'smoke@test.io' } }).catch(() => null);
  if (stale?.id) {
    await dbClient.userProfile.deleteMany({ where: { userId: stale.id } }).catch(() => {});
    await dbClient.architectProfile.deleteMany({ where: { userId: stale.id } }).catch(() => {});
    await dbClient.vendorProfile.deleteMany({ where: { userId: stale.id } }).catch(() => {});
    await dbClient.subscription.deleteMany({ where: { userId: stale.id } }).catch(() => {});
    await dbClient.cart.deleteMany({ where: { userId: stale.id } }).catch(() => {});
    await dbClient.user.delete({ where: { id: stale.id } }).catch(() => {});
  }

  const nu = await dbClient.user.create({ data: { email: 'smoke@test.io', name: 'Smoke User', role: 'CLIENT', passwordHash: 'x' } });
  check('user.create returns id + defaults', !!nu.id && nu.emailVerified === false, nu);
  const nu2 = await dbClient.user.findUnique({ where: { id: nu.id } });
  check('user.create persisted', nu2?.email === 'smoke@test.io', nu2);

  // ---- userProfile ----
  const up = await dbClient.userProfile.findUnique({ where: { userId: 'u_client' } });
  check('userProfile.findUnique', up?.id === 'up_client', up);
  const upNew = await dbClient.userProfile.create({ data: { userId: nu.id, location: 'Test City' } });
  check('userProfile.create', upNew?.location === 'Test City', upNew);
  const upUpd = await dbClient.userProfile.update({ where: { userId: nu.id }, data: { bio: 'hi' } });
  check('userProfile.update', upUpd?.bio === 'hi', upUpd);

  // ---- architectProfile ----
  const ap = await dbClient.architectProfile.findUnique({ where: { userId: 'u_architect' } });
  check('architectProfile.findUnique', ap?.id === 'ap_1', ap);
  const aps = await dbClient.architectProfile.findMany();
  check('architectProfile.findMany', aps.length >= 3, aps.length);
  const apUpd = await dbClient.architectProfile.update({ where: { userId: 'u_architect' }, data: { hourlyRate: 26000 } });
  check('architectProfile.update', apUpd?.hourlyRate === 26000, apUpd?.hourlyRate);
  const apNew = await dbClient.architectProfile.create({ data: { userId: nu.id, specializations: '[]', portfolio: '[]', rating: 0, reviewCount: 0, hourlyRate: 0 } });
  check('architectProfile.create', !!apNew.id, apNew);

  // ---- vendorProfile ----
  const vp = await dbClient.vendorProfile.findUnique({ where: { userId: 'u_vendor' } });
  check('vendorProfile.findUnique', vp?.id === 'vp_1', vp);
  const vps = await dbClient.vendorProfile.findMany();
  check('vendorProfile.findMany', vps.length >= 2, vps.length);
  const vpNew = await dbClient.vendorProfile.create({ data: { userId: nu.id, businessName: 'Smoke Co' } });
  check('vendorProfile.create', vpNew?.businessName === 'Smoke Co', vpNew);
  const vpUpd = await dbClient.vendorProfile.update({ where: { userId: nu.id }, data: { description: 'd' } });
  check('vendorProfile.update', vpUpd?.description === 'd', vpUpd);

  // ---- product ----
  const prods = await dbClient.product.findMany();
  check('product.findMany all', prods.length >= 10, prods.length);
  const prodsCat = await dbClient.product.findMany({ where: { category: 'Steel' } });
  check('product.findMany by category', prodsCat.length >= 2, prodsCat.length);
  const prod1 = await dbClient.product.findUnique({ where: { id: 'prod_1' } });
  check('product.findUnique', prod1?.name === 'Portland Cement 50kg', prod1?.name);
  const np = await dbClient.product.create({ data: { vendorId: 'vp_1', name: 'Smoke Brick', category: 'Bricks', unit: 'pc', price: 5, stock: 10, isActive: 1 } });
  check('product.create isActive:1 -> true', np?.isActive === true, np?.isActive);
  const npUpd = await dbClient.product.update({ where: { id: np.id }, data: { price: 6 } });
  check('product.update', npUpd?.price === 6, npUpd?.price);
  const npDel = await dbClient.product.delete({ where: { id: np.id } });
  check('product.delete returns true', npDel === true, npDel);

  // ---- project ----
  const projs = await dbClient.project.findMany();
  check('project.findMany all', projs.length >= 3, projs.length);
  const projsMine = await dbClient.project.findMany({ where: { ownerId: 'u_client' } });
  check('project.findMany by owner', projsMine.length >= 2, projsMine.length);
  const proj1 = await dbClient.project.findUnique({ where: { id: 'proj_1' } });
  check('project.findUnique', proj1?.name === 'Riverside Villa', proj1?.name);
  const nproj = await dbClient.project.create({ data: { name: 'Smoke Block', ownerId: 'u_client', status: 'DESIGNING', progress: 0 } });
  check('project.create', !!nproj.id && nproj.progress === 0, nproj);
  const nprojUpd = await dbClient.project.update({ where: { id: nproj.id }, data: { status: 'APPROVED' } });
  check('project.update', nprojUpd?.status === 'APPROVED', nprojUpd?.status);
  const nprojDel = await dbClient.project.delete({ where: { id: nproj.id } });
  check('project.delete', nprojDel === true, nprojDel);

  // ---- floorPlan ----
  const fps = await dbClient.floorPlan.findMany({ where: { projectId: 'proj_1' } });
  check('floorPlan.findMany by project', fps.length >= 1, fps.length);
  const nfp = await dbClient.floorPlan.create({ data: { projectId: 'proj_1', name: 'Smoke FP', data: '{}', svgData: '<svg/>' } });
  check('floorPlan.create', !!nfp.id, nfp);

  // ---- cart / cartItem ----
  const cart = await dbClient.cart.findUnique({ where: { userId: 'u_client' } });
  check('cart.findUnique', cart?.id === 'cart_1', cart);
  const ncart = await dbClient.cart.create({ data: { userId: nu.id } });
  check('cart.create', !!ncart.id, ncart);
  const items = await dbClient.cartItem.findMany({ where: { cartId: 'cart_1' } });
  check('cartItem.findMany joined', items.length >= 2 && items.every((i: any) => i.name && i.price !== undefined), items.map((i: any) => i.name));
  const nci = await dbClient.cartItem.create({ data: { cartId: 'cart_1', productId: 'prod_2', quantity: 3 } });
  check('cartItem.create', nci?.quantity === 3, nci);
  const nciUpd = await dbClient.cartItem.update({ where: { id: nci.id }, data: { quantity: 4 } });
  check('cartItem.update', nciUpd?.quantity === 4, nciUpd?.quantity);
  const nciDel = await dbClient.cartItem.delete({ where: { id: nci.id } });
  check('cartItem.delete', nciDel === true, nciDel);
  const delMany = await dbClient.cartItem.deleteMany({ where: { cartId: ncart.id } });
  check('cartItem.deleteMany returns count', delMany?.count === 0, delMany);

  // ---- chat ----
  const rooms = await dbClient.chatRoom.findMany({ where: {} });
  check('chatRoom.findMany', rooms.length >= 1, rooms.length);
  const room = await dbClient.chatRoom.findUnique({ where: { projectId: 'proj_1' } });
  check('chatRoom.findUnique by project', room?.id === 'room_1', room);

  // ---- message ----
  const msgs = await dbClient.message.findMany({ where: { roomId: 'room_1' } });
  check('message.findMany ordered', msgs.length >= 3 && msgs[0].id === 'msg_1', msgs.map((m: any) => m.id));
  const nmsg = await dbClient.message.create({ data: { senderId: 'u_client', roomId: 'room_1', content: 'smoke msg', read: 0 } });
  check('message.create read:0 -> false', nmsg?.read === false, nmsg?.read);

  // ---- order / orderItem ----
  const orders = await dbClient.order.findMany({ where: { userId: 'u_client' } });
  check('order.findMany desc', orders.length >= 2, orders.map((o: any) => o.id));
  const norder = await dbClient.order.create({ data: { userId: 'u_client', status: 'PENDING', totalAmount: 100, currency: 'XAF' } });
  check('order.create', !!norder.id, norder);
  const noit = await dbClient.orderItem.create({ data: { orderId: norder.id, productId: 'prod_1', quantity: 2, unitPrice: 4500, total: 9000 } });
  check('orderItem.create', noit?.total === 9000, noit);
  const oitems = await dbClient.orderItem.findMany({ where: { orderId: 'order_1' } });
  check('orderItem.findMany', oitems.length >= 2, oitems.length);

  // ---- notification ----
  const notifs = await dbClient.notification.findMany({ where: { userId: 'u_client' } });
  check('notification.findMany desc', notifs.length >= 2, notifs.map((n: any) => n.id));
  const nn = await dbClient.notification.create({ data: { userId: 'u_client', type: 'ORDER', title: 't', body: 'b', read: 0 } });
  check('notification.create read:0 -> false', nn?.read === false, nn?.read);
  const nnUpd = await dbClient.notification.update({ where: { id: nn.id }, data: { read: 1 } });
  check('notification.update read:1 -> true', nnUpd?.read === true, nnUpd?.read);

  // ---- review ----
  const revs = await dbClient.review.findMany({ where: { targetType: 'ARCHITECT', targetId: 'u_architect', status: 'APPROVED' } });
  check('review.findMany filtered', revs.length >= 2, revs.length);
  const revFirst = await dbClient.review.findFirst({ where: { targetType: 'ARCHITECT', targetId: 'u_architect', authorId: 'u_client' } });
  check('review.findFirst', revFirst?.id === 'rev_1', revFirst?.id);
  const nrev = await dbClient.review.create({ data: { targetType: 'ARCHITECT', targetId: 'u_arch2', authorId: nu.id, authorName: 'Smoke', rating: 5, title: 't', body: 'b' } });
  check('review.create defaults PENDING', nrev?.status === 'PENDING', nrev?.status);
  const nrevUpd = await dbClient.review.update({ where: { id: nrev.id }, data: { status: 'APPROVED' } });
  check('review.update', nrevUpd?.status === 'APPROVED', nrevUpd?.status);

  // ---- blogPost ----
  const posts = await dbClient.blogPost.findMany({ where: { status: 'PUBLISHED' } });
  check('blogPost.findMany published', posts.length >= 3, posts.length);
  const bpost = await dbClient.blogPost.findUnique({ where: { slug: 'steel-vs-concrete' } });
  check('blogPost.findUnique by slug', bpost?.id === 'blog_3', bpost?.id);
  const npost = await dbClient.blogPost.create({ data: { title: 'Smoke', slug: 'smoke-slug', status: 'DRAFT' } });
  check('blogPost.create', !!npost.id, npost);
  const npostUpd = await dbClient.blogPost.update({ where: { id: npost.id }, data: { status: 'PUBLISHED' } });
  check('blogPost.update', npostUpd?.status === 'PUBLISHED', npostUpd?.status);
  const npostDel = await dbClient.blogPost.delete({ where: { id: npost.id } });
  check('blogPost.delete', npostDel === true, npostDel);

  // ---- supportTicket ----
  const tickets = await dbClient.supportTicket.findMany({ where: { userId: 'u_client' } });
  check('supportTicket.findMany', tickets.length >= 1, tickets.length);
  const t1 = await dbClient.supportTicket.findUnique({ where: { id: 'ticket_1' } });
  check('supportTicket.findUnique', t1?.subject?.startsWith('Question'), t1?.subject);
  check('supportTicket.messages is array', Array.isArray(t1?.messages), t1?.messages);
  const nt = await dbClient.supportTicket.create({ data: { userId: 'u_client', subject: 'Smoke', category: 'Other' } });
  check('supportTicket.create defaults OPEN + messages[]', nt?.status === 'OPEN' && Array.isArray(nt?.messages), nt);
  const ntUpd = await dbClient.supportTicket.update({ where: { id: nt.id }, data: { status: 'RESOLVED' } });
  check('supportTicket.update', ntUpd?.status === 'RESOLVED', ntUpd?.status);

  // ---- subscription / payment ----
  const sub = await dbClient.subscription.findUnique({ where: { userId: 'u_architect' } });
  check('subscription.findUnique', sub?.plan === 'PROFESSIONAL', sub?.plan);
  const subUpd = await dbClient.subscription.update({ where: { userId: 'u_client' }, data: { plan: 'BASIC' } });
  check('subscription.update', subUpd?.plan === 'BASIC', subUpd?.plan);
  const nsub = await dbClient.subscription.create({ data: { userId: nu.id, plan: 'FREE', status: 'ACTIVE' } });
  check('subscription.create', nsub?.plan === 'FREE', nsub);
  const pays = await dbClient.payment.findMany({ where: { userId: 'u_architect' } });
  check('payment.findMany', pays.length >= 1, pays.length);
  const npay = await dbClient.payment.create({ data: { userId: 'u_client', amount: 49, currency: 'EUR', status: 'SUCCEEDED', description: 'smoke' } });
  check('payment.create', npay?.amount === 49, npay);

  // ---- document ----
  const docs = await dbClient.document.findMany({ where: { projectId: 'proj_1' } });
  check('document.findMany', docs.length >= 3, docs.length);
  const d1 = await dbClient.document.findUnique({ where: { id: 'doc_1' } });
  check('document.findUnique', d1?.name?.startsWith('ground-floor'), d1?.name);
  const ndoc = await dbClient.document.create({ data: { id: 'doc_smoke', ownerId: 'u_client', projectId: 'proj_1', name: 'smoke.txt', type: 'text/plain', size: 4, version: 1 } });
  check('document.create respects given id', ndoc?.id === 'doc_smoke', ndoc?.id);
  const ndocDel = await dbClient.document.delete({ where: { id: 'doc_smoke' } });
  check('document.delete', ndocDel === true, ndocDel);

  // Clean up test user
  await dbClient.userProfile.deleteMany({ where: { userId: nu.id } }).catch(() => {});
  await dbClient.architectProfile.deleteMany({ where: { userId: nu.id } }).catch(() => {});
  await dbClient.vendorProfile.deleteMany({ where: { userId: nu.id } }).catch(() => {});
  await dbClient.subscription.deleteMany({ where: { userId: nu.id } }).catch(() => {});
  await dbClient.cart.deleteMany({ where: { userId: nu.id } }).catch(() => {});
  await dbClient.user.delete({ where: { id: nu.id } }).catch(() => {});

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('SMOKE ERROR:', err);
  process.exit(1);
});
