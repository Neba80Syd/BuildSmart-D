// BuildSmart AI — vendor console helpers (server-only).
// Shared analytics/order computation used by the /api/vendor/* routes.
import { dbClient } from './db.ts';

export const COMMISSION_RATE = 0.1; // platform commission on vendor sales
export const CURRENCY = 'XAF';
export const LOW_STOCK_THRESHOLD = 100;

type Any = Record<string, any>;

/** Resolve the vendor profile + its canonical vendorId from the acting user. */
export async function getVendorContext(userId: string) {
  const profile = await dbClient.vendorProfile.findUnique({ where: { userId } });
  const vendorId = profile?.id ?? userId;
  return { profile, vendorId };
}

/** All orders that contain at least one line item sold by this vendor. */
export async function getVendorOrders(vendorId: string): Promise<any[]> {
  const products = await dbClient.product.findMany({ where: { vendorId } });
  const productMap: Record<string, any> = Object.fromEntries(products.map((p) => [p.id, p]));
  const productIds = new Set(products.map((p) => p.id));

  const allItems = await dbClient.orderItem.findMany({});
  const vendorItems = allItems.filter((it) => productIds.has(it.productId));
  const orderIds = [...new Set(vendorItems.map((it) => it.orderId))];

  const allOrders = await dbClient.order.findMany({});
  const orders = allOrders.filter((o) => orderIds.includes(o.id));

  const itemsByOrder: Record<string, any[]> = {};
  for (const it of vendorItems) (itemsByOrder[it.orderId] ??= []).push(it);

  return orders.map((o) => ({
    ...o,
    items: (itemsByOrder[o.id] ?? []).map((it) => ({
      ...it,
      name: productMap[it.productId]?.name ?? 'Product',
      unit: productMap[it.productId]?.unit ?? '',
      sku: productMap[it.productId]?.sku ?? '',
    })),
  }));
}

function ymd(d: Date | string): string {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0, 10);
}

/** Full vendor dashboard analytics payload. */
export async function buildVendorAnalytics(vendorId: string): Promise<any> {
  const products = await dbClient.product.findMany({ where: { vendorId } });
  const productMap: Record<string, any> = Object.fromEntries(products.map((p) => [p.id, p]));

  const orders = await getVendorOrders(vendorId);

  // Revenue from non-cancelled orders, from line items only.
  const saleable = orders.filter((o) => o.status !== 'CANCELLED');
  const gross = saleable.reduce((s: number, o: any) => s + (o.items ?? []).reduce((x: number, it: any) => x + (it.total ?? 0), 0), 0);
  const commissions = Math.round(gross * COMMISSION_RATE);
  const net = gross - commissions;

  // Daily sales series for the last 30 days (continuity-filled).
  const dayBuckets: Record<string, { revenue: number; orders: number }> = {};
  for (let i = 29; i >= 0; i--) {
    const d = ymd(new Date(Date.now() - i * 86400000));
    dayBuckets[d] = { revenue: 0, orders: 0 };
  }
  const seenDays = new Set<string>();
  for (const o of saleable) {
    const d = ymd(o.createdAt);
    if (dayBuckets[d]) {
      dayBuckets[d].revenue += (o.items ?? []).reduce((x: number, it: any) => x + (it.total ?? 0), 0);
      if (!seenDays.has(o.id)) {
        dayBuckets[d].orders += 1;
        seenDays.add(o.id);
      }
    }
  }
  const salesSeries = Object.entries(dayBuckets).map(([day, v]) => ({ day, ...v }));

  // Top-selling products by revenue/units.
  const units: Record<string, { units: number; revenue: number }> = {};
  for (const o of saleable) {
    for (const it of o.items ?? []) {
      units[it.productId] = units[it.productId] ?? { units: 0, revenue: 0 };
      units[it.productId].units += it.quantity;
      units[it.productId].revenue += it.total;
    }
  }
  const topProducts = Object.entries(units)
    .map(([productId, v]) => ({ productId, name: productMap[productId]?.name ?? 'Product', unit: productMap[productId]?.unit ?? '', ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  // Stock status.
  const stockStatus = products.map((p) => {
    const qty = p.stock ?? 0;
    const status = qty === 0 ? (p.backorderable ? 'BACKORDERED' : 'OUT_OF_STOCK') : qty < LOW_STOCK_THRESHOLD ? 'LOW_STOCK' : 'IN_STOCK';
    return { id: p.id, name: p.name, sku: p.sku, stock: qty, status };
  });
  const stockSummary = {
    inStock: stockStatus.filter((s) => s.status === 'IN_STOCK').length,
    lowStock: stockStatus.filter((s) => s.status === 'LOW_STOCK').length,
    outOfStock: stockStatus.filter((s) => s.status === 'OUT_OF_STOCK').length,
    backordered: stockStatus.filter((s) => s.status === 'BACKORDERED').length,
  };
  const lowStock = stockStatus.filter((s) => s.status !== 'IN_STOCK');

  // Traffic sources.
  const traffic = await dbClient.vendorTraffic.findMany({ where: { vendorId } });
  const bySource: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  for (const t of traffic) {
    bySource[t.source] = (bySource[t.source] ?? 0) + t.visits;
    byDay[t.day] = (byDay[t.day] ?? 0) + t.visits;
  }
  const trafficSources = Object.entries(bySource).map(([source, visits]) => ({ source, visits }));
  const trafficSeries = Object.keys(byDay)
    .sort()
    .map((day) => ({ day, visits: byDay[day] }));
  const totalVisits = trafficSources.reduce((s: number, t: any) => s + t.visits, 0);

  // Customer demographics (buyer locations).
  const buyerIds = [...new Set(orders.map((o) => o.userId))];
  const users = await dbClient.user.findMany();
  const userProfiles = await dbClient.userProfile.findMany();
  const profileByUser: Record<string, any> = Object.fromEntries(userProfiles.map((p) => [p.userId, p]));
  const nameByUser: Record<string, any> = Object.fromEntries(users.map((u) => [u.id, u]));
  const byLocation: Record<string, number> = {};
  for (const id of buyerIds) {
    const loc = profileByUser[id]?.location ?? 'Unknown';
    byLocation[loc] = (byLocation[loc] ?? 0) + 1;
  }
  const demographics = Object.entries(byLocation)
    .map(([location, customers]) => ({ location, customers }))
    .sort((a, b) => b.customers - a.customers);

  return {
    metrics: {
      grossRevenue: gross,
      netRevenue: net,
      commissions,
      orderVolume: orders.length,
      activeOrders: orders.filter((o) => ['PENDING', 'PROCESSING', 'SHIPPED'].includes(o.status)).length,
      customers: buyerIds.length,
      totalVisits,
    },
    salesSeries,
    trafficSources,
    trafficSeries,
    topProducts,
    stockSummary,
    lowStock,
    demographics,
    recentOrders: orders.slice(0, 6).map((o) => ({
      id: o.id,
      status: o.status,
      totalAmount: o.totalAmount,
      createdAt: o.createdAt,
      customer: nameByUser[o.userId]?.name ?? 'Client',
      itemCount: (o.items ?? []).length,
    })),
  };
}
