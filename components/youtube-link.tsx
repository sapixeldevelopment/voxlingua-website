/** Shared public channel link; no embedded player or third-party tracking. */
export default function YouTubeLink({ iconOnly = false }: { iconOnly?: boolean }) {
  return <a className={iconOnly ? "site-youtube-link site-social-icon site-social-youtube" : "site-youtube-link"} href="https://www.youtube.com/@Dexlyy_5M" target="_blank" rel="noopener noreferrer" aria-label="Dexlyy on YouTube (opens in a new tab)" title="Watch Dexlyy on YouTube">
    <svg width="22" height="18" viewBox="0 0 24 18" fill="none" aria-hidden="true"><rect x="1" y="1" width="22" height="16" rx="5" fill="currentColor" /><path d="m10 5 6 4-6 4V5Z" fill="#fff" /></svg>
    {!iconOnly && <span>YouTube</span>}
  </a>;
}
