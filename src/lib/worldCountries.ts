// Canonical worldwide country list for thenetworkers.app.
//
// Sourced from ISO 3166-1 alpha-2. Top-of-list bias: GB / IE / US / AU /
// CA — thenetworkers.app's home + primary English-speaking markets where
// the affiliate programme launched. After those five the list is
// strictly alphabetical by `name`, so anyone outside the top markets
// finds their country quickly.
//
// Every entry carries the ISO-2 code (the canonical key), the
// human-readable name, an emoji flag (for inline rendering — no SVG
// dependency) and the dial code (so we can reuse the list for phone /
// WhatsApp inputs too, avoiding a second list).
//
// Older callers that imported the legacy 28-entry `countryDialCodes`
// list should keep working — that file is preserved for backwards
// compatibility, but new code should import from here.

export type Country = {
  iso2: string;
  name: string;
  flag: string;
  dial_code: string;
};

// Top markets — pinned in this order. Comment intentionally explicit so
// anyone editing the file later understands the reason.
const TOP_MARKETS: ReadonlyArray<Country> = [
  { iso2: "GB", name: "United Kingdom", flag: "🇬🇧", dial_code: "+44" },
  { iso2: "IE", name: "Ireland", flag: "🇮🇪", dial_code: "+353" },
  { iso2: "US", name: "United States", flag: "🇺🇸", dial_code: "+1" },
  { iso2: "AU", name: "Australia", flag: "🇦🇺", dial_code: "+61" },
  { iso2: "CA", name: "Canada", flag: "🇨🇦", dial_code: "+1" }
];

