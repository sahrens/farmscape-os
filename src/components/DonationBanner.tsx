import farmConfig from '@/farm.config';

/**
 * DonationBanner — shows donation links for the farm and upstream FarmscapeOS project.
 * Reads configuration from farm.config.ts. Hidden if no donation config is set.
 *
 * Design: minimal, non-intrusive footer bar. Appears on the login page and
 * optionally in the sidebar/data explorer.
 */
export function DonationBanner({ variant = 'footer' }: { variant?: 'footer' | 'inline' }) {
  const donation = farmConfig.donation;
  if (!donation) return null;

  const hasFarmLink = !!donation.farmUrl;
  const hasUpstreamLink = !!donation.upstreamUrl;
  if (!hasFarmLink && !hasUpstreamLink) return null;

  if (variant === 'inline') {
    return (
      <div className="px-3 py-2 text-xs text-earth-500 space-y-1">
        {hasFarmLink && (
          <a
            href={donation.farmUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-forest-400 hover:text-forest-300 underline"
          >
            {donation.farmLabel || `Support ${farmConfig.name}`}
          </a>
        )}
        {hasUpstreamLink && (
          <a
            href={donation.upstreamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-earth-500 hover:text-earth-400 underline"
          >
            Support FarmscapeOS
            {donation.upstreamPercent
              ? ` (${donation.upstreamPercent}% of donations go to the open-source project)`
              : ''}
          </a>
        )}
      </div>
    );
  }

  // Footer variant — full-width bar
  return (
    <div className="bg-earth-800/80 border-t border-earth-700 px-4 py-3 flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-earth-400">
      {hasFarmLink && (
        <a
          href={donation.farmUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-forest-700 hover:bg-forest-600 text-forest-100 rounded-lg transition-colors font-medium"
        >
          <span>🌱</span>
          {donation.farmLabel || `Support ${farmConfig.name}`}
        </a>
      )}
      {hasUpstreamLink && (
        <>
          {hasFarmLink && <span className="text-earth-600 hidden sm:inline">·</span>}
          <a
            href={donation.upstreamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-earth-500 hover:text-earth-300 underline transition-colors"
          >
            Support FarmscapeOS
          </a>
        </>
      )}
    </div>
  );
}
