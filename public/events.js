// Fictional demonstration events. No actual tickets are sold.
export const EVENTS = Object.freeze([
  {
    id: "sound-district", title: "The Sound District", category: "Music", city: "Bengaluru",
    venue: "The Open Grounds, Bengaluru", date: "2026-11-21T18:00:00+05:30", end: "2026-11-21T23:00:00+05:30",
    image: "assets/sound-district.svg", price: "Free demo signup", featured: true,
    excerpt: "An electric evening of live sets, big energy, and even better company.",
    description: "Step into a night built for music lovers. Discover exciting live acts, feel the energy of the crowd, and enjoy an open-air gathering with people who love sound as much as you do.",
    highlights: ["Live performances across multiple genres", "Open-air atmosphere and vibrant visuals", "Food stalls and community hangouts"]
  },
  {
    id: "build-tomorrow", title: "Build Tomorrow 2026", category: "Technology", city: "Hyderabad",
    venue: "Innovation Hub, Hyderabad", date: "2026-11-28T10:00:00+05:30", end: "2026-11-28T17:30:00+05:30",
    image: "assets/build-tomorrow.svg", price: "Free demo signup", featured: true,
    excerpt: "Fresh ideas, curious minds, and a full day of future-facing conversations.",
    description: "A day for builders, designers, and curious thinkers. Hear practical talks, discover ambitious projects, and connect with a community creating what comes next.",
    highlights: ["Short talks from builders and innovators", "Hands-on idea-sharing sessions", "Community networking and demos"]
  },
  {
    id: "art-after-hours", title: "Art After Hours", category: "Art & Culture", city: "Kolkata",
    venue: "The Gallery House, Kolkata", date: "2026-12-05T17:30:00+05:30", end: "2026-12-05T21:00:00+05:30",
    image: "assets/art-after-hours.svg", price: "Free demo signup", featured: false,
    excerpt: "An after-dark celebration of color, creativity, and the unexpected.",
    description: "See contemporary art in a different light. Wander through immersive pieces, meet local creatives, and enjoy a relaxed evening with art at its heart.",
    highlights: ["Curated contemporary art showcases", "Meet-the-artist conversations", "Interactive creative corners"]
  },
  {
    id: "table-for-everyone", title: "Table for Everyone", category: "Food", city: "Mumbai",
    venue: "The Courtyard, Mumbai", date: "2026-12-12T12:00:00+05:30", end: "2026-12-12T17:00:00+05:30",
    image: "assets/table-for-everyone.svg", price: "Free demo signup", featured: false,
    excerpt: "A delightful food social where new flavors meet new friends.",
    description: "Pull up a chair and explore food together. Sample imaginative menus, discover small culinary businesses, and connect through the simple joy of a shared table.",
    highlights: ["Tasting counters from local food creators", "Casual communal seating", "Friendly food conversations and activities"]
  },
  {
    id: "make-something-good", title: "Make Something Good", category: "Workshops", city: "Pune",
    venue: "Studio Twenty One, Pune", date: "2026-12-19T11:00:00+05:30", end: "2026-12-19T14:00:00+05:30",
    image: "assets/make-something-good.svg", price: "Free demo signup", featured: false,
    excerpt: "A hands-on creative workshop for anyone who loves making things.",
    description: "Make time to work with your hands. This beginner-friendly studio session is about experimenting, learning a new skill, and taking home something entirely your own.",
    highlights: ["All basic art materials included", "Guided creative exercises", "Take home your own handmade creation"]
  },
  {
    id: "sunset-reset", title: "Sunset Reset", category: "Wellness", city: "Goa",
    venue: "Seabreeze Lawn, Goa", date: "2027-01-09T16:30:00+05:30", end: "2027-01-09T19:00:00+05:30",
    image: "assets/sunset-reset.svg", price: "Free demo signup", featured: false,
    excerpt: "Slow down, breathe deeply, and reset with an evening by the sea.",
    description: "Leave a busy week behind with gentle movement, mindful breathing, and a refreshing golden-hour gathering in a calming open-air setting.",
    highlights: ["Beginner-friendly guided movement", "Mindfulness and breathing practices", "Relaxed sunset social time"]
  },
  {
    id: "frame-by-frame", title: "Frame by Frame", category: "Art & Culture", city: "New Delhi",
    venue: "Indie Cinema Hall, New Delhi", date: "2027-01-16T15:00:00+05:30", end: "2027-01-16T20:00:00+05:30",
    image: "assets/frame-by-frame.svg", price: "Free demo signup", featured: false,
    excerpt: "A little cinema magic and a lot of love for independent storytelling.",
    description: "Spend an afternoon discovering original short films and the people behind them. A thoughtful celebration of stories that deserve a bigger screen.",
    highlights: ["Curated independent short film screenings", "Post-screening audience conversations", "Creative community connections"]
  },
  {
    id: "night-market-club", title: "Night Market Club", category: "Food", city: "Jaipur",
    venue: "Pink City Courtyard, Jaipur", date: "2027-01-23T18:00:00+05:30", end: "2027-01-23T23:00:00+05:30",
    image: "assets/night-market-club.svg", price: "Free demo signup", featured: false,
    excerpt: "Street eats, local discoveries, and the magic of a night market.",
    description: "Explore a lively evening market filled with food, small makers, and little surprises. Come hungry, wander slowly, and find a new favorite thing.",
    highlights: ["Street food and local small businesses", "Music and colorful market lights", "Relaxed shopping and social spaces"]
  }
]);
