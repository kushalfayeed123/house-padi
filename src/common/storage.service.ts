// src/modules/common/storage.service.ts
import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private supabase = createClient(
    process.env.SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  );
  private readonly BUCKET = 'house-padi-assets';
  async uploadKycDoc(
    userId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `kyc-documents/${fileName}`;

    const { error } = await this.supabase.storage
      .from('house-padi-assets') // Ensure this bucket exists in Supabase
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) throw error;

    // Return the public URL
    const { data: urlData } = this.supabase.storage
      .from('house-padi-assets')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  }

  async uploadFile(
    path: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const { error } = await this.supabase.storage
      .from(this.BUCKET)
      .upload(path, buffer, {
        contentType: mimeType,
        upsert: true,
        cacheControl: '3600',
      });

    if (error) throw error;

    const { data: urlData } = this.supabase.storage
      .from(this.BUCKET)
      .getPublicUrl(path);

    return urlData.publicUrl;
  }
}