// Rest of the world — ISO 3166-1 alpha-2, alphabetical by name. The
// top-market entries above are deliberately excluded from this list to
// avoid duplicates.
const REST_OF_WORLD: ReadonlyArray<Country> = [
  { iso2: "AF", name: "Afghanistan", flag: "🇦🇫", dial_code: "+93" },
  { iso2: "AL", name: "Albania", flag: "🇦🇱", dial_code: "+355" },
  { iso2: "DZ", name: "Algeria", flag: "🇩🇿", dial_code: "+213" },
  { iso2: "AS", name: "American Samoa", flag: "🇦🇸", dial_code: "+1684" },
  { iso2: "AD", name: "Andorra", flag: "🇦🇩", dial_code: "+376" },
  { iso2: "AO", name: "Angola", flag: "🇦🇴", dial_code: "+244" },
  { iso2: "AI", name: "Anguilla", flag: "🇦🇮", dial_code: "+1264" },
  { iso2: "AG", name: "Antigua and Barbuda", flag: "🇦🇬", dial_code: "+1268" },
  { iso2: "AR", name: "Argentina", flag: "🇦🇷", dial_code: "+54" },
  { iso2: "AM", name: "Armenia", flag: "🇦🇲", dial_code: "+374" },
  { iso2: "AW", name: "Aruba", flag: "🇦🇼", dial_code: "+297" },
  { iso2: "AT", name: "Austria", flag: "🇦🇹", dial_code: "+43" },
  { iso2: "AZ", name: "Azerbaijan", flag: "🇦🇿", dial_code: "+994" },
  { iso2: "BS", name: "Bahamas", flag: "🇧🇸", dial_code: "+1242" },
  { iso2: "BH", name: "Bahrain", flag: "🇧🇭", dial_code: "+973" },
  { iso2: "BD", name: "Bangladesh", flag: "🇧🇩", dial_code: "+880" },
  { iso2: "BB", name: "Barbados", flag: "🇧🇧", dial_code: "+1246" },
  { iso2: "BY", name: "Belarus", flag: "🇧🇾", dial_code: "+375" },
  { iso2: "BE", name: "Belgium", flag: "🇧🇪", dial_code: "+32" },
  { iso2: "BZ", name: "Belize", flag: "🇧🇿", dial_code: "+501" },
  { iso2: "BJ", name: "Benin", flag: "🇧🇯", dial_code: "+229" },
  { iso2: "BM", name: "Bermuda", flag: "🇧🇲", dial_code: "+1441" },
  { iso2: "BT", name: "Bhutan", flag: "🇧🇹", dial_code: "+975" },
  { iso2: "BO", name: "Bolivia", flag: "🇧🇴", dial_code: "+591" },
  {
    iso2: "BA",
    name: "Bosnia and Herzegovina",
    flag: "🇧🇦",
    dial_code: "+387"
  },
  { iso2: "BW", name: "Botswana", flag: "🇧🇼", dial_code: "+267" },
  { iso2: "BR", name: "Brazil", flag: "🇧🇷", dial_code: "+55" },
  {
    iso2: "IO",
    name: "British Indian Ocean Territory",
    flag: "🇮🇴",
    dial_code: "+246"
  },
  {
    iso2: "VG",
    name: "British Virgin Islands",
    flag: "🇻🇬",
    dial_code: "+1284"
  },
  { iso2: "BN", name: "Brunei", flag: "🇧🇳", dial_code: "+673" },
  { iso2: "BG", name: "Bulgaria", flag: "🇧🇬", dial_code: "+359" },
  { iso2: "BF", name: "Burkina Faso", flag: "🇧🇫", dial_code: "+226" },
  { iso2: "BI", name: "Burundi", flag: "🇧🇮", dial_code: "+257" },
  { iso2: "KH", name: "Cambodia", flag: "🇰🇭", dial_code: "+855" },
  { iso2: "CM", name: "Cameroon", flag: "🇨🇲", dial_code: "+237" },
  { iso2: "CV", name: "Cape Verde", flag: "🇨🇻", dial_code: "+238" },
  { iso2: "KY", name: "Cayman Islands", flag: "🇰🇾", dial_code: "+1345" },
  {
    iso2: "CF",
    name: "Central African Republic",
    flag: "🇨🇫",
    dial_code: "+236"
  },
  { iso2: "TD", name: "Chad", flag: "🇹🇩", dial_code: "+235" },
  { iso2: "CL", name: "Chile", flag: "🇨🇱", dial_code: "+56" },
  { iso2: "CN", name: "China", flag: "🇨🇳", dial_code: "+86" },
  { iso2: "CO", name: "Colombia", flag: "🇨🇴", dial_code: "+57" },
  { iso2: "KM", name: "Comoros", flag: "🇰🇲", dial_code: "+269" },
  {
    iso2: "CD",
    name: "Congo (DRC)",
    flag: "🇨🇩",
    dial_code: "+243"
  },
  {
    iso2: "CG",
    name: "Congo (Republic)",
    flag: "🇨🇬",
    dial_code: "+242"
  },
  { iso2: "CK", name: "Cook Islands", flag: "🇨🇰", dial_code: "+682" },
  { iso2: "CR", name: "Costa Rica", flag: "🇨🇷", dial_code: "+506" },
  { iso2: "CI", name: "Côte d'Ivoire", flag: "🇨🇮", dial_code: "+225" },
  { iso2: "HR", name: "Croatia", flag: "🇭🇷", dial_code: "+385" },
  { iso2: "CU", name: "Cuba", flag: "🇨🇺", dial_code: "+53" },
  { iso2: "CW", name: "Curaçao", flag: "🇨🇼", dial_code: "+599" },
  { iso2: "CY", name: "Cyprus", flag: "🇨🇾", dial_code: "+357" },
  { iso2: "CZ", name: "Czechia", flag: "🇨🇿", dial_code: "+420" },
  { iso2: "DK", name: "Denmark", flag: "🇩🇰", dial_code: "+45" },
  { iso2: "DJ", name: "Djibouti", flag: "🇩🇯", dial_code: "+253" },
  { iso2: "DM", name: "Dominica", flag: "🇩🇲", dial_code: "+1767" },
  {
    iso2: "DO",
    name: "Dominican Republic",
    flag: "🇩🇴",
    dial_code: "+1809"
  },
  { iso2: "EC", name: "Ecuador", flag: "🇪🇨", dial_code: "+593" },
  { iso2: "EG", name: "Egypt", flag: "🇪🇬", dial_code: "+20" },
  { iso2: "SV", name: "El Salvador", flag: "🇸🇻", dial_code: "+503" },
  { iso2: "GQ", name: "Equatorial Guinea", flag: "🇬🇶", dial_code: "+240" },
  { iso2: "ER", name: "Eritrea", flag: "🇪🇷", dial_code: "+291" },
  { iso2: "EE", name: "Estonia", flag: "🇪🇪", dial_code: "+372" },
  { iso2: "SZ", name: "Eswatini", flag: "🇸🇿", dial_code: "+268" },
  { iso2: "ET", name: "Ethiopia", flag: "🇪🇹", dial_code: "+251" },
  { iso2: "FK", name: "Falkland Islands", flag: "🇫🇰", dial_code: "+500" },
  { iso2: "FO", name: "Faroe Islands", flag: "🇫🇴", dial_code: "+298" },
  { iso2: "FJ", name: "Fiji", flag: "🇫🇯", dial_code: "+679" },
  { iso2: "FI", name: "Finland", flag: "🇫🇮", dial_code: "+358" },
  { iso2: "FR", name: "France", flag: "🇫🇷", dial_code: "+33" },
  { iso2: "GF", name: "French Guiana", flag: "🇬🇫", dial_code: "+594" },
  { iso2: "PF", name: "French Polynesia", flag: "🇵🇫", dial_code: "+689" },
  { iso2: "GA", name: "Gabon", flag: "🇬🇦", dial_code: "+241" },
  { iso2: "GM", name: "Gambia", flag: "🇬🇲", dial_code: "+220" },
  { iso2: "GE", name: "Georgia", flag: "🇬🇪", dial_code: "+995" },
  { iso2: "DE", name: "Germany", flag: "🇩🇪", dial_code: "+49" },
  { iso2: "GH", name: "Ghana", flag: "🇬🇭", dial_code: "+233" },
  { iso2: "GI", name: "Gibraltar", flag: "🇬🇮", dial_code: "+350" },
  { iso2: "GR", name: "Greece", flag: "🇬🇷", dial_code: "+30" },
  { iso2: "GL", name: "Greenland", flag: "🇬🇱", dial_code: "+299" },
  { iso2: "GD", name: "Grenada", flag: "🇬🇩", dial_code: "+1473" },
  { iso2: "GP", name: "Guadeloupe", flag: "🇬🇵", dial_code: "+590" },
  { iso2: "GU", name: "Guam", flag: "🇬🇺", dial_code: "+1671" },
  { iso2: "GT", name: "Guatemala", flag: "🇬🇹", dial_code: "+502" },
  { iso2: "GG", name: "Guernsey", flag: "🇬🇬", dial_code: "+44" },
  { iso2: "GN", name: "Guinea", flag: "🇬🇳", dial_code: "+224" },
  { iso2: "GW", name: "Guinea-Bissau", flag: "🇬🇼", dial_code: "+245" },
  { iso2: "GY", name: "Guyana", flag: "🇬🇾", dial_code: "+592" },
  { iso2: "HT", name: "Haiti", flag: "🇭🇹", dial_code: "+509" },
  { iso2: "HN", name: "Honduras", flag: "🇭🇳", dial_code: "+504" },
  { iso2: "HK", name: "Hong Kong", flag: "🇭🇰", dial_code: "+852" },
  { iso2: "HU", name: "Hungary", flag: "🇭🇺", dial_code: "+36" },
  { iso2: "IS", name: "Iceland", flag: "🇮🇸", dial_code: "+354" },
  { iso2: "IN", name: "India", flag: "🇮🇳", dial_code: "+91" },
  { iso2: "ID", name: "Indonesia", flag: "🇮🇩", dial_code: "+62" },
  { iso2: "IR", name: "Iran", flag: "🇮🇷", dial_code: "+98" },
  { iso2: "IQ", name: "Iraq", flag: "🇮🇶", dial_code: "+964" },
  { iso2: "IM", name: "Isle of Man", flag: "🇮🇲", dial_code: "+44" },
  { iso2: "IL", name: "Israel", flag: "🇮🇱", dial_code: "+972" },
  { iso2: "IT", name: "Italy", flag: "🇮🇹", dial_code: "+39" },
  { iso2: "JM", name: "Jamaica", flag: "🇯🇲", dial_code: "+1876" },
  { iso2: "JP", name: "Japan", flag: "🇯🇵", dial_code: "+81" },
  { iso2: "JE", name: "Jersey", flag: "🇯🇪", dial_code: "+44" },
  { iso2: "JO", name: "Jordan", flag: "🇯🇴", dial_code: "+962" },
  { iso2: "KZ", name: "Kazakhstan", flag: "🇰🇿", dial_code: "+7" },
  { iso2: "KE", name: "Kenya", flag: "🇰🇪", dial_code: "+254" },
  { iso2: "KI", name: "Kiribati", flag: "🇰🇮", dial_code: "+686" },
  { iso2: "XK", name: "Kosovo", flag: "🇽🇰", dial_code: "+383" },
  { iso2: "KW", name: "Kuwait", flag: "🇰🇼", dial_code: "+965" },
  { iso2: "KG", name: "Kyrgyzstan", flag: "🇰🇬", dial_code: "+996" },
  { iso2: "LA", name: "Laos", flag: "🇱🇦", dial_code: "+856" },
  { iso2: "LV", name: "Latvia", flag: "🇱🇻", dial_code: "+371" },
  { iso2: "LB", name: "Lebanon", flag: "🇱🇧", dial_code: "+961" },
  { iso2: "LS", name: "Lesotho", flag: "🇱🇸", dial_code: "+266" },
  { iso2: "LR", name: "Liberia", flag: "🇱🇷", dial_code: "+231" },
  { iso2: "LY", name: "Libya", flag: "🇱🇾", dial_code: "+218" },
  { iso2: "LI", name: "Liechtenstein", flag: "🇱🇮", dial_code: "+423" },
  { iso2: "LT", name: "Lithuania", flag: "🇱🇹", dial_code: "+370" },
  { iso2: "LU", name: "Luxembourg", flag: "🇱🇺", dial_code: "+352" },
  { iso2: "MO", name: "Macao", flag: "🇲🇴", dial_code: "+853" },
  { iso2: "MG", name: "Madagascar", flag: "🇲🇬", dial_code: "+261" },
  { iso2: "MW", name: "Malawi", flag: "🇲🇼", dial_code: "+265" },
  { iso2: "MY", name: "Malaysia", flag: "🇲🇾", dial_code: "+60" },
  { iso2: "MV", name: "Maldives", flag: "🇲🇻", dial_code: "+960" },
  { iso2: "ML", name: "Mali", flag: "🇲🇱", dial_code: "+223" },
  { iso2: "MT", name: "Malta", flag: "🇲🇹", dial_code: "+356" },
  { iso2: "MH", name: "Marshall Islands", flag: "🇲🇭", dial_code: "+692" },
  { iso2: "MQ", name: "Martinique", flag: "🇲🇶", dial_code: "+596" },
  { iso2: "MR", name: "Mauritania", flag: "🇲🇷", dial_code: "+222" },
  { iso2: "MU", name: "Mauritius", flag: "🇲🇺", dial_code: "+230" },
  { iso2: "YT", name: "Mayotte", flag: "🇾🇹", dial_code: "+262" },
  { iso2: "MX", name: "Mexico", flag: "🇲🇽", dial_code: "+52" },
  { iso2: "FM", name: "Micronesia", flag: "🇫🇲", dial_code: "+691" },
  { iso2: "MD", name: "Moldova", flag: "🇲🇩", dial_code: "+373" },
  { iso2: "MC", name: "Monaco", flag: "🇲🇨", dial_code: "+377" },
  { iso2: "MN", name: "Mongolia", flag: "🇲🇳", dial_code: "+976" },
  { iso2: "ME", name: "Montenegro", flag: "🇲🇪", dial_code: "+382" },
  { iso2: "MS", name: "Montserrat", flag: "🇲🇸", dial_code: "+1664" },
  { iso2: "MA", name: "Morocco", flag: "🇲🇦", dial_code: "+212" },
  { iso2: "MZ", name: "Mozambique", flag: "🇲🇿", dial_code: "+258" },
  { iso2: "MM", name: "Myanmar", flag: "🇲🇲", dial_code: "+95" },
  { iso2: "NA", name: "Namibia", flag: "🇳🇦", dial_code: "+264" },
  { iso2: "NR", name: "Nauru", flag: "🇳🇷", dial_code: "+674" },
  { iso2: "NP", name: "Nepal", flag: "🇳🇵", dial_code: "+977" },
  { iso2: "NL", name: "Netherlands", flag: "🇳🇱", dial_code: "+31" },
  { iso2: "NC", name: "New Caledonia", flag: "🇳🇨", dial_code: "+687" },
  { iso2: "NZ", name: "New Zealand", flag: "🇳🇿", dial_code: "+64" },
  { iso2: "NI", name: "Nicaragua", flag: "🇳🇮", dial_code: "+505" },
  { iso2: "NE", name: "Niger", flag: "🇳🇪", dial_code: "+227" },
  { iso2: "NG", name: "Nigeria", flag: "🇳🇬", dial_code: "+234" },
  { iso2: "NU", name: "Niue", flag: "🇳🇺", dial_code: "+683" },
  { iso2: "KP", name: "North Korea", flag: "🇰🇵", dial_code: "+850" },
  {
    iso2: "MK",
    name: "North Macedonia",
    flag: "🇲🇰",
    dial_code: "+389"
  },
  {
    iso2: "MP",
    name: "Northern Mariana Islands",
    flag: "🇲🇵",
    dial_code: "+1670"
  },
  { iso2: "NO", name: "Norway", flag: "🇳🇴", dial_code: "+47" },
  { iso2: "OM", name: "Oman", flag: "🇴🇲", dial_code: "+968" },
  { iso2: "PK", name: "Pakistan", flag: "🇵🇰", dial_code: "+92" },
  { iso2: "PW", name: "Palau", flag: "🇵🇼", dial_code: "+680" },
  { iso2: "PS", name: "Palestine", flag: "🇵🇸", dial_code: "+970" },
  { iso2: "PA", name: "Panama", flag: "🇵🇦", dial_code: "+507" },
  { iso2: "PG", name: "Papua New Guinea", flag: "🇵🇬", dial_code: "+675" },
  { iso2: "PY", name: "Paraguay", flag: "🇵🇾", dial_code: "+595" },
  { iso2: "PE", name: "Peru", flag: "🇵🇪", dial_code: "+51" },
  { iso2: "PH", name: "Philippines", flag: "🇵🇭", dial_code: "+63" },
  { iso2: "PL", name: "Poland", flag: "🇵🇱", dial_code: "+48" },
  { iso2: "PT", name: "Portugal", flag: "🇵🇹", dial_code: "+351" },
  { iso2: "PR", name: "Puerto Rico", flag: "🇵🇷", dial_code: "+1787" },
  { iso2: "QA", name: "Qatar", flag: "🇶🇦", dial_code: "+974" },
  { iso2: "RE", name: "Réunion", flag: "🇷🇪", dial_code: "+262" },
  { iso2: "RO", name: "Romania", flag: "🇷🇴", dial_code: "+40" },
  { iso2: "RU", name: "Russia", flag: "🇷🇺", dial_code: "+7" },
  { iso2: "RW", name: "Rwanda", flag: "🇷🇼", dial_code: "+250" },
  {
    iso2: "BL",
    name: "Saint Barthélemy",
    flag: "🇧🇱",
    dial_code: "+590"
  },
  { iso2: "SH", name: "Saint Helena", flag: "🇸🇭", dial_code: "+290" },
  {
    iso2: "KN",
    name: "Saint Kitts and Nevis",
    flag: "🇰🇳",
    dial_code: "+1869"
  },
  { iso2: "LC", name: "Saint Lucia", flag: "🇱🇨", dial_code: "+1758" },
  {
    iso2: "MF",
    name: "Saint Martin",
    flag: "🇲🇫",
    dial_code: "+590"
  },
  {
    iso2: "PM",
    name: "Saint Pierre and Miquelon",
    flag: "🇵🇲",
    dial_code: "+508"
  },
  {
    iso2: "VC",
    name: "Saint Vincent and the Grenadines",
    flag: "🇻🇨",
    dial_code: "+1784"
  },
  { iso2: "WS", name: "Samoa", flag: "🇼🇸", dial_code: "+685" },
  { iso2: "SM", name: "San Marino", flag: "🇸🇲", dial_code: "+378" },
  {
    iso2: "ST",
    name: "São Tomé and Príncipe",
    flag: "🇸🇹",
    dial_code: "+239"
  },
  { iso2: "SA", name: "Saudi Arabia", flag: "🇸🇦", dial_code: "+966" },
  { iso2: "SN", name: "Senegal", flag: "🇸🇳", dial_code: "+221" },
  { iso2: "RS", name: "Serbia", flag: "🇷🇸", dial_code: "+381" },
  { iso2: "SC", name: "Seychelles", flag: "🇸🇨", dial_code: "+248" },
  { iso2: "SL", name: "Sierra Leone", flag: "🇸🇱", dial_code: "+232" },
  { iso2: "SG", name: "Singapore", flag: "🇸🇬", dial_code: "+65" },
  { iso2: "SX", name: "Sint Maarten", flag: "🇸🇽", dial_code: "+1721" },
  { iso2: "SK", name: "Slovakia", flag: "🇸🇰", dial_code: "+421" },
  { iso2: "SI", name: "Slovenia", flag: "🇸🇮", dial_code: "+386" },
  { iso2: "SB", name: "Solomon Islands", flag: "🇸🇧", dial_code: "+677" },
  { iso2: "SO", name: "Somalia", flag: "🇸🇴", dial_code: "+252" },
  { iso2: "ZA", name: "South Africa", flag: "🇿🇦", dial_code: "+27" },
  { iso2: "KR", name: "South Korea", flag: "🇰🇷", dial_code: "+82" },
  { iso2: "SS", name: "South Sudan", flag: "🇸🇸", dial_code: "+211" },
  { iso2: "ES", name: "Spain", flag: "🇪🇸", dial_code: "+34" },
  { iso2: "LK", name: "Sri Lanka", flag: "🇱🇰", dial_code: "+94" },
  { iso2: "SD", name: "Sudan", flag: "🇸🇩", dial_code: "+249" },
  { iso2: "SR", name: "Suriname", flag: "🇸🇷", dial_code: "+597" },
  { iso2: "SE", name: "Sweden", flag: "🇸🇪", dial_code: "+46" },
  { iso2: "CH", name: "Switzerland", flag: "🇨🇭", dial_code: "+41" },
  { iso2: "SY", name: "Syria", flag: "🇸🇾", dial_code: "+963" },
  { iso2: "TW", name: "Taiwan", flag: "🇹🇼", dial_code: "+886" },
  { iso2: "TJ", name: "Tajikistan", flag: "🇹🇯", dial_code: "+992" },
  { iso2: "TZ", name: "Tanzania", flag: "🇹🇿", dial_code: "+255" },
  { iso2: "TH", name: "Thailand", flag: "🇹🇭", dial_code: "+66" },
  { iso2: "TL", name: "Timor-Leste", flag: "🇹🇱", dial_code: "+670" },
  { iso2: "TG", name: "Togo", flag: "🇹🇬", dial_code: "+228" },
  { iso2: "TK", name: "Tokelau", flag: "🇹🇰", dial_code: "+690" },
  { iso2: "TO", name: "Tonga", flag: "🇹🇴", dial_code: "+676" },
  {
    iso2: "TT",
    name: "Trinidad and Tobago",
    flag: "🇹🇹",
    dial_code: "+1868"
  },
  { iso2: "TN", name: "Tunisia", flag: "🇹🇳", dial_code: "+216" },
  { iso2: "TR", name: "Türkiye", flag: "🇹🇷", dial_code: "+90" },
  { iso2: "TM", name: "Turkmenistan", flag: "🇹🇲", dial_code: "+993" },
  {
    iso2: "TC",
    name: "Turks and Caicos Islands",
    flag: "🇹🇨",
    dial_code: "+1649"
  },
  { iso2: "TV", name: "Tuvalu", flag: "🇹🇻", dial_code: "+688" },
  { iso2: "UG", name: "Uganda", flag: "🇺🇬", dial_code: "+256" },
  { iso2: "UA", name: "Ukraine", flag: "🇺🇦", dial_code: "+380" },
  {
    iso2: "AE",
    name: "United Arab Emirates",
    flag: "🇦🇪",
    dial_code: "+971"
  },
  { iso2: "UY", name: "Uruguay", flag: "🇺🇾", dial_code: "+598" },
  {
    iso2: "VI",
    name: "US Virgin Islands",
    flag: "🇻🇮",
    dial_code: "+1340"
  },
  { iso2: "UZ", name: "Uzbekistan", flag: "🇺🇿", dial_code: "+998" },
  { iso2: "VU", name: "Vanuatu", flag: "🇻🇺", dial_code: "+678" },
  { iso2: "VA", name: "Vatican City", flag: "🇻🇦", dial_code: "+379" },
  { iso2: "VE", name: "Venezuela", flag: "🇻🇪", dial_code: "+58" },
  { iso2: "VN", name: "Vietnam", flag: "🇻🇳", dial_code: "+84" },
  {
    iso2: "WF",
    name: "Wallis and Futuna",
    flag: "🇼🇫",
    dial_code: "+681"
  },
  { iso2: "EH", name: "Western Sahara", flag: "🇪🇭", dial_code: "+212" },
  { iso2: "YE", name: "Yemen", flag: "🇾🇪", dial_code: "+967" },
  { iso2: "ZM", name: "Zambia", flag: "🇿🇲", dial_code: "+260" },
  { iso2: "ZW", name: "Zimbabwe", flag: "🇿🇼", dial_code: "+263" }
];

// Final exported list — top markets first, then alphabetical world.
export const WORLD_COUNTRIES: ReadonlyArray<Country> = [
  ...TOP_MARKETS,
  ...REST_OF_WORLD
];

// Fast ISO-2 lookup.
const ISO_INDEX: Record<string, Country> = Object.fromEntries(
  WORLD_COUNTRIES.map((c) => [c.iso2.toUpperCase(), c])
);

export function countryByIso2(
  iso2: string | null | undefined
): Country | undefined {
  if (!iso2) return undefined;
  return ISO_INDEX[iso2.toUpperCase()];
}

export function isValidIso2(iso2: string | null | undefined): boolean {
  if (!iso2) return false;
  return Boolean(ISO_INDEX[iso2.toUpperCase()]);
}

// Backwards-compatible shape for older ContactForm consumers — same
// `{ value, label }` pair the legacy 20-entry list exposed, but now
// drawn from the full worldwide list.
export type CountrySelectOption = { value: string; label: string };
export const CONTACT_COUNTRIES: ReadonlyArray<CountrySelectOption> =
  WORLD_COUNTRIES.map((c) => ({
    value: c.name,
    label: `${c.flag} ${c.name}`
  }));
