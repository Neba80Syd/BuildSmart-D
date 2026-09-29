import { handlers } from '../lib/auth';
import { NextRequest } from 'next/server';

const BASE_URL = 'http://localhost:3000';

async function loginUser(email: string, pass: string): Promise<string> {
  const csrfReq = new NextRequest(`${BASE_URL}/api/auth/csrf`);
  const csrfRes = await handlers.GET(csrfReq);
  const csrfData = await csrfRes.json();
  const csrfCookie = csrfRes.headers.get('set-cookie') || '';

  const postReq = new NextRequest(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    body: new URLSearchParams({
      email,
      password: pass,
      csrfToken: csrfData.csrfToken,
    }).toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': csrfCookie.split(';')[0],
    },
  });

  const postRes = await handlers.POST(postReq);
  const setCookie = postRes.headers.get('set-cookie') || '';
  const match = setCookie.match(/authjs\.session-token=([^;]+)/);
  if (!match) {
    throw new Error(`Failed to log in ${email}: no session cookie received`);
  }
  return `authjs.session-token=${match[1]}`;
}

async function testRoute(name: string, path: string, cookie?: string, expectedStatus?: number, expectedLocationPrefix?: string) {
  const headers: Record<string, string> = {
    'Accept': 'text/html,application/xhtml+xml',
  };
  if (cookie) {
    headers['Cookie'] = cookie;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    headers,
    redirect: 'manual',
  });

  const status = res.status;
  const location = res.headers.get('location') || '';

  let pass = true;
  if (expectedStatus && status !== expectedStatus) {
    pass = false;
  }
  if (expectedLocationPrefix) {
    const normLocation = location.replace(/^https?:\/\/[^\/]+/, '');
    const normExpected = expectedLocationPrefix.replace(/^https?:\/\/[^\/]+/, '');
    if (!normLocation.startsWith(normExpected)) {
      pass = false;
    }
  }

  console.log(
    `${pass ? 'PASS' : 'FAIL'} [${name}]: ${path} -> Status: ${status}, Location: ${location || '(none)'}`
  );
  return pass;
}

