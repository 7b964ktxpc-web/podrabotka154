import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest { return { name: 'Подработка 154', short_name: 'Подработка', start_url: '/', display: 'standalone', lang: 'ru', icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }] }; }
