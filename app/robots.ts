import type { MetadataRoute } from 'next';
import { appUrl } from '@/lib/env';
export default function robots(): MetadataRoute.Robots { return { rules: { userAgent: '*', allow: ['/', '/jobs', '/employers/'], disallow: ['/admin', '/profile', '/favorites', '/employer$', '/orders', '/api', '/login', '/auth', '/jobs/new', '/jobs/*/edit', '/jobs/*/preview'] }, sitemap: appUrl() + '/sitemap.xml' }; }
