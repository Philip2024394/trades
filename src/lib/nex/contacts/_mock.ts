// Mock contacts + groups — V2 seed with tags · favourite · last
// interaction · private notes · activity timeline so every profile
// surface has real content to render.

import type { PersonalContact, BusinessContact, ContactGroup } from "./_types";

export const MOCK_PERSONAL_CONTACTS: PersonalContact[] = [
  {
    id: "sarah-manchester",
    name: "Sarah",
    photo_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80",
    connection_type: "Friend",
    online: true,
    location: "Manchester",
    favourite: true,
    tags: ["Friend", "Coffee", "Travel"],
    connection_history: "Met through Discover · connected 3 weeks ago",
    last_interaction: {
      at: "2 days ago",
      last_message: "See you Friday"
    },
    private_notes: "Prefers WhatsApp for casual, NEX for planning.",
    memory: {
      kind: "personal",
      connected_at: "July 2026",
      first_conversation: "Travel recommendations",
      shared: "Restaurant recommendation",
      message_count: 12
    },
    timeline: [
      { at: "2 days ago", kind: "message", label: "Sent \"See you Friday\"" },
      { at: "July 2026", kind: "shared", label: "Shared restaurant recommendation" },
      { at: "July 2026", kind: "connected", label: "Connected through Discovery" }
    ]
  },
  {
    id: "john-electrician",
    name: "John Electrician",
    photo_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80",
    connection_type: "Electrician",
    online: false,
    location: "Salford",
    favourite: true,
    tags: ["Trade", "Electrician", "Loft"],
    last_seen_text: "Last seen today",
    connection_history: "Booked through NEX Discover · 4 months ago",
    last_interaction: {
      at: "1 week ago",
      last_message: "All wired, testing tomorrow."
    },
    private_notes: "Great on price. Book at least 2 weeks ahead.",
    memory: {
      kind: "trade",
      met_through: "NEX Discover",
      jobs_completed: 4,
      last_booking: "Kitchen lighting"
    },
    timeline: [
      { at: "1 week ago", kind: "message", label: "\"All wired, testing tomorrow.\"" },
      { at: "June 2026", kind: "booking", label: "Booking · Kitchen lighting" },
      { at: "April 2026", kind: "booking", label: "Booking · Loft rewire" },
      { at: "March 2026", kind: "discovered", label: "Discovered on NEX Discover" }
    ]
  },
  {
    id: "emma-manchester",
    name: "Emma",
    photo_url: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&q=80",
    connection_type: "Friend",
    online: true,
    location: "Manchester",
    tags: ["Family friend", "Loft project"],
    connection_history: "Family friend · 2 years",
    last_interaction: {
      at: "yesterday",
      last_message: "Loved the photos!"
    },
    memory: {
      kind: "personal",
      connected_at: "May 2024",
      first_conversation: "Loft renovation ideas",
      shared: "Weekend brunch spots",
      message_count: 148
    },
    timeline: [
      { at: "yesterday", kind: "message", label: "\"Loved the photos!\"" },
      { at: "May 2026", kind: "shared", label: "Shared weekend brunch spots" },
      { at: "May 2024", kind: "connected", label: "Connected · introduced by family" }
    ]
  },
  {
    id: "priya-edinburgh",
    name: "Priya",
    photo_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80",
    connection_type: "Colleague",
    online: false,
    location: "Edinburgh",
    tags: ["Colleague", "Salford loft"],
    last_seen_text: "Last seen yesterday",
    connection_history: "Worked together on the Salford loft project",
    last_interaction: {
      at: "3 weeks ago",
      last_message: "Schedule attached."
    },
    memory: {
      kind: "personal",
      connected_at: "February 2026",
      first_conversation: "Site coordination for the Salford loft",
      shared: "Project schedule",
      message_count: 34
    },
    timeline: [
      { at: "3 weeks ago", kind: "message", label: "Sent project schedule" },
      { at: "February 2026", kind: "connected", label: "Connected · Salford loft project" }
    ]
  },
  {
    id: "tom-liverpool",
    name: "Tom",
    photo_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80",
    connection_type: "Previous connection",
    online: true,
    location: "Liverpool",
    tags: ["Timber", "Networking"],
    connection_history: "Met at a trade meetup · 6 months ago",
    last_interaction: {
      at: "2 months ago"
    },
    memory: {
      kind: "personal",
      connected_at: "January 2026",
      first_conversation: "Timber suppliers up north",
      shared: "North Timber Co. contact",
      message_count: 5
    },
    timeline: [
      { at: "2 months ago", kind: "shared", label: "Shared North Timber Co. contact" },
      { at: "January 2026", kind: "connected", label: "Met at trade meetup" }
    ]
  }
];

