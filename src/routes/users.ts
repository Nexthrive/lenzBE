import { Router } from 'express';
import multer from 'multer';
import { verifyJWT } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { Request } from 'express';

declare module 'express' {
  export interface Request {
    file?: Express.Multer.File;
  }
}

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// POST /users/me/photo  (multipart form: field name "file")
router.post('/me/photo', verifyJWT, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required' });
  const userId = req.user!.id;
  const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
  const contentType = req.file.mimetype || (ext === 'png' ? 'image/png' : 'image/jpeg');

  const filePath = `user-${userId}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase
    .storage
    .from('avatars')
    .upload(filePath, req.file.buffer, { contentType, upsert: true });
  if (upErr) return res.status(500).json({ error: upErr.message });

  const { data: publicUrlData } = supabase
    .storage
    .from('avatars')
    .getPublicUrl(filePath);
  const publicUrl = publicUrlData.publicUrl;

  const { error: updErr } = await supabase
    .from('User')
    .update({ photoprofile: publicUrl })
    .eq('iduser', userId);
  if (updErr) return res.status(500).json({ error: updErr.message });

  return res.json({ url: publicUrl });
});

export default router;







