/**
 * Provider & MCP-client marks. Uses each company's real logo asset
 * (served from /logos), styled to sit quietly in a monochrome, dark UI.
 */

export interface ProviderInfo {
  name: string;
  logo: string;
  /** Some marks (e.g. black-on-transparent) need a light chip behind them on the dark theme. */
  needsLightBg?: boolean;
}

export const providers: ProviderInfo[] = [
  { name: 'OpenAI', logo: '/logos/openai.png', needsLightBg: true },
  { name: 'Anthropic', logo: '/logos/claude.png' },
  { name: 'Google Gemini', logo: '/logos/gemini.png' },
  { name: 'Mistral', logo: '/logos/mistral.png', needsLightBg: true },
  { name: 'DeepSeek', logo: '/logos/deepseek.png' },
  { name: 'xAI Grok', logo: '/logos/xai.png', needsLightBg: true },
  { name: 'Cohere', logo: '/logos/cohere.png' },
  { name: 'OpenRouter', logo: '/logos/openrouter.png' },
];

export const mcpClients: string[] = ['Claude Desktop', 'Cursor', 'VS Code', 'Windsurf', 'Zed'];

export function ProviderLogo({ name, logo, needsLightBg, className = '' }: ProviderInfo & { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-gray-400 hover:text-white hover:border-white/10 hover:bg-white/[0.05] transition-colors ${className}`}>
      <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-md ${needsLightBg ? 'bg-white/90 p-1' : ''}`}>
        <img src={logo} alt={`${name} logo`} className="h-full w-full object-contain" loading="lazy" />
      </span>
      <span className="text-xs font-semibold whitespace-nowrap">{name}</span>
    </div>
  );
}
