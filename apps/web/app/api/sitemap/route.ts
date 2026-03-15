import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { getOrgCollections } from '@services/courses/collections';
import { getOrgCourses } from '@services/courses/courses';
import { getAbsoluteUrl } from '@services/config/config';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const orgSlug = request.headers.get('X-Sitemap-Orgslug');

  if (!orgSlug) {
    return NextResponse.json({ error: 'Missing X-Sitemap-Orgslug header' }, { status: 400 });
  }

  const orgInfo = await getOrganizationContextInfo(orgSlug, null);

  // Fetch all courses with pagination (20 per page)
  const COURSES_PER_PAGE = 20;
  const allCourses: { course_uuid: string }[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const { courses: pageCourses, total } = await getOrgCourses(orgSlug, null, null, page, COURSES_PER_PAGE);
    allCourses.push(...pageCourses);
    hasMore = page * COURSES_PER_PAGE < total;
    page += 1;
  }

  const collections = await getOrgCollections(orgInfo.id);

  const host = request.headers.get('host');
  if (!host) {
    return NextResponse.json({ error: 'Missing host header' }, { status: 400 });
  }

  const baseUrl = getAbsoluteUrl(orgSlug, '/');

  const sitemapUrls: SitemapUrl[] = [
    { loc: baseUrl, priority: 1, changefreq: 'daily' },
    { loc: `${baseUrl}collections`, priority: 0.9, changefreq: 'weekly' },
    { loc: `${baseUrl}courses`, priority: 0.9, changefreq: 'weekly' },
    // Courses
    ...allCourses.map((course) => ({
      loc: `${baseUrl}course/${course.course_uuid.replace('course_', '')}`,
      priority: 0.7,
      changefreq: 'weekly',
    })),
    // Collections
    ...collections.map((collection: { collection_uuid: string }) => ({
      loc: `${baseUrl}collections/${collection.collection_uuid.replace('collection_', '')}`,
      priority: 0.6,
      changefreq: 'weekly',
    })),
  ];

  const sitemap = generateSitemap(baseUrl, sitemapUrls);

  return new NextResponse(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}

interface SitemapUrl {
  loc: string;
  priority: number;
  changefreq: string;
}

function generateSitemap(_baseUrl: string, urls: SitemapUrl[]): string {
  const urlEntries = urls
    .map(
      ({ loc, priority, changefreq }) => `
    <url>
      <loc>${loc}</loc>
      <priority>${priority.toFixed(1)}</priority>
      <changefreq>${changefreq}</changefreq>
    </url>`,
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urlEntries}
  </urlset>`;
}
