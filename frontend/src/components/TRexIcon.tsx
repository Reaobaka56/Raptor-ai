import React from 'react';

export function TRexIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      {...props}
    >
      <path d="M 11 2 h 8 v 2 h 2 v 2 h -2 v 2 h 2 v 2 h -8 v -2 h -2 v -2 h -2 V 6 h 2 V 4 h 2 V 2 z m -4 6 h 2 v 2 h 2 v 2 h 2 v 2 h -2 v 2 h -2 v 2 H 7 v -2 H 5 v -2 H 3 V 8 h 2 v 2 h 2 V 8 h 2 z" />
      <path d="M12 4h2v2h-2z" fill="#000" opacity="0.5" />
    </svg>
  );
}