async function run() {
  console.log('--- Logging In Accounts & Testing Real RBAC Navigation Security ---\n');

  console.log('Logging in test accounts with credentials...');
  const clientCookie = await loginUser('jordan@buildsmart.ai', 'demo1234');
  const architectCookie = await loginUser('elena@buildsmart.ai', 'demo1234');
  const vendorCookie = await loginUser('marcus@buildsmart.ai', 'demo1234');
  const adminCookie = await loginUser('admin@buildsmart.ai', 'demo1234');
  console.log('All 4 roles logged in successfully!\n');

  let allPassed = true;

  // 1. Unauthenticated Visitor Tests
  console.log('1. Unauthenticated Visitor Tests (Redirect to /login):');
  allPassed = (await testRoute('Unauth -> /client', '/client', undefined, 307, '/login?callbackUrl=%2Fclient')) && allPassed;
  allPassed = (await testRoute('Unauth -> /architect/floor-plan-studio', '/architect/floor-plan-studio', undefined, 307, '/login?callbackUrl=%2Farchitect%2Ffloor-plan-studio')) && allPassed;
  allPassed = (await testRoute('Unauth -> /vendor', '/vendor', undefined, 307, '/login?callbackUrl=%2Fvendor')) && allPassed;
  allPassed = (await testRoute('Unauth -> /admin', '/admin', undefined, 307, '/login?callbackUrl=%2Fadmin')) && allPassed;
  allPassed = (await testRoute('Unauth -> /dashboard', '/dashboard', undefined, 307, '/login?callbackUrl=%2Fdashboard')) && allPassed;

  // 2. Client User Tests (Strictly Maintained in /client)
  console.log('\n2. Client User Tests (Strictly Maintained in /client workspace):');
  allPassed = (await testRoute('Client -> /client', '/client', clientCookie, 200)) && allPassed;
  allPassed = (await testRoute('Client -> /architect/floor-plan-studio (Blocked!)', '/architect/floor-plan-studio', clientCookie, 307, '/client')) && allPassed;
  allPassed = (await testRoute('Client -> /architect (Blocked!)', '/architect', clientCookie, 307, '/client')) && allPassed;
  allPassed = (await testRoute('Client -> /vendor (Blocked!)', '/vendor', clientCookie, 307, '/client')) && allPassed;
  allPassed = (await testRoute('Client -> /admin (Blocked!)', '/admin', clientCookie, 307, '/client')) && allPassed;
  allPassed = (await testRoute('Client -> /dashboard (Auto-routes to /client)', '/dashboard', clientCookie, 307, '/client')) && allPassed;
  allPassed = (await testRoute('Client -> /login (Auto-routes to /client)', '/login', clientCookie, 307, '/client')) && allPassed;

  // 3. Architect User Tests (Strictly Maintained in /architect)
  console.log('\n3. Architect User Tests (Strictly Maintained in /architect workspace):');
  allPassed = (await testRoute('Architect -> /architect/floor-plan-studio', '/architect/floor-plan-studio', architectCookie, 200)) && allPassed;
  allPassed = (await testRoute('Architect -> /client (Blocked!)', '/client', architectCookie, 307, '/architect')) && allPassed;
  allPassed = (await testRoute('Architect -> /vendor (Blocked!)', '/vendor', architectCookie, 307, '/architect')) && allPassed;
  allPassed = (await testRoute('Architect -> /admin (Blocked!)', '/admin', architectCookie, 307, '/architect')) && allPassed;
  allPassed = (await testRoute('Architect -> /dashboard (Auto-routes to /architect)', '/dashboard', architectCookie, 307, '/architect')) && allPassed;
  allPassed = (await testRoute('Architect -> /login (Auto-routes to /architect)', '/login', architectCookie, 307, '/architect')) && allPassed;

  // 4. Vendor User Tests (Strictly Maintained in /vendor)
  console.log('\n4. Vendor User Tests (Strictly Maintained in /vendor workspace):');
  allPassed = (await testRoute('Vendor -> /vendor', '/vendor', vendorCookie, 200)) && allPassed;
  allPassed = (await testRoute('Vendor -> /client (Blocked!)', '/client', vendorCookie, 307, '/vendor')) && allPassed;
  allPassed = (await testRoute('Vendor -> /architect/floor-plan-studio (Blocked!)', '/architect/floor-plan-studio', vendorCookie, 307, '/vendor')) && allPassed;
  allPassed = (await testRoute('Vendor -> /admin (Blocked!)', '/admin', vendorCookie, 307, '/vendor')) && allPassed;
  allPassed = (await testRoute('Vendor -> /dashboard (Auto-routes to /vendor)', '/dashboard', vendorCookie, 307, '/vendor')) && allPassed;

  // 5. Admin User Tests (Strictly Maintained in /admin)
  console.log('\n5. Admin User Tests (Strictly Maintained in /admin workspace):');
  allPassed = (await testRoute('Admin -> /admin', '/admin', adminCookie, 200)) && allPassed;
  allPassed = (await testRoute('Admin -> /client (Blocked!)', '/client', adminCookie, 307, '/admin')) && allPassed;
  allPassed = (await testRoute('Admin -> /architect/floor-plan-studio (Blocked!)', '/architect/floor-plan-studio', adminCookie, 307, '/admin')) && allPassed;
  allPassed = (await testRoute('Admin -> /vendor (Blocked!)', '/vendor', adminCookie, 307, '/admin')) && allPassed;
  allPassed = (await testRoute('Admin -> /dashboard (Auto-routes to /admin)', '/dashboard', adminCookie, 307, '/admin')) && allPassed;

  console.log(`\n========================================`);
  console.log(`FINAL RESULT: ${allPassed ? 'ALL 25 RBAC TESTS PASSED 100%!' : 'SOME TESTS FAILED'}`);
  console.log(`========================================`);
}

run().catch(console.error);
