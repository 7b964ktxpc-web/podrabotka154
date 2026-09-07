import 'server-only';
import { serviceDb, check } from './service-db';
export async function uploadImage(file: FormDataEntryValue | null, userId: string): Promise<string | null> {
    if (!(file instanceof File) || !file.size)
        return null;
    if (file.size > 800000)
        throw new Error('Изображение должно быть меньше 800 КБ');
    const bytes = Buffer.from(await file.arrayBuffer());
    let ext: string;
    if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])))
        ext = 'jpg';
    else if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
        ext = 'png';
    else
        throw new Error('Разрешены только JPEG и PNG');
    const client = serviceDb();
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    check(await client.storage.from('job-images').upload(path, bytes, { contentType: ext === 'jpg' ? 'image/jpeg' : 'image/png', upsert: false }));
    return client.storage.from('job-images').getPublicUrl(path).data.publicUrl;
}
