/**
 * LOC Tooltip Component
 * Provides a hover tooltip explaining what "LOC" (Lines of Code) means
 */

export function LOCTooltip() {
  return (
    <span className="inline-flex items-center gap-1 group relative">
      <span>LOC</span>
      <svg className="w-3 h-3 text-gray-400 cursor-help" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="7" fill="currentColor"/>
        <text x="8" y="11" fontSize="10" textAnchor="middle" fill="white" fontWeight="bold">?</text>
      </svg>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none w-56 z-50 shadow-xl transition-opacity duration-200 block">
        <strong>LOC = Lines of Code</strong><br/>
        Non-comment, non-blank lines in your private projects
      </span>
    </span>
  );
}
