/**
 * SA Company Wordmark Components
 * Styled to match each brand's visual identity (typography, colors, weight)
 * Used in the Landing page "Trusted by" section
 */

export function NaspersLogo({ className = "h-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="8" width="16" height="16" fill="#E03A2E"/>
      <rect x="4" y="4" width="16" height="16" fill="#F47920"/>
      <text x="26" y="22" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="16" fill="white" letterSpacing="-0.5">naspers</text>
    </svg>
  )
}

export function DiscoveryLogo({ className = "h-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 160 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" fill="#003087"/>
      <path d="M8 16 L16 8 L24 16 L16 24 Z" fill="#00A3E0"/>
      <text x="36" y="21" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="15" fill="white" letterSpacing="0.5">DISCOVERY</text>
    </svg>
  )
}

export function TakealotLogo({ className = "h-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 140 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="4" width="24" height="24" rx="4" fill="#0077C8"/>
      <path d="M6 16 L12 10 L18 16 L12 22 Z" fill="white"/>
      <text x="30" y="21" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="15" fill="white" letterSpacing="-0.3">takealot</text>
    </svg>
  )
}

export function CapitecLogo({ className = "h-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 130 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="6" width="20" height="20" rx="10" fill="#00205B"/>
      <rect x="5" y="11" width="10" height="10" rx="5" fill="#6ECFF6"/>
      <text x="26" y="21" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="15" fill="white" letterSpacing="0.3">CAPITEC</text>
    </svg>
  )
}

export function VodacomLogo({ className = "h-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 140 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="16" r="12" fill="#E60000"/>
      <path d="M14 8 Q20 14 14 22 Q8 14 14 8Z" fill="white"/>
      <text x="32" y="21" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="15" fill="white" letterSpacing="-0.3">Vodacom</text>
    </svg>
  )
}

export function StandardBankLogo({ className = "h-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 180 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="4" width="22" height="24" rx="2" fill="#009CDE"/>
      <rect x="4" y="8" width="14" height="3" fill="white"/>
      <rect x="4" y="14" width="14" height="3" fill="white"/>
      <rect x="4" y="20" width="14" height="3" fill="white"/>
      <text x="28" y="21" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="13" fill="white" letterSpacing="0.2">Standard Bank</text>
    </svg>
  )
}

export function FNBLogo({ className = "h-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="4" width="26" height="24" rx="3" fill="#004A97"/>
      <text x="4" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="16" fill="#F7A800">FNB</text>
      <text x="32" y="21" fontFamily="Arial, sans-serif" fontWeight="600" fontSize="13" fill="white" letterSpacing="0.1">Bank</text>
    </svg>
  )
}

export function InvestecLogo({ className = "h-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 140 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="10" width="4" height="12" fill="#004B8D"/>
      <rect x="6" y="6" width="4" height="20" fill="#004B8D"/>
      <rect x="12" y="10" width="4" height="12" fill="#004B8D"/>
      <text x="24" y="21" fontFamily="Georgia, serif" fontWeight="400" fontSize="15" fill="white" letterSpacing="1">INVESTEC</text>
    </svg>
  )
}