export const MOCK_BUSINESS_CONTACTS: BusinessContact[] = [
  {
    id: "hammerex-tools",
    name: "Hammerex Tools",
    photo_url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400&q=80",
    category: "Supplier",
    location: "Manchester",
    favourite: true,
    tags: ["Supplier", "Tools", "Construction"],
    last_interaction: {
      at: "5 days ago"
    },
    private_notes: "Best price on Milwaukee kit. Ask for Dan.",
    memory: {
      kind: "business",
      first_contacted_at: "March 2026",
      enquiries_count: 3,
      last_quote_gbp: 145
    },
    timeline: [
      { at: "5 days ago", kind: "quote", label: "Received quote · £145" },
      { at: "April 2026", kind: "quote", label: "Quote for cordless kit" },
      { at: "March 2026", kind: "connected", label: "First enquiry sent" }
    ]
  },
  {
    id: "abc-plumbing",
    name: "ABC Plumbing",
    photo_url: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&q=80",
    category: "Service Provider",
    location: "Salford",
    tags: ["Plumbing", "Emergency"],
    last_interaction: {
      at: "3 weeks ago"
    },
    memory: {
      kind: "business",
      first_contacted_at: "May 2026",
      enquiries_count: 2,
      last_quote_gbp: 320
    },
    timeline: [
      { at: "3 weeks ago", kind: "quote", label: "Received quote · £320" },
      { at: "May 2026", kind: "connected", label: "First enquiry sent" }
    ]
  },
  {
    id: "stairplan-ltd",
    name: "Stairplan Ltd",
    photo_url: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=400&q=80",
    category: "Staircase maker",
    location: "Manchester + 30mi",
    tags: ["Staircases", "Oak", "Bespoke"],
    last_interaction: {
      at: "last month"
    },
    memory: {
      kind: "business",
      first_contacted_at: "April 2026",
      enquiries_count: 5,
      last_quote_gbp: 2480
    },
    timeline: [
      { at: "last month", kind: "quote", label: "Received quote · £2,480" },
      { at: "April 2026", kind: "connected", label: "First enquiry · oak staircase" }
    ]
  },
  {
    id: "north-timber",
    name: "North Timber Co.",
    photo_url: "https://images.unsplash.com/photo-1615529162924-f8605388461d?w=400&q=80",
    category: "Timber merchant",
    location: "Leeds",
    tags: ["Timber", "Oak", "Delivery"],
    last_interaction: {
      at: "2 weeks ago"
    },
    memory: {
      kind: "business",
      first_contacted_at: "June 2026",
      enquiries_count: 1
    },
    timeline: [
      { at: "June 2026", kind: "connected", label: "First enquiry sent" }
    ]
  }
];

export const MOCK_GROUPS: ContactGroup[] = [
  {
    id: "family",
    name: "Family",
    photo_url: "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=400&q=80",
    member_count: 8,
    type: "family",
    favourite: true
  },
  {
    id: "construction-network",
    name: "Construction Network",
    photo_url: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400&q=80",
    member_count: 245,
    type: "business"
  },
  {
    id: "local-deals",
    name: "Local Deals",
    photo_url: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&q=80",
    member_count: 1200,
    type: "community"
  },
  {
    id: "loft-project",
    name: "Salford Loft Project",
    photo_url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&q=80",
    member_count: 6,
    type: "project"
  }
];
