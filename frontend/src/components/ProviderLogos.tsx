/**
 * Provider & MCP-client marks — original abstract glyphs (not brand assets).
 * Each is a simple geometric mark paired with a wordmark, styled to sit
 * quietly in a monochrome, dark UI rather than reproduce any company's
 * actual logo.
 */

export interface ProviderInfo {
  name: string;
  glyph: 'ring' | 'spark' | 'triangle' | 'diamond' | 'bars' | 'hex' | 'wave' | 'square' | 'orbit' | 'plus';
}

export const providers: ProviderInfo[] = [
  { name: 'OpenAI', glyph: 'spark' },
  { name: 'Anthropic', glyph: 'diamond' },
  { name: 'Google Gemini', glyph: 'orbit' },
  { name: 'Meta Llama', glyph: 'triangle' },
  { name: 'Mistral', glyph: 'wave' },
  { name: 'DeepSeek', glyph: 'hex' },
  { name: 'xAI Grok', glyph: 'bars' },
  { name: 'Cohere', glyph: 'ring' },
  { name: 'OpenRouter', glyph: 'plus' },
  { name: 'Azure OpenAI', glyph: 'square' },
];

export const mcpClients: string[] = ['Claude Desktop', 'Cursor', 'VS Code', 'Windsurf', 'Zed'];

function Glyph({ type, className }: { type: ProviderInfo['glyph']; className?: string }) {
  const common = { className, viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' } as const;
  switch (type) {
    case 'ring':
      return <svg {...common}><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2" /></svg>;
    case 'spark':
      return <svg {...common}><path d="M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3z" fill="currentColor" /></svg>;
    case 'triangle':
      return <svg {...common}><path d="M12 4l8 15H4l8-15z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>;
    case 'diamond':
      return <svg {...common}><rect x="6" y="6" width="12" height="12" fill="currentColor" transform="rotate(45 12 12)" /></svg>;
    case 'bars':
      return (
        <svg {...common}>
          <rect x="4" y="12" width="3" height="8" fill="currentColor" />
          <rect x="10.5" y="7" width="3" height="13" fill="currentColor" />
          <rect x="17" y="3" width="3" height="17" fill="currentColor" />
        </svg>
      );
    case 'hex':
      return <svg {...common}><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>;
    case 'wave':
      return <svg {...common}><path d="M3 14c2-4 4-4 6 0s4 4 6 0 4-4 6 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
    case 'square':
      return <svg {...common}><rect x="5" y="5" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /></svg>;
    case 'orbit':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="2.2" fill="currentColor" />
          <ellipse cx="12" cy="12" rx="9" ry="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <ellipse cx="12" cy="12" rx="9" ry="4" fill="none" stroke="currentColor" strokeWidth="1.6" transform="rotate(60 12 12)" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...common}>
          <rect x="10.5" y="4" width="3" height="16" fill="currentColor" />
          <rect x="4" y="10.5" width="16" height="3" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
}

export function ProviderLogo({ name, glyph, className = '' }: ProviderInfo & { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-gray-400 hover:text-white hover:border-white/20 hover:bg-white/[0.06] transition-colors ${className}`}>
      <Glyph type={glyph} className="h-4 w-4 flex-none" />
      <span className="text-xs font-semibold whitespace-nowrap">{name}</span>
    </div>
  );
}
