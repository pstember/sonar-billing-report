/**
 * Help Icon Component
 * Displays a small "?" icon with hover tooltip for contextual help
 */

interface HelpIconProps {
  content: string;
}

export function HelpIcon({ content }: HelpIconProps) {
  return (
    <span className="inline-flex items-center group relative ml-1">
      <button
        type="button"
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        aria-label="Help"
      >
        ?
      </button>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none w-64 z-50 shadow-xl transition-opacity duration-200 block">
        {content}
      </span>
    </span>
  );
}
