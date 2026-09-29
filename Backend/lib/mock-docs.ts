// Mock SVG credential generators for realistic admin document crosschecking
function toBase64(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export function generateArchitectLicenseSvg(name: string, licenseNumber: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 600" width="840" height="600">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FCFBF7"/>
        <stop offset="100%" stop-color="#F3EFE6"/>
      </linearGradient>
      <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#DFB76C"/>
        <stop offset="50%" stop-color="#B8860B"/>
        <stop offset="100%" stop-color="#8B6508"/>
      </linearGradient>
    </defs>
    <!-- Background & Borders -->
    <rect width="840" height="600" fill="url(#bgGrad)"/>
    <rect x="24" y="24" width="792" height="552" fill="none" stroke="#164e33" stroke-width="4"/>
    <rect x="34" y="34" width="772" height="532" fill="none" stroke="url(#gold)" stroke-width="1.5"/>
    <rect x="42" y="42" width="756" height="516" fill="none" stroke="#164e33" stroke-width="0.75" stroke-dasharray="6,3"/>

    <!-- Header / Crest -->
    <circle cx="420" cy="95" r="32" fill="#164e33"/>
    <circle cx="420" cy="95" r="28" fill="none" stroke="url(#gold)" stroke-width="2"/>
    <text x="420" y="103" font-family="serif" font-size="24" fill="#DFB76C" text-anchor="middle" font-weight="bold">🏛️</text>

    <text x="420" y="150" font-family="serif" font-size="18" fill="#164e33" text-anchor="middle" letter-spacing="4" font-weight="bold">ORDRE NATIONAL DES ARCHITECTES</text>
    <text x="420" y="170" font-family="sans-serif" font-size="11" fill="#4B6354" text-anchor="middle" letter-spacing="2">NATIONAL COUNCIL OF REGISTERED ARCHITECTS &amp; URBANISTS</text>

    <line x1="220" y1="185" x2="620" y2="185" stroke="url(#gold)" stroke-width="1.5"/>

    <!-- Title -->
    <text x="420" y="222" font-family="serif" font-size="25" fill="#164e33" text-anchor="middle" font-style="italic">Professional Practicing Certificate &amp; License</text>
    <text x="420" y="248" font-family="sans-serif" font-size="12" fill="#555" text-anchor="middle">THIS IS TO CERTIFY THAT IN ACCORDANCE WITH STATUTORY LAW NO. 90/032</text>

    <!-- Recipient Name -->
    <text x="420" y="300" font-family="serif" font-size="32" fill="#0D3622" text-anchor="middle" font-weight="bold" letter-spacing="1">${name.toUpperCase()}</text>
    <line x1="260" y1="312" x2="580" y2="312" stroke="#164e33" stroke-width="1"/>

    <!-- Certification Text -->
    <text x="420" y="340" font-family="sans-serif" font-size="12.5" fill="#333" text-anchor="middle">Has fulfilled all professional competency assessments and is formally certified</text>
    <text x="420" y="360" font-family="sans-serif" font-size="12.5" fill="#333" text-anchor="middle">as a Licensed Principal Architect with full practice and signature authorization.</text>

    <!-- Metadata Grid -->
    <rect x="180" y="388" width="480" height="52" rx="6" fill="#FFFFFF" stroke="#D1D9D3" stroke-width="1"/>
    <text x="210" y="410" font-family="sans-serif" font-size="10" fill="#666" font-weight="bold">OFFICIAL REGISTRATION NO.</text>
    <text x="210" y="428" font-family="monospace" font-size="15" fill="#164e33" font-weight="bold">${licenseNumber}</text>

    <text x="440" y="410" font-family="sans-serif" font-size="10" fill="#666" font-weight="bold">ISSUED / VALIDITY</text>
    <text x="440" y="428" font-family="sans-serif" font-size="13" fill="#222">Jan 2024 — Dec 2026 (Active)</text>

    <!-- Seal & Signatures -->
    <g transform="translate(130, 470)">
      <circle cx="45" cy="40" r="35" fill="none" stroke="url(#gold)" stroke-width="3"/>
      <circle cx="45" cy="40" r="30" fill="none" stroke="#164e33" stroke-width="1" stroke-dasharray="3,2"/>
      <text x="45" y="37" font-family="sans-serif" font-size="8" fill="#164e33" font-weight="bold" text-anchor="middle">COUNCIL SEAL</text>
      <text x="45" y="49" font-family="sans-serif" font-size="7" fill="#B8860B" text-anchor="middle">VERIFIED 2024</text>
    </g>

    <g transform="translate(480, 480)">
      <path d="M 10 30 Q 50 5, 90 28 T 160 20" fill="none" stroke="#103254" stroke-width="2"/>
      <line x1="0" y1="42" x2="200" y2="42" stroke="#888" stroke-width="0.8"/>
      <text x="100" y="55" font-family="sans-serif" font-size="11" fill="#333" text-anchor="middle" font-weight="bold">Prof. Jean-Marc Mbarga</text>
      <text x="100" y="68" font-family="sans-serif" font-size="9.5" fill="#666" text-anchor="middle">President of the Governing Board</text>
    </g>
  </svg>`;
  return toBase64(svg);
}

export function generateNationalIdSvg(name: string, idNumber: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 540" width="850" height="540">
    <defs>
      <linearGradient id="idBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#E9F1F7"/>
        <stop offset="100%" stop-color="#CFE0EC"/>
      </linearGradient>
    </defs>
    <rect width="850" height="540" rx="24" fill="url(#idBg)" stroke="#A7C2D6" stroke-width="3"/>
    
    <!-- Guilloche pattern simulation -->
    <path d="M 0 100 Q 212 180 425 100 T 850 100" fill="none" stroke="#B8D3E6" stroke-width="1.5" opacity="0.6"/>
    <path d="M 0 140 Q 212 220 425 140 T 850 140" fill="none" stroke="#B8D3E6" stroke-width="1.5" opacity="0.6"/>
    <path d="M 0 180 Q 212 260 425 180 T 850 180" fill="none" stroke="#B8D3E6" stroke-width="1.5" opacity="0.6"/>

    <!-- Header -->
    <rect x="25" y="25" width="800" height="70" rx="12" fill="#1C4B72"/>
    <text x="425" y="53" font-family="sans-serif" font-size="15" fill="#FFFFFF" text-anchor="middle" font-weight="bold" letter-spacing="2">REPUBLIQUE / REPUBLIC OF CAMEROON</text>
    <text x="425" y="74" font-family="sans-serif" font-size="12" fill="#A4CBED" text-anchor="middle" letter-spacing="3">CARTE NATIONALE D'IDENTITE / NATIONAL IDENTITY CARD</text>

    <!-- Photo Avatar Box -->
    <rect x="50" y="125" width="190" height="240" rx="10" fill="#E2EAF0" stroke="#7A9FB8" stroke-width="2"/>
    <!-- Person silhouette -->
    <circle cx="145" cy="205" r="45" fill="#7A9FB8"/>
    <path d="M 85 340 C 85 275, 205 275, 205 340 Z" fill="#7A9FB8"/>
    <!-- Hologram badge on photo -->
    <circle cx="210" cy="335" r="16" fill="#F4D03F" opacity="0.85"/>
    <text x="210" y="340" font-family="sans-serif" font-size="9" fill="#7D6608" text-anchor="middle" font-weight="bold">CHIP</text>

    <!-- Identification Details -->
    <g transform="translate(270, 130)">
      <text x="0" y="20" font-family="sans-serif" font-size="10" fill="#52738B" font-weight="bold">SURNAME &amp; GIVEN NAMES / NOM ET PRENOMS</text>
      <text x="0" y="44" font-family="sans-serif" font-size="19" fill="#0D2A42" font-weight="bold">${name.toUpperCase()}</text>

      <text x="0" y="80" font-family="sans-serif" font-size="10" fill="#52738B" font-weight="bold">NATIONAL ID NO. / N° CNI</text>
      <text x="0" y="104" font-family="monospace" font-size="19" fill="#1C4B72" font-weight="bold">${idNumber}</text>

      <text x="0" y="140" font-family="sans-serif" font-size="10" fill="#52738B" font-weight="bold">NATIONALITY / NATIONALITE</text>
      <text x="0" y="160" font-family="sans-serif" font-size="14" fill="#222">CAMEROONIAN / CAMEROUNAISE</text>

      <text x="240" y="140" font-family="sans-serif" font-size="10" fill="#52738B" font-weight="bold">DATE OF BIRTH / NE(E) LE</text>
      <text x="240" y="160" font-family="sans-serif" font-size="14" fill="#222">14/08/1988</text>

      <text x="0" y="200" font-family="sans-serif" font-size="10" fill="#52738B" font-weight="bold">DATE OF ISSUE / DATE DE DELIVRANCE</text>
      <text x="0" y="220" font-family="sans-serif" font-size="14" fill="#222">18/02/2022</text>

      <text x="240" y="200" font-family="sans-serif" font-size="10" fill="#52738B" font-weight="bold">EXPIRY DATE / DATE D'EXPIRATION</text>
      <text x="240" y="220" font-family="sans-serif" font-size="14" fill="#155724" font-weight="bold">18/02/2032 (VALID)</text>
    </g>

    <!-- MRZ Zone at bottom -->
    <rect x="25" y="410" width="800" height="95" rx="8" fill="#142B3B"/>
    <text x="45" y="448" font-family="monospace" font-size="15" fill="#E8F1F5" letter-spacing="3.5">IDCAM${idNumber}&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
    <text x="45" y="480" font-family="monospace" font-size="15" fill="#E8F1F5" letter-spacing="3.5">8808144F3202188CAM&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;04</text>
  </svg>`;
  return toBase64(svg);
}

export function generateDiplomaSvg(name: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 600" width="840" height="600">
    <rect width="840" height="600" fill="#FDFCF7" stroke="#333" stroke-width="3"/>
    <rect x="20" y="20" width="800" height="560" fill="none" stroke="#7E5224" stroke-width="2"/>
    <rect x="28" y="28" width="784" height="544" fill="none" stroke="#7E5224" stroke-width="0.8" stroke-dasharray="4,4"/>

    <text x="420" y="110" font-family="serif" font-size="28" fill="#2E1C0C" text-anchor="middle" font-weight="bold">FACULTY OF ARCHITECTURE &amp; URBAN PLANNING</text>
    <text x="420" y="135" font-family="serif" font-size="14" fill="#6E4A28" text-anchor="middle" letter-spacing="2">NATIONAL POLYTECHNIC INSTITUTE</text>

    <text x="420" y="210" font-family="serif" font-size="16" fill="#444" text-anchor="middle" font-style="italic">Upon the recommendation of the Academic Council, confers upon</text>

    <text x="420" y="275" font-family="serif" font-size="34" fill="#1C3829" text-anchor="middle" font-weight="bold">${name.toUpperCase()}</text>
    <line x1="240" y1="290" x2="600" y2="290" stroke="#7E5224" stroke-width="1"/>

    <text x="420" y="335" font-family="serif" font-size="22" fill="#7E5224" text-anchor="middle" font-weight="bold">THE DEGREE OF MASTER OF ARCHITECTURE</text>
    <text x="420" y="365" font-family="sans-serif" font-size="13" fill="#333" text-anchor="middle">Specialization in Sustainable Tropical Architecture &amp; Environmental Systems</text>
    <text x="420" y="388" font-family="sans-serif" font-size="12" fill="#555" text-anchor="middle">With Highest Academic Distinction (Magna Cum Laude)</text>

    <!-- University Seal -->
    <circle cx="180" cy="480" r="42" fill="#A93226"/>
    <circle cx="180" cy="480" r="36" fill="none" stroke="#FDFCF7" stroke-width="2"/>
    <text x="180" y="476" font-family="serif" font-size="10" fill="#FFF" font-weight="bold" text-anchor="middle">FACULTY SEAL</text>
    <text x="180" y="492" font-family="sans-serif" font-size="9" fill="#FFF" text-anchor="middle">HONORS 2012</text>

    <!-- Dean Signature -->
    <g transform="translate(520, 450)">
      <path d="M 10 25 Q 45 5, 80 20 T 150 15" fill="none" stroke="#162D4A" stroke-width="2"/>
      <line x1="0" y1="36" x2="180" y2="36" stroke="#666" stroke-width="1"/>
      <text x="90" y="52" font-family="sans-serif" font-size="11" fill="#222" font-weight="bold" text-anchor="middle">Dean of Faculty</text>
    </g>
  </svg>`;
  return toBase64(svg);
}

export function generateCommercialRegisterSvg(businessName: string, regNumber: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 600" width="840" height="600">
    <rect width="840" height="600" fill="#FAF9F5" stroke="#1E3A5F" stroke-width="3"/>
    <rect x="25" y="25" width="790" height="550" fill="none" stroke="#2B5B84" stroke-width="1"/>

    <text x="420" y="80" font-family="serif" font-size="18" fill="#1E3A5F" text-anchor="middle" font-weight="bold" letter-spacing="2">GREFFE DU TRIBUNAL DE PREMIERE INSTANCE DE DOUALA</text>
    <text x="420" y="105" font-family="sans-serif" font-size="13" fill="#42688C" text-anchor="middle" font-weight="bold" letter-spacing="1.5">REGISTRE DU COMMERCE ET DU CREDIT MOBILIER (RCCM)</text>

    <line x1="180" y1="125" x2="660" y2="125" stroke="#1E3A5F" stroke-width="1.5"/>

    <text x="420" y="165" font-family="serif" font-size="22" fill="#1E3A5F" text-anchor="middle" font-weight="bold">EXTRAIT D'IMMATRICULATION PRINCIPALE</text>
    <text x="420" y="190" font-family="sans-serif" font-size="12" fill="#666" text-anchor="middle">OFFICIAL TRADE &amp; CORPORATE REGISTER RECORD</text>

    <!-- Data Container -->
    <rect x="80" y="220" width="680" height="240" rx="8" fill="#FFFFFF" stroke="#CCD8E2" stroke-width="1"/>

    <g transform="translate(110, 245)">
      <text x="0" y="15" font-family="sans-serif" font-size="11" fill="#666" font-weight="bold">DENOMINATION SOCIALE / TRADE NAME</text>
      <text x="0" y="38" font-family="sans-serif" font-size="18" fill="#1E3A5F" font-weight="bold">${businessName.toUpperCase()}</text>

      <text x="0" y="75" font-family="sans-serif" font-size="11" fill="#666" font-weight="bold">NUMERO DU REGISTRE DU COMMERCE / RCCM NUMBER</text>
      <text x="0" y="98" font-family="monospace" font-size="17" fill="#8B2500" font-weight="bold">${regNumber}</text>

      <text x="0" y="135" font-family="sans-serif" font-size="11" fill="#666" font-weight="bold">FORME JURIDIQUE &amp; CAPITAL</text>
      <text x="0" y="155" font-family="sans-serif" font-size="13" fill="#222">Société à Responsabilité Limitée (SARL) — Capital: 50,000,000 FCFA</text>

      <text x="0" y="185" font-family="sans-serif" font-size="11" fill="#666" font-weight="bold">SIEGE SOCIAL &amp; ACTIVITE</text>
      <text x="0" y="205" font-family="sans-serif" font-size="13" fill="#222">Zone Industrielle Bassa, Douala — Import &amp; Distribution of Building Supplies</text>
    </g>

    <!-- Official Stamp -->
    <g transform="translate(600, 480)">
      <circle cx="50" cy="40" r="40" fill="none" stroke="#004080" stroke-width="2"/>
      <circle cx="50" cy="40" r="35" fill="none" stroke="#004080" stroke-width="0.8" stroke-dasharray="3,2"/>
      <text x="50" y="35" font-family="sans-serif" font-size="8.5" fill="#004080" font-weight="bold" text-anchor="middle">GREFFE COMMERCIAL</text>
      <text x="50" y="48" font-family="sans-serif" font-size="8" fill="#004080" text-anchor="middle">CERTIFIE CONFORME</text>
    </g>
  </svg>`;
  return toBase64(svg);
}

export function generateTaxpayerCardSvg(businessName: string, taxId: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 540" width="850" height="540">
    <rect width="850" height="540" rx="20" fill="#EEF7EE" stroke="#2D7A3E" stroke-width="3"/>
    
    <rect x="25" y="25" width="800" height="65" rx="10" fill="#1C5E2D"/>
    <text x="425" y="52" font-family="sans-serif" font-size="15" fill="#FFFFFF" text-anchor="middle" font-weight="bold" letter-spacing="2">DIRECTION GENERALE DES IMPOTS / TAXATION AUTHORITY</text>
    <text x="425" y="72" font-family="sans-serif" font-size="11" fill="#BDE5C5" text-anchor="middle" letter-spacing="2">CARTE DE CONTRIBUABLE ELECTRONIQUE / TAXPAYER ID</text>

    <!-- QR Simulation Box -->
    <rect x="60" y="130" width="180" height="180" rx="8" fill="#FFFFFF" stroke="#88B893" stroke-width="2"/>
    <rect x="75" y="145" width="50" height="50" fill="#1C5E2D"/>
    <rect x="175" y="145" width="50" height="50" fill="#1C5E2D"/>
    <rect x="75" y="245" width="50" height="50" fill="#1C5E2D"/>
    <circle cx="160" cy="225" r="14" fill="#1C5E2D"/>

    <g transform="translate(280, 130)">
      <text x="0" y="20" font-family="sans-serif" font-size="11" fill="#4B7754" font-weight="bold">RAISON SOCIALE / BUSINESS LEGAL NAME</text>
      <text x="0" y="45" font-family="sans-serif" font-size="20" fill="#10361A" font-weight="bold">${businessName.toUpperCase()}</text>

      <text x="0" y="90" font-family="sans-serif" font-size="11" fill="#4B7754" font-weight="bold">NUMERO D'IDENTIFICATION FISCALE (NIF / TIN)</text>
      <text x="0" y="118" font-family="monospace" font-size="22" fill="#1C5E2D" font-weight="bold">${taxId}</text>

      <text x="0" y="160" font-family="sans-serif" font-size="11" fill="#4B7754" font-weight="bold">REGIME FISCAL &amp; CENTRE DE RATTACHEMENT</text>
      <text x="0" y="180" font-family="sans-serif" font-size="14" fill="#222">Régime Réel — Centre Divisionnaire des Impôts Douala 1</text>

      <text x="0" y="215" font-family="sans-serif" font-size="11" fill="#4B7754" font-weight="bold">STATUT FISCAL ACTIF</text>
      <text x="0" y="235" font-family="sans-serif" font-size="14" fill="#155724" font-weight="bold">En règle avec toutes obligations déclaratives (Exercice 2024)</text>
    </g>

    <rect x="25" y="440" width="800" height="60" rx="8" fill="#1C5E2D"/>
    <text x="425" y="475" font-family="sans-serif" font-size="13" fill="#FFFFFF" text-anchor="middle" font-weight="bold" letter-spacing="1">AUTHENTICATED IN TAXPAYER REGISTRY · SECURE QR VERIFIED</text>
  </svg>`;
  return toBase64(svg);
}

export function generateWarehousePermitSvg(businessName: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 600" width="840" height="600">
    <rect width="840" height="600" fill="#FCFCFA" stroke="#2B3A42" stroke-width="3"/>
    <rect x="25" y="25" width="790" height="550" fill="none" stroke="#C0C9CC" stroke-width="1.5"/>

    <text x="420" y="80" font-family="sans-serif" font-size="16" fill="#1C2B33" text-anchor="middle" font-weight="bold" letter-spacing="2">MINISTERE DU COMMERCE ET DE L'INDUSTRIE</text>
    <text x="420" y="105" font-family="sans-serif" font-size="12" fill="#52636B" text-anchor="middle" letter-spacing="1">DEPARTMENT OF STANDARDS, STORAGE &amp; COMMERCIAL INFRASTRUCTURE</text>

    <line x1="200" y1="125" x2="640" y2="125" stroke="#1C2B33" stroke-width="1.5"/>

    <text x="420" y="170" font-family="serif" font-size="23" fill="#1C2B33" text-anchor="middle" font-weight="bold">Warehouse &amp; Building Materials Facility Permit</text>
    <text x="420" y="195" font-family="sans-serif" font-size="12" fill="#666" text-anchor="middle">LICENCE D'EXPLOITATION D'ENTREPOT DE MATERIAUX DE CONSTRUCTION</text>

    <rect x="80" y="230" width="680" height="200" rx="8" fill="#FFFFFF" stroke="#DFE3E5" stroke-width="1"/>

    <g transform="translate(110, 260)">
      <text x="0" y="15" font-family="sans-serif" font-size="11" fill="#666" font-weight="bold">OPERATING ENTITY / BENEFICIAIRE</text>
      <text x="0" y="38" font-family="sans-serif" font-size="18" fill="#1C2B33" font-weight="bold">${businessName.toUpperCase()}</text>

      <text x="0" y="75" font-family="sans-serif" font-size="11" fill="#666" font-weight="bold">FACILITY LOCATION &amp; INSPECTION</text>
      <text x="0" y="95" font-family="sans-serif" font-size="13" fill="#222">Port Logistics Zone, Hangar 4B, Douala Port Authority</text>

      <text x="0" y="130" font-family="sans-serif" font-size="11" fill="#666" font-weight="bold">AUTHORIZED COMMODITIES</text>
      <text x="0" y="150" font-family="sans-serif" font-size="13" fill="#222">Cement, Rebar, Steel, Structural Glazing, Ceramic Finishes &amp; Aggregates</text>
    </g>

    <g transform="translate(120, 480)">
      <circle cx="40" cy="30" r="30" fill="none" stroke="#1C2B33" stroke-width="2"/>
      <text x="40" y="33" font-family="sans-serif" font-size="7.5" fill="#1C2B33" font-weight="bold" text-anchor="middle">INSPECTED</text>
      <text x="40" y="44" font-family="sans-serif" font-size="7" fill="#1C2B33" text-anchor="middle">APPROVED</text>
    </g>
  </svg>`;
  return toBase64(svg);
}
