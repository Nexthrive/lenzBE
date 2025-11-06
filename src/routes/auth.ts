import { Router } from 'express';
import { supabase } from '../lib/supabase';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { loginLimiter } from '../middleware/security';

const router = Router();
const jwtSecret = process.env.JWT_SECRET as string;

function normalizeRole(input?: string): 'admin' | 'user' {
  const v = (input || 'user').toString().toLowerCase();
  return v === 'admin' ? 'admin' : 'user';
}

// POST /auth/register
const RegisterSchema = z.object({
  username: z.string().min(3).max(32),
  name: z.string().min(1).max(64),
  email: z.string().email(),
  password: z.string().min(8),
});

router.post('/register', async (req, res) => {
  const body = (req.body ?? {}) as {
    username?: string; name?: string; email?: string; password?: string; role?: 'admin' | 'user';
  };
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  const { username, name, email, password } = parsed.data;

  if (!username || !name || !email || !password) {
    return res.status(400).json({ error: 'username, name, email, password are required' });
  }

  // Cek duplikasi username atau email
  const { data: existing, error: checkErr } = await supabase
    .from('User')
    .select('iduser, username, email')
    .or(`username.eq.${username},email.eq.${email}`)
    .limit(1);
  if (checkErr) return res.status(500).json({ error: checkErr.message });
  if (existing && existing.length > 0) {
    return res.status(409).json({ error: 'username or email already exists' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const roleLower = 'user';

  // Try insert with lowercase role
  let { data, error } = await supabase
    .from('User')
    .insert([{ username, name, email, password: hashed, role: roleLower }])
    .select('iduser, username, email, role, name')
    .single();

  // If check constraint fails (e.g., expects 'Admin'/'User'), retry with capitalized
  if (error && (error as any).code === '23514') {
    const capitalized = roleLower === 'admin' ? 'Admin' : 'User';
    const retry = await supabase
      .from('User')
      .insert([{ username, name, email, password: hashed, role: capitalized }])
      .select('iduser, username, email, role, name')
      .single();
    data = retry.data as any;
    error = retry.error as any;
  }

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ data });
});

// POST /auth/login
const LoginSchema = z.object({
  username: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8),
}).refine(v => !!v.username || !!v.email, { message: 'username or email required', path: ['username'] });

router.post('/login', loginLimiter, async (req, res) => {
  const body = (req.body ?? {}) as { username?: string; email?: string; password?: string };
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  const { username, email, password } = parsed.data as { username?: string; email?: string; password: string };
  if (!password || (!username && !email)) return res.status(400).json({ error: 'username/email and password are required' });

  let query = supabase.from('User').select('iduser, username, email, password, role').limit(1);
  if (username) query = query.eq('username', username);
  if (email) query = query.eq('email', email);
  const { data: rows, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  const user = rows?.[0];
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password!, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const roleLower = (user.role || 'user').toString().toLowerCase();
  const token = jwt.sign({ id: user.iduser, role: roleLower }, jwtSecret, { expiresIn: '7d' });
  return res.json({ token, user: { id: user.iduser, username: user.username, email: user.email, role: roleLower } });
});

export default router;


