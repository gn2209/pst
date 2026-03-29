import { NextResponse } from 'next/server';
import packageJson from '@/package.json';

export const runtime = 'nodejs';

const GITHUB_OWNER = 'realbestia1';
const GITHUB_REPO = 'erdb';
const GITHUB_PACKAGE_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/package.json`;

const fetchJson = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export async function GET() {
  const currentVersion = String(packageJson.version || '').trim();
  let githubPackageVersion: string | null = null;

  const githubPackage = await fetchJson(GITHUB_PACKAGE_URL);
  if (githubPackage && typeof githubPackage === 'object') {
    const version = (githubPackage as { version?: string }).version;
    if (typeof version === 'string' && version.trim()) {
      githubPackageVersion = version.trim();
    }
  }

  return NextResponse.json({
    currentVersion,
    githubPackageVersion,
    repoUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`,
  });
}
