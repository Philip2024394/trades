// Custom Domain add-on — per-registrar DNS instructions.
//
// Structured data the editor's DNS card renders as tabs. Each guide is
// 3-4 short steps written for a non-technical tradesperson — no
// "navigate to the management portal" jargon.
//
// Two DNS records are always required:
//   - Apex A record → 76.76.21.21 (Vercel)
//   - www CNAME    → cname.vercel-dns.com
//
// We DO NOT bundle a domain reseller. Each guide ends with a link to
// the registrar's own DNS panel.

export type RegistrarGuide = {
  id: string;
  name: string;
  dnsPanelUrl: string;
  steps: string[];
};

export const REGISTRAR_GUIDES: RegistrarGuide[] = [
  {
    id: "123-reg",
    name: "123-reg",
    dnsPanelUrl: "https://www.123-reg.co.uk/secure/cpanel/domain/list/",
    steps: [
      "Log in to 123-reg and open Control Panel → Manage Domains.",
      "Click your domain, then choose Advanced DNS.",
      "Add an A record with hostname '@' pointing to the Vercel IP above.",
      "Add a CNAME record with hostname 'www' pointing to cname.vercel-dns.com.",
      "Save changes. Come back here in 5-30 minutes and press 'Check now'."
    ]
  },
  {
    id: "godaddy",
    name: "GoDaddy",
    dnsPanelUrl: "https://dcc.godaddy.com/control/dnsmanagement",
    steps: [
      "Log in to GoDaddy and open Domain Portfolio.",
      "Find your domain and click the three dots → DNS.",
      "Edit the existing A record for '@' so its Value is the Vercel IP above.",
      "Add or edit a CNAME for 'www' so it points to cname.vercel-dns.com.",
      "Save. DNS usually propagates in 5-30 minutes."
    ]
  },
  {
    id: "cloudflare",
    name: "Cloudflare Registrar",
    dnsPanelUrl: "https://dash.cloudflare.com/",
    steps: [
      "Open Cloudflare → your domain → DNS → Records.",
      "Add an A record: Name '@', IPv4 the Vercel IP above, Proxy status DNS only (grey cloud).",
      "Add a CNAME: Name 'www', Target cname.vercel-dns.com, Proxy status DNS only.",
      "Save. Cloudflare propagation is usually under 2 minutes."
    ]
  },
  {
    id: "namecheap",
    name: "Namecheap",
    dnsPanelUrl: "https://ap.www.namecheap.com/domains/list/",
    steps: [
      "Log in to Namecheap → Domain List.",
      "Click Manage next to your domain → Advanced DNS.",
      "Add an A Record with Host '@' and Value the Vercel IP above.",
      "Add a CNAME Record with Host 'www' and Value cname.vercel-dns.com.",
      "Save. Namecheap usually propagates in 5-30 minutes."
    ]
  }
];

// Trusted registrar suggestions for the empty-state card. We don't
// resell domains; we just point at the UK-relevant cheapies.
export const SUGGESTED_REGISTRARS: { name: string; url: string; note: string }[] =
  [
    {
      name: "Cloudflare Registrar",
      url: "https://www.cloudflare.com/products/registrar/",
      note: "At-cost pricing, no markup"
    },
    {
      name: "123-reg",
      url: "https://www.123-reg.co.uk/",
      note: "UK-based, easy DNS panel"
    },
    {
      name: "Namecheap",
      url: "https://www.namecheap.com/",
      note: "Cheap renewals, free WHOIS privacy"
    }
  ];
