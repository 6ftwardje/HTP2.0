import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return { rules: process.env.HTP_ENVIRONMENT === 'staging'
    ? { userAgent: '*', disallow: '/' }
    : { userAgent: '*', disallow: ['/admin','/api','/account','/mentor'] } };
}
