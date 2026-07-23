/**
 * SA Company SVG Logos — hand-traced from actual brand assets
 */

// Takealot: dark gray wordmark + blue circle with "com"
export function TakealotLogo({ className = "h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 220 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="42" fontFamily="'Arial Black', Arial, sans-serif" fontWeight="900" fontSize="38" fill="#4a4a4a" letterSpacing="-1">takealot</text>
      <circle cx="196" cy="30" r="22" fill="#1B9BD1"/>
      <text x="196" y="36" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="13" fill="white" textAnchor="middle" letterSpacing="0.5">com</text>
    </svg>
  )
}

// Discovery: gold/bronze circle with chevron icon + "Discovery" in navy serif
export function DiscoveryLogo({ className = "h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Bronze/gold circle */}
      <circle cx="28" cy="28" r="26" fill="none" stroke="#B8935A" strokeWidth="2.5"/>
      {/* Inner chevron/V shapes */}
      <path d="M16 22 L28 34 L40 22" stroke="#B8935A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M16 30 L28 42 L40 30" stroke="#B8935A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      {/* Discovery wordmark */}
      <text x="62" y="35" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="400" fontSize="24" fill="#1A3A6B" letterSpacing="0.5">Discovery</text>
    </svg>
  )
}

// Naspers: red radiating sun icon + "NASPERS" in bold black serif
export function NaspersLogo({ className = "h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 190 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Radiating lines sun */}
      {[0,22,44,66,88,110,132,154,176,198,220,242,264,286,308,330].map((angle, i) => {
        const r1 = 10, r2 = 22
        const rad = (angle * Math.PI) / 180
        const x1 = 26 + Math.cos(rad) * r1
        const y1 = 26 + Math.sin(rad) * r1
        const x2 = 26 + Math.cos(rad) * r2
        const y2 = 26 + Math.sin(rad) * r2
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#CC2B2B" strokeWidth="2.8" strokeLinecap="round"/>
      })}
      {/* Center circle */}
      <circle cx="26" cy="26" r="8" fill="#CC2B2B"/>
      {/* Inner face/mask shape */}
      <path d="M22 24 Q26 20 30 24 Q26 30 22 24Z" fill="white" opacity="0.7"/>
      {/* NASPERS text */}
      <text x="56" y="38" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" fontSize="26" fill="#1a1a1a" letterSpacing="3">NASPERS</text>
    </svg>
  )
}

// Capitec: navy+red interlocking C shapes + "CAPITEC" in black
export function CapitecLogo({ className = "h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 230 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Navy left C */}
      <path d="M38 8 C18 8 6 18 6 28 C6 38 18 48 38 48 L38 38 C24 38 16 34 16 28 C16 22 24 18 38 18 Z" fill="#1B3F6E"/>
      {/* Red right C overlapping */}
      <path d="M28 8 C48 8 60 18 60 28 C60 38 48 48 28 48 L28 38 C42 38 50 34 50 28 C50 22 42 18 28 18 Z" fill="#C0282D"/>
      {/* CAPITEC text */}
      <text x="74" y="38" fontFamily="'Arial', sans-serif" fontWeight="900" fontSize="28" fill="#1a1a1a" letterSpacing="2">CAPITEC</text>
    </svg>
  )
}
