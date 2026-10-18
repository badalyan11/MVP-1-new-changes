const PAPER = "#FFFEFB";
const EDGE = "#D9D0BD";
const SAGE = "#8A9A7E";
const TINTS = ["#C9D6C0", "#E3C9BE", "#D6CFE0", "#EBD9A8", "#BFD3D9", "#E8BFC6"];

/** An album gradually gaining pages over time. */
export function GrowIllustration() {
  const books = [
    { x: 10, thickness: 2, caption: "First smile" },
    { x: 104, thickness: 5, caption: "First steps" },
    { x: 196, thickness: 9, caption: "First day of school" },
  ];
  return (
    <svg viewBox="0 0 300 118" className="w-full" role="img" aria-label="An album gaining pages over time">
      {books.map((b, i) => (
        <g key={b.caption} transform={`translate(${b.x} 8)`}>
          <rect x={-b.thickness} y="3" width={88 + b.thickness * 2} height="62" rx="2" fill={EDGE} />
          <rect x="0" y="0" width="44" height="64" rx="2" fill={PAPER} stroke={EDGE} />
          <rect x="44" y="0" width="44" height="64" rx="2" fill={PAPER} stroke={EDGE} />
          <rect x="43" y="0" width="2" height="64" fill="rgba(60,40,10,0.18)" />
          {/* page contents */}
          <rect x="7" y="9" width="30" height="24" rx="1.5" fill={TINTS[i * 2]} />
          <rect x="7" y="38" width="30" height="2" rx="1" fill={EDGE} />
          <rect x="7" y="43" width="22" height="2" rx="1" fill={EDGE} />
          {i > 0 && <rect x="51" y="9" width="30" height="14" rx="1.5" fill={TINTS[i * 2 + 1]} />}
          {i > 0 && <rect x="51" y="28" width="14" height="14" rx="1.5" fill={TINTS[(i + 3) % 6]} />}
          <rect x="51" y="49" width={i === 0 ? 0 : 24} height="2" rx="1" fill={EDGE} />
          <text x="44" y="86" textAnchor="middle" fontFamily="Caveat, cursive" fontSize="15" fill="#6B655B">
            {b.caption}
          </text>
        </g>
      ))}
      <circle cx="289" cy="9" r="8" fill={SAGE} />
      <path d="M289 5v8M285 9h8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** A pile of photos being organized into one album. */
export function GatherIllustration() {
  const pile = [
    { x: 10, y: 14, r: -8, c: 0 },
    { x: 42, y: 8, r: 6, c: 1 },
    { x: 74, y: 16, r: -4, c: 2 },
    { x: 14, y: 44, r: 5, c: 3 },
    { x: 48, y: 40, r: -7, c: 4 },
    { x: 80, y: 46, r: 8, c: 5 },
    { x: 30, y: 66, r: -3, c: 2 },
    { x: 64, y: 70, r: 4, c: 0 },
  ];
  return (
    <svg viewBox="0 0 300 118" className="w-full" role="img" aria-label="Many photos organized into an album">
      {pile.map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.r} 14 11)`}>
          <rect width="30" height="23" rx="1.5" fill="#fff" stroke={EDGE} />
          <rect x="2.5" y="2.5" width="25" height="18" rx="1" fill={TINTS[p.c]} />
        </g>
      ))}
      <path d="M126 56h30m-7-7 7 7-7 7" fill="none" stroke={SAGE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <g transform="translate(176 14)">
        <rect x="-3" y="3" width="126" height="74" rx="2" fill={EDGE} />
        <rect x="0" y="0" width="60" height="74" rx="2" fill={PAPER} stroke={EDGE} />
        <rect x="60" y="0" width="60" height="74" rx="2" fill={PAPER} stroke={EDGE} />
        <rect x="59" y="0" width="2" height="74" fill="rgba(60,40,10,0.18)" />
        <rect x="7" y="8" width="21" height="27" rx="1.5" fill={TINTS[0]} />
        <rect x="31" y="8" width="22" height="27" rx="1.5" fill={TINTS[1]} />
        <rect x="7" y="39" width="46" height="27" rx="1.5" fill={TINTS[4]} />
        <rect x="67" y="8" width="46" height="36" rx="1.5" fill={TINTS[3]} />
        <rect x="67" y="49" width="30" height="2" rx="1" fill={EDGE} />
        <rect x="67" y="55" width="40" height="2" rx="1" fill={EDGE} />
      </g>
      <text x="55" y="108" textAnchor="middle" fontFamily="Caveat, cursive" fontSize="15" fill="#6B655B">
        40 photos
      </text>
      <text x="236" y="108" textAnchor="middle" fontFamily="Caveat, cursive" fontSize="15" fill="#6B655B">
        one album
      </text>
    </svg>
  );
}
