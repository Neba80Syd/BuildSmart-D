import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';

const RegisterSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['CLIENT', 'ARCHITECT', 'VENDOR', 'ADMIN']).default('CLIENT'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { name, email, password, role } = parsed.data;

    const existing: any = await dbClient.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user: any = await dbClient.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        role,
      },
    });

    await dbClient.userProfile.create({
      data: { userId: user.id },
    });

    if (role === 'ARCHITECT') {
      await dbClient.architectProfile.create({
        data: { userId: user.id },
      });
    }

    if (role === 'VENDOR') {
      await dbClient.vendorProfile.create({
        data: { userId: user.id, businessName: `${name} Supplies` },
      });
    }

    return NextResponse.json({ success: true, message: 'Account created successfully. Please log in.' });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
