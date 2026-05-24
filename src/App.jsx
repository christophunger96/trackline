import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";

const colors = {
  bg: "#020617",
  panel: "#0f172a",
  panelSoft: "#111827",
  border: "#1e293b",
  text: "#f8fafc",
  muted: "#94a3b8",
  chip: "#334155",
  primary: "#f8fafc",
  primaryText: "#020617",
  good: "#064e3b",
  bad: "#7f1d1d",
  warning: "#78350f",
};

const cardTheme = {
  table: "radial-gradient(circle at top left, rgba(126, 87, 255, 0.25), transparent 32%), linear-gradient(135deg, #080b15 0%, #141827 52%, #20162c 100%)",
  ivory: "linear-gradient(160deg, #fffaf0 0%, #f1eadb 100%)",
  back: "radial-gradient(circle at 50% 38%, rgba(196, 160, 255, 0.22), transparent 30%), repeating-radial-gradient(circle at 50% 38%, rgba(255,255,255,0.08) 0 1px, transparent 1px 9px), linear-gradient(160deg, #351371 0%, #1b0e3d 100%)",
};

function getGenreColor(genre = "") {
  const key = genre.toLowerCase();

  if (key.includes("rock") || key.includes("grunge") || key.includes("metal")) return "#ef476f";
  if (key.includes("pop")) return "#8b5cf6";
  if (key.includes("dance") || key.includes("disco") || key.includes("funk")) return "#22c55e";
  if (key.includes("r&b") || key.includes("soul")) return "#f59e0b";
  if (key.includes("hip")) return "#06b6d4";

  return "#64748b";
}


const CUSTOM_TRACKS_STORAGE_KEY = "trackline.customTracks.v1";
const GAME_STATE_STORAGE_KEY = "trackline.gameState.v1";
const DISCORD_CLIENT_ID_STORAGE_KEY = "trackline.discord.clientId";
const DISCORD_CLIENT_ID_DEFAULT = import.meta.env?.VITE_DISCORD_CLIENT_ID || "";
const SYNC_SOCKET_URL_STORAGE_KEY = "trackline.sync.socketUrl";
const SYNC_ENABLED_STORAGE_KEY = "trackline.sync.enabled";
const CLIENT_INSTANCE_ID_STORAGE_KEY = "trackline.clientInstanceId.v1";
const VIEWER_PLAYER_STORAGE_PREFIX = "trackline.viewerPlayer.v1.";
const DEFAULT_SYNC_SOCKET_URL = import.meta.env?.VITE_SOCKET_URL || "nicht mehr nötig, nur Legacy-Fallback";
const SUPABASE_URL_STORAGE_KEY = "trackline.supabase.url";
const SUPABASE_ANON_KEY_STORAGE_KEY = "trackline.supabase.anonKey";
const SUPABASE_ENABLED_STORAGE_KEY = "trackline.supabase.enabled";
const SUPABASE_SAVED_RESULTS_STORAGE_KEY = "trackline.supabase.savedResults.v1";
const SUPABASE_AUTH_SESSION_STORAGE_KEY = "trackline.supabase.authSession.v1";
const DEFAULT_SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || "";
const DEFAULT_SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || "";

const SPOTIFY_CLIENT_ID_STORAGE_KEY = "trackline.spotify.clientId";
const DEFAULT_SPOTIFY_CLIENT_ID = "eb70ba4d164248d8810e52caae6b40cb";
const SPOTIFY_CODE_VERIFIER_STORAGE_KEY = "trackline.spotify.codeVerifier";
const SPOTIFY_TOKEN_STORAGE_KEY = "trackline.spotify.token";
const SPOTIFY_JAM_MODE_STORAGE_KEY = "trackline.spotify.jamMode.v1";
const SPOTIFY_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
].join(" ");

const SPOTIFY_PLAY_EVENT_NAME = "trackline.spotify.playCurrent";
const DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS = 20;
const PLAY_LIMIT_OPTIONS = [10, 20, 30];
const DIFFICULTY_OPTIONS = [
  { id: "easy", label: "Leicht", description: "bekannte Hits und große Klassiker" },
  { id: "normal", label: "Normal", description: "ausgewogener Mix" },
  { id: "hard", label: "Schwer", description: "mehr Randtreffer und weniger offensichtliche Songs" },
];


const GAME_MODE_OPTIONS = [
  { id: "solo", label: "Einzel", description: "Jeder Spieler hat eine eigene Timeline." },
  { id: "teams", label: "Teams", description: "Zwei Teams, abwechselnde Teammitglieder, gemeinsame Team-Timeline." },
];

const NEW_LINE = String.fromCharCode(10);

const CSV_EXAMPLE_PLACEHOLDER = [
  "Beispiel CSV:",
  "title,artist,year,genre,spotifyUri",
  "Around the World,Daft Punk,1997,Dance,spotify:track:...",
].join(NEW_LINE);

const DECK_PRESETS = [
  { id: "party", label: "Party", description: "breiter Party-Mix aus Pop, Dance, Disco, Mitsing-Hits und Club-Songs" },
  { id: "pop", label: "Pop", description: "großer Pop-Mix aus Mainstream, Synthpop, Pop Rock und Indie Pop" },
  { id: "rock", label: "Rock/Alternative", description: "Rock, Alternative, Grunge, Pop Rock und Indie Rock" },
  { id: "hiphop", label: "Hip-Hop/Rap", description: "Hip-Hop, Rap, R&B-Rap und Crossover" },
  { id: "dance", label: "Dance/Electronic", description: "Dance, EDM, Trance, Eurodance, House und elektronische Hits" },
  { id: "schlager", label: "Schlager", description: "Schlager, Partyhits und Mitsing-Songs" },
  { id: "metalpunk", label: "Metal/Punk", description: "Metal, Punk, Nu Metal, härtere Rock-Songs und Crossover" },
  { id: "indie", label: "Indie", description: "Indie Pop, Indie Rock, Alternative und moderne Gitarrenmusik" },
  { id: "ballads", label: "Balladen", description: "Powerballaden, große Stimmen, ruhige Pop- und Rock-Hits" },
  { id: "eurovision", label: "Eurovision", description: "Eurovision-Sound, ESC-Klassiker und große europäische Popmomente" },
  { id: "movie", label: "Film/Soundtrack", description: "Movie-, Musical-, Disney- und Soundtrack-Hits" },
  { id: "mix", label: "Bunter Mix", description: "alles, was nicht eindeutig in die Spezialthemen fällt" },
  { id: "all", label: "Alle Songs", description: "kompletter Songpool inklusive eigener/importierter Songs" },
];

const STARTING_TRACKS = [
  { id: "s1", title: "Billie Jean", artist: "Michael Jackson", year: 1982, genre: "Pop" },
  { id: "s2", title: "Wonderwall", artist: "Oasis", year: 1995, genre: "Britpop" },
  { id: "s3", title: "Dancing Queen", artist: "ABBA", year: 1976, genre: "Disco" },
  { id: "s4", title: "Seven Nation Army", artist: "The White Stripes", year: 2003, genre: "Rock" },
  { id: "s5", title: "Rolling in the Deep", artist: "Adele", year: 2010, genre: "Soul Pop" },
  { id: "s6", title: "Smells Like Teen Spirit", artist: "Nirvana", year: 1991, genre: "Grunge" },
];

const BASE_TRACK_DECK = [
  { id: "t1", title: "Hey Jude", artist: "The Beatles", year: 1968, genre: "Rock", spotifyUri: "spotify:track:0aym2LBJBk9DAYuHHutrIl" },
  { id: "t2", title: "Bohemian Rhapsody", artist: "Queen", year: 1975, genre: "Rock", spotifyUri: "spotify:track:4u7EnebtmKWzUH433cf5Qv" },
  { id: "t3", title: "Sweet Dreams", artist: "Eurythmics", year: 1983, genre: "Synthpop", spotifyUri: "spotify:track:1TfqLAPs4K3s2rJMoCokcS" },
  { id: "t4", title: "Take On Me", artist: "a-ha", year: 1985, genre: "Synthpop", spotifyUri: "spotify:track:2WfaOiMkCvy7F5fcp2zZ8L" },
  { id: "t5", title: "Like a Prayer", artist: "Madonna", year: 1989, genre: "Pop" },
  { id: "t6", title: "Losing My Religion", artist: "R.E.M.", year: 1991, genre: "Alternative" },
  { id: "t7", title: "No Scrubs", artist: "TLC", year: 1999, genre: "R&B" },
  { id: "t8", title: "In the End", artist: "Linkin Park", year: 2000, genre: "Nu Metal" },
  { id: "t9", title: "Crazy in Love", artist: "Beyonce feat. Jay-Z", year: 2003, genre: "R&B" },
  { id: "t10", title: "Mr. Brightside", artist: "The Killers", year: 2003, genre: "Indie Rock" },
  { id: "t11", title: "Umbrella", artist: "Rihanna feat. Jay-Z", year: 2007, genre: "Pop" },
  { id: "t12", title: "Viva la Vida", artist: "Coldplay", year: 2008, genre: "Pop Rock" },
  { id: "t13", title: "Bad Romance", artist: "Lady Gaga", year: 2009, genre: "Pop" },
  { id: "t14", title: "Get Lucky", artist: "Daft Punk feat. Pharrell Williams", year: 2013, genre: "Disco" },
  { id: "t15", title: "Uptown Funk", artist: "Mark Ronson feat. Bruno Mars", year: 2014, genre: "Funk Pop" },
  { id: "t16", title: "Blinding Lights", artist: "The Weeknd", year: 2019, genre: "Synthpop" },
  { id: "t17", title: "As It Was", artist: "Harry Styles", year: 2022, genre: "Pop" },
  { id: "t18", title: "Flowers", artist: "Miley Cyrus", year: 2023, genre: "Pop" },
  { id: "t19", title: "Hound Dog", artist: "Elvis Presley", year: 1956, genre: "Rock and Roll" },
  { id: "t20", title: "Johnny B. Goode", artist: "Chuck Berry", year: 1958, genre: "Rock and Roll" },
  { id: "t21", title: "Stand by Me", artist: "Ben E. King", year: 1961, genre: "Soul" },
  { id: "t22", title: "I Want to Hold Your Hand", artist: "The Beatles", year: 1963, genre: "Rock" },
  { id: "t23", title: "My Girl", artist: "The Temptations", year: 1964, genre: "Soul" },
  { id: "t24", title: "Satisfaction", artist: "The Rolling Stones", year: 1965, genre: "Rock" },
  { id: "t25", title: "Respect", artist: "Aretha Franklin", year: 1967, genre: "Soul" },
  { id: "t26", title: "All Along the Watchtower", artist: "Jimi Hendrix", year: 1968, genre: "Rock" },
  { id: "t27", title: "Whole Lotta Love", artist: "Led Zeppelin", year: 1969, genre: "Hard Rock" },
  { id: "t28", title: "Let It Be", artist: "The Beatles", year: 1970, genre: "Rock" },
  { id: "t29", title: "Imagine", artist: "John Lennon", year: 1971, genre: "Pop Rock" },
  { id: "t30", title: "Superstition", artist: "Stevie Wonder", year: 1972, genre: "Funk" },
  { id: "t31", title: "Dream On", artist: "Aerosmith", year: 1973, genre: "Rock" },
  { id: "t32", title: "Waterloo", artist: "ABBA", year: 1974, genre: "Pop" },
  { id: "t33", title: "Hotel California", artist: "Eagles", year: 1976, genre: "Rock" },
  { id: "t34", title: "Stayin' Alive", artist: "Bee Gees", year: 1977, genre: "Disco" },
  { id: "t35", title: "Roxanne", artist: "The Police", year: 1978, genre: "New Wave" },
  { id: "t36", title: "Another Brick in the Wall, Pt. 2", artist: "Pink Floyd", year: 1979, genre: "Rock" },
  { id: "t37", title: "Another One Bites the Dust", artist: "Queen", year: 1980, genre: "Rock" },
  { id: "t38", title: "Don't Stop Believin'", artist: "Journey", year: 1981, genre: "Rock" },
  { id: "t39", title: "Africa", artist: "Toto", year: 1982, genre: "Pop Rock" },
  { id: "t40", title: "Every Breath You Take", artist: "The Police", year: 1983, genre: "New Wave" },
  { id: "t41", title: "Girls Just Want to Have Fun", artist: "Cyndi Lauper", year: 1983, genre: "Pop" },
  { id: "t42", title: "Purple Rain", artist: "Prince", year: 1984, genre: "Pop Rock" },
  { id: "t43", title: "Careless Whisper", artist: "George Michael", year: 1984, genre: "Pop" },
  { id: "t44", title: "Everybody Wants to Rule the World", artist: "Tears for Fears", year: 1985, genre: "Synthpop" },
  { id: "t45", title: "Livin' on a Prayer", artist: "Bon Jovi", year: 1986, genre: "Rock" },
  { id: "t46", title: "With or Without You", artist: "U2", year: 1987, genre: "Rock" },
  { id: "t47", title: "Sweet Child O' Mine", artist: "Guns N' Roses", year: 1987, genre: "Hard Rock" },
  { id: "t48", title: "Fast Car", artist: "Tracy Chapman", year: 1988, genre: "Folk Rock" },
  { id: "t49", title: "Enjoy the Silence", artist: "Depeche Mode", year: 1990, genre: "Synthpop" },
  { id: "t50", title: "Nothing Else Matters", artist: "Metallica", year: 1991, genre: "Metal" },
  { id: "t51", title: "Under the Bridge", artist: "Red Hot Chili Peppers", year: 1992, genre: "Alternative" },
  { id: "t52", title: "Creep", artist: "Radiohead", year: 1992, genre: "Alternative" },
  { id: "t53", title: "What's Up?", artist: "4 Non Blondes", year: 1993, genre: "Alternative" },
  { id: "t54", title: "Zombie", artist: "The Cranberries", year: 1994, genre: "Alternative" },
  { id: "t55", title: "Gangsta's Paradise", artist: "Coolio feat. L.V.", year: 1995, genre: "Hip-Hop" },
  { id: "t56", title: "Wannabe", artist: "Spice Girls", year: 1996, genre: "Pop" },
  { id: "t57", title: "Bittersweet Symphony", artist: "The Verve", year: 1997, genre: "Britpop" },
  { id: "t58", title: "My Heart Will Go On", artist: "Celine Dion", year: 1997, genre: "Pop" },
  { id: "t59", title: "Iris", artist: "Goo Goo Dolls", year: 1998, genre: "Alternative" },
  { id: "t60", title: "Baby One More Time", artist: "Britney Spears", year: 1998, genre: "Pop" },
  { id: "t61", title: "Californication", artist: "Red Hot Chili Peppers", year: 1999, genre: "Alternative" },
  { id: "t62", title: "One More Time", artist: "Daft Punk", year: 2000, genre: "Dance" },
  { id: "t63", title: "Clint Eastwood", artist: "Gorillaz", year: 2001, genre: "Alternative" },
  { id: "t64", title: "Can't Get You Out of My Head", artist: "Kylie Minogue", year: 2001, genre: "Dance Pop" },
  { id: "t65", title: "Lose Yourself", artist: "Eminem", year: 2002, genre: "Hip-Hop" },
  { id: "t66", title: "Seven Nation Army", artist: "The White Stripes", year: 2003, genre: "Rock" },
  { id: "t67", title: "Toxic", artist: "Britney Spears", year: 2003, genre: "Pop" },
  { id: "t68", title: "Yeah!", artist: "Usher feat. Lil Jon and Ludacris", year: 2004, genre: "R&B" },
  { id: "t69", title: "Numb", artist: "Linkin Park", year: 2003, genre: "Nu Metal" },
  { id: "t70", title: "Hips Don't Lie", artist: "Shakira feat. Wyclef Jean", year: 2005, genre: "Pop" },
  { id: "t71", title: "Crazy", artist: "Gnarls Barkley", year: 2006, genre: "Soul" },
  { id: "t72", title: "Rehab", artist: "Amy Winehouse", year: 2006, genre: "Soul" },
  { id: "t73", title: "Poker Face", artist: "Lady Gaga", year: 2008, genre: "Pop" },
  { id: "t74", title: "I Gotta Feeling", artist: "The Black Eyed Peas", year: 2009, genre: "Pop" },
  { id: "t75", title: "Empire State of Mind", artist: "Jay-Z feat. Alicia Keys", year: 2009, genre: "Hip-Hop" },
  { id: "t76", title: "Tik Tok", artist: "Kesha", year: 2009, genre: "Pop" },
  { id: "t77", title: "Rolling in the Deep", artist: "Adele", year: 2010, genre: "Soul Pop" },
  { id: "t78", title: "Somebody That I Used to Know", artist: "Gotye feat. Kimbra", year: 2011, genre: "Indie Pop" },
  { id: "t79", title: "Call Me Maybe", artist: "Carly Rae Jepsen", year: 2011, genre: "Pop" },
  { id: "t80", title: "Thrift Shop", artist: "Macklemore & Ryan Lewis feat. Wanz", year: 2012, genre: "Hip-Hop" },
  { id: "t81", title: "Wake Me Up", artist: "Avicii", year: 2013, genre: "Dance" },
  { id: "t82", title: "Happy", artist: "Pharrell Williams", year: 2013, genre: "Pop" },
  { id: "t83", title: "Chandelier", artist: "Sia", year: 2014, genre: "Pop" },
  { id: "t84", title: "Shake It Off", artist: "Taylor Swift", year: 2014, genre: "Pop" },
  { id: "t85", title: "Lean On", artist: "Major Lazer & DJ Snake feat. MO", year: 2015, genre: "Dance" },
  { id: "t86", title: "Can't Stop the Feeling!", artist: "Justin Timberlake", year: 2016, genre: "Pop" },
  { id: "t87", title: "Shape of You", artist: "Ed Sheeran", year: 2017, genre: "Pop" },
  { id: "t88", title: "Despacito", artist: "Luis Fonsi feat. Daddy Yankee", year: 2017, genre: "Latin Pop" },
  { id: "t89", title: "HUMBLE.", artist: "Kendrick Lamar", year: 2017, genre: "Hip-Hop" },
  { id: "t90", title: "Shallow", artist: "Lady Gaga & Bradley Cooper", year: 2018, genre: "Pop" },
  { id: "t91", title: "Old Town Road", artist: "Lil Nas X feat. Billy Ray Cyrus", year: 2019, genre: "Country Rap" },
  { id: "t92", title: "Dance Monkey", artist: "Tones and I", year: 2019, genre: "Pop" },
  { id: "t93", title: "Don't Start Now", artist: "Dua Lipa", year: 2019, genre: "Disco Pop" },
  { id: "t94", title: "Watermelon Sugar", artist: "Harry Styles", year: 2019, genre: "Pop" },
  { id: "t95", title: "Levitating", artist: "Dua Lipa", year: 2020, genre: "Disco Pop" },
  { id: "t96", title: "Drivers License", artist: "Olivia Rodrigo", year: 2021, genre: "Pop" },
  { id: "t97", title: "Stay", artist: "The Kid LAROI & Justin Bieber", year: 2021, genre: "Pop" },
  { id: "t98", title: "Heat Waves", artist: "Glass Animals", year: 2020, genre: "Indie Pop" },
  { id: "t99", title: "Anti-Hero", artist: "Taylor Swift", year: 2022, genre: "Pop" },
  { id: "t100", title: "Flowers", artist: "Miley Cyrus", year: 2023, genre: "Pop" },
  { id: "t101", title: "Sweet Caroline", artist: "Neil Diamond", year: 1969, genre: "Pop Rock" },
  { id: "t102", title: "Bridge Over Troubled Water", artist: "Simon & Garfunkel", year: 1970, genre: "Folk Rock" },
  { id: "t103", title: "American Pie", artist: "Don McLean", year: 1971, genre: "Folk Rock" },
  { id: "t104", title: "Rocket Man", artist: "Elton John", year: 1972, genre: "Pop Rock" },
  { id: "t105", title: "Killing Me Softly with His Song", artist: "Roberta Flack", year: 1973, genre: "Soul" },
  { id: "t106", title: "No Woman, No Cry", artist: "Bob Marley & The Wailers", year: 1974, genre: "Reggae" },
  { id: "t107", title: "Boogie Wonderland", artist: "Earth, Wind & Fire", year: 1979, genre: "Disco" },
  { id: "t108", title: "Heart of Glass", artist: "Blondie", year: 1978, genre: "New Wave" },
  { id: "t109", title: "Video Killed the Radio Star", artist: "The Buggles", year: 1979, genre: "New Wave" },
  { id: "t110", title: "Tainted Love", artist: "Soft Cell", year: 1981, genre: "Synthpop" },
  { id: "t111", title: "Eye of the Tiger", artist: "Survivor", year: 1982, genre: "Rock" },
  { id: "t112", title: "Beat It", artist: "Michael Jackson", year: 1982, genre: "Pop" },
  { id: "t113", title: "Thriller", artist: "Michael Jackson", year: 1982, genre: "Pop" },
  { id: "t114", title: "99 Luftballons", artist: "Nena", year: 1983, genre: "Neue Deutsche Welle" },
  { id: "t115", title: "Radio Ga Ga", artist: "Queen", year: 1984, genre: "Rock" },
  { id: "t116", title: "The Final Countdown", artist: "Europe", year: 1986, genre: "Rock" },
  { id: "t117", title: "Never Gonna Give You Up", artist: "Rick Astley", year: 1987, genre: "Pop" },
  { id: "t118", title: "Man in the Mirror", artist: "Michael Jackson", year: 1988, genre: "Pop" },
  { id: "t119", title: "Wind of Change", artist: "Scorpions", year: 1990, genre: "Rock" },
  { id: "t120", title: "Black or White", artist: "Michael Jackson", year: 1991, genre: "Pop" },
  { id: "t121", title: "Enter Sandman", artist: "Metallica", year: 1991, genre: "Metal" },
  { id: "t122", title: "November Rain", artist: "Guns N' Roses", year: 1991, genre: "Rock" },
  { id: "t123", title: "I Will Always Love You", artist: "Whitney Houston", year: 1992, genre: "Pop" },
  { id: "t124", title: "Mr. Vain", artist: "Culture Beat", year: 1993, genre: "Eurodance" },
  { id: "t125", title: "All That She Wants", artist: "Ace of Base", year: 1992, genre: "Pop" },
  { id: "t126", title: "The Sign", artist: "Ace of Base", year: 1993, genre: "Pop" },
  { id: "t127", title: "Basket Case", artist: "Green Day", year: 1994, genre: "Punk Rock" },
  { id: "t128", title: "Wonderwall", artist: "Oasis", year: 1995, genre: "Britpop" },
  { id: "t129", title: "Don't Speak", artist: "No Doubt", year: 1996, genre: "Pop Rock" },
  { id: "t130", title: "Firestarter", artist: "The Prodigy", year: 1996, genre: "Electronic" },
  { id: "t131", title: "Song 2", artist: "Blur", year: 1997, genre: "Britpop" },
  { id: "t132", title: "Tubthumping", artist: "Chumbawamba", year: 1997, genre: "Alternative" },
  { id: "t133", title: "Around the World", artist: "Daft Punk", year: 1997, genre: "Dance" },
  { id: "t134", title: "Ray of Light", artist: "Madonna", year: 1998, genre: "Pop" },
  { id: "t135", title: "Believe", artist: "Cher", year: 1998, genre: "Dance Pop" },
  { id: "t136", title: "Blue (Da Ba Dee)", artist: "Eiffel 65", year: 1998, genre: "Eurodance" },
  { id: "t137", title: "Smooth", artist: "Santana feat. Rob Thomas", year: 1999, genre: "Latin Rock" },
  { id: "t138", title: "All Star", artist: "Smash Mouth", year: 1999, genre: "Pop Rock" },
  { id: "t139", title: "It Wasn't Me", artist: "Shaggy feat. Rikrok", year: 2000, genre: "Reggae Pop" },
  { id: "t140", title: "Ms. Jackson", artist: "Outkast", year: 2000, genre: "Hip-Hop" },
  { id: "t141", title: "Yellow", artist: "Coldplay", year: 2000, genre: "Alternative" },
  { id: "t142", title: "Stan", artist: "Eminem feat. Dido", year: 2000, genre: "Hip-Hop" },
  { id: "t143", title: "Lady (Hear Me Tonight)", artist: "Modjo", year: 2000, genre: "French House" },
  { id: "t144", title: "Drops of Jupiter", artist: "Train", year: 2001, genre: "Pop Rock" },
  { id: "t145", title: "How You Remind Me", artist: "Nickelback", year: 2001, genre: "Rock" },
  { id: "t146", title: "Whenever, Wherever", artist: "Shakira", year: 2001, genre: "Pop" },
  { id: "t147", title: "Sk8er Boi", artist: "Avril Lavigne", year: 2002, genre: "Pop Punk" },
  { id: "t148", title: "Complicated", artist: "Avril Lavigne", year: 2002, genre: "Pop Rock" },
  { id: "t149", title: "Hot in Herre", artist: "Nelly", year: 2002, genre: "Hip-Hop" },
  { id: "t150", title: "Bring Me to Life", artist: "Evanescence", year: 2003, genre: "Rock" },
  { id: "t151", title: "Where Is the Love?", artist: "The Black Eyed Peas", year: 2003, genre: "Pop" },
  { id: "t152", title: "Hey Ya!", artist: "Outkast", year: 2003, genre: "Hip-Hop" },
  { id: "t153", title: "This Love", artist: "Maroon 5", year: 2004, genre: "Pop Rock" },
  { id: "t154", title: "Boulevard of Broken Dreams", artist: "Green Day", year: 2004, genre: "Rock" },
  { id: "t155", title: "Since U Been Gone", artist: "Kelly Clarkson", year: 2004, genre: "Pop Rock" },
  { id: "t156", title: "Drop It Like It's Hot", artist: "Snoop Dogg feat. Pharrell", year: 2004, genre: "Hip-Hop" },
  { id: "t157", title: "Feel Good Inc.", artist: "Gorillaz", year: 2005, genre: "Alternative" },
  { id: "t158", title: "Hung Up", artist: "Madonna", year: 2005, genre: "Dance Pop" },
  { id: "t159", title: "Gold Digger", artist: "Kanye West feat. Jamie Foxx", year: 2005, genre: "Hip-Hop" },
  { id: "t160", title: "You're Beautiful", artist: "James Blunt", year: 2005, genre: "Pop" },
  { id: "t161", title: "Dani California", artist: "Red Hot Chili Peppers", year: 2006, genre: "Alternative" },
  { id: "t162", title: "Promiscuous", artist: "Nelly Furtado feat. Timbaland", year: 2006, genre: "Pop" },
  { id: "t163", title: "SexyBack", artist: "Justin Timberlake", year: 2006, genre: "Pop" },
  { id: "t164", title: "Welcome to the Black Parade", artist: "My Chemical Romance", year: 2006, genre: "Rock" },
  { id: "t165", title: "Stronger", artist: "Kanye West", year: 2007, genre: "Hip-Hop" },
  { id: "t166", title: "Apologize", artist: "Timbaland feat. OneRepublic", year: 2007, genre: "Pop" },
  { id: "t167", title: "Bleeding Love", artist: "Leona Lewis", year: 2007, genre: "Pop" },
  { id: "t168", title: "Paper Planes", artist: "M.I.A.", year: 2007, genre: "Alternative" },
  { id: "t169", title: "Kids", artist: "MGMT", year: 2007, genre: "Indie Pop" },
  { id: "t170", title: "Sex on Fire", artist: "Kings of Leon", year: 2008, genre: "Rock" },
  { id: "t171", title: "Single Ladies", artist: "Beyonce", year: 2008, genre: "R&B" },
  { id: "t172", title: "Use Somebody", artist: "Kings of Leon", year: 2008, genre: "Rock" },
  { id: "t173", title: "Human", artist: "The Killers", year: 2008, genre: "Indie Rock" },
  { id: "t174", title: "Fireflies", artist: "Owl City", year: 2009, genre: "Synthpop" },
  { id: "t175", title: "Paparazzi", artist: "Lady Gaga", year: 2009, genre: "Pop" },
  { id: "t176", title: "Rude Boy", artist: "Rihanna", year: 2009, genre: "R&B" },
  { id: "t177", title: "Airplanes", artist: "B.o.B feat. Hayley Williams", year: 2010, genre: "Hip-Hop" },
  { id: "t178", title: "Love the Way You Lie", artist: "Eminem feat. Rihanna", year: 2010, genre: "Hip-Hop" },
  { id: "t179", title: "Only Girl (In the World)", artist: "Rihanna", year: 2010, genre: "Pop" },
  { id: "t180", title: "Dynamite", artist: "Taio Cruz", year: 2010, genre: "Dance Pop" },
  { id: "t181", title: "Firework", artist: "Katy Perry", year: 2010, genre: "Pop" },
  { id: "t182", title: "Grenade", artist: "Bruno Mars", year: 2010, genre: "Pop" },
  { id: "t183", title: "Party Rock Anthem", artist: "LMFAO", year: 2011, genre: "Dance" },
  { id: "t184", title: "Rolling in the Deep", artist: "Adele", year: 2010, genre: "Soul Pop" },
  { id: "t185", title: "We Found Love", artist: "Rihanna feat. Calvin Harris", year: 2011, genre: "Dance Pop" },
  { id: "t186", title: "Born This Way", artist: "Lady Gaga", year: 2011, genre: "Pop" },
  { id: "t187", title: "Pumped Up Kicks", artist: "Foster the People", year: 2010, genre: "Indie Pop" },
  { id: "t188", title: "Paradise", artist: "Coldplay", year: 2011, genre: "Pop Rock" },
  { id: "t189", title: "Levels", artist: "Avicii", year: 2011, genre: "Dance" },
  { id: "t190", title: "We Are Young", artist: "fun. feat. Janelle Monae", year: 2011, genre: "Pop" },
  { id: "t191", title: "Gangnam Style", artist: "PSY", year: 2012, genre: "K-Pop" },
  { id: "t192", title: "Locked Out of Heaven", artist: "Bruno Mars", year: 2012, genre: "Pop" },
  { id: "t193", title: "Diamonds", artist: "Rihanna", year: 2012, genre: "Pop" },
  { id: "t194", title: "Radioactive", artist: "Imagine Dragons", year: 2012, genre: "Alternative" },
  { id: "t195", title: "Royals", artist: "Lorde", year: 2013, genre: "Pop" },
  { id: "t196", title: "Counting Stars", artist: "OneRepublic", year: 2013, genre: "Pop Rock" },
  { id: "t197", title: "Blurred Lines", artist: "Robin Thicke feat. T.I. and Pharrell", year: 2013, genre: "R&B" },
  { id: "t198", title: "Wrecking Ball", artist: "Miley Cyrus", year: 2013, genre: "Pop" },
  { id: "t199", title: "Rather Be", artist: "Clean Bandit feat. Jess Glynne", year: 2014, genre: "Dance" },
  { id: "t200", title: "All About That Bass", artist: "Meghan Trainor", year: 2014, genre: "Pop" },
  { id: "t201", title: "Take Me to Church", artist: "Hozier", year: 2013, genre: "Soul" },
  { id: "t202", title: "Thinking Out Loud", artist: "Ed Sheeran", year: 2014, genre: "Pop" },
  { id: "t203", title: "See You Again", artist: "Wiz Khalifa feat. Charlie Puth", year: 2015, genre: "Hip-Hop" },
  { id: "t204", title: "Hello", artist: "Adele", year: 2015, genre: "Soul Pop" },
  { id: "t205", title: "Sorry", artist: "Justin Bieber", year: 2015, genre: "Pop" },
  { id: "t206", title: "Love Yourself", artist: "Justin Bieber", year: 2015, genre: "Pop" },
  { id: "t207", title: "Stressed Out", artist: "Twenty One Pilots", year: 2015, genre: "Alternative" },
  { id: "t208", title: "Cheap Thrills", artist: "Sia feat. Sean Paul", year: 2016, genre: "Pop" },
  { id: "t209", title: "Closer", artist: "The Chainsmokers feat. Halsey", year: 2016, genre: "Dance Pop" },
  { id: "t210", title: "One Dance", artist: "Drake feat. Wizkid and Kyla", year: 2016, genre: "Dancehall" },
  { id: "t211", title: "Starboy", artist: "The Weeknd feat. Daft Punk", year: 2016, genre: "R&B" },
  { id: "t212", title: "Rockabye", artist: "Clean Bandit feat. Sean Paul and Anne-Marie", year: 2016, genre: "Dance Pop" },
  { id: "t213", title: "Human", artist: "Rag'n'Bone Man", year: 2016, genre: "Soul" },
  { id: "t214", title: "Believer", artist: "Imagine Dragons", year: 2017, genre: "Alternative" },
  { id: "t215", title: "Thunder", artist: "Imagine Dragons", year: 2017, genre: "Alternative" },
  { id: "t216", title: "New Rules", artist: "Dua Lipa", year: 2017, genre: "Pop" },
  { id: "t217", title: "Perfect", artist: "Ed Sheeran", year: 2017, genre: "Pop" },
  { id: "t218", title: "Rockstar", artist: "Post Malone feat. 21 Savage", year: 2017, genre: "Hip-Hop" },
  { id: "t219", title: "God's Plan", artist: "Drake", year: 2018, genre: "Hip-Hop" },
  { id: "t220", title: "This Is America", artist: "Childish Gambino", year: 2018, genre: "Hip-Hop" },
  { id: "t221", title: "High Hopes", artist: "Panic! At The Disco", year: 2018, genre: "Pop Rock" },
  { id: "t222", title: "Sunflower", artist: "Post Malone & Swae Lee", year: 2018, genre: "Hip-Hop" },
  { id: "t223", title: "Bad Guy", artist: "Billie Eilish", year: 2019, genre: "Pop" },
  { id: "t224", title: "Someone You Loved", artist: "Lewis Capaldi", year: 2018, genre: "Pop" },
  { id: "t225", title: "Senorita", artist: "Shawn Mendes & Camila Cabello", year: 2019, genre: "Pop" },
  { id: "t226", title: "Circles", artist: "Post Malone", year: 2019, genre: "Pop" },
  { id: "t227", title: "Savage Love", artist: "Jawsh 685 & Jason Derulo", year: 2020, genre: "Pop" },
  { id: "t228", title: "WAP", artist: "Cardi B feat. Megan Thee Stallion", year: 2020, genre: "Hip-Hop" },
  { id: "t229", title: "Mood", artist: "24kGoldn feat. Iann Dior", year: 2020, genre: "Pop Rap" },
  { id: "t230", title: "Good 4 U", artist: "Olivia Rodrigo", year: 2021, genre: "Pop Punk" },
  { id: "t231", title: "Montero (Call Me By Your Name)", artist: "Lil Nas X", year: 2021, genre: "Pop Rap" },
  { id: "t232", title: "Industry Baby", artist: "Lil Nas X feat. Jack Harlow", year: 2021, genre: "Hip-Hop" },
  { id: "t233", title: "Bad Habits", artist: "Ed Sheeran", year: 2021, genre: "Pop" },
  { id: "t234", title: "Cold Heart", artist: "Elton John & Dua Lipa", year: 2021, genre: "Dance Pop" },
  { id: "t235", title: "Easy on Me", artist: "Adele", year: 2021, genre: "Soul Pop" },
  { id: "t236", title: "About Damn Time", artist: "Lizzo", year: 2022, genre: "Pop" },
  { id: "t237", title: "Unholy", artist: "Sam Smith & Kim Petras", year: 2022, genre: "Pop" },
  { id: "t238", title: "Calm Down", artist: "Rema & Selena Gomez", year: 2022, genre: "Afrobeats" },
  { id: "t239", title: "Kill Bill", artist: "SZA", year: 2022, genre: "R&B" },
  { id: "t240", title: "Escapism.", artist: "Raye feat. 070 Shake", year: 2022, genre: "R&B" },
  { id: "t241", title: "Vampire", artist: "Olivia Rodrigo", year: 2023, genre: "Pop Rock" },
  { id: "t242", title: "Seven", artist: "Jung Kook feat. Latto", year: 2023, genre: "Pop" },
  { id: "t243", title: "Paint the Town Red", artist: "Doja Cat", year: 2023, genre: "Hip-Hop" },
  { id: "t244", title: "Greedy", artist: "Tate McRae", year: 2023, genre: "Pop" },
  { id: "t245", title: "Houdini", artist: "Dua Lipa", year: 2023, genre: "Dance Pop" },
  { id: "t246", title: "Lose Control", artist: "Teddy Swims", year: 2023, genre: "Soul Pop" },
  { id: "t247", title: "Beautiful Things", artist: "Benson Boone", year: 2024, genre: "Pop" },
  { id: "t248", title: "Espresso", artist: "Sabrina Carpenter", year: 2024, genre: "Pop" },
  { id: "t249", title: "Please Please Please", artist: "Sabrina Carpenter", year: 2024, genre: "Pop" },
  { id: "t250", title: "Good Luck, Babe!", artist: "Chappell Roan", year: 2024, genre: "Pop" },
  { id: "t251", title: "A Bar Song (Tipsy)", artist: "Shaboozey", year: 2024, genre: "Country Pop" },
  { id: "t252", title: "Not Like Us", artist: "Kendrick Lamar", year: 2024, genre: "Hip-Hop" },
  { id: "t253", title: "Fortnight", artist: "Taylor Swift feat. Post Malone", year: 2024, genre: "Pop" },
  { id: "t254", title: "Die With a Smile", artist: "Lady Gaga & Bruno Mars", year: 2024, genre: "Pop" },
  { id: "t255", title: "APT.", artist: "ROSÉ & Bruno Mars", year: 2024, genre: "Pop" },
  { id: "t256", title: "Major Tom", artist: "Peter Schilling", year: 1982, genre: "Neue Deutsche Welle" },
  { id: "t257", title: "Skandal im Sperrbezirk", artist: "Spider Murphy Gang", year: 1981, genre: "Rock" },
  { id: "t258", title: "Sternenhimmel", artist: "Hubert Kah", year: 1982, genre: "Neue Deutsche Welle" },
  { id: "t259", title: "Da Da Da", artist: "Trio", year: 1982, genre: "Neue Deutsche Welle" },
  { id: "t260", title: "1000 und 1 Nacht", artist: "Klaus Lage", year: 1984, genre: "Pop Rock" },
  { id: "t261", title: "Männer", artist: "Herbert Grönemeyer", year: 1984, genre: "Pop Rock" },
  { id: "t262", title: "Verdammt, ich lieb' dich", artist: "Matthias Reim", year: 1990, genre: "Schlager" },
  { id: "t263", title: "Tage wie diese", artist: "Die Toten Hosen", year: 2012, genre: "Rock", spotifyUri: "spotify:track:2lYsCjTvXIHOqT8xSbK2jq" },
  { id: "t264", title: "Tage wie diese", artist: "Die Toten Hosen", year: 2012, genre: "Rock" },
  { id: "t265", title: "Schrei nach Liebe", artist: "Die Ärzte", year: 1993, genre: "Punk Rock" },
  { id: "t266", title: "Ein Kompliment", artist: "Sportfreunde Stiller", year: 2002, genre: "Indie Rock" },
  { id: "t267", title: "MfG", artist: "Die Fantastischen Vier", year: 1999, genre: "Hip-Hop" },
  { id: "t268", title: "Jein", artist: "Fettes Brot", year: 1996, genre: "Hip-Hop" },
  { id: "t269", title: "Haus am See", artist: "Peter Fox", year: 2008, genre: "Reggae Pop" },
  { id: "t270", title: "Augenbling", artist: "Seeed", year: 2012, genre: "Dancehall" },
  { id: "t271", title: "Auf uns", artist: "Andreas Bourani", year: 2014, genre: "Pop" },
  { id: "t272", title: "80 Millionen", artist: "Max Giesinger", year: 2016, genre: "Pop" },
  { id: "t273", title: "Lieblingsmensch", artist: "Namika", year: 2015, genre: "Pop" },
  { id: "t274", title: "Atemlos durch die Nacht", artist: "Helene Fischer", year: 2013, genre: "Schlager" },
  { id: "t275", title: "Cordula Grün", artist: "Josh.", year: 2018, genre: "Pop" },
  { id: "t276", title: "Vincent", artist: "Sarah Connor", year: 2019, genre: "Pop" },
  { id: "t277", title: "Roller", artist: "Apache 207", year: 2019, genre: "Deutschrap" },
  { id: "t278", title: "Komet", artist: "Udo Lindenberg & Apache 207", year: 2023, genre: "Pop" },
  { id: "t279", title: "Wildberry Lillet", artist: "Nina Chuba", year: 2022, genre: "Pop Rap" },
  { id: "t280", title: "Zukunft Pink", artist: "Peter Fox feat. Inéz", year: 2022, genre: "Pop" },
  { id: "t281", title: "Barbie Girl", artist: "Aqua", year: 1997, genre: "Eurodance" },
  { id: "t282", title: "Cotton Eye Joe", artist: "Rednex", year: 1994, genre: "Eurodance" },
  { id: "t283", title: "Freed from Desire", artist: "Gala", year: 1996, genre: "Dance" },
  { id: "t284", title: "Insomnia", artist: "Faithless", year: 1995, genre: "Electronic" },
  { id: "t285", title: "Sandstorm", artist: "Darude", year: 1999, genre: "Trance" },
  { id: "t286", title: "The Rhythm of the Night", artist: "Corona", year: 1993, genre: "Eurodance" },
  { id: "t287", title: "Rhythm Is a Dancer", artist: "Snap!", year: 1992, genre: "Eurodance" },
  { id: "t288", title: "What Is Love", artist: "Haddaway", year: 1993, genre: "Eurodance" },
  { id: "t289", title: "Mr. Saxobeat", artist: "Alexandra Stan", year: 2011, genre: "Dance" },
  { id: "t290", title: "Alors on danse", artist: "Stromae", year: 2009, genre: "Dance" },
  { id: "t291", title: "Papaoutai", artist: "Stromae", year: 2013, genre: "Dance Pop" },
  { id: "t292", title: "Dernière danse", artist: "Indila", year: 2013, genre: "Pop" },
  { id: "t293", title: "Ai Se Eu Te Pego", artist: "Michel Teló", year: 2011, genre: "Latin Pop" },
  { id: "t294", title: "Macarena", artist: "Los Del Rio", year: 1993, genre: "Latin Pop" },
  { id: "t295", title: "La Camisa Negra", artist: "Juanes", year: 2004, genre: "Latin Rock" },
  { id: "t296", title: "Gasolina", artist: "Daddy Yankee", year: 2004, genre: "Reggaeton" },
  { id: "t297", title: "Danza Kuduro", artist: "Don Omar feat. Lucenzo", year: 2010, genre: "Reggaeton" },
  { id: "t298", title: "Mi Gente", artist: "J Balvin & Willy William", year: 2017, genre: "Reggaeton" },
  { id: "t299", title: "Taki Taki", artist: "DJ Snake feat. Selena Gomez, Ozuna & Cardi B", year: 2018, genre: "Reggaeton" },
  { id: "t300", title: "La Bachata", artist: "Manuel Turizo", year: 2022, genre: "Bachata" },
];


const THEME_TRACK_DECK = [
  { id: "x301", title: "Johnny B. Goode", artist: "Chuck Berry", year: 1958, genre: "Rock and Roll" },
  { id: "x302", title: "Stand by Me", artist: "Ben E. King", year: 1961, genre: "Soul" },
  { id: "x303", title: "Be My Baby", artist: "The Ronettes", year: 1963, genre: "Pop" },
  { id: "x304", title: "House of the Rising Sun", artist: "The Animals", year: 1964, genre: "Rock" },
  { id: "x305", title: "My Generation", artist: "The Who", year: 1965, genre: "Rock" },
  { id: "x306", title: "California Dreamin'", artist: "The Mamas & The Papas", year: 1965, genre: "Folk Pop" },
  { id: "x307", title: "Good Vibrations", artist: "The Beach Boys", year: 1966, genre: "Pop Rock" },
  { id: "x308", title: "Respect", artist: "Aretha Franklin", year: 1967, genre: "Soul" },
  { id: "x309", title: "All Along the Watchtower", artist: "Jimi Hendrix", year: 1968, genre: "Rock" },
  { id: "x310", title: "Proud Mary", artist: "Creedence Clearwater Revival", year: 1969, genre: "Rock" },
  { id: "x311", title: "Paranoid", artist: "Black Sabbath", year: 1970, genre: "Metal" },
  { id: "x312", title: "Imagine", artist: "John Lennon", year: 1971, genre: "Pop" },
  { id: "x313", title: "Superstition", artist: "Stevie Wonder", year: 1972, genre: "Funk" },
  { id: "x314", title: "Smoke on the Water", artist: "Deep Purple", year: 1972, genre: "Rock" },
  { id: "x315", title: "Dream On", artist: "Aerosmith", year: 1973, genre: "Rock" },
  { id: "x316", title: "Waterloo", artist: "ABBA", year: 1974, genre: "Eurovision Pop" },
  { id: "x317", title: "No Woman No Cry", artist: "Bob Marley & The Wailers", year: 1974, genre: "Reggae" },
  { id: "x318", title: "Born to Run", artist: "Bruce Springsteen", year: 1975, genre: "Rock" },
  { id: "x319", title: "Hotel California", artist: "Eagles", year: 1976, genre: "Rock" },
  { id: "x320", title: "Stayin' Alive", artist: "Bee Gees", year: 1977, genre: "Disco" },
  { id: "x321", title: "We Will Rock You", artist: "Queen", year: 1977, genre: "Rock" },
  { id: "x322", title: "Le Freak", artist: "Chic", year: 1978, genre: "Disco" },
  { id: "x323", title: "I Will Survive", artist: "Gloria Gaynor", year: 1978, genre: "Disco" },
  { id: "x324", title: "Another Brick in the Wall", artist: "Pink Floyd", year: 1979, genre: "Rock" },
  { id: "x325", title: "Another One Bites the Dust", artist: "Queen", year: 1980, genre: "Rock" },
  { id: "x326", title: "Don't Stop Believin'", artist: "Journey", year: 1981, genre: "Rock" },
  { id: "x327", title: "Tainted Love", artist: "Soft Cell", year: 1981, genre: "Synthpop" },
  { id: "x328", title: "Eye of the Tiger", artist: "Survivor", year: 1982, genre: "Movie Rock" },
  { id: "x329", title: "Africa", artist: "Toto", year: 1982, genre: "Pop Rock" },
  { id: "x330", title: "Sweet Child O' Mine", artist: "Guns N' Roses", year: 1987, genre: "Rock" },
  { id: "x331", title: "With or Without You", artist: "U2", year: 1987, genre: "Rock" },
  { id: "x332", title: "Never Gonna Give You Up", artist: "Rick Astley", year: 1987, genre: "Pop" },
  { id: "x333", title: "Fast Car", artist: "Tracy Chapman", year: 1988, genre: "Folk Pop" },
  { id: "x334", title: "Like a Prayer", artist: "Madonna", year: 1989, genre: "Pop" },
  { id: "x335", title: "Nothing Compares 2 U", artist: "Sinead O'Connor", year: 1990, genre: "Pop" },
  { id: "x336", title: "Enter Sandman", artist: "Metallica", year: 1991, genre: "Metal" },
  { id: "x337", title: "Under the Bridge", artist: "Red Hot Chili Peppers", year: 1991, genre: "Alternative Rock" },
  { id: "x338", title: "Creep", artist: "Radiohead", year: 1992, genre: "Alternative Rock" },
  { id: "x339", title: "What's Up?", artist: "4 Non Blondes", year: 1993, genre: "Rock" },
  { id: "x340", title: "Zombie", artist: "The Cranberries", year: 1994, genre: "Alternative Rock" },
  { id: "x341", title: "Basket Case", artist: "Green Day", year: 1994, genre: "Punk Rock" },
  { id: "x342", title: "Gangsta's Paradise", artist: "Coolio", year: 1995, genre: "Hip Hop" },
  { id: "x343", title: "Killing Me Softly", artist: "Fugees", year: 1996, genre: "Hip Hop Soul" },
  { id: "x344", title: "Wannabe", artist: "Spice Girls", year: 1996, genre: "Pop" },
  { id: "x345", title: "Song 2", artist: "Blur", year: 1997, genre: "Alternative Rock" },
  { id: "x346", title: "Barbie Girl", artist: "Aqua", year: 1997, genre: "Eurodance" },
  { id: "x347", title: "My Heart Will Go On", artist: "Celine Dion", year: 1997, genre: "Movie Pop" },
  { id: "x348", title: "I Don't Want to Miss a Thing", artist: "Aerosmith", year: 1998, genre: "Movie Rock" },
  { id: "x349", title: "...Baby One More Time", artist: "Britney Spears", year: 1998, genre: "Pop" },
  { id: "x350", title: "Blue (Da Ba Dee)", artist: "Eiffel 65", year: 1998, genre: "Eurodance" },
  { id: "x351", title: "Californication", artist: "Red Hot Chili Peppers", year: 1999, genre: "Alternative Rock" },
  { id: "x352", title: "Smooth", artist: "Santana feat. Rob Thomas", year: 1999, genre: "Latin Rock" },
  { id: "x353", title: "Stan", artist: "Eminem feat. Dido", year: 2000, genre: "Hip Hop" },
  { id: "x354", title: "One More Time", artist: "Daft Punk", year: 2000, genre: "Electronic" },
  { id: "x355", title: "Can't Get You Out of My Head", artist: "Kylie Minogue", year: 2001, genre: "Dance Pop" },
  { id: "x356", title: "Whenever, Wherever", artist: "Shakira", year: 2001, genre: "Latin Pop" },
  { id: "x357", title: "Lose Yourself", artist: "Eminem", year: 2002, genre: "Hip Hop" },
  { id: "x358", title: "Seven Nation Army", artist: "The White Stripes", year: 2003, genre: "Rock" },
  { id: "x359", title: "Toxic", artist: "Britney Spears", year: 2003, genre: "Pop" },
  { id: "x360", title: "Yeah!", artist: "Usher feat. Lil Jon & Ludacris", year: 2004, genre: "R&B" },
  { id: "x361", title: "Dragostea Din Tei", artist: "O-Zone", year: 2004, genre: "Eurodance" },
  { id: "x362", title: "Boulevard of Broken Dreams", artist: "Green Day", year: 2004, genre: "Rock" },
  { id: "x363", title: "Hips Don't Lie", artist: "Shakira feat. Wyclef Jean", year: 2005, genre: "Latin Pop" },
  { id: "x364", title: "Gold Digger", artist: "Kanye West feat. Jamie Foxx", year: 2005, genre: "Hip Hop" },
  { id: "x365", title: "Crazy", artist: "Gnarls Barkley", year: 2006, genre: "Soul Pop" },
  { id: "x366", title: "Rehab", artist: "Amy Winehouse", year: 2006, genre: "Soul" },
  { id: "x367", title: "Stronger", artist: "Kanye West", year: 2007, genre: "Hip Hop" },
  { id: "x368", title: "I Gotta Feeling", artist: "The Black Eyed Peas", year: 2009, genre: "Dance Pop" },
  { id: "x369", title: "Empire State of Mind", artist: "Jay-Z feat. Alicia Keys", year: 2009, genre: "Hip Hop" },
  { id: "x370", title: "Tik Tok", artist: "Kesha", year: 2009, genre: "Dance Pop" },
  { id: "x371", title: "Waka Waka", artist: "Shakira", year: 2010, genre: "Latin Pop" },
  { id: "x372", title: "Somebody That I Used to Know", artist: "Gotye feat. Kimbra", year: 2011, genre: "Indie Pop" },
  { id: "x373", title: "We Found Love", artist: "Rihanna feat. Calvin Harris", year: 2011, genre: "Dance Pop" },
  { id: "x374", title: "Call Me Maybe", artist: "Carly Rae Jepsen", year: 2011, genre: "Pop" },
  { id: "x375", title: "Thrift Shop", artist: "Macklemore & Ryan Lewis", year: 2012, genre: "Hip Hop" },
  { id: "x376", title: "Radioactive", artist: "Imagine Dragons", year: 2012, genre: "Alternative Rock" },
  { id: "x377", title: "Royals", artist: "Lorde", year: 2013, genre: "Pop" },
  { id: "x378", title: "Happy", artist: "Pharrell Williams", year: 2013, genre: "Soul Pop" },
  { id: "x379", title: "Rather Be", artist: "Clean Bandit feat. Jess Glynne", year: 2014, genre: "Dance Pop" },
  { id: "x380", title: "Shake It Off", artist: "Taylor Swift", year: 2014, genre: "Pop" },
  { id: "x381", title: "See You Again", artist: "Wiz Khalifa feat. Charlie Puth", year: 2015, genre: "Movie Hip Hop" },
  { id: "x382", title: "Can't Feel My Face", artist: "The Weeknd", year: 2015, genre: "R&B Pop" },
  { id: "x383", title: "One Dance", artist: "Drake feat. Wizkid & Kyla", year: 2016, genre: "Hip Hop" },
  { id: "x384", title: "Cheap Thrills", artist: "Sia feat. Sean Paul", year: 2016, genre: "Pop" },
  { id: "x385", title: "Human", artist: "Rag'n'Bone Man", year: 2016, genre: "Soul" },
  { id: "x386", title: "Havana", artist: "Camila Cabello feat. Young Thug", year: 2017, genre: "Latin Pop" },
  { id: "x387", title: "God's Plan", artist: "Drake", year: 2018, genre: "Hip Hop" },
  { id: "x388", title: "Shallow", artist: "Lady Gaga & Bradley Cooper", year: 2018, genre: "Movie Pop" },
  { id: "x389", title: "Old Town Road", artist: "Lil Nas X feat. Billy Ray Cyrus", year: 2019, genre: "Country Rap" },
  { id: "x390", title: "Dance Monkey", artist: "Tones and I", year: 2019, genre: "Pop" },
  { id: "x391", title: "Watermelon Sugar", artist: "Harry Styles", year: 2019, genre: "Pop" },
  { id: "x392", title: "WAP", artist: "Cardi B feat. Megan Thee Stallion", year: 2020, genre: "Hip Hop" },
  { id: "x393", title: "Drivers License", artist: "Olivia Rodrigo", year: 2021, genre: "Pop" },
  { id: "x394", title: "Good 4 U", artist: "Olivia Rodrigo", year: 2021, genre: "Pop Rock" },
  { id: "x395", title: "Heat Waves", artist: "Glass Animals", year: 2020, genre: "Indie Pop" },
  { id: "x396", title: "Anti-Hero", artist: "Taylor Swift", year: 2022, genre: "Pop" },
  { id: "x397", title: "Unholy", artist: "Sam Smith & Kim Petras", year: 2022, genre: "Pop" },
  { id: "x398", title: "Vampire", artist: "Olivia Rodrigo", year: 2023, genre: "Pop Rock" },
  { id: "x399", title: "Flowers", artist: "Miley Cyrus", year: 2023, genre: "Pop" },
  { id: "x400", title: "Espresso", artist: "Sabrina Carpenter", year: 2024, genre: "Pop" },
  { id: "x401", title: "99 Luftballons", artist: "Nena", year: 1983, genre: "Deutsch Pop" },
  { id: "x402", title: "Major Tom", artist: "Peter Schilling", year: 1983, genre: "Neue Deutsche Welle" },
  { id: "x403", title: "Skandal im Sperrbezirk", artist: "Spider Murphy Gang", year: 1981, genre: "Deutsch Rock" },
  { id: "x404", title: "Mensch", artist: "Herbert Grönemeyer", year: 2002, genre: "Deutsch Pop" },
  { id: "x405", title: "Perfekte Welle", artist: "Juli", year: 2004, genre: "Deutsch Pop Rock" },
  { id: "x406", title: "Durch den Monsun", artist: "Tokio Hotel", year: 2005, genre: "Deutsch Rock" },
  { id: "x407", title: "Dieser Weg", artist: "Xavier Naidoo", year: 2005, genre: "Deutsch Soul" },
  { id: "x408", title: "Haus am See", artist: "Peter Fox", year: 2008, genre: "Deutsch Pop" },
  { id: "x409", title: "Tage wie diese", artist: "Die Toten Hosen", year: 2012, genre: "Deutsch Rock" },
  { id: "x410", title: "Atemlos durch die Nacht", artist: "Helene Fischer", year: 2013, genre: "Schlager" },
  { id: "x411", title: "Auf uns", artist: "Andreas Bourani", year: 2014, genre: "Deutsch Pop" },
  { id: "x412", title: "80 Millionen", artist: "Max Giesinger", year: 2016, genre: "Deutsch Pop" },
  { id: "x413", title: "Roller", artist: "Apache 207", year: 2019, genre: "Deutschrap" },
  { id: "x414", title: "Ohne mein Team", artist: "Bonez MC & RAF Camora", year: 2016, genre: "Deutschrap" },
  { id: "x415", title: "Komet", artist: "Udo Lindenberg & Apache 207", year: 2023, genre: "Deutsch Pop" },
  { id: "x416", title: "Nel Blu Dipinto Di Blu", artist: "Domenico Modugno", year: 1958, genre: "Eurovision Pop" },
  { id: "x417", title: "Puppet on a String", artist: "Sandie Shaw", year: 1967, genre: "Eurovision Pop" },
  { id: "x418", title: "Save Your Kisses for Me", artist: "Brotherhood of Man", year: 1976, genre: "Eurovision Pop" },
  { id: "x419", title: "Ein bisschen Frieden", artist: "Nicole", year: 1982, genre: "Eurovision Schlager" },
  { id: "x420", title: "Hold Me Now", artist: "Johnny Logan", year: 1987, genre: "Eurovision Pop" },
  { id: "x421", title: "Euphoria", artist: "Loreen", year: 2012, genre: "Eurovision Dance" },
  { id: "x422", title: "Rise Like a Phoenix", artist: "Conchita Wurst", year: 2014, genre: "Eurovision Pop" },
  { id: "x423", title: "Arcade", artist: "Duncan Laurence", year: 2019, genre: "Eurovision Pop" },
  { id: "x424", title: "Zitti e buoni", artist: "Måneskin", year: 2021, genre: "Eurovision Rock" },
  { id: "x425", title: "Tattoo", artist: "Loreen", year: 2023, genre: "Eurovision Pop" },
  { id: "x426", title: "Stayin' Alive", artist: "Bee Gees", year: 1977, genre: "Movie Disco" },
  { id: "x427", title: "Don't You (Forget About Me)", artist: "Simple Minds", year: 1985, genre: "Movie Pop" },
  { id: "x428", title: "The Power of Love", artist: "Huey Lewis and the News", year: 1985, genre: "Movie Rock" },
  { id: "x429", title: "Take My Breath Away", artist: "Berlin", year: 1986, genre: "Movie Pop" },
  { id: "x430", title: "Ghostbusters", artist: "Ray Parker Jr.", year: 1984, genre: "Movie Pop" },
  { id: "x431", title: "Kiss from a Rose", artist: "Seal", year: 1994, genre: "Movie Soul" },
  { id: "x432", title: "Men in Black", artist: "Will Smith", year: 1997, genre: "Movie Hip Hop" },
  { id: "x433", title: "Let It Go", artist: "Idina Menzel", year: 2013, genre: "Movie Pop" },
  { id: "x434", title: "This Is Me", artist: "Keala Settle", year: 2017, genre: "Movie Pop" },
  { id: "x435", title: "Skyfall", artist: "Adele", year: 2012, genre: "Movie Pop" },
  { id: "x436", title: "Livin' la Vida Loca", artist: "Ricky Martin", year: 1999, genre: "Latin Pop" },
  { id: "x437", title: "Whenever, Wherever", artist: "Shakira", year: 2001, genre: "Latin Pop" },
  { id: "x438", title: "Gasolina", artist: "Daddy Yankee", year: 2004, genre: "Reggaeton" },
  { id: "x439", title: "Danza Kuduro", artist: "Don Omar feat. Lucenzo", year: 2010, genre: "Reggaeton" },
  { id: "x440", title: "Bailando", artist: "Enrique Iglesias", year: 2014, genre: "Latin Pop" },
  { id: "x441", title: "Despacito", artist: "Luis Fonsi feat. Daddy Yankee", year: 2017, genre: "Reggaeton" },
  { id: "x442", title: "Mi Gente", artist: "J Balvin & Willy William", year: 2017, genre: "Reggaeton" },
  { id: "x443", title: "Taki Taki", artist: "DJ Snake feat. Selena Gomez, Ozuna & Cardi B", year: 2018, genre: "Reggaeton" },
  { id: "x444", title: "Con Calma", artist: "Daddy Yankee feat. Snow", year: 2019, genre: "Reggaeton" },
  { id: "x445", title: "La Bachata", artist: "Manuel Turizo", year: 2022, genre: "Bachata" },
  { id: "x446", title: "Rhythm Is a Dancer", artist: "Snap!", year: 1992, genre: "Eurodance" },
  { id: "x447", title: "Insomnia", artist: "Faithless", year: 1995, genre: "Electronic" },
  { id: "x448", title: "Around the World", artist: "Daft Punk", year: 1997, genre: "Electronic" },
  { id: "x449", title: "Sandstorm", artist: "Darude", year: 1999, genre: "Trance" },
  { id: "x450", title: "Satisfaction", artist: "Benny Benassi", year: 2002, genre: "Electronic" },
  { id: "x451", title: "Call on Me", artist: "Eric Prydz", year: 2004, genre: "Dance" },
  { id: "x452", title: "Levels", artist: "Avicii", year: 2011, genre: "EDM" },
  { id: "x453", title: "Wake Me Up", artist: "Avicii", year: 2013, genre: "EDM" },
  { id: "x454", title: "Summer", artist: "Calvin Harris", year: 2014, genre: "EDM" },
  { id: "x455", title: "Lean On", artist: "Major Lazer & DJ Snake", year: 2015, genre: "Dancehall" },
];


const CATEGORY_EXPANSION_TRACKS = [
  { id: "c456", title: "Celebration", artist: "Kool & The Gang", year: 1980, genre: "Party Funk" },
  { id: "c457", title: "Girls Just Want to Have Fun", artist: "Cyndi Lauper", year: 1983, genre: "Party Pop" },
  { id: "c458", title: "Wake Me Up Before You Go-Go", artist: "Wham!", year: 1984, genre: "Party Pop" },
  { id: "c459", title: "Footloose", artist: "Kenny Loggins", year: 1984, genre: "Movie Party Pop" },
  { id: "c460", title: "Walking on Sunshine", artist: "Katrina and the Waves", year: 1985, genre: "Party Pop" },
  { id: "c461", title: "You Spin Me Round", artist: "Dead or Alive", year: 1984, genre: "Dance Pop" },
  { id: "c462", title: "The Final Countdown", artist: "Europe", year: 1986, genre: "Party Rock" },
  { id: "c463", title: "Livin' on a Prayer", artist: "Bon Jovi", year: 1986, genre: "Party Rock" },
  { id: "c464", title: "I'm Gonna Be (500 Miles)", artist: "The Proclaimers", year: 1988, genre: "Party Pop Rock" },
  { id: "c465", title: "Pump Up the Jam", artist: "Technotronic", year: 1989, genre: "Dance" },
  { id: "c466", title: "Vogue", artist: "Madonna", year: 1990, genre: "Dance Pop" },
  { id: "c467", title: "Gonna Make You Sweat", artist: "C+C Music Factory", year: 1990, genre: "Dance" },
  { id: "c468", title: "Finally", artist: "CeCe Peniston", year: 1991, genre: "Dance" },
  { id: "c469", title: "The Rhythm of the Night", artist: "Corona", year: 1993, genre: "Eurodance" },
  { id: "c470", title: "What Is Love", artist: "Haddaway", year: 1993, genre: "Eurodance" },
  { id: "c471", title: "Mr. Vain", artist: "Culture Beat", year: 1993, genre: "Eurodance" },
  { id: "c472", title: "Freed from Desire", artist: "Gala", year: 1996, genre: "Dance" },
  { id: "c473", title: "Boom, Boom, Boom, Boom!!", artist: "Vengaboys", year: 1998, genre: "Eurodance" },
  { id: "c474", title: "We Like to Party", artist: "Vengaboys", year: 1998, genre: "Eurodance" },
  { id: "c475", title: "Mambo No. 5", artist: "Lou Bega", year: 1999, genre: "Party Pop" },
  { id: "c476", title: "All Star", artist: "Smash Mouth", year: 1999, genre: "Party Pop Rock" },
  { id: "c477", title: "Who Let the Dogs Out", artist: "Baha Men", year: 2000, genre: "Party Pop" },
  { id: "c478", title: "Can't Stop the Feeling!", artist: "Justin Timberlake", year: 2016, genre: "Party Pop" },
  { id: "c479", title: "Shut Up and Dance", artist: "Walk the Moon", year: 2014, genre: "Party Pop Rock" },
  { id: "c480", title: "Cake by the Ocean", artist: "DNCE", year: 2015, genre: "Party Pop" },
  { id: "c481", title: "Levitating", artist: "Dua Lipa", year: 2020, genre: "Dance Pop" },
  { id: "c482", title: "Don't Start Now", artist: "Dua Lipa", year: 2019, genre: "Dance Pop" },
  { id: "c483", title: "About Damn Time", artist: "Lizzo", year: 2022, genre: "Party Pop" },
  { id: "c484", title: "Houdini", artist: "Dua Lipa", year: 2023, genre: "Dance Pop" },
  { id: "c485", title: "Paint the Town Red", artist: "Doja Cat", year: 2023, genre: "Pop Rap" },
  { id: "c486", title: "Greedy", artist: "Tate McRae", year: 2023, genre: "Pop" },
  { id: "c487", title: "True Colors", artist: "Cyndi Lauper", year: 1986, genre: "Pop Ballad" },
  { id: "c488", title: "Careless Whisper", artist: "George Michael", year: 1984, genre: "Pop Ballad" },
  { id: "c489", title: "Every Breath You Take", artist: "The Police", year: 1983, genre: "Pop Rock" },
  { id: "c490", title: "Time After Time", artist: "Cyndi Lauper", year: 1983, genre: "Pop Ballad" },
  { id: "c491", title: "I Want to Know What Love Is", artist: "Foreigner", year: 1984, genre: "Rock Ballad" },
  { id: "c492", title: "Nothing's Gonna Stop Us Now", artist: "Starship", year: 1987, genre: "Movie Pop Ballad" },
  { id: "c493", title: "Total Eclipse of the Heart", artist: "Bonnie Tyler", year: 1983, genre: "Power Ballad" },
  { id: "c494", title: "Alone", artist: "Heart", year: 1987, genre: "Rock Ballad" },
  { id: "c495", title: "Eternal Flame", artist: "The Bangles", year: 1988, genre: "Pop Ballad" },
  { id: "c496", title: "Wind of Change", artist: "Scorpions", year: 1990, genre: "Rock Ballad" },
  { id: "c497", title: "I Will Always Love You", artist: "Whitney Houston", year: 1992, genre: "Movie Pop Ballad" },
  { id: "c498", title: "Everybody Hurts", artist: "R.E.M.", year: 1992, genre: "Alternative Ballad" },
  { id: "c499", title: "Angels", artist: "Robbie Williams", year: 1997, genre: "Pop Ballad" },
  { id: "c500", title: "Torn", artist: "Natalie Imbruglia", year: 1997, genre: "Pop Rock" },
  { id: "c501", title: "Iris", artist: "Goo Goo Dolls", year: 1998, genre: "Movie Rock Ballad" },
  { id: "c502", title: "If I Ain't Got You", artist: "Alicia Keys", year: 2003, genre: "R&B Soul Ballad" },
  { id: "c503", title: "The Scientist", artist: "Coldplay", year: 2002, genre: "Alternative Ballad" },
  { id: "c504", title: "Chasing Cars", artist: "Snow Patrol", year: 2006, genre: "Indie Ballad" },
  { id: "c505", title: "Apologize", artist: "Timbaland feat. OneRepublic", year: 2007, genre: "Pop Ballad" },
  { id: "c506", title: "Someone Like You", artist: "Adele", year: 2011, genre: "Pop Ballad" },
  { id: "c507", title: "Stay", artist: "Rihanna feat. Mikky Ekko", year: 2012, genre: "Pop Ballad" },
  { id: "c508", title: "All of Me", artist: "John Legend", year: 2013, genre: "Soul Ballad" },
  { id: "c509", title: "Say Something", artist: "A Great Big World & Christina Aguilera", year: 2013, genre: "Pop Ballad" },
  { id: "c510", title: "Let Her Go", artist: "Passenger", year: 2012, genre: "Folk Pop Ballad" },
  { id: "c511", title: "When I Was Your Man", artist: "Bruno Mars", year: 2012, genre: "Pop Ballad" },
  { id: "c512", title: "Stay With Me", artist: "Sam Smith", year: 2014, genre: "Soul Ballad" },
  { id: "c513", title: "Love Yourself", artist: "Justin Bieber", year: 2015, genre: "Pop Ballad" },
  { id: "c514", title: "Someone You Loved", artist: "Lewis Capaldi", year: 2018, genre: "Pop Ballad" },
  { id: "c515", title: "Easy on Me", artist: "Adele", year: 2021, genre: "Pop Ballad" },
  { id: "c516", title: "Lose Control", artist: "Teddy Swims", year: 2023, genre: "Soul Pop" },
  { id: "c517", title: "Should I Stay or Should I Go", artist: "The Clash", year: 1982, genre: "Punk Rock" },
  { id: "c518", title: "Rock You Like a Hurricane", artist: "Scorpions", year: 1984, genre: "Hard Rock" },
  { id: "c519", title: "The Boys of Summer", artist: "Don Henley", year: 1984, genre: "Rock" },
  { id: "c520", title: "Here I Go Again", artist: "Whitesnake", year: 1987, genre: "Rock" },
  { id: "c521", title: "Welcome to the Jungle", artist: "Guns N' Roses", year: 1987, genre: "Hard Rock" },
  { id: "c522", title: "Personal Jesus", artist: "Depeche Mode", year: 1989, genre: "Alternative" },
  { id: "c523", title: "Alive", artist: "Pearl Jam", year: 1991, genre: "Grunge" },
  { id: "c524", title: "Black Hole Sun", artist: "Soundgarden", year: 1994, genre: "Grunge" },
  { id: "c525", title: "Come As You Are", artist: "Nirvana", year: 1991, genre: "Grunge" },
  { id: "c526", title: "Everlong", artist: "Foo Fighters", year: 1997, genre: "Alternative Rock" },
  { id: "c527", title: "The Kids Aren't Alright", artist: "The Offspring", year: 1998, genre: "Punk Rock" },
  { id: "c528", title: "All the Small Things", artist: "Blink-182", year: 1999, genre: "Punk Pop" },
  { id: "c529", title: "Last Resort", artist: "Papa Roach", year: 2000, genre: "Nu Metal" },
  { id: "c530", title: "Chop Suey!", artist: "System of a Down", year: 2001, genre: "Metal" },
  { id: "c531", title: "The Middle", artist: "Jimmy Eat World", year: 2001, genre: "Pop Punk" },
  { id: "c532", title: "Numb", artist: "Linkin Park", year: 2003, genre: "Nu Metal" },
  { id: "c533", title: "American Idiot", artist: "Green Day", year: 2004, genre: "Punk Rock" },
  { id: "c534", title: "I Believe in a Thing Called Love", artist: "The Darkness", year: 2003, genre: "Rock" },
  { id: "c535", title: "Take Me Out", artist: "Franz Ferdinand", year: 2004, genre: "Indie Rock" },
  { id: "c536", title: "Somebody Told Me", artist: "The Killers", year: 2004, genre: "Indie Rock" },
  { id: "c537", title: "Dani California", artist: "Red Hot Chili Peppers", year: 2006, genre: "Alternative Rock" },
  { id: "c538", title: "Use Somebody", artist: "Kings of Leon", year: 2008, genre: "Alternative Rock" },
  { id: "c539", title: "Sex on Fire", artist: "Kings of Leon", year: 2008, genre: "Alternative Rock" },
  { id: "c540", title: "Dog Days Are Over", artist: "Florence + The Machine", year: 2008, genre: "Indie Pop" },
  { id: "c541", title: "Little Lion Man", artist: "Mumford & Sons", year: 2009, genre: "Folk Rock" },
  { id: "c542", title: "Pumped Up Kicks", artist: "Foster the People", year: 2010, genre: "Indie Pop" },
  { id: "c543", title: "Ho Hey", artist: "The Lumineers", year: 2012, genre: "Indie Folk" },
  { id: "c544", title: "Do I Wanna Know?", artist: "Arctic Monkeys", year: 2013, genre: "Indie Rock" },
  { id: "c545", title: "Stressed Out", artist: "Twenty One Pilots", year: 2015, genre: "Alternative" },
  { id: "c546", title: "Believer", artist: "Imagine Dragons", year: 2017, genre: "Alternative Rock" },
  { id: "c547", title: "Rapper's Delight", artist: "The Sugarhill Gang", year: 1979, genre: "Hip Hop" },
  { id: "c548", title: "The Message", artist: "Grandmaster Flash & The Furious Five", year: 1982, genre: "Hip Hop" },
  { id: "c549", title: "Walk This Way", artist: "Run-DMC feat. Aerosmith", year: 1986, genre: "Rap Rock" },
  { id: "c550", title: "Fight the Power", artist: "Public Enemy", year: 1989, genre: "Hip Hop" },
  { id: "c551", title: "U Can't Touch This", artist: "MC Hammer", year: 1990, genre: "Hip Hop" },
  { id: "c552", title: "Jump Around", artist: "House of Pain", year: 1992, genre: "Hip Hop" },
  { id: "c553", title: "California Love", artist: "2Pac feat. Dr. Dre", year: 1995, genre: "Hip Hop" },
  { id: "c554", title: "Hypnotize", artist: "The Notorious B.I.G.", year: 1997, genre: "Hip Hop" },
  { id: "c555", title: "Get Ur Freak On", artist: "Missy Elliott", year: 2001, genre: "Hip Hop" },
  { id: "c556", title: "Without Me", artist: "Eminem", year: 2002, genre: "Hip Hop" },
  { id: "c557", title: "In Da Club", artist: "50 Cent", year: 2003, genre: "Hip Hop" },
  { id: "c558", title: "Hey Ya!", artist: "OutKast", year: 2003, genre: "Hip Hop Pop" },
  { id: "c559", title: "Drop It Like It's Hot", artist: "Snoop Dogg feat. Pharrell", year: 2004, genre: "Hip Hop" },
  { id: "c560", title: "Run This Town", artist: "Jay-Z feat. Rihanna & Kanye West", year: 2009, genre: "Hip Hop" },
  { id: "c561", title: "Love the Way You Lie", artist: "Eminem feat. Rihanna", year: 2010, genre: "Hip Hop Ballad" },
  { id: "c562", title: "Black and Yellow", artist: "Wiz Khalifa", year: 2010, genre: "Hip Hop" },
  { id: "c563", title: "Can't Hold Us", artist: "Macklemore & Ryan Lewis", year: 2011, genre: "Hip Hop" },
  { id: "c564", title: "Hotline Bling", artist: "Drake", year: 2015, genre: "Hip Hop" },
  { id: "c565", title: "HUMBLE.", artist: "Kendrick Lamar", year: 2017, genre: "Hip Hop" },
  { id: "c566", title: "SICKO MODE", artist: "Travis Scott", year: 2018, genre: "Hip Hop" },
  { id: "c567", title: "Savage", artist: "Megan Thee Stallion", year: 2020, genre: "Hip Hop" },
  { id: "c568", title: "Lose Yourself", artist: "Eminem", year: 2002, genre: "Hip Hop" },
  { id: "c569", title: "Astronaut in the Ocean", artist: "Masked Wolf", year: 2019, genre: "Hip Hop" },
  { id: "c570", title: "Industry Baby", artist: "Lil Nas X & Jack Harlow", year: 2021, genre: "Hip Hop" },
  { id: "c571", title: "Griechischer Wein", artist: "Udo Jürgens", year: 1974, genre: "Schlager" },
  { id: "c572", title: "Über den Wolken", artist: "Reinhard Mey", year: 1974, genre: "Deutsch Folk" },
  { id: "c573", title: "Er gehört zu mir", artist: "Marianne Rosenberg", year: 1975, genre: "Schlager" },
  { id: "c574", title: "Anita", artist: "Costa Cordalis", year: 1976, genre: "Schlager" },
  { id: "c575", title: "Santa Maria", artist: "Roland Kaiser", year: 1980, genre: "Schlager" },
  { id: "c576", title: "Joana", artist: "Roland Kaiser", year: 1984, genre: "Schlager" },
  { id: "c577", title: "Verdammt, ich lieb' dich", artist: "Matthias Reim", year: 1990, genre: "Schlager" },
  { id: "c578", title: "Wahnsinn", artist: "Wolfgang Petry", year: 1983, genre: "Schlager" },
  { id: "c579", title: "Weiß der Geier", artist: "Wolfgang Petry", year: 1997, genre: "Schlager" },
  { id: "c580", title: "Sie liebt den DJ", artist: "Michael Wendler", year: 2007, genre: "Schlager" },
  { id: "c581", title: "Ich war noch niemals in New York", artist: "Udo Jürgens", year: 1982, genre: "Schlager" },
  { id: "c582", title: "Cordula Grün", artist: "Josh.", year: 2018, genre: "Deutsch Pop" },
  { id: "c583", title: "Hulapalu", artist: "Andreas Gabalier", year: 2015, genre: "Schlager" },
  { id: "c584", title: "Warum hast du nicht nein gesagt", artist: "Roland Kaiser & Maite Kelly", year: 2014, genre: "Schlager" },
  { id: "c585", title: "Herzbeben", artist: "Helene Fischer", year: 2017, genre: "Schlager" },
  { id: "c586", title: "Regenbogenfarben", artist: "Kerstin Ott", year: 2018, genre: "Schlager" },
  { id: "c587", title: "Delfin", artist: "Isi Glück", year: 2023, genre: "Schlager Party" },
  { id: "c588", title: "Layla", artist: "DJ Robin & Schürze", year: 2022, genre: "Schlager Party" },
  { id: "c589", title: "Johnny Däpp", artist: "Lorenz Büffel", year: 2016, genre: "Schlager Party" },
  { id: "c590", title: "Mama Laudaaa", artist: "Almklausi & Specktakel", year: 2018, genre: "Schlager Party" },
  { id: "c591", title: "Waterloo", artist: "ABBA", year: 1974, genre: "Eurovision Pop" },
  { id: "c592", title: "Dschinghis Khan", artist: "Dschinghis Khan", year: 1979, genre: "Eurovision Pop" },
  { id: "c593", title: "Making Your Mind Up", artist: "Bucks Fizz", year: 1981, genre: "Eurovision Pop" },
  { id: "c594", title: "Hard Rock Hallelujah", artist: "Lordi", year: 2006, genre: "Eurovision Rock" },
  { id: "c595", title: "Satellite", artist: "Lena", year: 2010, genre: "Eurovision Pop" },
  { id: "c596", title: "Fairytale", artist: "Alexander Rybak", year: 2009, genre: "Eurovision Pop" },
  { id: "c597", title: "Only Teardrops", artist: "Emmelie de Forest", year: 2013, genre: "Eurovision Pop" },
  { id: "c598", title: "Heroes", artist: "Måns Zelmerlöw", year: 2015, genre: "Eurovision Pop" },
  { id: "c599", title: "Soldi", artist: "Mahmood", year: 2019, genre: "Eurovision Pop" },
  { id: "c600", title: "Stefania", artist: "Kalush Orchestra", year: 2022, genre: "Eurovision Folk Rap" },
  { id: "c601", title: "Cha Cha Cha", artist: "Käärijä", year: 2023, genre: "Eurovision Electronic" },
  { id: "c602", title: "The Code", artist: "Nemo", year: 2024, genre: "Eurovision Pop" },
  { id: "c603", title: "Circle of Life", artist: "Elton John", year: 1994, genre: "Movie Pop" },
  { id: "c604", title: "Hakuna Matata", artist: "Nathan Lane & Ernie Sabella", year: 1994, genre: "Movie Pop" },
  { id: "c605", title: "A Whole New World", artist: "Peabo Bryson & Regina Belle", year: 1992, genre: "Movie Pop" },
  { id: "c606", title: "You're the One That I Want", artist: "John Travolta & Olivia Newton-John", year: 1978, genre: "Movie Pop" },
  { id: "c607", title: "Summer Nights", artist: "John Travolta & Olivia Newton-John", year: 1978, genre: "Movie Pop" },
  { id: "c608", title: "Eye of the Tiger", artist: "Survivor", year: 1982, genre: "Movie Rock" },
  { id: "c609", title: "Flashdance... What a Feeling", artist: "Irene Cara", year: 1983, genre: "Movie Pop" },
  { id: "c610", title: "Footloose", artist: "Kenny Loggins", year: 1984, genre: "Movie Pop" },
  { id: "c611", title: "Danger Zone", artist: "Kenny Loggins", year: 1986, genre: "Movie Rock" },
  { id: "c612", title: "Unchained Melody", artist: "The Righteous Brothers", year: 1965, genre: "Movie Ballad" },
  { id: "c613", title: "(I've Had) The Time of My Life", artist: "Bill Medley & Jennifer Warnes", year: 1987, genre: "Movie Pop" },
  { id: "c614", title: "Can You Feel the Love Tonight", artist: "Elton John", year: 1994, genre: "Movie Ballad" },
  { id: "c615", title: "Lose Yourself", artist: "Eminem", year: 2002, genre: "Movie Hip Hop" },
  { id: "c616", title: "Lady Marmalade", artist: "Christina Aguilera, Lil' Kim, Mya & Pink", year: 2001, genre: "Movie Pop" },
  { id: "c617", title: "City of Stars", artist: "Ryan Gosling & Emma Stone", year: 2016, genre: "Movie Ballad" },
  { id: "c618", title: "A Million Dreams", artist: "Ziv Zaifman, Hugh Jackman & Michelle Williams", year: 2017, genre: "Movie Pop" },
  { id: "c619", title: "Remember Me", artist: "Miguel feat. Natalia Lafourcade", year: 2017, genre: "Movie Pop" },
  { id: "c620", title: "No Time to Die", artist: "Billie Eilish", year: 2020, genre: "Movie Ballad" },
];


const VINTAGE_EXPANSION_TRACKS = [
  { id: "v621", title: "Rock Around the Clock", artist: "Bill Haley & His Comets", year: 1954, genre: "Rock and Roll" },
  { id: "v622", title: "Tutti Frutti", artist: "Little Richard", year: 1955, genre: "Rock and Roll" },
  { id: "v623", title: "Heartbreak Hotel", artist: "Elvis Presley", year: 1956, genre: "Rock and Roll" },
  { id: "v624", title: "Jailhouse Rock", artist: "Elvis Presley", year: 1957, genre: "Rock and Roll" },
  { id: "v625", title: "Great Balls of Fire", artist: "Jerry Lee Lewis", year: 1957, genre: "Rock and Roll" },
  { id: "v626", title: "La Bamba", artist: "Ritchie Valens", year: 1958, genre: "Latin Rock" },
  { id: "v627", title: "What'd I Say", artist: "Ray Charles", year: 1959, genre: "Soul" },
  { id: "v628", title: "Only the Lonely", artist: "Roy Orbison", year: 1960, genre: "Pop Ballad" },
  { id: "v629", title: "The Twist", artist: "Chubby Checker", year: 1960, genre: "Party Rock and Roll" },
  { id: "v630", title: "Hit the Road Jack", artist: "Ray Charles", year: 1961, genre: "Soul" },
  { id: "v631", title: "Can't Help Falling in Love", artist: "Elvis Presley", year: 1961, genre: "Pop Ballad" },
  { id: "v632", title: "Twist and Shout", artist: "The Isley Brothers", year: 1962, genre: "Soul Rock" },
  { id: "v633", title: "You've Really Got Me", artist: "The Kinks", year: 1964, genre: "Rock" },
  { id: "v634", title: "I Get Around", artist: "The Beach Boys", year: 1964, genre: "Pop Rock" },
  { id: "v635", title: "My Girl", artist: "The Temptations", year: 1964, genre: "Motown Soul" },
  { id: "v636", title: "Mr. Tambourine Man", artist: "The Byrds", year: 1965, genre: "Folk Rock" },
  { id: "v637", title: "I Got You (I Feel Good)", artist: "James Brown", year: 1965, genre: "Funk Soul" },
  { id: "v638", title: "Like a Rolling Stone", artist: "Bob Dylan", year: 1965, genre: "Folk Rock" },
  { id: "v639", title: "These Boots Are Made for Walkin'", artist: "Nancy Sinatra", year: 1966, genre: "Pop" },
  { id: "v640", title: "Paint It Black", artist: "The Rolling Stones", year: 1966, genre: "Rock" },
  { id: "v641", title: "Sunny Afternoon", artist: "The Kinks", year: 1966, genre: "Rock" },
  { id: "v642", title: "I'm a Believer", artist: "The Monkees", year: 1966, genre: "Pop Rock" },
  { id: "v643", title: "A Whiter Shade of Pale", artist: "Procol Harum", year: 1967, genre: "Rock Ballad" },
  { id: "v644", title: "Light My Fire", artist: "The Doors", year: 1967, genre: "Rock" },
  { id: "v645", title: "Happy Together", artist: "The Turtles", year: 1967, genre: "Pop Rock" },
  { id: "v646", title: "Mrs. Robinson", artist: "Simon & Garfunkel", year: 1968, genre: "Folk Rock" },
  { id: "v647", title: "Born to Be Wild", artist: "Steppenwolf", year: 1968, genre: "Rock" },
  { id: "v648", title: "Sweet Caroline", artist: "Neil Diamond", year: 1969, genre: "Pop" },
  { id: "v649", title: "Bad Moon Rising", artist: "Creedence Clearwater Revival", year: 1969, genre: "Rock" },
  { id: "v650", title: "Whole Lotta Love", artist: "Led Zeppelin", year: 1969, genre: "Hard Rock" },
  { id: "v651", title: "Bridge Over Troubled Water", artist: "Simon & Garfunkel", year: 1970, genre: "Folk Ballad" },
  { id: "v652", title: "Lola", artist: "The Kinks", year: 1970, genre: "Rock" },
  { id: "v653", title: "Ain't No Sunshine", artist: "Bill Withers", year: 1971, genre: "Soul" },
  { id: "v654", title: "American Pie", artist: "Don McLean", year: 1971, genre: "Folk Rock" },
  { id: "v655", title: "Take Me Home, Country Roads", artist: "John Denver", year: 1971, genre: "Country Folk" },
  { id: "v656", title: "Let's Stay Together", artist: "Al Green", year: 1971, genre: "Soul" },
  { id: "v657", title: "Rocket Man", artist: "Elton John", year: 1972, genre: "Pop Rock" },
  { id: "v658", title: "Lean on Me", artist: "Bill Withers", year: 1972, genre: "Soul" },
  { id: "v659", title: "Stuck in the Middle with You", artist: "Stealers Wheel", year: 1972, genre: "Rock" },
  { id: "v660", title: "Live and Let Die", artist: "Wings", year: 1973, genre: "Movie Rock" },
  { id: "v661", title: "Killing Me Softly with His Song", artist: "Roberta Flack", year: 1973, genre: "Soul Ballad" },
  { id: "v662", title: "Piano Man", artist: "Billy Joel", year: 1973, genre: "Pop Rock" },
  { id: "v663", title: "Jolene", artist: "Dolly Parton", year: 1973, genre: "Country" },
  { id: "v664", title: "Rebel Rebel", artist: "David Bowie", year: 1974, genre: "Rock" },
  { id: "v665", title: "Sweet Home Alabama", artist: "Lynyrd Skynyrd", year: 1974, genre: "Southern Rock" },
  { id: "v666", title: "Kung Fu Fighting", artist: "Carl Douglas", year: 1974, genre: "Disco Pop" },
  { id: "v667", title: "Fame", artist: "David Bowie", year: 1975, genre: "Funk Rock" },
  { id: "v668", title: "Bohemian Rhapsody", artist: "Queen", year: 1975, genre: "Rock" },
  { id: "v669", title: "December, 1963", artist: "The Four Seasons", year: 1975, genre: "Disco Pop" },
  { id: "v670", title: "Don't Go Breaking My Heart", artist: "Elton John & Kiki Dee", year: 1976, genre: "Pop" },
  { id: "v671", title: "Dancing in the Moonlight", artist: "King Harvest", year: 1972, genre: "Pop Rock" },
  { id: "v672", title: "Blitzkrieg Bop", artist: "Ramones", year: 1976, genre: "Punk Rock" },
  { id: "v673", title: "Go Your Own Way", artist: "Fleetwood Mac", year: 1977, genre: "Rock" },
  { id: "v674", title: "Dreams", artist: "Fleetwood Mac", year: 1977, genre: "Rock" },
  { id: "v675", title: "Heroes", artist: "David Bowie", year: 1977, genre: "Rock" },
  { id: "v676", title: "Psycho Killer", artist: "Talking Heads", year: 1977, genre: "New Wave" },
  { id: "v677", title: "Mr. Blue Sky", artist: "Electric Light Orchestra", year: 1977, genre: "Pop Rock" },
  { id: "v678", title: "Sultans of Swing", artist: "Dire Straits", year: 1978, genre: "Rock" },
  { id: "v679", title: "September", artist: "Earth, Wind & Fire", year: 1978, genre: "Disco Funk" },
  { id: "v680", title: "Heart of Glass", artist: "Blondie", year: 1978, genre: "New Wave Disco" },
  { id: "v681", title: "Don't Stop Me Now", artist: "Queen", year: 1978, genre: "Rock" },
  { id: "v682", title: "Message in a Bottle", artist: "The Police", year: 1979, genre: "New Wave Rock" },
  { id: "v683", title: "Video Killed the Radio Star", artist: "The Buggles", year: 1979, genre: "New Wave Pop" },
  { id: "v684", title: "Rapper's Delight", artist: "The Sugarhill Gang", year: 1979, genre: "Hip Hop" },
  { id: "v685", title: "Call Me", artist: "Blondie", year: 1980, genre: "New Wave Rock" },
  { id: "v686", title: "Upside Down", artist: "Diana Ross", year: 1980, genre: "Disco Pop" },
  { id: "v687", title: "Just the Two of Us", artist: "Grover Washington Jr. feat. Bill Withers", year: 1980, genre: "Soul" },
  { id: "v688", title: "Start Me Up", artist: "The Rolling Stones", year: 1981, genre: "Rock" },
  { id: "v689", title: "Physical", artist: "Olivia Newton-John", year: 1981, genre: "Pop" },
  { id: "v690", title: "Centerfold", artist: "The J. Geils Band", year: 1981, genre: "Rock" },
  { id: "v691", title: "Come On Eileen", artist: "Dexys Midnight Runners", year: 1982, genre: "Pop" },
  { id: "v692", title: "Maneater", artist: "Daryl Hall & John Oates", year: 1982, genre: "Pop Rock" },
  { id: "v693", title: "Sweet Dreams", artist: "Eurythmics", year: 1983, genre: "Synthpop" },
  { id: "v694", title: "Blue Monday", artist: "New Order", year: 1983, genre: "Electronic" },
  { id: "v695", title: "Karma Chameleon", artist: "Culture Club", year: 1983, genre: "Pop" },
  { id: "v696", title: "Jump", artist: "Van Halen", year: 1984, genre: "Rock" },
  { id: "v697", title: "Smalltown Boy", artist: "Bronski Beat", year: 1984, genre: "Synthpop" },
  { id: "v698", title: "Take On Me", artist: "a-ha", year: 1985, genre: "Synthpop" },
  { id: "v699", title: "Everybody Wants to Rule the World", artist: "Tears for Fears", year: 1985, genre: "Pop Rock" },
  { id: "v700", title: "Money for Nothing", artist: "Dire Straits", year: 1985, genre: "Rock" },
  { id: "v701", title: "West End Girls", artist: "Pet Shop Boys", year: 1985, genre: "Synthpop" },
  { id: "v702", title: "You Give Love a Bad Name", artist: "Bon Jovi", year: 1986, genre: "Rock" },
  { id: "v703", title: "The Lady in Red", artist: "Chris de Burgh", year: 1986, genre: "Pop Ballad" },
  { id: "v704", title: "Don't Dream It's Over", artist: "Crowded House", year: 1986, genre: "Pop Rock" },
  { id: "v705", title: "Beds Are Burning", artist: "Midnight Oil", year: 1987, genre: "Rock" },
  { id: "v706", title: "Never Tear Us Apart", artist: "INXS", year: 1987, genre: "Rock Ballad" },
  { id: "v707", title: "Man in the Mirror", artist: "Michael Jackson", year: 1987, genre: "Pop" },
  { id: "v708", title: "The Look", artist: "Roxette", year: 1988, genre: "Pop Rock" },
  { id: "v709", title: "Buffalo Stance", artist: "Neneh Cherry", year: 1988, genre: "Hip Hop Pop" },
  { id: "v710", title: "Personal Jesus", artist: "Depeche Mode", year: 1989, genre: "Alternative" },
];


const ERA_BALANCE_EXPANSION_TRACKS = [
  { id: "b711", title: "Blue Suede Shoes", artist: "Carl Perkins", year: 1956, genre: "Rock and Roll" },
  { id: "b712", title: "Hound Dog", artist: "Elvis Presley", year: 1956, genre: "Rock and Roll" },
  { id: "b713", title: "That'll Be the Day", artist: "Buddy Holly", year: 1957, genre: "Rock and Roll" },
  { id: "b714", title: "Peggy Sue", artist: "Buddy Holly", year: 1957, genre: "Rock and Roll" },
  { id: "b715", title: "Wake Up Little Susie", artist: "The Everly Brothers", year: 1957, genre: "Rock and Roll" },
  { id: "b716", title: "Summertime Blues", artist: "Eddie Cochran", year: 1958, genre: "Rock and Roll" },
  { id: "b717", title: "Yakety Yak", artist: "The Coasters", year: 1958, genre: "Rock and Roll" },
  { id: "b718", title: "Dream Lover", artist: "Bobby Darin", year: 1959, genre: "Pop" },
  { id: "b719", title: "Mack the Knife", artist: "Bobby Darin", year: 1959, genre: "Pop Jazz" },
  { id: "b720", title: "Shout", artist: "The Isley Brothers", year: 1959, genre: "Soul Rock" },
  { id: "b721", title: "Runaway", artist: "Del Shannon", year: 1961, genre: "Pop Rock" },
  { id: "b722", title: "Please Mr. Postman", artist: "The Marvelettes", year: 1961, genre: "Motown Pop" },
  { id: "b723", title: "Green Onions", artist: "Booker T. & the M.G.'s", year: 1962, genre: "Soul Funk" },
  { id: "b724", title: "Surfin' U.S.A.", artist: "The Beach Boys", year: 1963, genre: "Pop Rock" },
  { id: "b725", title: "Louie Louie", artist: "The Kingsmen", year: 1963, genre: "Rock" },
  { id: "b726", title: "You Really Got a Hold on Me", artist: "The Miracles", year: 1962, genre: "Motown Soul" },
  { id: "b727", title: "Do You Love Me", artist: "The Contours", year: 1962, genre: "Motown Soul" },
  { id: "b728", title: "The Loco-Motion", artist: "Little Eva", year: 1962, genre: "Pop" },
  { id: "b729", title: "Where Did Our Love Go", artist: "The Supremes", year: 1964, genre: "Motown Pop" },
  { id: "b730", title: "Dancing in the Street", artist: "Martha and the Vandellas", year: 1964, genre: "Motown Soul" },
  { id: "b731", title: "You Can't Hurry Love", artist: "The Supremes", year: 1966, genre: "Motown Pop" },
  { id: "b732", title: "Wild Thing", artist: "The Troggs", year: 1966, genre: "Rock" },
  { id: "b733", title: "Gimme Some Lovin'", artist: "The Spencer Davis Group", year: 1966, genre: "Rock Soul" },
  { id: "b734", title: "Somebody to Love", artist: "Jefferson Airplane", year: 1967, genre: "Rock" },
  { id: "b735", title: "Piece of My Heart", artist: "Big Brother and the Holding Company", year: 1968, genre: "Rock" },
  { id: "b736", title: "I Heard It Through the Grapevine", artist: "Marvin Gaye", year: 1968, genre: "Soul" },
  { id: "b737", title: "Crimson and Clover", artist: "Tommy James and the Shondells", year: 1968, genre: "Pop Rock" },
  { id: "b738", title: "Build Me Up Buttercup", artist: "The Foundations", year: 1968, genre: "Soul Pop" },
  { id: "b739", title: "Get Back", artist: "The Beatles", year: 1969, genre: "Rock" },
  { id: "b740", title: "Fortunate Son", artist: "Creedence Clearwater Revival", year: 1969, genre: "Rock" },
  { id: "b741", title: "Signed, Sealed, Delivered I'm Yours", artist: "Stevie Wonder", year: 1970, genre: "Soul Funk" },
  { id: "b742", title: "War", artist: "Edwin Starr", year: 1970, genre: "Soul Funk" },
  { id: "b743", title: "It's Too Late", artist: "Carole King", year: 1971, genre: "Pop" },
  { id: "b744", title: "Maggie May", artist: "Rod Stewart", year: 1971, genre: "Rock" },
  { id: "b745", title: "Me and Bobby McGee", artist: "Janis Joplin", year: 1971, genre: "Rock" },
  { id: "b746", title: "Without You", artist: "Harry Nilsson", year: 1971, genre: "Pop Ballad" },
  { id: "b747", title: "School's Out", artist: "Alice Cooper", year: 1972, genre: "Rock" },
  { id: "b748", title: "Crocodile Rock", artist: "Elton John", year: 1972, genre: "Pop Rock" },
  { id: "b749", title: "You Are the Sunshine of My Life", artist: "Stevie Wonder", year: 1973, genre: "Soul Pop" },
  { id: "b750", title: "Radar Love", artist: "Golden Earring", year: 1973, genre: "Rock" },
  { id: "b751", title: "The Joker", artist: "Steve Miller Band", year: 1973, genre: "Rock" },
  { id: "b752", title: "Hooked on a Feeling", artist: "Blue Swede", year: 1974, genre: "Pop Rock" },
  { id: "b753", title: "Lady Marmalade", artist: "Labelle", year: 1974, genre: "Disco Soul" },
  { id: "b754", title: "Love Is in the Air", artist: "John Paul Young", year: 1977, genre: "Disco Pop" },
  { id: "b755", title: "Night Fever", artist: "Bee Gees", year: 1977, genre: "Disco" },
  { id: "b756", title: "More Than a Feeling", artist: "Boston", year: 1976, genre: "Rock" },
  { id: "b757", title: "Rich Girl", artist: "Daryl Hall & John Oates", year: 1977, genre: "Pop Rock" },
  { id: "b758", title: "Hot Stuff", artist: "Donna Summer", year: 1979, genre: "Disco" },
  { id: "b759", title: "I Was Made for Lovin' You", artist: "KISS", year: 1979, genre: "Rock Disco" },
  { id: "b760", title: "Don't Bring Me Down", artist: "Electric Light Orchestra", year: 1979, genre: "Pop Rock" },
  { id: "b761", title: "Another Day in Paradise", artist: "Phil Collins", year: 1989, genre: "Pop" },
  { id: "b762", title: "Sledgehammer", artist: "Peter Gabriel", year: 1986, genre: "Pop Rock" },
  { id: "b763", title: "Addicted to Love", artist: "Robert Palmer", year: 1985, genre: "Rock" },
  { id: "b764", title: "Take My Breath Away", artist: "Berlin", year: 1986, genre: "Movie Pop" },
  { id: "b765", title: "I Wanna Dance with Somebody", artist: "Whitney Houston", year: 1987, genre: "Dance Pop" },
  { id: "b766", title: "Heaven Is a Place on Earth", artist: "Belinda Carlisle", year: 1987, genre: "Pop Rock" },
  { id: "b767", title: "Never Gonna Give You Up", artist: "Rick Astley", year: 1987, genre: "Pop" },
  { id: "b768", title: "Faith", artist: "George Michael", year: 1987, genre: "Pop" },
  { id: "b769", title: "The Way You Make Me Feel", artist: "Michael Jackson", year: 1987, genre: "Pop" },
  { id: "b770", title: "Like a Prayer", artist: "Madonna", year: 1989, genre: "Pop" },
  { id: "b771", title: "Blinding Lights", artist: "The Weeknd", year: 2020, genre: "Synthpop" },
  { id: "b772", title: "Save Your Tears", artist: "The Weeknd", year: 2020, genre: "Synthpop" },
  { id: "b773", title: "Therefore I Am", artist: "Billie Eilish", year: 2020, genre: "Pop" },
  { id: "b774", title: "Mood", artist: "24kGoldn feat. Iann Dior", year: 2020, genre: "Pop Rap" },
  { id: "b775", title: "Dynamite", artist: "BTS", year: 2020, genre: "Dance Pop" },
  { id: "b776", title: "Levitating", artist: "Dua Lipa", year: 2020, genre: "Dance Pop" },
  { id: "b777", title: "Bad Habits", artist: "Ed Sheeran", year: 2021, genre: "Pop" },
  { id: "b778", title: "Montero", artist: "Lil Nas X", year: 2021, genre: "Pop Rap" },
  { id: "b779", title: "Stay", artist: "The Kid LAROI & Justin Bieber", year: 2021, genre: "Pop" },
  { id: "b780", title: "As It Was", artist: "Harry Styles", year: 2022, genre: "Pop" },
  { id: "b781", title: "About Damn Time", artist: "Lizzo", year: 2022, genre: "Party Pop" },
  { id: "b782", title: "Calm Down", artist: "Rema & Selena Gomez", year: 2022, genre: "Afrobeats Pop" },
  { id: "b783", title: "Escapism.", artist: "Raye feat. 070 Shake", year: 2022, genre: "Pop" },
  { id: "b784", title: "Kill Bill", artist: "SZA", year: 2022, genre: "R&B Pop" },
  { id: "b785", title: "Padam Padam", artist: "Kylie Minogue", year: 2023, genre: "Dance Pop" },
  { id: "b786", title: "Dance the Night", artist: "Dua Lipa", year: 2023, genre: "Movie Pop" },
  { id: "b787", title: "Paint the Town Red", artist: "Doja Cat", year: 2023, genre: "Pop Rap" },
  { id: "b788", title: "Houdini", artist: "Dua Lipa", year: 2023, genre: "Dance Pop" },
  { id: "b789", title: "Beautiful Things", artist: "Benson Boone", year: 2024, genre: "Pop Rock" },
  { id: "b790", title: "Texas Hold 'Em", artist: "Beyoncé", year: 2024, genre: "Country Pop" },
];

const SONGPOOL_800_EXPANSION_TRACKS = [
  { id: "e8001", title: "Only You", artist: "The Platters", year: 1955, genre: "Doo-wop" },
  { id: "e8002", title: "Mr. Sandman", artist: "The Chordettes", year: 1954, genre: "Vocal Pop" },
  { id: "e8003", title: "Sh-Boom", artist: "The Chords", year: 1954, genre: "Doo-wop" },
  { id: "e8004", title: "Earth Angel", artist: "The Penguins", year: 1954, genre: "Doo-wop" },
  { id: "e8005", title: "Sixteen Tons", artist: "Tennessee Ernie Ford", year: 1955, genre: "Country" },
  { id: "e8006", title: "Come Go with Me", artist: "The Del-Vikings", year: 1957, genre: "Doo-wop" },
  { id: "e8007", title: "Poetry in Motion", artist: "Johnny Tillotson", year: 1960, genre: "Pop" },
  { id: "e8008", title: "Telstar", artist: "The Tornados", year: 1962, genre: "Instrumental" },
  { id: "e8009", title: "Rhythm of the Rain", artist: "The Cascades", year: 1962, genre: "Pop" },
  { id: "e8010", title: "Walk Like a Man", artist: "The Four Seasons", year: 1963, genre: "Pop" },
  { id: "e8011", title: "Da Doo Ron Ron", artist: "The Crystals", year: 1963, genre: "Girl Group" },
  { id: "e8012", title: "Wipe Out", artist: "The Surfaris", year: 1963, genre: "Surf Rock" },
  { id: "e8013", title: "Surfin' Bird", artist: "The Trashmen", year: 1963, genre: "Surf Rock" },
  { id: "e8014", title: "California Sun", artist: "The Rivieras", year: 1964, genre: "Surf Rock" },
  { id: "e8015", title: "Baby Love", artist: "The Supremes", year: 1964, genre: "Motown" },
  { id: "e8016", title: "The Girl from Ipanema", artist: "Stan Getz & João Gilberto", year: 1964, genre: "Bossa Nova" },
  { id: "e8017", title: "You Really Got Me", artist: "The Kinks", year: 1964, genre: "Rock" },
  { id: "e8018", title: "Needles and Pins", artist: "The Searchers", year: 1964, genre: "Beat" },
  { id: "e8019", title: "She's Not There", artist: "The Zombies", year: 1964, genre: "Rock" },
  { id: "e8020", title: "Downtown", artist: "Petula Clark", year: 1964, genre: "Pop" },
  { id: "e8021", title: "Stop! In the Name of Love", artist: "The Supremes", year: 1965, genre: "Motown" },
  { id: "e8022", title: "The Tracks of My Tears", artist: "Smokey Robinson & The Miracles", year: 1965, genre: "Motown" },
  { id: "e8023", title: "I Got You Babe", artist: "Sonny & Cher", year: 1965, genre: "Pop" },
  { id: "e8024", title: "Do You Believe in Magic", artist: "The Lovin' Spoonful", year: 1965, genre: "Folk Rock" },
  { id: "e8025", title: "All Right Now", artist: "Free", year: 1970, genre: "Rock" },
  { id: "e8026", title: "ABC", artist: "The Jackson 5", year: 1970, genre: "Motown" },
  { id: "e8027", title: "O-o-h Child", artist: "Five Stairsteps", year: 1970, genre: "Soul" },
  { id: "e8028", title: "Love Grows", artist: "Edison Lighthouse", year: 1970, genre: "Pop" },
  { id: "e8029", title: "Black Magic Woman", artist: "Santana", year: 1970, genre: "Latin Rock" },
  { id: "e8030", title: "Mr. Bojangles", artist: "Nitty Gritty Dirt Band", year: 1970, genre: "Country Rock" },
  { id: "e8031", title: "Knock Three Times", artist: "Tony Orlando & Dawn", year: 1970, genre: "Pop" },
  { id: "e8032", title: "Joy to the World", artist: "Three Dog Night", year: 1971, genre: "Rock" },
  { id: "e8033", title: "Have You Ever Seen the Rain", artist: "Creedence Clearwater Revival", year: 1971, genre: "Rock" },
  { id: "e8034", title: "Riders on the Storm", artist: "The Doors", year: 1971, genre: "Rock" },
  { id: "e8035", title: "I Am... I Said", artist: "Neil Diamond", year: 1971, genre: "Pop" },
  { id: "e8036", title: "What's Going On", artist: "Marvin Gaye", year: 1971, genre: "Soul" },
  { id: "e8037", title: "Brand New Key", artist: "Melanie", year: 1971, genre: "Folk Pop" },
  { id: "e8038", title: "Family Affair", artist: "Sly & The Family Stone", year: 1971, genre: "Funk" },
  { id: "e8039", title: "Long Cool Woman", artist: "The Hollies", year: 1972, genre: "Rock" },
  { id: "e8040", title: "I Can See Clearly Now", artist: "Johnny Nash", year: 1972, genre: "Reggae Pop" },
  { id: "e8041", title: "Papa Was a Rollin' Stone", artist: "The Temptations", year: 1972, genre: "Soul" },
  { id: "e8042", title: "You're So Vain", artist: "Carly Simon", year: 1972, genre: "Pop Rock" },
  { id: "e8043", title: "Could It Be I'm Falling in Love", artist: "The Spinners", year: 1972, genre: "Soul" },
  { id: "e8044", title: "Angie", artist: "The Rolling Stones", year: 1973, genre: "Rock" },
  { id: "e8045", title: "Free Bird", artist: "Lynyrd Skynyrd", year: 1973, genre: "Southern Rock" },
  { id: "e8046", title: "Midnight Train to Georgia", artist: "Gladys Knight & The Pips", year: 1973, genre: "Soul" },
  { id: "e8047", title: "Brother Louie", artist: "Stories", year: 1973, genre: "Pop" },
  { id: "e8048", title: "Love Train", artist: "The O'Jays", year: 1973, genre: "Soul" },
  { id: "e8049", title: "Goodbye Yellow Brick Road", artist: "Elton John", year: 1973, genre: "Pop Rock" },
  { id: "e8050", title: "Love Is a Battlefield", artist: "Pat Benatar", year: 1983, genre: "Rock" },
  { id: "e8051", title: "Atomic", artist: "Blondie", year: 1980, genre: "New Wave" },
  { id: "e8052", title: "Funkytown", artist: "Lipps Inc.", year: 1980, genre: "Disco" },
  { id: "e8053", title: "Whip It", artist: "Devo", year: 1980, genre: "New Wave" },
  { id: "e8054", title: "You Shook Me All Night Long", artist: "AC/DC", year: 1980, genre: "Rock" },
  { id: "e8055", title: "Babooshka", artist: "Kate Bush", year: 1980, genre: "Art Pop" },
  { id: "e8056", title: "Don't Stand So Close to Me", artist: "The Police", year: 1980, genre: "New Wave" },
  { id: "e8057", title: "Vienna", artist: "Ultravox", year: 1980, genre: "Synthpop" },
  { id: "e8058", title: "In the Air Tonight", artist: "Phil Collins", year: 1981, genre: "Pop Rock" },
  { id: "e8059", title: "Bette Davis Eyes", artist: "Kim Carnes", year: 1981, genre: "Pop" },
  { id: "e8060", title: "Our Lips Are Sealed", artist: "The Go-Go's", year: 1981, genre: "New Wave" },
  { id: "e8061", title: "I Love Rock 'n' Roll", artist: "Joan Jett & The Blackhearts", year: 1981, genre: "Rock" },
  { id: "e8062", title: "Under Pressure", artist: "Queen & David Bowie", year: 1981, genre: "Rock" },
  { id: "e8063", title: "Do You Really Want to Hurt Me", artist: "Culture Club", year: 1982, genre: "New Wave" },
  { id: "e8064", title: "1999", artist: "Prince", year: 1982, genre: "Funk" },
  { id: "e8065", title: "I Ran", artist: "A Flock of Seagulls", year: 1982, genre: "New Wave" },
  { id: "e8066", title: "Jack & Diane", artist: "John Mellencamp", year: 1982, genre: "Rock" },
  { id: "e8067", title: "Gloria", artist: "Laura Branigan", year: 1982, genre: "Pop" },
  { id: "e8068", title: "Electric Avenue", artist: "Eddy Grant", year: 1982, genre: "Reggae Pop" },
  { id: "e8069", title: "Relax", artist: "Frankie Goes to Hollywood", year: 1983, genre: "Synthpop" },
  { id: "e8070", title: "Let's Dance", artist: "David Bowie", year: 1983, genre: "Pop Rock" },
  { id: "e8071", title: "Owner of a Lonely Heart", artist: "Yes", year: 1983, genre: "Rock" },
  { id: "e8072", title: "When Doves Cry", artist: "Prince", year: 1984, genre: "Funk" },
  { id: "e8073", title: "Like a Virgin", artist: "Madonna", year: 1984, genre: "Pop" },
  { id: "e8074", title: "The Reflex", artist: "Duran Duran", year: 1984, genre: "New Wave" },
  { id: "e8075", title: "Shout", artist: "Tears for Fears", year: 1984, genre: "Synthpop" },
  { id: "e8076", title: "Dancing in the Dark", artist: "Bruce Springsteen", year: 1984, genre: "Rock" },
  { id: "e8077", title: "Self Control", artist: "Laura Branigan", year: 1984, genre: "Pop" },
  { id: "e8078", title: "You're the Inspiration", artist: "Chicago", year: 1984, genre: "Rock Ballad" },
  { id: "e8079", title: "Sweet Dreams", artist: "La Bouche", year: 1995, genre: "Eurodance" },
  { id: "e8080", title: "Nothing Compares 2 U", artist: "Sinéad O'Connor", year: 1990, genre: "Pop Ballad" },
  { id: "e8081", title: "The Power", artist: "Snap!", year: 1990, genre: "Eurodance" },
  { id: "e8082", title: "It Must Have Been Love", artist: "Roxette", year: 1990, genre: "Pop Ballad" },
  { id: "e8083", title: "Unbelievable", artist: "EMF", year: 1990, genre: "Alternative" },
  { id: "e8084", title: "More Than Words", artist: "Extreme", year: 1991, genre: "Acoustic Rock" },
  { id: "e8085", title: "Set Adrift on Memory Bliss", artist: "P.M. Dawn", year: 1991, genre: "Hip-Hop" },
  { id: "e8086", title: "One", artist: "U2", year: 1991, genre: "Rock" },
  { id: "e8087", title: "Would I Lie to You?", artist: "Charles & Eddie", year: 1992, genre: "Soul" },
  { id: "e8088", title: "Connected", artist: "Stereo MC's", year: 1992, genre: "Hip-Hop" },
  { id: "e8089", title: "Friday I'm in Love", artist: "The Cure", year: 1992, genre: "Alternative" },
  { id: "e8090", title: "Ordinary World", artist: "Duran Duran", year: 1992, genre: "Pop Rock" },
  { id: "e8091", title: "No Rain", artist: "Blind Melon", year: 1992, genre: "Alternative" },
  { id: "e8092", title: "Dreams", artist: "Gabrielle", year: 1993, genre: "Pop" },
  { id: "e8093", title: "Two Princes", artist: "Spin Doctors", year: 1993, genre: "Rock" },
  { id: "e8094", title: "Informer", artist: "Snow", year: 1993, genre: "Reggae Pop" },
  { id: "e8095", title: "Regulate", artist: "Warren G", year: 1994, genre: "Hip-Hop" },
  { id: "e8096", title: "Return to Innocence", artist: "Enigma", year: 1994, genre: "New Age Pop" },
  { id: "e8097", title: "Always", artist: "Bon Jovi", year: 1994, genre: "Rock Ballad" },
  { id: "e8098", title: "Common People", artist: "Pulp", year: 1995, genre: "Britpop" },
  { id: "e8099", title: "Missing", artist: "Everything But The Girl", year: 1995, genre: "Dance" },
  { id: "e8100", title: "Bitter Sweet Symphony", artist: "The Verve", year: 1997, genre: "Britpop" },
  { id: "e8101", title: "Blue", artist: "Eiffel 65", year: 1998, genre: "Eurodance" },
  { id: "e8102", title: "Flat Beat", artist: "Mr. Oizo", year: 1999, genre: "Electronic" },
  { id: "e8103", title: "Stan", artist: "Eminem", year: 2000, genre: "Hip-Hop" },
  { id: "e8104", title: "The Real Slim Shady", artist: "Eminem", year: 2000, genre: "Hip-Hop" },
  { id: "e8105", title: "Music", artist: "Madonna", year: 2000, genre: "Pop" },
  { id: "e8106", title: "Teenage Dirtbag", artist: "Wheatus", year: 2000, genre: "Pop Rock" },
  { id: "e8107", title: "It Wasn't Me", artist: "Shaggy", year: 2000, genre: "Reggae Pop" },
  { id: "e8108", title: "Get the Party Started", artist: "Pink", year: 2001, genre: "Pop" },
  { id: "e8109", title: "A Thousand Miles", artist: "Vanessa Carlton", year: 2002, genre: "Pop" },
  { id: "e8110", title: "Dilemma", artist: "Nelly feat. Kelly Rowland", year: 2002, genre: "R&B" },
  { id: "e8111", title: "Crazy in Love", artist: "Beyoncé feat. Jay-Z", year: 2003, genre: "R&B" },
  { id: "e8112", title: "Don't Cha", artist: "The Pussycat Dolls", year: 2005, genre: "Pop" },
  { id: "e8113", title: "I Bet You Look Good on the Dancefloor", artist: "Arctic Monkeys", year: 2005, genre: "Indie Rock" },
  { id: "e8114", title: "Maneater", artist: "Nelly Furtado", year: 2006, genre: "Pop" },
  { id: "e8115", title: "1973", artist: "James Blunt", year: 2007, genre: "Pop" },
  { id: "e8116", title: "Sweet Disposition", artist: "The Temper Trap", year: 2008, genre: "Indie" },
  { id: "e8117", title: "You've Got the Love", artist: "Florence + The Machine", year: 2009, genre: "Indie" },
  { id: "e8118", title: "We No Speak Americano", artist: "Yolanda Be Cool & DCUP", year: 2010, genre: "Dance" },
  { id: "e8119", title: "Just the Way You Are", artist: "Bruno Mars", year: 2010, genre: "Pop" },
  { id: "e8120", title: "Only Girl", artist: "Rihanna", year: 2010, genre: "Dance Pop" },
  { id: "e8121", title: "Wonderful Life", artist: "Hurts", year: 2010, genre: "Synthpop" },
  { id: "e8122", title: "Moves Like Jagger", artist: "Maroon 5 feat. Christina Aguilera", year: 2011, genre: "Pop" },
  { id: "e8123", title: "Video Games", artist: "Lana Del Rey", year: 2011, genre: "Indie Pop" },
  { id: "e8124", title: "Little Talks", artist: "Of Monsters and Men", year: 2011, genre: "Indie" },
  { id: "e8125", title: "Titanium", artist: "David Guetta feat. Sia", year: 2011, genre: "Dance" },
  { id: "e8126", title: "Feel This Moment", artist: "Pitbull feat. Christina Aguilera", year: 2012, genre: "Pop" },
  { id: "e8127", title: "I Love It", artist: "Icona Pop", year: 2012, genre: "Dance Pop" },
  { id: "e8128", title: "Blurred Lines", artist: "Robin Thicke feat. T.I. & Pharrell", year: 2013, genre: "Pop" },
  { id: "e8129", title: "Pompeii", artist: "Bastille", year: 2013, genre: "Indie Pop" },
  { id: "e8130", title: "Lean On", artist: "Major Lazer & DJ Snake feat. MØ", year: 2015, genre: "Dance" },
  { id: "e8131", title: "Faded", artist: "Alan Walker", year: 2015, genre: "EDM" },
  { id: "e8132", title: "This Is What You Came For", artist: "Calvin Harris feat. Rihanna", year: 2016, genre: "Dance" },
  { id: "e8133", title: "Castle on the Hill", artist: "Ed Sheeran", year: 2017, genre: "Pop" },
  { id: "e8134", title: "Feel It Still", artist: "Portugal. The Man", year: 2017, genre: "Indie Pop" },
  { id: "e8135", title: "One Kiss", artist: "Calvin Harris & Dua Lipa", year: 2018, genre: "Dance" },
  { id: "e8136", title: "No Tears Left to Cry", artist: "Ariana Grande", year: 2018, genre: "Pop" },
  { id: "e8137", title: "Sweet but Psycho", artist: "Ava Max", year: 2018, genre: "Pop" },
  { id: "e8138", title: "Señorita", artist: "Shawn Mendes & Camila Cabello", year: 2019, genre: "Pop" },
  { id: "e8139", title: "Physical", artist: "Dua Lipa", year: 2020, genre: "Dance Pop" },
  { id: "e8140", title: "Beggin'", artist: "Måneskin", year: 2021, genre: "Rock" },
  { id: "e8141", title: "I'm Good", artist: "David Guetta & Bebe Rexha", year: 2022, genre: "Dance" },
  { id: "e8142", title: "Made You Look", artist: "Meghan Trainor", year: 2022, genre: "Pop" },
  { id: "e8143", title: "What Was I Made For?", artist: "Billie Eilish", year: 2023, genre: "Soundtrack" },
  { id: "e8144", title: "Cruel Summer", artist: "Taylor Swift", year: 2019, genre: "Pop" },
  { id: "e8145", title: "Training Season", artist: "Dua Lipa", year: 2024, genre: "Dance Pop" },
  { id: "e8146", title: "Too Sweet", artist: "Hozier", year: 2024, genre: "Soul" },
  { id: "e8147", title: "Birds of a Feather", artist: "Billie Eilish", year: 2024, genre: "Pop" },
  { id: "e8148", title: "A Bar Song", artist: "Shaboozey", year: 2024, genre: "Country Pop" },
  { id: "e8149", title: "Stargazing", artist: "Myles Smith", year: 2024, genre: "Folk Pop" },
  { id: "e8150", title: "The Door", artist: "Teddy Swims", year: 2024, genre: "Soul Pop" },
  { id: "e8151", title: "I Had Some Help", artist: "Post Malone feat. Morgan Wallen", year: 2024, genre: "Country Pop" },
  { id: "e8152", title: "360", artist: "Charli XCX", year: 2024, genre: "Electropop" },
  { id: "e8153", title: "Apple", artist: "Charli XCX", year: 2024, genre: "Electropop" },
  { id: "e8154", title: "Houdini", artist: "Eminem", year: 2024, genre: "Hip-Hop" },
  { id: "e8155", title: "Beautiful Day", artist: "U2", year: 2000, genre: "Rock" },
  { id: "e8156", title: "Kryptonite", artist: "3 Doors Down", year: 2000, genre: "Rock" },
  { id: "e8157", title: "Hanging by a Moment", artist: "Lifehouse", year: 2000, genre: "Rock" },
  { id: "e8158", title: "Survivor", artist: "Destiny's Child", year: 2001, genre: "R&B" },
  { id: "e8159", title: "Smooth Criminal", artist: "Alien Ant Farm", year: 2001, genre: "Rock" },
  { id: "e8160", title: "Island in the Sun", artist: "Weezer", year: 2001, genre: "Alternative" },
  { id: "e8161", title: "Hash Pipe", artist: "Weezer", year: 2001, genre: "Alternative" },
  { id: "e8162", title: "Because I Got High", artist: "Afroman", year: 2001, genre: "Hip-Hop" },
  { id: "e8163", title: "Family Affair", artist: "Mary J. Blige", year: 2001, genre: "R&B" },
  { id: "e8164", title: "A Woman's Worth", artist: "Alicia Keys", year: 2001, genre: "R&B" },
  { id: "e8165", title: "Fell in Love with a Girl", artist: "The White Stripes", year: 2001, genre: "Garage Rock" },
  { id: "e8166", title: "Just Like a Pill", artist: "Pink", year: 2001, genre: "Pop Rock" },
  { id: "e8167", title: "Here to Stay", artist: "Korn", year: 2002, genre: "Nu Metal" },
  { id: "e8168", title: "Can't Stop", artist: "Red Hot Chili Peppers", year: 2002, genre: "Alternative" },
  { id: "e8169", title: "Sweet Nothing", artist: "Calvin Harris feat. Florence Welch", year: 2012, genre: "Dance" },
  { id: "e8170", title: "Breezeblocks", artist: "alt-J", year: 2012, genre: "Indie" },
  { id: "e8171", title: "Tessellate", artist: "alt-J", year: 2012, genre: "Indie" },
  { id: "e8172", title: "Riptide", artist: "Vance Joy", year: 2013, genre: "Folk Pop" },
  { id: "e8173", title: "Home", artist: "Edward Sharpe & The Magnetic Zeros", year: 2010, genre: "Indie Folk" },
  { id: "e8174", title: "Midnight City", artist: "M83", year: 2011, genre: "Synthpop" },
  { id: "e8175", title: "Pursuit of Happiness", artist: "Kid Cudi", year: 2010, genre: "Hip-Hop" },
  { id: "e8176", title: "No Hands", artist: "Waka Flocka Flame", year: 2010, genre: "Hip-Hop" },
  { id: "e8177", title: "Bottoms Up", artist: "Trey Songz feat. Nicki Minaj", year: 2010, genre: "R&B" },
  { id: "e8178", title: "Super Bass", artist: "Nicki Minaj", year: 2011, genre: "Pop Rap" },
  { id: "e8179", title: "Starships", artist: "Nicki Minaj", year: 2012, genre: "Pop Rap" },
  { id: "e8180", title: "Turn Me On", artist: "David Guetta feat. Nicki Minaj", year: 2011, genre: "Dance" },
  { id: "e8181", title: "Domino", artist: "Jessie J", year: 2011, genre: "Pop" },
  { id: "e8182", title: "Price Tag", artist: "Jessie J feat. B.o.B", year: 2011, genre: "Pop" },
  { id: "e8183", title: "Glad You Came", artist: "The Wanted", year: 2011, genre: "Pop" },
  { id: "e8184", title: "What Makes You Beautiful", artist: "One Direction", year: 2011, genre: "Pop" },
  { id: "e8185", title: "Live While We're Young", artist: "One Direction", year: 2012, genre: "Pop" },
  { id: "e8186", title: "Little Things", artist: "One Direction", year: 2012, genre: "Pop" },
  { id: "e8187", title: "Hallucinate", artist: "Dua Lipa", year: 2020, genre: "Dance Pop" },
  { id: "e8188", title: "Break My Heart", artist: "Dua Lipa", year: 2020, genre: "Dance Pop" },
  { id: "e8189", title: "Fever", artist: "Dua Lipa & Angèle", year: 2020, genre: "Dance Pop" },
];






function createInitialJokerDuelState() {
  return {
    active: false,
    playerIds: [],
    choices: {},
    round: 0,
    lastResult: null,
  };
}

const RPS_OPTIONS = [
  { id: "rock", label: "Stein", icon: "🪨" },
  { id: "scissors", label: "Schere", icon: "✂️" },
  { id: "paper", label: "Papier", icon: "📄" },
];

function getRpsOption(choice) {
  return RPS_OPTIONS.find((option) => option.id === choice) || null;
}

function getRpsChoiceLabel(choice) {
  const option = getRpsOption(choice);
  return option ? `${option.icon} ${option.label}` : "-";
}

function getRpsWinningChoice(choiceA, choiceB) {
  const pair = new Set([choiceA, choiceB]);

  if (pair.has("rock") && pair.has("scissors")) return "rock";
  if (pair.has("scissors") && pair.has("paper")) return "scissors";
  if (pair.has("paper") && pair.has("rock")) return "paper";

  return null;
}

function evaluateJokerDuelRound(players, playerIds, choices) {
  const contenders = playerIds.filter((playerId) => getPlayerById(players, playerId));
  const revealedChoices = contenders.map((playerId) => {
    const player = getPlayerById(players, playerId);

    return {
      playerId,
      playerName: player?.name || "-",
      choice: choices[playerId],
      label: getRpsChoiceLabel(choices[playerId]),
    };
  });

  const uniqueChoices = Array.from(new Set(revealedChoices.map((item) => item.choice).filter(Boolean)));

  if (contenders.length <= 1) {
    return {
      status: "winner",
      winnerId: contenders[0] || null,
      nextPlayerIds: contenders,
      eliminatedIds: [],
      revealedChoices,
      reason: "Nur noch ein Challenger steht.",
    };
  }

  if (uniqueChoices.length <= 1) {
    return {
      status: "continue",
      winnerId: null,
      nextPlayerIds: contenders,
      eliminatedIds: [],
      revealedChoices,
      reason: "Alle haben dasselbe gewählt. Die Runde wird wiederholt.",
    };
  }

  if (uniqueChoices.length >= 3) {
    return {
      status: "continue",
      winnerId: null,
      nextPlayerIds: contenders,
      eliminatedIds: [],
      revealedChoices,
      reason: "Alle drei Zeichen sind im Spiel. Niemand scheidet aus.",
    };
  }

  const winningChoice = getRpsWinningChoice(uniqueChoices[0], uniqueChoices[1]);
  const nextPlayerIds = contenders.filter((playerId) => choices[playerId] === winningChoice);
  const eliminatedIds = contenders.filter((playerId) => choices[playerId] !== winningChoice);

  if (nextPlayerIds.length === 1) {
    return {
      status: "winner",
      winnerId: nextPlayerIds[0],
      nextPlayerIds,
      eliminatedIds,
      revealedChoices,
      reason: `${getRpsChoiceLabel(winningChoice)} gewinnt diese Runde.`,
    };
  }

  return {
    status: "continue",
    winnerId: null,
    nextPlayerIds,
    eliminatedIds,
    revealedChoices,
    reason: `${getRpsChoiceLabel(winningChoice)} gewinnt. Die verbleibenden Challenger spielen weiter.`,
  };
}


const initialGameState = {
  phase: "lobby",
  room: null,
  players: [],
  deck: [],
  activePlayerIndex: 0,
  currentTrack: null,
  selectedInsertIndex: null,
  currentTrackJokerAwarded: false,
  currentTrackJokerGuessReviewed: false,
  jokerClaims: [],
  selectedJokerPlayerId: null,
  jokerDuel: createInitialJokerDuelState(),
  lastResult: null,
  targetScore: 10,
  maxTurns: 0,
  playLimitSeconds: DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS,
  difficulty: "normal",
  gameMode: "solo",
  turnNumber: 1,
  showDebugSong: false,
  discardedTracks: [],
  playedTrackHistory: [],
  songReports: [],
  blockedTrackKeys: [],
  usedTrackIds: [],
  usedTrackKeys: [],
  overtime: false,
  overtimePlayerIds: [],
  overtimePendingPlayerIds: [],
  gameLog: [],
  eventHistory: [],
  playbackRequests: [],
};

function Button({ children, variant = "primary", disabled = false, style = {}, ...props }) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";

  return (
    <button
      disabled={disabled}
      style={{
        border: `1px solid ${isPrimary ? colors.primary : isDanger ? "#ef4444" : colors.border}`,
        borderRadius: 16,
        padding: "10px 14px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        background: isPrimary ? colors.primary : isDanger ? colors.bad : colors.chip,
        color: isPrimary ? colors.primaryText : colors.text,
        fontWeight: 800,
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}

function Card({ children, style = {} }) {
  return (
    <section
      style={{
        background: "rgba(15, 23, 42, 0.92)",
        border: `1px solid ${colors.border}`,
        borderRadius: 22,
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        ...style,
      }}
    >
      {children}
    </section>
  );
}

function CardContent({ children, style = {} }) {
  return <div style={{ padding: 14, ...style }}>{children}</div>;
}

function Input(props) {
  return (
    <input
      style={{
        width: "100%",
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        padding: "11px 12px",
        background: colors.bg,
        color: colors.text,
        outline: "none",
        boxSizing: "border-box",
      }}
      {...props}
    />
  );
}

function Select(props) {
  return (
    <select
      style={{
        width: "100%",
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        padding: "11px 12px",
        background: colors.bg,
        color: colors.text,
        outline: "none",
        boxSizing: "border-box",
      }}
      {...props}
    />
  );
}

function Badge({ children, variant = "default" }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "4px 10px",
        background: variant === "secondary" ? colors.chip : colors.primary,
        color: variant === "secondary" ? colors.text : colors.primaryText,
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function createId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function getRandomFloat() {
  try {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const values = new Uint32Array(1);
      crypto.getRandomValues(values);
      return values[0] / 4294967296;
    }
  } catch {
    // fallback
  }

  return Math.random();
}

function shuffle(array) {
  const result = [...array];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(getRandomFloat() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function getEraBucket(track) {
  const year = Number(track?.year || 0);

  if (year < 1960) return "1950er";
  if (year < 1970) return "1960er";
  if (year < 1980) return "1970er";
  if (year < 1990) return "1980er";
  if (year < 2000) return "1990er";
  if (year < 2010) return "2000er";
  if (year < 2020) return "2010er";

  return "2020er";
}

function buildBalancedDeck(tracks) {
  const buckets = new Map();

  for (const track of shuffle(tracks)) {
    const bucket = getEraBucket(track);
    const group = buckets.get(bucket) || [];
    group.push(track);
    buckets.set(bucket, group);
  }

  const bucketOrder = shuffle(Array.from(buckets.keys()));
  const result = [];

  while (buckets.size > 0) {
    for (const bucket of [...bucketOrder]) {
      const group = buckets.get(bucket);

      if (!group || group.length === 0) {
        buckets.delete(bucket);
        continue;
      }

      result.push(group.shift());

      if (group.length === 0) buckets.delete(bucket);
    }
  }

  return result;
}

function sortTimeline(timeline) {
  return [...timeline].sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
}

function normalizeTeamConfig(names, teamConfig = {}) {
  const safeNames = Array.isArray(names) && names.length ? names : ["Host"];
  const teamCount = Math.max(2, Math.min(4, Number(teamConfig.teamCount || 2), safeNames.length));
  const teamNames = Array.from({ length: teamCount }, (_, index) => {
    const configuredName = String(teamConfig.teamNames?.[index] || "").trim();
    return configuredName || `Team ${index + 1}`;
  });
  const assignments = teamConfig.assignments && typeof teamConfig.assignments === "object" ? teamConfig.assignments : {};

  return {
    safeNames,
    teamCount,
    teamNames,
    assignments,
  };
}

function splitIntoTeams(names, teamConfig = {}) {
  const { safeNames, teamCount, teamNames, assignments } = normalizeTeamConfig(names, teamConfig);
  const teams = Array.from({ length: teamCount }, (_, index) => ({
    name: teamNames[index],
    members: [],
  }));

  safeNames.forEach((name, index) => {
    const configuredIndex = Number(assignments[name]);
    const teamIndex = Number.isInteger(configuredIndex) && configuredIndex >= 0 && configuredIndex < teamCount ? configuredIndex : index % teamCount;
    teams[teamIndex].members.push(name);
  });

  const nonEmptyTeams = teams.filter((team) => team.members.length > 0);

  return nonEmptyTeams.length ? nonEmptyTeams : [{ name: teamNames[0] || "Team 1", members: safeNames }];
}

function createSoloPlayers(names) {
  const starters = shuffle(STARTING_TRACKS);

  return names.map((name, index) => ({
    id: createId("player"),
    name,
    role: index === 0 ? "host" : "player",
    teamMembers: [],
    activeMemberIndex: 0,
    timeline: [starters[index % starters.length]],
    score: 1,
    correct: 0,
    wrong: 0,
    jokers: 2,
  }));
}

function createTeamPlayers(names, teamConfig = {}) {
  const starters = shuffle(STARTING_TRACKS);
  const teams = splitIntoTeams(names, teamConfig);

  return teams.map((team, index) => ({
    id: createId("team"),
    name: team.name || `Team ${index + 1}`,
    role: index === 0 ? "host" : "player",
    teamMembers: team.members,
    activeMemberIndex: 0,
    timeline: [starters[index % starters.length]],
    score: 1,
    correct: 0,
    wrong: 0,
    jokers: 2,
  }));
}

function createInitialPlayers(names, gameMode = "solo", teamConfig = {}) {
  const safeNames = Array.isArray(names) && names.length ? names : ["Host"];

  return gameMode === "teams" && safeNames.length >= 2 ? createTeamPlayers(safeNames, teamConfig) : createSoloPlayers(safeNames);
}

function resetPlayersForNewRound(players) {
  const starters = shuffle(STARTING_TRACKS);

  return players.map((player, index) => ({
    ...player,
    role: index === 0 ? "host" : "player",
    activeMemberIndex: 0,
    timeline: [starters[index % starters.length]],
    score: 1,
    correct: 0,
    wrong: 0,
    jokers: 2,
  }));
}

function isTeamPlayer(player) {
  return Array.isArray(player?.teamMembers) && player.teamMembers.length > 0;
}

function getActiveTeamMemberName(player) {
  if (!isTeamPlayer(player)) return "";

  return player.teamMembers[player.activeMemberIndex % player.teamMembers.length] || player.teamMembers[0] || "";
}

function getPlayerTurnLabel(player) {
  const memberName = getActiveTeamMemberName(player);

  return memberName ? `${player.name} · ${memberName}` : player?.name || "-";
}

function getPlayerSubLabel(player) {
  if (!isTeamPlayer(player)) return "";

  return player.teamMembers.join(", ");
}


function getPlayerById(players, playerId) {
  return (players || []).find((player) => player.id === playerId) || null;
}

function getPlayerJokers(player) {
  return Math.max(0, Number(player?.jokers ?? 0));
}

function getJokerClaimNames(players, jokerClaims = []) {
  return jokerClaims
    .map((claim) => getPlayerById(players, claim.playerId))
    .filter(Boolean)
    .map((player) => player.name);
}

function getSelectedJokerPlayer(players, selectedJokerPlayerId) {
  return getPlayerById(players, selectedJokerPlayerId);
}

function canPlayerThrowJoker(state, playerId) {
  const activePlayer = state.players[state.activePlayerIndex];
  const player = getPlayerById(state.players, playerId);

  if (!player || !activePlayer) return false;
  if (player.id === activePlayer.id) return false;
  if (getPlayerJokers(player) <= 0) return false;
  if ((state.jokerClaims || []).some((claim) => claim.playerId === player.id)) return false;

  return true;
}

function advanceTeamMember(player) {
  if (!isTeamPlayer(player)) return player;

  return {
    ...player,
    activeMemberIndex: (Number(player.activeMemberIndex || 0) + 1) % player.teamMembers.length,
  };
}

function advanceCurrentPlayerMember(players, activePlayerIndex) {
  return players.map((player, index) => (index === activePlayerIndex ? advanceTeamMember(player) : player));
}

function getStartPlayerIndex(players, startPlayerName) {
  const wantedName = String(startPlayerName || "").trim();

  if (!wantedName) return 0;

  const directIndex = players.findIndex((player) => player.name === wantedName);

  if (directIndex >= 0) return directIndex;

  const teamIndex = players.findIndex((player) => Array.isArray(player.teamMembers) && player.teamMembers.includes(wantedName));

  return teamIndex >= 0 ? teamIndex : 0;
}

function isInsertSlotAllowed(timeline, insertIndex) {
  const orderedTimeline = sortTimeline(timeline);
  const left = orderedTimeline[insertIndex - 1];
  const right = orderedTimeline[insertIndex];

  return !(left && right && left.year === right.year);
}

function isCorrectPlacement(timeline, track, insertIndex) {
  if (!isInsertSlotAllowed(timeline, insertIndex)) return false;

  const orderedTimeline = sortTimeline(timeline);
  const left = orderedTimeline[insertIndex - 1];
  const right = orderedTimeline[insertIndex];

  return (!left || left.year <= track.year) && (!right || track.year <= right.year);
}

function sortedWithInsert(timeline, track) {
  return sortTimeline([...timeline, track]);
}

function getPlacementLabel(timeline, insertIndex) {
  const orderedTimeline = sortTimeline(timeline);

  if (insertIndex === 0) return `vor ${orderedTimeline[0]?.title || "Start"}`;
  if (insertIndex === orderedTimeline.length) return `nach ${orderedTimeline[orderedTimeline.length - 1]?.title || "Ende"}`;

  return `zwischen ${orderedTimeline[insertIndex - 1]?.title} und ${orderedTimeline[insertIndex]?.title}`;
}

function getCorrectPlacementLabel(timeline, track) {
  const orderedTimeline = sortTimeline(timeline || []);

  if (!track || orderedTimeline.length === 0) return "als erste Karte";

  const insertIndex = orderedTimeline.findIndex((item) => track.year < item.year || (track.year === item.year && track.title.localeCompare(item.title) <= 0));
  const safeIndex = insertIndex === -1 ? orderedTimeline.length : insertIndex;

  return getPlacementLabel(orderedTimeline, safeIndex);
}

function getWinner(players, targetScore) {
  return players.find((player) => player.score >= targetScore) || null;
}

function getFinalWinner(players, targetScore) {
  const eligiblePlayers = players.filter((player) => player.score >= targetScore);

  if (!eligiblePlayers.length) return null;

  const topScore = Math.max(...eligiblePlayers.map((player) => player.score));
  const leaders = eligiblePlayers.filter((player) => player.score === topScore);

  return leaders.length === 1 ? leaders[0] : null;
}

function hasTargetTie(players, targetScore) {
  const eligiblePlayers = players.filter((player) => player.score >= targetScore);

  if (eligiblePlayers.length < 2) return false;

  const topScore = Math.max(...eligiblePlayers.map((player) => player.score));

  return eligiblePlayers.filter((player) => player.score === topScore).length > 1;
}

function getOvertimeContenderPlayerIds(players, targetScore, allowedPlayerIds = null) {
  const allowedSet = Array.isArray(allowedPlayerIds) && allowedPlayerIds.length ? new Set(allowedPlayerIds) : null;
  const eligible = players.filter((player) => player.score >= targetScore && (!allowedSet || allowedSet.has(player.id)));

  if (eligible.length < 2) return [];

  const topScore = Math.max(...eligible.map((player) => player.score));

  return eligible.filter((player) => player.score === topScore).map((player) => player.id);
}

function getPlayerIndexById(players, playerId) {
  return Math.max(0, players.findIndex((player) => player.id === playerId));
}

function getNextIndexFromAllowedPlayerIds(currentIndex, allowedPlayerIds, players) {
  if (!allowedPlayerIds.length) return (currentIndex + 1) % players.length;

  const allowedIndexes = allowedPlayerIds
    .map((playerId) => players.findIndex((player) => player.id === playerId))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);

  if (!allowedIndexes.length) return (currentIndex + 1) % players.length;

  const nextHigher = allowedIndexes.find((index) => index > currentIndex);

  return nextHigher ?? allowedIndexes[0];
}

function getBlockedTrackKeySet(state) {
  return new Set(Array.isArray(state.blockedTrackKeys) ? state.blockedTrackKeys : []);
}

function filterBlockedTracks(deck, state) {
  const blockedTrackKeys = getBlockedTrackKeySet(state);

  return (Array.isArray(deck) ? deck : []).filter((track) => !blockedTrackKeys.has(getTrackDedupeKey(track)));
}

function createPlayedTrackEntry(state, activePlayer, result = {}) {
  const track = state.currentTrack;

  return {
    id: createId("played"),
    trackId: track?.id || "",
    trackKey: getTrackDedupeKey(track),
    title: track?.title || "",
    artist: track?.artist || "",
    year: track?.year || "",
    genre: track?.genre || "",
    playerName: getPlayerTurnLabel(activePlayer),
    teamName: activePlayer?.name || "",
    activeMemberName: getActiveTeamMemberName(activePlayer),
    correct: Boolean(result.correct),
    skipped: Boolean(result.skipped),
    createdAt: new Date().toLocaleTimeString(),
  };
}

function createSongReportEntry(track, reason, actorName = "Host") {
  return {
    id: createId("report"),
    trackId: track?.id || "",
    trackKey: getTrackDedupeKey(track),
    title: track?.title || "",
    artist: track?.artist || "",
    year: track?.year || "",
    reason,
    actorName,
    createdAt: new Date().toLocaleTimeString(),
  };
}

function getUsedTrackIdSet(state) {
  return new Set(Array.isArray(state.usedTrackIds) ? state.usedTrackIds : []);
}

function getUsedTrackKeySet(state) {
  return new Set(Array.isArray(state.usedTrackKeys) ? state.usedTrackKeys : []);
}

function filterUnusedDeck(deck, state) {
  const usedTrackIds = getUsedTrackIdSet(state);
  const usedTrackKeys = getUsedTrackKeySet(state);

  const blockedTrackKeys = getBlockedTrackKeySet(state);

  return (Array.isArray(deck) ? deck : []).filter(
    (track) => !usedTrackIds.has(track.id) && !usedTrackKeys.has(getTrackDedupeKey(track)) && !blockedTrackKeys.has(getTrackDedupeKey(track))
  );
}

function addEvent(state, type, details = "") {
  const entry = {
    id: createId("event"),
    type,
    details,
    turnNumber: state.turnNumber,
  };

  return {
    ...state,
    eventHistory: [entry, ...state.eventHistory].slice(0, 20),
  };
}

function gameReducer(state, action) {
  switch (action.type) {
    case "RESET_GAME":
      return initialGameState;

    case "SERVER_STATE_RECEIVED":
      return action.gameState || state;

    case "NEW_ROUND": {
      if (!state.players.length || !state.room) return state;

      const deck = dedupeTrackDeck(filterUnusedDeck(action.deck, state));
      const players = resetPlayersForNewRound(state.players);

      const nextState = {
        ...initialGameState,
        phase: "ready",
        room: {
          ...state.room,
          hostPlayerId: players[0]?.id || state.room.hostPlayerId,
          hostName: players[0]?.name || state.room.hostName || "Host",
        },
        players,
        playedTrackHistory: state.playedTrackHistory || [],
        songReports: state.songReports || [],
        blockedTrackKeys: state.blockedTrackKeys || [],
        usedTrackIds: state.usedTrackIds || [],
        usedTrackKeys: state.usedTrackKeys || [],
        overtime: false,
        deck: preparePlayableDeck(deck),
        targetScore: Number(action.targetScore || state.targetScore || 10),
        maxTurns: Number(action.maxTurns ?? state.maxTurns ?? 0),
        playLimitSeconds: Math.max(1, Math.min(120, Number(action.playLimitSeconds || state.playLimitSeconds || DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS))),
        difficulty: action.difficulty || state.difficulty || "normal",
        gameMode: state.gameMode || action.gameMode || "solo",
        gameLog: [
          {
            id: createId("log"),
            text: `Neue Runde gestartet mit ${players.length} Spielern und ${deck.length} Songs im Deck.`,
          },
        ],
      };

      return addEvent(nextState, "NEW_ROUND", `${players.length} Spieler, ${deck.length} Songs`);
    }

    case "START_GAME": {
      const players = createInitialPlayers(action.playerNames, action.gameMode || "solo", action.teamConfig || {});

      const nextState = {
        ...initialGameState,
        phase: "ready",
        room: {
          code: action.roomCode || createRoomCode(),
          hostPlayerId: players[0]?.id || null,
          hostName: players[0]?.name || "Host",
          visibility: "private",
        },
        players,
        activePlayerIndex: getStartPlayerIndex(players, action.startPlayerName),
        deck: preparePlayableDeck(action.deck),
        targetScore: Number(action.targetScore || 10),
        maxTurns: Number(action.maxTurns || 0),
        playLimitSeconds: Math.max(1, Math.min(120, Number(action.playLimitSeconds || DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS))),
        difficulty: action.difficulty || "normal",
        gameMode: action.gameMode || "solo",
        gameLog: [
          {
            id: createId("log"),
            text: action.gameMode === "teams"
              ? `Teamspiel gestartet mit ${players.length} Teams und ${action.deck.length} Songs im Deck.`
              : `Spiel gestartet mit ${action.playerNames.length} Spielern und ${action.deck.length} Songs im Deck.`,
          },
        ],
      };

      return addEvent(nextState, "GAME_STARTED", `${action.playerNames.length} Spieler, ${action.deck.length} Songs`);
    }

    case "TRACK_DRAWN": {
      if (state.phase !== "ready" || state.deck.length === 0) return state;

      const blockedTrackKeys = getBlockedTrackKeySet(state);
      const nextTrackIndex = state.deck.findIndex((track) => !blockedTrackKeys.has(getTrackDedupeKey(track)));

      if (nextTrackIndex < 0) return state;

      const nextTrack = state.deck[nextTrackIndex];
      const remainingDeck = state.deck.filter((_, index) => index !== nextTrackIndex);

      return addEvent(
        {
          ...state,
          phase: "placing",
          currentTrack: nextTrack,
          deck: remainingDeck,
          usedTrackIds: Array.from(new Set([...(state.usedTrackIds || []), nextTrack.id])),
          usedTrackKeys: Array.from(new Set([...(state.usedTrackKeys || []), getTrackDedupeKey(nextTrack)])),
          selectedInsertIndex: null,
          currentTrackJokerAwarded: false,
          currentTrackJokerGuessReviewed: false,
          jokerClaims: [],
          selectedJokerPlayerId: null,
          jokerDuel: createInitialJokerDuelState(),
          lastResult: null,
          showDebugSong: false,
        },
        "TRACK_DRAWN",
        "Verdeckter Song gezogen"
      );
    }

    case "TRACK_SWAP_JOKER": {
      if (state.phase !== "placing" || !state.currentTrack || state.deck.length === 0) return state;

      const activePlayer = state.players[state.activePlayerIndex];
      if (!activePlayer || getPlayerJokers(activePlayer) < 1) return state;

      const blockedTrackKeys = getBlockedTrackKeySet(state);
      const nextTrackIndex = state.deck.findIndex((track) => !blockedTrackKeys.has(getTrackDedupeKey(track)));

      if (nextTrackIndex < 0) return state;

      const nextTrack = state.deck[nextTrackIndex];
      const remainingDeck = state.deck.filter((_, index) => index !== nextTrackIndex);

      const players = state.players.map((player, index) =>
        index === state.activePlayerIndex
          ? {
              ...player,
              jokers: Math.max(0, getPlayerJokers(player) - 1),
            }
          : player
      );

      return addEvent(
        {
          ...state,
          players,
          currentTrack: nextTrack,
          deck: remainingDeck,
          usedTrackIds: Array.from(new Set([...(state.usedTrackIds || []), nextTrack.id])),
          usedTrackKeys: Array.from(new Set([...(state.usedTrackKeys || []), getTrackDedupeKey(nextTrack)])),
          selectedInsertIndex: null,
          currentTrackJokerAwarded: false,
          currentTrackJokerGuessReviewed: false,
          jokerClaims: [],
          selectedJokerPlayerId: null,
          jokerDuel: createInitialJokerDuelState(),
          lastResult: null,
          showDebugSong: false,
          discardedTracks: [state.currentTrack, ...state.discardedTracks],
          gameLog: [
            {
              id: createId("log"),
              text: `${getPlayerTurnLabel(activePlayer)} nutzt den Tauschen-Joker und zieht einen neuen Song.`,
            },
            ...state.gameLog,
          ].slice(0, 12),
        },
        "TRACK_SWAPPED",
        `${getPlayerTurnLabel(activePlayer)} tauscht den Song`
      );
    }

    case "TRACK_AUTO_CARD_JOKER": {
      if (state.phase !== "placing" || !state.currentTrack) return state;

      const activePlayer = state.players[state.activePlayerIndex];
      if (!activePlayer || getPlayerJokers(activePlayer) < 3) return state;

      const players = state.players.map((player, index) => {
        if (index !== state.activePlayerIndex) return player;

        return {
          ...player,
          jokers: Math.max(0, getPlayerJokers(player) - 3),
          timeline: sortedWithInsert(player.timeline, state.currentTrack),
          score: player.score + 1,
          correct: player.correct + 1,
        };
      });

      const playedEntry = createPlayedTrackEntry(state, activePlayer, { correct: true, autoJoker: true });

      return addEvent(
        {
          ...state,
          players,
          phase: "reveal",
          selectedInsertIndex: null,
          currentTrackJokerAwarded: false,
          currentTrackJokerGuessReviewed: true,
          jokerClaims: [],
          selectedJokerPlayerId: null,
          jokerDuel: createInitialJokerDuelState(),
          playedTrackHistory: [playedEntry, ...(state.playedTrackHistory || [])].slice(0, 80),
          lastResult: {
            correct: true,
            autoJoker: true,
            placementLabel: "Sicherer Karten-Joker",
            playerName: getPlayerTurnLabel(activePlayer),
            teamName: activePlayer.name,
            activeMemberName: getActiveTeamMemberName(activePlayer),
            track: state.currentTrack,
          },
          gameLog: [
            {
              id: createId("log"),
              text: `${getPlayerTurnLabel(activePlayer)} nutzt den Sicheren-Karten-Joker und erhaelt ${state.currentTrack.title} automatisch.`,
            },
            ...state.gameLog,
          ].slice(0, 12),
        },
        "TRACK_AUTO_CARD_JOKER",
        `${getPlayerTurnLabel(activePlayer)} kauft die Karte`
      );
    }

    case "PLACEMENT_SELECTED": {
      if (state.phase !== "placing") return state;

      const activePlayer = state.players[state.activePlayerIndex];
      if (!activePlayer || !isInsertSlotAllowed(activePlayer.timeline, action.insertIndex)) return state;

      return addEvent(
        {
          ...state,
          selectedInsertIndex: action.insertIndex,
        },
        "PLACEMENT_SELECTED",
        `Index ${action.insertIndex}`
      );
    }

    case "PLACEMENT_CONFIRMED": {
      if (state.phase !== "placing" || !state.currentTrack || state.selectedInsertIndex === null) return state;

      const activePlayer = state.players[state.activePlayerIndex];

      return addEvent(
        {
          ...state,
          phase: "challenge",
          jokerClaims: [],
          selectedJokerPlayerId: null,
          jokerDuel: createInitialJokerDuelState(),
        },
        "PLACEMENT_CONFIRMED",
        `${getPlayerTurnLabel(activePlayer)} hat die Position bestaetigt`
      );
    }

    case "AWARD_SONG_GUESS_JOKER": {
      if (state.phase !== "reveal" || !state.lastResult?.track || state.currentTrackJokerGuessReviewed || state.currentTrackJokerAwarded) return state;

      const activePlayer = state.players[state.activePlayerIndex];
      if (!activePlayer) return state;

      const players = state.players.map((player, index) =>
        index === state.activePlayerIndex
          ? {
              ...player,
              jokers: getPlayerJokers(player) + 1,
            }
          : player
      );

      return addEvent(
        {
          ...state,
          players,
          currentTrackJokerAwarded: true,
          currentTrackJokerGuessReviewed: true,
          gameLog: [
            {
              id: createId("log"),
              text: `${getPlayerTurnLabel(activePlayer)} erhaelt +1 Joker fuer Song und Interpret.`,
            },
            ...state.gameLog,
          ].slice(0, 12),
        },
        "JOKER_EARNED",
        getPlayerTurnLabel(activePlayer)
      );
    }

    case "CLEAR_SONG_GUESS_CLAIM": {
      if (state.phase !== "reveal" || state.currentTrackJokerGuessReviewed || state.currentTrackJokerAwarded) return state;

      const activePlayer = state.players[state.activePlayerIndex];

      return addEvent(
        {
          ...state,
          currentTrackJokerGuessReviewed: true,
          gameLog: [
            {
              id: createId("log"),
              text: `Kein Zusatz-Joker fuer ${getPlayerTurnLabel(activePlayer)} vergeben.`,
            },
            ...state.gameLog,
          ].slice(0, 12),
        },
        "JOKER_GUESS_DENIED",
        getPlayerTurnLabel(activePlayer)
      );
    }

    case "JOKER_CLAIM": {
      if (state.phase !== "challenge" || !state.currentTrack) return state;

      const claimant = getPlayerById(state.players, action.playerId || action.actorPlayerId);
      if (!claimant || !canPlayerThrowJoker(state, claimant.id)) return state;

      const claim = {
        id: createId("joker"),
        playerId: claimant.id,
        playerName: claimant.name,
        createdAt: new Date().toLocaleTimeString(),
      };
      const nextClaims = [...(state.jokerClaims || []), claim];

      return addEvent(
        {
          ...state,
          jokerClaims: nextClaims,
          selectedJokerPlayerId: nextClaims.length === 1 ? claimant.id : null,
          jokerDuel: createInitialJokerDuelState(),
          gameLog: [
            {
              id: createId("log"),
              text: `${claimant.name} wirft einen Joker und zweifelt die Platzierung an.`,
            },
            ...state.gameLog,
          ].slice(0, 12),
        },
        "JOKER_THROWN",
        claimant.name
      );
    }

    case "START_JOKER_DUEL": {
      if (state.phase !== "challenge" || (state.jokerClaims || []).length <= 1 || state.selectedJokerPlayerId) return state;

      const playerIds = Array.from(new Set((state.jokerClaims || []).map((claim) => claim.playerId))).filter((playerId) =>
        getPlayerById(state.players, playerId)
      );

      if (playerIds.length <= 1) return state;

      return addEvent(
        {
          ...state,
          jokerDuel: {
            active: true,
            playerIds,
            choices: {},
            round: Number(state.jokerDuel?.round || 0) + 1,
            lastResult: null,
          },
          gameLog: [
            {
              id: createId("log"),
              text: `Joker-Duell gestartet: ${playerIds.map((playerId) => getPlayerById(state.players, playerId)?.name).filter(Boolean).join(", ")}.`,
            },
            ...state.gameLog,
          ].slice(0, 12),
        },
        "JOKER_DUEL_STARTED",
        `${playerIds.length} Challenger`
      );
    }

    case "JOKER_DUEL_CHOICE": {
      if (state.phase !== "challenge" || !state.jokerDuel?.active || state.selectedJokerPlayerId) return state;

      const playerId = action.playerId || action.actorPlayerId;
      const choice = action.choice;
      const playerIds = state.jokerDuel.playerIds || [];

      if (!playerIds.includes(playerId)) return state;
      if (!RPS_OPTIONS.some((option) => option.id === choice)) return state;

      const nextChoices = {
        ...(state.jokerDuel.choices || {}),
        [playerId]: choice,
      };
      const allChosen = playerIds.every((id) => nextChoices[id]);

      if (!allChosen) {
        return addEvent(
          {
            ...state,
            jokerDuel: {
              ...state.jokerDuel,
              choices: nextChoices,
            },
          },
          "JOKER_DUEL_CHOICE",
          `${getPlayerById(state.players, playerId)?.name || "Spieler"} hat gewählt`
        );
      }

      const result = evaluateJokerDuelRound(state.players, playerIds, nextChoices);

      if (result.status === "winner" && result.winnerId) {
        const winner = getPlayerById(state.players, result.winnerId);

        return addEvent(
          {
            ...state,
            selectedJokerPlayerId: result.winnerId,
            jokerDuel: {
              active: false,
              playerIds: result.nextPlayerIds,
              choices: {},
              round: state.jokerDuel.round,
              lastResult: result,
            },
            gameLog: [
              {
                id: createId("log"),
                text: `Joker-Duell: ${winner?.name || "Ein Spieler"} gewinnt und darf den Joker setzen.`,
              },
              ...state.gameLog,
            ].slice(0, 12),
          },
          "JOKER_DUEL_WINNER",
          winner?.name || "Gewinner"
        );
      }

      return addEvent(
        {
          ...state,
          jokerDuel: {
            active: true,
            playerIds: result.nextPlayerIds,
            choices: {},
            round: Number(state.jokerDuel.round || 0) + 1,
            lastResult: result,
          },
          gameLog: [
            {
              id: createId("log"),
              text: `Joker-Duell: ${result.reason}`,
            },
            ...state.gameLog,
          ].slice(0, 12),
        },
        "JOKER_DUEL_CONTINUES",
        result.reason
      );
    }

    case "TRACK_PLAY_REQUESTED": {
      if (!["placing", "challenge"].includes(state.phase) || !state.currentTrack) return state;

      const activePlayer = state.players[state.activePlayerIndex];
      const requester = action.requesterName || activePlayer?.name || "Spieler";

      const request = {
        id: createId("playback"),
        requester,
        trackId: state.currentTrack.id,
        hiddenLabel: "Verdeckter Song",
        playLimitSeconds: Number(action.playLimitSeconds || DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS),
        createdAt: new Date().toLocaleTimeString(),
      };

      return addEvent(
        {
          ...state,
          playbackRequests: [request, ...state.playbackRequests].slice(0, 8),
          gameLog: [
            {
              id: createId("log"),
              text: `${requester} hat den verdeckten Song gestartet oder erneut angefordert.`,
            },
            ...state.gameLog,
          ].slice(0, 12),
        },
        "TRACK_PLAY_REQUESTED",
        `${requester} fordert Playback an`
      );
    }

    case "TRACK_REVEALED": {
      if (!["placing", "challenge"].includes(state.phase) || !state.currentTrack || state.selectedInsertIndex === null) return state;

      const activePlayer = state.players[state.activePlayerIndex];
      if (!activePlayer) return state;

      if (state.phase === "challenge" && (state.jokerClaims || []).length > 1 && !state.selectedJokerPlayerId) return state;
      if (state.phase === "challenge" && state.jokerDuel?.active) return state;

      const correct = isCorrectPlacement(activePlayer.timeline, state.currentTrack, state.selectedInsertIndex);
      const placementLabel = getPlacementLabel(activePlayer.timeline, state.selectedInsertIndex);
      const challenger = getSelectedJokerPlayer(state.players, state.selectedJokerPlayerId);
      const jokerWasThrown = Boolean(challenger);
      const challengerWins = Boolean(jokerWasThrown && !correct);

      const players = state.players.map((player, index) => {
        if (index === state.activePlayerIndex) {
          return {
            ...player,
            timeline: correct ? sortedWithInsert(player.timeline, state.currentTrack) : player.timeline,
            score: correct ? player.score + 1 : player.score,
            correct: correct ? player.correct + 1 : player.correct,
            wrong: correct ? player.wrong : player.wrong + 1,
          };
        }

        if (challenger && player.id === challenger.id) {
          return {
            ...player,
            jokers: Math.max(0, getPlayerJokers(player) - 1),
            timeline: challengerWins ? sortedWithInsert(player.timeline, state.currentTrack) : player.timeline,
            score: challengerWins ? player.score + 1 : player.score,
            correct: challengerWins ? player.correct + 1 : player.correct,
            wrong: challengerWins ? player.wrong : player.wrong + 1,
          };
        }

        return player;
      });

      const logText = challenger
        ? challengerWins
          ? `${challenger.name} hatte mit dem Joker Recht: ${state.currentTrack.title} (${state.currentTrack.year}) war falsch einsortiert und geht an ${challenger.name}.`
          : `${challenger.name} verliert einen Joker: ${getPlayerTurnLabel(activePlayer)} hatte ${state.currentTrack.title} (${state.currentTrack.year}) korrekt einsortiert.`
        : correct
          ? `${getPlayerTurnLabel(activePlayer)} hat ${state.currentTrack.title} (${state.currentTrack.year}) richtig ${placementLabel} einsortiert.`
          : `${getPlayerTurnLabel(activePlayer)} lag mit ${state.currentTrack.title} (${state.currentTrack.year}) falsch. Gewaehlt: ${placementLabel}.`;

      const playedEntry = createPlayedTrackEntry(state, activePlayer, { correct });

      return addEvent(
        {
          ...state,
          players,
          phase: "reveal",
          playedTrackHistory: [playedEntry, ...(state.playedTrackHistory || [])].slice(0, 80),
          lastResult: {
            correct,
            jokerWasThrown,
            challengerWon: challengerWins,
            challengerLost: Boolean(jokerWasThrown && correct),
            challengerName: challenger?.name || "",
            placementLabel,
            playerName: getPlayerTurnLabel(activePlayer),
            teamName: activePlayer.name,
            activeMemberName: getActiveTeamMemberName(activePlayer),
            track: state.currentTrack,
          },
          jokerClaims: [],
          selectedJokerPlayerId: null,
          jokerDuel: createInitialJokerDuelState(),
          discardedTracks: !correct && !challengerWins ? [state.currentTrack, ...state.discardedTracks] : state.discardedTracks,
          gameLog: [{ id: createId("log"), text: logText }, ...state.gameLog].slice(0, 12),
        },
        "TRACK_REVEALED",
        challenger ? (challengerWins ? "joker erfolgreich" : "joker verloren") : correct ? "richtig" : "falsch"
      );
    }

    case "TRACK_SKIPPED": {
      if (state.phase !== "placing" || !state.currentTrack) return state;

      const activePlayer = state.players[state.activePlayerIndex];
      if (!activePlayer) return state;

      const playedEntry = createPlayedTrackEntry(state, activePlayer, { correct: false, skipped: true });

      return addEvent(
        {
          ...state,
          phase: "reveal",
          showDebugSong: true,
          playedTrackHistory: [playedEntry, ...(state.playedTrackHistory || [])].slice(0, 80),
          discardedTracks: [state.currentTrack, ...state.discardedTracks],
          lastResult: {
            correct: false,
            skipped: true,
            placementLabel: "uebersprungen",
            playerName: getPlayerTurnLabel(activePlayer),
            teamName: activePlayer.name,
            activeMemberName: getActiveTeamMemberName(activePlayer),
            track: state.currentTrack,
          },
          gameLog: [
            {
              id: createId("log"),
              text: `${getPlayerTurnLabel(activePlayer)} hat ${state.currentTrack.title} uebersprungen.`,
            },
            ...state.gameLog,
          ].slice(0, 12),
        },
        "TRACK_SKIPPED",
        "Song uebersprungen"
      );
    }

    case "NEXT_PLAYER": {
      const turnsFinished = state.maxTurns > 0 && state.turnNumber >= state.maxTurns;
      const deckFinished = state.deck.length === 0;
      const finalWinner = getFinalWinner(state.players, state.targetScore);
      const targetTie = hasTargetTie(state.players, state.targetScore);
      const targetReached = state.players.some((player) => player.score >= state.targetScore);
      const playersAfterTurn = advanceCurrentPlayerMember(state.players, state.activePlayerIndex);

      if (deckFinished || turnsFinished) {
        return addEvent(
          {
            ...state,
            players: playersAfterTurn,
            phase: "finished",
            overtime: false,
            overtimePlayerIds: [],
            overtimePendingPlayerIds: [],
            currentTrackJokerAwarded: false,
            jokerClaims: [],
            selectedJokerPlayerId: null,
            jokerDuel: createInitialJokerDuelState(),
          },
          "GAME_FINISHED",
          finalWinner ? `Gewinner: ${finalWinner.name}` : "Limit erreicht"
        );
      }

      if (state.overtime) {
        const currentPlayerId = state.players[state.activePlayerIndex]?.id;
        const currentOvertimePlayerIds =
          Array.isArray(state.overtimePlayerIds) && state.overtimePlayerIds.length
            ? state.overtimePlayerIds
            : getOvertimeContenderPlayerIds(state.players, state.targetScore);

        const pendingAfterCurrent = (state.overtimePendingPlayerIds?.length ? state.overtimePendingPlayerIds : currentOvertimePlayerIds)
          .filter((playerId) => playerId !== currentPlayerId);

        if (pendingAfterCurrent.length > 0) {
          const nextOvertimeIndex = getNextIndexFromAllowedPlayerIds(state.activePlayerIndex, pendingAfterCurrent, playersAfterTurn);

          return addEvent(
            {
              ...state,
              players: playersAfterTurn,
              activePlayerIndex: nextOvertimeIndex,
              turnNumber: state.turnNumber + 1,
              currentTrack: null,
              selectedInsertIndex: null,
              lastResult: null,
              showDebugSong: false,
              currentTrackJokerAwarded: false,
              jokerClaims: [],
              selectedJokerPlayerId: null,
              jokerDuel: createInitialJokerDuelState(),
              overtime: true,
              overtimePlayerIds: currentOvertimePlayerIds,
              overtimePendingPlayerIds: pendingAfterCurrent,
              phase: "ready",
            },
            "OVERTIME_NEXT_PLAYER",
            getPlayerTurnLabel(playersAfterTurn[nextOvertimeIndex]) || "Verlaengerung"
          );
        }

        const nextContenderIds = getOvertimeContenderPlayerIds(state.players, state.targetScore, currentOvertimePlayerIds);

        if (nextContenderIds.length <= 1) {
          const winnerId = nextContenderIds[0] || finalWinner?.id;
          const winner = state.players.find((player) => player.id === winnerId) || finalWinner;

          return addEvent(
            {
              ...state,
              players: playersAfterTurn,
              phase: "finished",
              overtime: false,
              overtimePlayerIds: [],
              overtimePendingPlayerIds: [],
            },
            "GAME_FINISHED",
            winner ? `Gewinner nach Verlaengerung: ${winner.name}` : "Verlaengerung beendet"
          );
        }

        const nextOvertimeIndex = getNextIndexFromAllowedPlayerIds(state.activePlayerIndex, nextContenderIds, playersAfterTurn);

        return addEvent(
          {
            ...state,
            players: playersAfterTurn,
            activePlayerIndex: nextOvertimeIndex,
            turnNumber: state.turnNumber + 1,
            currentTrack: null,
            selectedInsertIndex: null,
            lastResult: null,
            showDebugSong: false,
            overtime: true,
            overtimePlayerIds: nextContenderIds,
            overtimePendingPlayerIds: nextContenderIds,
            phase: "ready",
          },
          "OVERTIME_ROUND_CONTINUES",
          getPlayerTurnLabel(playersAfterTurn[nextOvertimeIndex]) || "Verlaengerung"
        );
      }

      const normalNextIndex = (state.activePlayerIndex + 1) % state.players.length;
      const isEndOfRound = normalNextIndex === 0;

      if (isEndOfRound && finalWinner && !targetTie) {
        return addEvent(
          {
            ...state,
            players: playersAfterTurn,
            phase: "finished",
            overtime: false,
            overtimePlayerIds: [],
            overtimePendingPlayerIds: [],
            currentTrackJokerAwarded: false,
            jokerClaims: [],
            selectedJokerPlayerId: null,
            jokerDuel: createInitialJokerDuelState(),
          },
          "GAME_FINISHED",
          `Gewinner: ${finalWinner.name}`
        );
      }

      if (isEndOfRound && targetReached && targetTie) {
        const overtimePlayerIds = getOvertimeContenderPlayerIds(state.players, state.targetScore);
        const nextOvertimeIndex = getNextIndexFromAllowedPlayerIds(state.activePlayerIndex, overtimePlayerIds, playersAfterTurn);

        return addEvent(
          {
            ...state,
            players: playersAfterTurn,
            activePlayerIndex: nextOvertimeIndex,
            turnNumber: state.turnNumber + 1,
            currentTrack: null,
            selectedInsertIndex: null,
            lastResult: null,
            showDebugSong: false,
            overtime: true,
            overtimePlayerIds,
            overtimePendingPlayerIds: overtimePlayerIds,
            phase: "ready",
          },
          "OVERTIME_STARTED",
          getPlayerTurnLabel(playersAfterTurn[nextOvertimeIndex]) || "Verlaengerung"
        );
      }

      return addEvent(
        {
          ...state,
          players: playersAfterTurn,
          activePlayerIndex: normalNextIndex,
          turnNumber: state.turnNumber + 1,
          currentTrack: null,
          selectedInsertIndex: null,
          lastResult: null,
          showDebugSong: false,
          overtime: false,
          overtimePlayerIds: [],
          overtimePendingPlayerIds: [],
          phase: "ready",
        },
        "NEXT_PLAYER",
        getPlayerTurnLabel(playersAfterTurn[normalNextIndex]) || "naechster Spieler"
      );
    }

    case "BLOCK_TRACK": {
      const track = action.track || state.currentTrack || state.lastResult?.track;
      const trackKey = action.trackKey || getTrackDedupeKey(track);

      if (!trackKey) return state;

      const reportReason = action.reason || "blockiert";

      return addEvent(
        {
          ...state,
          blockedTrackKeys: Array.from(new Set([...(state.blockedTrackKeys || []), trackKey])),
          songReports: [createSongReportEntry(track, reportReason, action.actorName || "Host"), ...(state.songReports || [])].slice(0, 100),
          deck: (state.deck || []).filter((item) => getTrackDedupeKey(item) !== trackKey),
        },
        "TRACK_BLOCKED",
        track?.title || trackKey
      );
    }

    case "UNBLOCK_TRACK": {
      const trackKey = action.trackKey;

      if (!trackKey) return state;

      return addEvent(
        {
          ...state,
          blockedTrackKeys: (state.blockedTrackKeys || []).filter((key) => key !== trackKey),
        },
        "TRACK_UNBLOCKED",
        trackKey
      );
    }

    case "REPORT_TRACK": {
      const track = action.track || state.currentTrack || state.lastResult?.track;

      if (!track) return state;

      return addEvent(
        {
          ...state,
          songReports: [createSongReportEntry(track, action.reason || "markiert", action.actorName || "Host"), ...(state.songReports || [])].slice(0, 100),
        },
        "TRACK_REPORTED",
        `${track.title} · ${action.reason || "markiert"}`
      );
    }

    case "CLEAR_SONG_REPORTS":
      return addEvent(
        {
          ...state,
          songReports: [],
        },
        "SONG_REPORTS_CLEARED",
        "Song-Markierungen geleert"
      );

    case "CLEAR_BLOCKED_TRACKS":
      return addEvent(
        {
          ...state,
          blockedTrackKeys: [],
        },
        "BLOCKLIST_CLEARED",
        "Blacklist geleert"
      );

    case "TOGGLE_DEBUG_SONG":
      return {
        ...state,
        showDebugSong: !state.showDebugSong,
      };

    default:
      return state;
  }
}

function getDiscordLaunchContext() {
  try {
    const params = new URLSearchParams(window.location.search);

    return {
      frameId: params.get("frame_id") || "",
      instanceId: params.get("instance_id") || "",
      channelId: params.get("channel_id") || "",
      guildId: params.get("guild_id") || "",
      platform: params.get("platform") || "",
      referrer: document.referrer || "",
    };
  } catch {
    return {
      frameId: "",
      instanceId: "",
      channelId: "",
      guildId: "",
      platform: "",
      referrer: "",
    };
  }
}

function isDiscordLikeEnvironment() {
  const context = getDiscordLaunchContext();
  return Boolean(
    context.frameId ||
      context.instanceId ||
      context.channelId ||
      context.guildId ||
      context.referrer.toLowerCase().includes("discord")
  );
}

async function tryInitializeDiscordSdk(clientId) {
  if (!clientId.trim()) {
    return {
      ok: false,
      message: "Discord Client ID wird in der Web-Version nicht benoetigt.",
    };
  }

  try {
    const module = await import("@discord/embedded-app-sdk");
    const sdk = new module.DiscordSDK(clientId.trim());
    await sdk.ready();

    return {
      ok: true,
      message: "Discord SDK bereit.",
      sdk,
    };
  } catch {
    return {
      ok: false,
      message: "Discord SDK wird in der Web-Version nicht benoetigt.",
    };
  }
}

function getSpotifyRedirectUri() {
  return `${window.location.origin}${window.location.pathname}`;
}

function getStoredSpotifyToken() {
  try {
    const raw = localStorage.getItem(SPOTIFY_TOKEN_STORAGE_KEY);
    if (!raw) return null;

    const token = JSON.parse(raw);

    if (!token.accessToken || !token.expiresAt) return null;
    if (Date.now() > token.expiresAt - 30000) return null;

    return token;
  } catch {
    return null;
  }
}

function storeSpotifyToken(data) {
  const token = {
    accessToken: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  };

  localStorage.setItem(SPOTIFY_TOKEN_STORAGE_KEY, JSON.stringify(token));

  return token;
}

function generateRandomString(length) {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = new Uint8Array(length);

  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(values);

    return Array.from(values, (value) => possible[value % possible.length]).join("");
  }

  return Array.from({ length }, () => possible[Math.floor(Math.random() * possible.length)]).join("");
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);

  return window.crypto.subtle.digest("SHA-256", data);
}

function base64UrlEncode(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function createSpotifyAuthorizeUrl(clientId) {
  const trimmedClientId = clientId.trim();

  if (!trimmedClientId) {
    throw new Error("Bitte zuerst eine Spotify Client ID eintragen.");
  }

  const codeVerifier = generateRandomString(64);
  const codeChallenge = base64UrlEncode(await sha256(codeVerifier));

  localStorage.setItem(SPOTIFY_CLIENT_ID_STORAGE_KEY, trimmedClientId);
  localStorage.setItem(SPOTIFY_CODE_VERIFIER_STORAGE_KEY, codeVerifier);

  const params = new URLSearchParams({
    client_id: trimmedClientId,
    response_type: "code",
    redirect_uri: getSpotifyRedirectUri(),
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    scope: SPOTIFY_SCOPES,
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

async function loginToSpotify(clientId, options = {}) {
  const { external = false } = options;
  const authorizeUrl = await createSpotifyAuthorizeUrl(clientId);

  if (external) {
    const popup = window.open(
      authorizeUrl,
      "trackline_spotify_login",
      "popup=yes,width=540,height=760"
    );

    if (!popup) {
      throw new Error("Spotify Login-Fenster wurde blockiert. Erlaube Popups fuer diese Seite und versuche es erneut.");
    }

    popup.focus?.();
    return "external";
  }

  window.location.href = authorizeUrl;
  return "redirect";
}

async function exchangeSpotifyCodeForToken() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (!code) return null;

  const clientId = localStorage.getItem(SPOTIFY_CLIENT_ID_STORAGE_KEY);
  const codeVerifier = localStorage.getItem(SPOTIFY_CODE_VERIFIER_STORAGE_KEY);

  if (!clientId || !codeVerifier) {
    throw new Error("Spotify Login konnte nicht abgeschlossen werden. Client ID oder Code Verifier fehlt.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getSpotifyRedirectUri(),
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Spotify Token konnte nicht geholt werden: ${await response.text()}`);
  }

  const token = storeSpotifyToken(await response.json());

  window.history.replaceState({}, document.title, getSpotifyRedirectUri());

  if (window.opener && !window.opener.closed) {
    window.opener.postMessage(
      {
        type: "TRACKLINE_SPOTIFY_TOKEN",
        token,
      },
      window.location.origin
    );

    window.setTimeout(() => {
      window.close();
    }, 500);
  }

  return token;
}

async function getSpotifyErrorMessage(response) {
  let details = "";

  try {
    const data = await response.json();
    details = data?.error?.message || data?.error_description || JSON.stringify(data);
  } catch {
    try {
      details = await response.text();
    } catch {
      details = "";
    }
  }

  if (response.status === 401) {
    return "Spotify Login ist abgelaufen. Bitte Spotify trennen und erneut verbinden.";
  }

  if (response.status === 403) {
    return "Spotify verweigert die Wiedergabe. Pruefe, ob du Spotify Premium nutzt und ob dein Account Playback erlaubt.";
  }

  if (response.status === 404) {
    return "Kein aktives Spotify-Geraet gefunden. Warte kurz auf 'Player bereit' oder oeffne Spotify einmal separat.";
  }

  if (response.status === 429) {
    return "Spotify Rate Limit erreicht. Warte kurz und versuche es erneut.";
  }

  return `Spotify Fehler ${response.status}: ${details || response.statusText}`;
}

async function searchSpotifyUri(track, accessToken) {
  if (track.spotifyUri) return track.spotifyUri;

  const mainArtist = String(track.artist || "")
    .split(" feat.")[0]
    .split(" ft.")[0]
    .trim();

  const query = `track:${track.title} artist:${mainArtist}`;

  const params = new URLSearchParams({
    q: query,
    type: "track",
    limit: "1",
  });

  const response = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await getSpotifyErrorMessage(response));
  }

  const data = await response.json();
  const item = data?.tracks?.items?.[0];

  if (!item?.uri) {
    throw new Error("Keinen passenden Spotify-Track gefunden. Trage spotifyUri manuell im Track-Datensatz ein.");
  }

  return item.uri;
}

function sanitizeTrackForm(form) {
  return {
    id: createId("custom-track"),
    title: form.title.trim(),
    artist: form.artist.trim(),
    year: Number(form.year),
    genre: form.genre.trim() || "Custom",
    spotifyUri: form.spotifyUri.trim() || undefined,
  };
}

function normalizeImportedTrack(rawTrack, index) {
  const title = String(rawTrack.title || rawTrack.Titel || rawTrack.song || "").trim();
  const artist = String(rawTrack.artist || rawTrack.Artist || rawTrack.kuenstler || rawTrack.künstler || "").trim();
  const year = Number(rawTrack.year || rawTrack.Jahr || rawTrack.releaseYear);
  const genre = String(rawTrack.genre || rawTrack.Genre || "Custom").trim() || "Custom";
  const spotifyUri = String(rawTrack.spotifyUri || rawTrack.spotify_uri || rawTrack.spotify || "").trim() || undefined;

  if (!title || !artist || !Number.isInteger(year) || year < 1900 || year > 2035) return null;

  return {
    id: rawTrack.id || createId(`import-${index}`),
    title,
    artist,
    year,
    genre,
    spotifyUri,
  };
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && nextChar === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());

  return result;
}

function parseCsvTracks(input) {
  const lines = input
    .split(new RegExp("\\r?\\n"))
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());

  return lines
    .slice(1)
    .map((line, index) => {
      const values = parseCsvLine(line);

      const rawTrack = headers.reduce((track, header, headerIndex) => {
        track[header] = values[headerIndex] || "";
        return track;
      }, {});

      return normalizeImportedTrack(rawTrack, index);
    })
    .filter(Boolean);
}

function parseImportedTracks(input) {
  const trimmed = input.trim();

  if (!trimmed) return [];

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    const rawTracks = Array.isArray(parsed) ? parsed : parsed.tracks || [];

    return rawTracks
      .map((track, index) => normalizeImportedTrack(track, index))
      .filter(Boolean);
  }

  return parseCsvTracks(trimmed);
}

function exportTracksAsJson(tracks) {
  return JSON.stringify(
    tracks.map(({ id, title, artist, year, genre, spotifyUri }) => ({
      id,
      title,
      artist,
      year,
      genre,
      spotifyUri,
    })),
    null,
    2
  );
}

function loadStoredCustomTracks() {
  try {
    const raw = localStorage.getItem(CUSTOM_TRACKS_STORAGE_KEY);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((track, index) => normalizeImportedTrack(track, index))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function loadStoredGameState(fallbackState) {
  try {
    const raw = localStorage.getItem(GAME_STATE_STORAGE_KEY);

    if (!raw) return fallbackState;

    const parsed = JSON.parse(raw);

    if (!parsed || parsed.phase === "lobby" || !Array.isArray(parsed.players)) return fallbackState;

    return {
      ...fallbackState,
      ...parsed,
      eventHistory: Array.isArray(parsed.eventHistory) ? parsed.eventHistory : [],
      gameLog: Array.isArray(parsed.gameLog) ? parsed.gameLog : [],
      discardedTracks: Array.isArray(parsed.discardedTracks) ? parsed.discardedTracks : [],
      playbackRequests: Array.isArray(parsed.playbackRequests) ? parsed.playbackRequests : [],
    };
  } catch {
    return fallbackState;
  }
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], {
    type: "application/json;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function isValidTrackForm(form) {
  const year = Number(form.year);

  return form.title.trim() && form.artist.trim() && Number.isInteger(year) && year >= 1900 && year <= 2035;
}

function isCustomTrack(track) {
  return String(track.id).startsWith("custom-track") || String(track.id).startsWith("import-");
}

function trackMatchesPreset(track, presetId) {
  const searchable = `${track.title || ""} ${track.artist || ""} ${track.genre || ""}`.toLowerCase();
  const hasAny = (...terms) => terms.some((term) => searchable.includes(term));
  const isSpecialThemeTrack = () =>
    hasAny(
      "party", "pop", "dance", "disco", "funk", "synthpop", "eurodance", "edm", "electronic", "trance",
      "rock", "alternative", "grunge", "metal", "punk", "indie",
      "hip hop", "hip-hop", "rap", "deutschrap",
      "schlager", "eurovision", "movie", "soundtrack", "film", "ballad", "power ballad"
    );

  if (presetId === "party") return hasAny("party", "pop", "dance", "disco", "funk", "synthpop", "eurodance", "edm", "latin", "reggaeton", "schlager", "movie pop", "club");
  if (presetId === "pop") return hasAny("pop", "synthpop", "indie pop", "pop rock", "dance pop", "latin pop", "soul pop", "movie pop", "eurovision pop");
  if (presetId === "rock") return hasAny("rock", "alternative", "grunge", "indie rock", "pop rock", "rock and roll", "hard rock");
  if (presetId === "hiphop") return hasAny("hip hop", "hip-hop", "rap", "deutschrap", "country rap", "pop rap", "rap rock");
  if (presetId === "dance") return hasAny("dance", "electronic", "edm", "trance", "eurodance", "techno", "synthpop", "house", "club");
  if (presetId === "schlager") return hasAny("schlager", "helene", "nicole", "atemlos", "roland kaiser", "wolfgang petry", "mallorca", "party schlager");
  if (presetId === "metalpunk") return hasAny("metal", "punk", "nu metal", "hard rock", "black sabbath", "metallica", "green day", "linkin park", "blink-182", "offspring");
  if (presetId === "indie") return hasAny("indie", "alternative", "folk rock", "indie folk", "lorde", "blur", "radiohead", "killers", "glass animals", "arctic monkeys", "lumineers");
  if (presetId === "ballads") return hasAny("ballad", "power ballad", "powerballad", "adele", "celine", "sinead", "aerosmith", "shallow", "skyfall", "nothing compares", "easy on me", "stay with me", "all of me");
  if (presetId === "eurovision") return hasAny("eurovision", "esc", "loreen", "abba", "måneskin", "nicole", "conchita", "duncan laurence", "lena", "lordi", "käärijä", "nemo");
  if (presetId === "movie") return hasAny("movie", "soundtrack", "film", "skyfall", "titanic", "ghostbusters", "frozen", "men in black", "lion king", "disney", "musical", "bond");
  if (presetId === "mix") return !isSpecialThemeTrack() && !isCustomTrack(track);
  if (presetId === "all") return true;

  return true;
}

function normalizeTrackText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getTrackTitleKey(track) {
  return normalizeTrackText(track?.title)
    .replace(/\b(remaster(ed)?|radio edit|single version|album version|live|mono|stereo|explicit|clean)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getTrackDedupeKey(track) {
  return getTrackTitleKey(track);
}

function dedupeTrackDeck(tracks) {
  const seenTitles = new Set();
  const result = [];

  for (const track of tracks) {
    const key = getTrackDedupeKey(track);

    if (!key || seenTitles.has(key)) continue;

    seenTitles.add(key);
    result.push(track);
  }

  return result;
}

function preparePlayableDeck(tracks) {
  return shuffle(dedupeTrackDeck(tracks));
}

function getTrackDifficultyScore(track) {
  const searchable = `${track.title || ""} ${track.artist || ""} ${track.genre || ""}`.toLowerCase();
  let score = 0;

  if (track.spotifyUri) score += 2;
  if (hasAnyText(searchable, "pop", "party", "dance", "disco", "rock", "movie", "eurovision", "schlager")) score += 2;
  if (hasAnyText(searchable, "beatles", "queen", "michael jackson", "abba", "madonna", "rihanna", "lady gaga", "adele", "eminem", "nirvana", "coldplay", "taylor swift", "bruno mars", "britney", "elvis", "helene", "loreen")) score += 3;
  if (track.year >= 1980 && track.year <= 2024) score += 1;
  if (hasAnyText(searchable, "indie", "alternative", "metal", "punk", "eurovision", "soundtrack", "country", "folk")) score -= 1;
  if (isCustomTrack(track)) score += 1;

  return score;
}

function hasAnyText(text, ...terms) {
  return terms.some((term) => text.includes(term));
}

function filterDeckByDifficulty(tracks, difficulty) {
  if (difficulty === "normal") return tracks;

  const scored = tracks.map((track) => ({
    track,
    score: getTrackDifficultyScore(track),
  }));

  if (difficulty === "easy") {
    const easyTracks = scored.filter((item) => item.score >= 3).map((item) => item.track);
    return easyTracks.length >= 40 ? easyTracks : tracks;
  }

  if (difficulty === "hard") {
    const hardTracks = scored.filter((item) => item.score <= 3).map((item) => item.track);
    return hardTracks.length >= 40 ? hardTracks : tracks;
  }

  return tracks;
}

function filterDeckByPreset(tracks, presetId) {
  const directMatches = tracks.filter((track) => trackMatchesPreset(track, presetId));

  if (presetId === "mix" || presetId === "all") return directMatches;

  const MIN_THEME_DECK_SIZE = 150;

  if (directMatches.length >= MIN_THEME_DECK_SIZE) return directMatches;

  const matchedIds = new Set(directMatches.map((track) => track.id));
  const broadFallback = tracks.filter((track) => {
    if (matchedIds.has(track.id) || isCustomTrack(track)) return false;

    const searchable = `${track.title || ""} ${track.artist || ""} ${track.genre || ""}`.toLowerCase();

    if (presetId === "schlager") return searchable.includes("deutsch") || searchable.includes("party") || searchable.includes("pop");
    if (presetId === "eurovision") return searchable.includes("pop") || searchable.includes("dance") || searchable.includes("rock") || searchable.includes("movie");
    if (presetId === "movie") return searchable.includes("pop") || searchable.includes("rock") || searchable.includes("ballad") || searchable.includes("hip hop");
    if (presetId === "ballads") return searchable.includes("pop") || searchable.includes("rock") || searchable.includes("soul");
    if (presetId === "metalpunk") return searchable.includes("rock") || searchable.includes("alternative") || searchable.includes("grunge");
    if (presetId === "indie") return searchable.includes("rock") || searchable.includes("pop") || searchable.includes("alternative");

    return false;
  });

  const padded = [...directMatches, ...broadFallback.filter((track) => !matchedIds.has(track.id))];

  if (padded.length >= MIN_THEME_DECK_SIZE) return padded.slice(0, Math.max(MIN_THEME_DECK_SIZE, directMatches.length));

  const paddedIds = new Set(padded.map((track) => track.id));
  const finalFallback = tracks.filter((track) => !paddedIds.has(track.id) && !isCustomTrack(track));

  return [...padded, ...finalFallback].slice(0, Math.min(tracks.length, MIN_THEME_DECK_SIZE));
}

function getDeckEraSummary(tracks) {
  const counts = tracks.reduce((acc, track) => {
    const bucket = getEraBucket(track);
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([era, count]) => `${era}: ${count}`)
    .join(" · ");
}

function getViewerRoleFromPlayer(viewerPlayerId, gameState) {
  if (!viewerPlayerId || viewerPlayerId === "spectator") return "spectator";

  const viewerIsHost = gameState.room?.hostPlayerId === viewerPlayerId;

  if (viewerIsHost) return "host";

  const activePlayer = gameState.players[gameState.activePlayerIndex];

  if (activePlayer?.id === viewerPlayerId) return "activePlayer";

  return "player";
}

function getViewerPermissions(viewerRole) {
  const isHost = viewerRole === "host";
  const isActivePlayer = viewerRole === "activePlayer";

  return {
    canHostControl: isHost,
    canDrawTrack: isHost || isActivePlayer,
    canPlayTrack: isHost || isActivePlayer,
    canPlace: isHost || isActivePlayer,
    canConfirmPlacement: isHost || isActivePlayer,
    canReveal: isHost || isActivePlayer,
    canAwardJoker: isHost || isActivePlayer,
    canUseActiveJoker: isHost || isActivePlayer,
    canResolveJokerTie: isHost || isActivePlayer,
    canAdvance: isHost || isActivePlayer,
  };
}

function buildSyncSnapshot(gameState) {
  const activePlayer = gameState.players[gameState.activePlayerIndex];

  return {
    room: gameState.room,
    phase: gameState.phase,
    turnNumber: gameState.turnNumber,
    activePlayerId: activePlayer?.id || null,
    activePlayerName: activePlayer?.name || null,
    currentTrack: gameState.currentTrack
      ? {
          id: gameState.currentTrack.id,
          hidden: gameState.phase !== "reveal",
          title: gameState.phase === "reveal" ? gameState.currentTrack.title : null,
          artist: gameState.phase === "reveal" ? gameState.currentTrack.artist : null,
          year: gameState.phase === "reveal" ? gameState.currentTrack.year : null,
        }
      : null,
    players: gameState.players.map((player) => ({
      id: player.id,
      name: player.name,
      role: player.role,
      score: player.score,
      jokers: getPlayerJokers(player),
      timelineLength: player.timeline.length,
    })),
    deckRemaining: gameState.deck.length,
    discardedCount: gameState.discardedTracks.length,
  };
}


function getInitialRoomCode() {
  try {
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get("room");

    if (roomFromUrl) return roomFromUrl.toUpperCase().slice(0, 8);
  } catch {
    // ignore
  }

  return createRoomCode();
}

function getInitialViewerPlayerId() {
  try {
    const params = new URLSearchParams(window.location.search);
    const roleFromUrl = params.get("role");

    if (roleFromUrl === "player") return "auto-player";
  } catch {
    // ignore
  }

  return "auto-host";
}

function getClientInstanceId() {
  try {
    const existingId = localStorage.getItem(CLIENT_INSTANCE_ID_STORAGE_KEY);

    if (existingId) return existingId;

    const nextId = createId("client");
    localStorage.setItem(CLIENT_INSTANCE_ID_STORAGE_KEY, nextId);

    return nextId;
  } catch {
    return createId("client");
  }
}

function getStoredViewerPlayerId(roomCode) {
  try {
    return localStorage.getItem(`${VIEWER_PLAYER_STORAGE_PREFIX}${String(roomCode || "DEFAULT").toUpperCase()}`) || "";
  } catch {
    return "";
  }
}

function storeViewerPlayerId(roomCode, playerId) {
  try {
    if (!playerId || playerId === "spectator" || playerId.startsWith("auto-")) return;

    localStorage.setItem(`${VIEWER_PLAYER_STORAGE_PREFIX}${String(roomCode || "DEFAULT").toUpperCase()}`, playerId);
  } catch {
    // ignore
  }
}



function getInitialSupabaseConfig() {
  try {
    const params = new URLSearchParams(window.location.search);
    const urlFromLink = params.get("supabaseUrl") ? decodeURIComponent(params.get("supabaseUrl")) : "";
    const keyFromLink = params.get("supabaseKey") ? decodeURIComponent(params.get("supabaseKey")) : "";
    const storedUrl = localStorage.getItem(SUPABASE_URL_STORAGE_KEY) || "";
    const storedKey = localStorage.getItem(SUPABASE_ANON_KEY_STORAGE_KEY) || "";
    const url = urlFromLink || storedUrl || DEFAULT_SUPABASE_URL;
    const anonKey = keyFromLink || storedKey || DEFAULT_SUPABASE_ANON_KEY;
    const enabledFromLink = Boolean(urlFromLink && keyFromLink);

    return {
      url,
      anonKey,
      enabled: enabledFromLink || localStorage.getItem(SUPABASE_ENABLED_STORAGE_KEY) === "true" || Boolean(DEFAULT_SUPABASE_URL && DEFAULT_SUPABASE_ANON_KEY),
    };
  } catch {
    return {
      url: DEFAULT_SUPABASE_URL,
      anonKey: DEFAULT_SUPABASE_ANON_KEY,
      enabled: Boolean(DEFAULT_SUPABASE_URL && DEFAULT_SUPABASE_ANON_KEY),
    };
  }
}

function normalizeSupabaseUrl(url = "") {
  return String(url || "").trim().replace(/\/+$/, "");
}


function getSupabaseSpotifyFunctionUrl(config) {
  const supabaseUrl = normalizeSupabaseUrl(config?.url);

  if (!supabaseUrl) return "";

  try {
    const url = new URL(supabaseUrl);
    const host = url.host.replace(".supabase.co", ".functions.supabase.co");

    return `${url.protocol}//${host}/trackline-spotify`;
  } catch {
    return "";
  }
}

function isSupabaseConfigured(config) {
  return Boolean(config?.enabled && normalizeSupabaseUrl(config.url) && String(config.anonKey || "").trim());
}

async function supabaseRestRequest(config, path, options = {}) {
  const baseUrl = normalizeSupabaseUrl(config?.url);
  const anonKey = String(config?.anonKey || "").trim();

  if (!baseUrl || !anonKey) {
    throw new Error("Supabase URL oder anon public key fehlt.");
  }

  const response = await fetch(`${baseUrl}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Supabase Fehler ${response.status}`);
  }

  if (response.status === 204) return null;

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}


function getInitialSupabaseAuthSession() {
  try {
    const raw = localStorage.getItem(SUPABASE_AUTH_SESSION_STORAGE_KEY);

    if (!raw) return null;

    const session = JSON.parse(raw);
    const expiresAt = Number(session?.expires_at || 0) * 1000;

    if (!session?.access_token || !session?.user) return null;
    if (expiresAt && expiresAt < Date.now() - 60_000) return null;

    return session;
  } catch {
    return null;
  }
}

function getAuthDisplayName(session) {
  return (
    String(session?.user?.user_metadata?.display_name || "").trim() ||
    String(session?.user?.email || "").split("@")[0] ||
    ""
  );
}

function getAuthEmail(session) {
  return String(session?.user?.email || "").trim();
}

function getAuthGuestId(session, fallbackGuestId) {
  const userId = session?.user?.id;

  return userId ? `auth-${userId}` : String(fallbackGuestId || "");
}

async function supabaseAuthRequest(config, path, options = {}, accessToken = "") {
  const baseUrl = normalizeSupabaseUrl(config?.url);
  const anonKey = String(config?.anonKey || "").trim();

  if (!baseUrl || !anonKey) {
    throw new Error("Supabase URL oder anon public key fehlt.");
  }

  const response = await fetch(`${baseUrl}/auth/v1${path}`, {
    ...options,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken || anonKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.msg || data?.message || data?.error_description || text || `Supabase Auth Fehler ${response.status}`);
  }

  return data;
}

async function signUpWithSupabase(config, { email, password, displayName }) {
  return supabaseAuthRequest(config, "/signup", {
    method: "POST",
    body: JSON.stringify({
      email: String(email || "").trim(),
      password,
      data: {
        display_name: String(displayName || "").trim(),
      },
    }),
  });
}

async function signInWithSupabase(config, { email, password }) {
  return supabaseAuthRequest(config, "/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({
      email: String(email || "").trim(),
      password,
    }),
  });
}

async function signOutWithSupabase(config, session) {
  if (!session?.access_token) return null;

  return supabaseAuthRequest(
    config,
    "/logout",
    {
      method: "POST",
      body: JSON.stringify({}),
    },
    session.access_token
  );
}

async function createOrUpdateAuthProfile(config, session, displayName, fallbackGuestId) {
  if (!isSupabaseConfigured(config) || !session?.user?.id) return null;

  const safeDisplayName = String(displayName || getAuthDisplayName(session) || "Spieler").trim() || "Spieler";
  const stableGuestId = getAuthGuestId(session, fallbackGuestId);

  await supabaseRestRequest(config, "/profiles?on_conflict=guest_id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      guest_id: stableGuestId,
      auth_user_id: session.user.id,
      display_name: safeDisplayName,
      updated_at: new Date().toISOString(),
    }),
  });

  const data = await supabaseRestRequest(
    config,
    `/profiles?select=id,guest_id,auth_user_id,display_name&guest_id=eq.${encodeURIComponent(stableGuestId)}&limit=1`,
    {
      method: "GET",
    }
  );

  return Array.isArray(data) ? data[0] || null : null;
}

async function testSupabaseConnection(config) {
  const data = await supabaseRestRequest(config, "/rooms?select=code&limit=1", {
    method: "GET",
  });

  return Array.isArray(data) ? data.length : 0;
}

async function registerSupabaseRoomEntry(config, { mode, roomCode, name, clientInstanceId, authSession }) {
  if (!isSupabaseConfigured(config)) {
    return {
      skipped: true,
      message: "Supabase ist noch nicht aktiviert.",
    };
  }

  const displayName = String(name || getAuthDisplayName(authSession) || "Spieler").trim() || "Spieler";
  const normalizedRoomCode = String(roomCode || "").trim().toUpperCase();
  const rawGuestId = String(clientInstanceId || createId("guest"));
  const guestId = getAuthGuestId(authSession, rawGuestId);
  const profile = authSession?.user?.id ? await createOrUpdateAuthProfile(config, authSession, displayName, rawGuestId) : null;

  if (!authSession?.user?.id) {
    await supabaseRestRequest(config, "/profiles?on_conflict=guest_id", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        guest_id: guestId,
        display_name: displayName,
        updated_at: new Date().toISOString(),
      }),
    });
  }

  await supabaseRestRequest(config, "/rooms?on_conflict=code", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      code: normalizedRoomCode,
      host_profile_id: mode === "create" && profile?.id ? profile.id : null,
      host_guest_id: mode === "create" ? guestId : null,
      status: "lobby",
      last_seen_at: new Date().toISOString(),
      metadata: {
        source: "trackline-phase9-auth",
      },
    }),
  });

  await supabaseRestRequest(config, "/room_players?on_conflict=room_code,guest_id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      room_code: normalizedRoomCode,
      profile_id: profile?.id || null,
      guest_id: guestId,
      display_name: displayName,
      is_host: mode === "create",
      last_seen_at: new Date().toISOString(),
      metadata: {
        client_instance_id: rawGuestId,
        auth_user_id: authSession?.user?.id || null,
      },
    }),
  });

  return {
    skipped: false,
    message: authSession?.user?.id
      ? mode === "create"
        ? "Supabase-Raum mit Login-Profil registriert."
        : "Supabase-Beitritt mit Login-Profil registriert."
      : mode === "create"
        ? "Supabase-Raum registriert."
        : "Supabase-Beitritt registriert.",
  };
}


async function fetchSupabaseRoomPlayers(config, roomCode) {
  if (!isSupabaseConfigured(config)) return [];

  const normalizedRoomCode = encodeURIComponent(String(roomCode || "").trim().toUpperCase());

  if (!normalizedRoomCode) return [];

  const data = await supabaseRestRequest(
    config,
    `/room_players?select=display_name,is_host,guest_id,profile_id,last_seen_at,joined_at&room_code=eq.${normalizedRoomCode}&order=is_host.desc,joined_at.asc`,
    {
      method: "GET",
    }
  );

  return (Array.isArray(data) ? data : [])
    .map((player) => ({
      displayName: String(player.display_name || "").trim(),
      isHost: Boolean(player.is_host),
      guestId: player.guest_id || "",
      profileId: player.profile_id || "",
      lastSeenAt: player.last_seen_at || "",
      joinedAt: player.joined_at || "",
    }))
    .filter((player) => player.displayName);
}

function getUniqueDisplayNamesFromSupabasePlayers(players = []) {
  const seen = new Set();
  const names = [];

  for (const player of players) {
    const name = String(player.displayName || "").trim();

    if (!name || seen.has(name)) continue;

    seen.add(name);
    names.push(name);
  }

  return names;
}

function mergePlayerNamesWithSupabase(currentNames = [], supabasePlayers = []) {
  const supabaseNames = getUniqueDisplayNamesFromSupabasePlayers(supabasePlayers);
  const merged = [];
  const seen = new Set();

  for (const name of supabaseNames) {
    if (!seen.has(name)) {
      seen.add(name);
      merged.push(name);
    }
  }

  for (const name of currentNames) {
    if (!name || seen.has(name)) continue;

    seen.add(name);
    merged.push(name);
  }

  return merged.length ? merged : currentNames;
}

function areNameListsEqual(left = [], right = []) {
  if (left.length !== right.length) return false;

  return left.every((name, index) => name === right[index]);
}


function getSavedSupabaseResultKeys() {
  try {
    return JSON.parse(localStorage.getItem(SUPABASE_SAVED_RESULTS_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function markSupabaseResultSaved(resultKey) {
  try {
    const keys = getSavedSupabaseResultKeys();
    const nextKeys = Array.from(new Set([resultKey, ...keys])).slice(0, 80);
    localStorage.setItem(SUPABASE_SAVED_RESULTS_STORAGE_KEY, JSON.stringify(nextKeys));
  } catch {
    // ignore
  }
}

function isSupabaseResultSaved(resultKey) {
  return getSavedSupabaseResultKeys().includes(resultKey);
}

function getFinishedEvent(gameState) {
  return (gameState.eventHistory || []).find((event) => event.type === "GAME_FINISHED") || null;
}

function getGameResultKey(roomCode, gameState) {
  const finishedEvent = getFinishedEvent(gameState);
  const eventId = finishedEvent?.id || `${gameState.turnNumber}-${gameState.players?.map((player) => `${player.name}:${player.score}`).join("|")}`;

  return `${String(roomCode || gameState.room?.code || "ROOM").toUpperCase()}::${eventId}`;
}

function countEventsForPlayer(gameState, playerName, eventTypes = []) {
  const name = String(playerName || "");
  const wantedTypes = new Set(eventTypes);

  return (gameState.eventHistory || []).filter((event) => {
    if (wantedTypes.size && !wantedTypes.has(event.type)) return false;

    return String(event.details || "").includes(name);
  }).length;
}

function buildSupabaseGameSummary(gameState, leaderboard, roomPlayers = []) {
  const winner = leaderboard[0] || null;
  const finishedEvent = getFinishedEvent(gameState);
  const playedTracks = gameState.playedTrackHistory || [];

  return {
    room: gameState.room,
    finished_event_id: finishedEvent?.id || null,
    turn_number: gameState.turnNumber,
    game_mode: gameState.gameMode || "solo",
    difficulty: gameState.difficulty || "normal",
    target_score: gameState.targetScore,
    max_turns: gameState.maxTurns,
    play_limit_seconds: gameState.playLimitSeconds,
    winner_name: winner?.name || "",
    players: leaderboard.map((player) => ({
      id: player.id,
      name: player.name,
      score: player.score,
      correct: player.correct,
      wrong: player.wrong,
      jokers: getPlayerJokers(player),
      team_members: player.teamMembers || [],
    })),
    room_players: roomPlayers,
    played_tracks: playedTracks.slice(0, 80),
    event_summary: (gameState.eventHistory || []).slice(0, 40).map((event) => ({
      type: event.type,
      details: event.details || "",
      turn_number: event.turnNumber,
    })),
  };
}

async function fetchExistingPlayerStats(config, guestIds = []) {
  const uniqueGuestIds = Array.from(new Set(guestIds.filter(Boolean)));

  if (!uniqueGuestIds.length) return new Map();

  const encodedList = uniqueGuestIds.map((guestId) => `"${String(guestId).replace(/"/g, '\\"')}"`).join(",");
  const data = await supabaseRestRequest(config, `/player_stats?select=*&guest_id=in.(${encodedList})`, {
    method: "GET",
  });

  return new Map((Array.isArray(data) ? data : []).map((row) => [row.guest_id, row]));
}

function getRoomPlayerForDisplayName(roomPlayers, displayName) {
  const wantedName = String(displayName || "").trim();

  return (roomPlayers || []).find((player) => String(player.displayName || "").trim() === wantedName) || null;
}

function buildPlayerStatPatch(existing = {}, player, gameState, roomPlayer, winnerName) {
  const isWinner = player.name === winnerName;
  const guestId = roomPlayer?.guestId || `name-${normalizeTrackText(player.name) || createId("guest")}`;
  const playedChallengeEvents = countEventsForPlayer(gameState, player.name, ["JOKER_THROWN", "JOKER_DUEL_WINNER", "TRACK_REVEALED"]);
  const swapJokersUsed = countEventsForPlayer(gameState, player.name, ["TRACK_SWAPPED"]);
  const secureJokersUsed = countEventsForPlayer(gameState, player.name, ["TRACK_AUTO_CARD_JOKER"]);
  const earnedJokers = countEventsForPlayer(gameState, player.name, ["JOKER_EARNED"]);

  return {
    guest_id: guestId,
    display_name: player.name,
    games_played: Number(existing.games_played || 0) + 1,
    wins: Number(existing.wins || 0) + (isWinner ? 1 : 0),
    cards_won: Number(existing.cards_won || 0) + Number(player.score || 0),
    correct_placements: Number(existing.correct_placements || 0) + Number(player.correct || 0),
    wrong_placements: Number(existing.wrong_placements || 0) + Number(player.wrong || 0),
    challenge_jokers_used: Number(existing.challenge_jokers_used || 0) + playedChallengeEvents,
    challenge_jokers_won: Number(existing.challenge_jokers_won || 0) + countEventsForPlayer(gameState, player.name, ["JOKER_DUEL_WINNER"]),
    swap_jokers_used: Number(existing.swap_jokers_used || 0) + swapJokersUsed,
    secure_card_jokers_used: Number(existing.secure_card_jokers_used || 0) + secureJokersUsed,
    earned_jokers: Number(existing.earned_jokers || 0) + earnedJokers,
    team_games: Number(existing.team_games || 0) + (gameState.gameMode === "teams" ? 1 : 0),
    updated_at: new Date().toISOString(),
  };
}

async function saveSupabaseGameStats(config, gameState, roomCode, roomPlayers = []) {
  if (!isSupabaseConfigured(config)) {
    return {
      skipped: true,
      message: "Supabase nicht aktiv.",
    };
  }

  if (gameState.phase !== "finished") {
    return {
      skipped: true,
      message: "Spiel ist noch nicht beendet.",
    };
  }

  const normalizedRoomCode = String(roomCode || gameState.room?.code || "").trim().toUpperCase();
  const leaderboard = [...(gameState.players || [])].sort((a, b) => b.score - a.score || a.wrong - b.wrong);
  const winner = leaderboard[0] || null;
  const summary = buildSupabaseGameSummary(gameState, leaderboard, roomPlayers);

  await supabaseRestRequest(config, "/game_results", {
    method: "POST",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      room_code: normalizedRoomCode,
      game_mode: gameState.gameMode || "solo",
      winner_name: winner?.name || "",
      target_score: gameState.targetScore || null,
      started_at: null,
      finished_at: new Date().toISOString(),
      summary,
    }),
  });

  const roomPlayerGuestIds = leaderboard
    .map((player) => getRoomPlayerForDisplayName(roomPlayers, player.name)?.guestId)
    .filter(Boolean);
  const existingStats = await fetchExistingPlayerStats(config, roomPlayerGuestIds);
  const statRows = leaderboard.map((player) => {
    const roomPlayer = getRoomPlayerForDisplayName(roomPlayers, player.name);
    const guestId = roomPlayer?.guestId || `name-${normalizeTrackText(player.name)}`;
    const existing = existingStats.get(guestId) || {};

    return buildPlayerStatPatch(existing, player, gameState, roomPlayer, winner?.name || "");
  });

  for (const row of statRows) {
    await supabaseRestRequest(config, "/player_stats?on_conflict=guest_id", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(row),
    });
  }

  await supabaseRestRequest(config, `/rooms?code=eq.${encodeURIComponent(normalizedRoomCode)}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      status: "finished",
      updated_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    }),
  });

  return {
    skipped: false,
    message: `Statistiken gespeichert: ${leaderboard.length} Spieler.`,
  };
}


async function fetchSupabasePlayerStats(config, limit = 100) {
  if (!isSupabaseConfigured(config)) return [];

  const data = await supabaseRestRequest(
    config,
    `/player_stats?select=*&order=wins.desc,games_played.desc,cards_won.desc&limit=${Number(limit) || 100}`,
    {
      method: "GET",
    }
  );

  return Array.isArray(data) ? data : [];
}

async function fetchSupabaseGameResults(config, limit = 30) {
  if (!isSupabaseConfigured(config)) return [];

  const data = await supabaseRestRequest(
    config,
    `/game_results?select=*&order=finished_at.desc&limit=${Number(limit) || 30}`,
    {
      method: "GET",
    }
  );

  return Array.isArray(data) ? data : [];
}

function getStatsAccuracy(row) {
  const correct = Number(row?.correct_placements || 0);
  const wrong = Number(row?.wrong_placements || 0);
  const total = correct + wrong;

  if (!total) return 0;

  return Math.round((correct / total) * 100);
}

function formatStatsDate(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}


function createSupabaseSyncedState(state, action = {}) {
  return {
    ...state,
    syncMeta: {
      version: Date.now(),
      actionType: action.type || "UNKNOWN",
      actorPlayerId: action.actorPlayerId || null,
      actorName: action.actorName || "",
      updatedAt: new Date().toISOString(),
    },
  };
}

function createTrackCatalogById(tracks = []) {
  const catalog = new Map();

  for (const track of tracks) {
    if (track?.id && !catalog.has(track.id)) {
      catalog.set(track.id, track);
    }
  }

  return catalog;
}

function compactTrackForSync(track, trackCatalogById) {
  if (!track || typeof track !== "object") return track;
  if (track.__trackRef) return track;
  if (track.id && trackCatalogById?.has?.(track.id)) {
    return {
      __trackRef: track.id,
    };
  }

  return track;
}

function expandTrackFromSync(track, trackCatalogById) {
  if (!track || typeof track !== "object") return track;

  if (track.__trackRef) {
    return trackCatalogById?.get?.(track.__trackRef) || track;
  }

  return track;
}

function compactTrackArrayForSync(tracks = [], trackCatalogById) {
  return Array.isArray(tracks) ? tracks.map((track) => compactTrackForSync(track, trackCatalogById)) : tracks;
}

function expandTrackArrayFromSync(tracks = [], trackCatalogById) {
  return Array.isArray(tracks) ? tracks.map((track) => expandTrackFromSync(track, trackCatalogById)) : tracks;
}

function compactTimelineForSync(timeline = [], trackCatalogById) {
  return Array.isArray(timeline) ? timeline.map((track) => compactTrackForSync(track, trackCatalogById)) : timeline;
}

function expandTimelineFromSync(timeline = [], trackCatalogById) {
  return Array.isArray(timeline) ? timeline.map((track) => expandTrackFromSync(track, trackCatalogById)) : timeline;
}

function compactPlayedTrackEntryForSync(entry, trackCatalogById) {
  if (!entry || typeof entry !== "object") return entry;

  return {
    ...entry,
    track: compactTrackForSync(entry.track, trackCatalogById),
  };
}

function expandPlayedTrackEntryFromSync(entry, trackCatalogById) {
  if (!entry || typeof entry !== "object") return entry;

  return {
    ...entry,
    track: expandTrackFromSync(entry.track, trackCatalogById),
  };
}

function compactGameStateForSync(state, trackCatalogById) {
  if (!state || typeof state !== "object") return state;

  return {
    ...state,
    currentTrack: compactTrackForSync(state.currentTrack, trackCatalogById),
    deck: compactTrackArrayForSync(state.deck, trackCatalogById),
    discardedTracks: compactTrackArrayForSync(state.discardedTracks, trackCatalogById),
    playedTrackHistory: Array.isArray(state.playedTrackHistory)
      ? state.playedTrackHistory.map((entry) => compactPlayedTrackEntryForSync(entry, trackCatalogById))
      : state.playedTrackHistory,
    players: Array.isArray(state.players)
      ? state.players.map((player) => ({
          ...player,
          timeline: compactTimelineForSync(player.timeline, trackCatalogById),
        }))
      : state.players,
    lastResult: state.lastResult?.track
      ? {
          ...state.lastResult,
          track: compactTrackForSync(state.lastResult.track, trackCatalogById),
        }
      : state.lastResult,
    syncMeta: {
      ...(state.syncMeta || {}),
      compactTrackRefs: true,
    },
  };
}

function expandGameStateFromSync(state, trackCatalogById) {
  if (!state || typeof state !== "object") return state;
  if (!state.syncMeta?.compactTrackRefs) return state;

  return {
    ...state,
    currentTrack: expandTrackFromSync(state.currentTrack, trackCatalogById),
    deck: expandTrackArrayFromSync(state.deck, trackCatalogById),
    discardedTracks: expandTrackArrayFromSync(state.discardedTracks, trackCatalogById),
    playedTrackHistory: Array.isArray(state.playedTrackHistory)
      ? state.playedTrackHistory.map((entry) => expandPlayedTrackEntryFromSync(entry, trackCatalogById))
      : state.playedTrackHistory,
    players: Array.isArray(state.players)
      ? state.players.map((player) => ({
          ...player,
          timeline: expandTimelineFromSync(player.timeline, trackCatalogById),
        }))
      : state.players,
    lastResult: state.lastResult?.track
      ? {
          ...state.lastResult,
          track: expandTrackFromSync(state.lastResult.track, trackCatalogById),
        }
      : state.lastResult,
  };
}

function getGameStateSyncVersion(state) {
  return String(state?.syncMeta?.version || "");
}

function getNumericSyncVersion(version) {
  const numericVersion = Number(version);

  return Number.isFinite(numericVersion) ? numericVersion : 0;
}

function isRemoteSyncVersionNewer(remoteVersion, localVersion) {
  if (!remoteVersion) return false;
  if (!localVersion) return true;

  const remoteNumeric = getNumericSyncVersion(remoteVersion);
  const localNumeric = getNumericSyncVersion(localVersion);

  if (remoteNumeric && localNumeric) return remoteNumeric > localNumeric;

  return remoteVersion !== localVersion;
}

async function upsertSupabaseGameState(config, roomCode, nextState, action = {}, trackCatalogById = null) {
  if (!isSupabaseConfigured(config)) {
    return {
      skipped: true,
      message: "Supabase nicht aktiv.",
    };
  }

  const normalizedRoomCode = String(roomCode || nextState?.room?.code || "").trim().toUpperCase();

  if (!normalizedRoomCode) {
    throw new Error("Raumcode fehlt.");
  }

  const syncedState = nextState?.syncMeta?.version ? nextState : createSupabaseSyncedState(nextState, action);
  const stateForSync = compactGameStateForSync(syncedState, trackCatalogById);

  await supabaseRestRequest(config, "/game_states?on_conflict=room_code", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      room_code: normalizedRoomCode,
      state: stateForSync,
      updated_at: new Date().toISOString(),
    }),
  });

  await supabaseRestRequest(config, `/rooms?code=eq.${encodeURIComponent(normalizedRoomCode)}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      status: syncedState.phase || "lobby",
      updated_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    }),
  });

  return {
    skipped: false,
    state: syncedState,
    message: `Supabase GameState gespeichert: ${action.type || "Aktion"}.`,
  };
}

async function fetchSupabaseGameState(config, roomCode, trackCatalogById = null) {
  if (!isSupabaseConfigured(config)) return null;

  const normalizedRoomCode = String(roomCode || "").trim().toUpperCase();

  if (!normalizedRoomCode) return null;

  const data = await supabaseRestRequest(
    config,
    `/game_states?select=state,updated_at&room_code=eq.${encodeURIComponent(normalizedRoomCode)}&limit=1`,
    {
      method: "GET",
    }
  );

  const row = Array.isArray(data) ? data[0] : null;

  return row?.state ? expandGameStateFromSync(row.state, trackCatalogById) : null;
}

async function clearSupabaseGameState(config, roomCode) {
  if (!isSupabaseConfigured(config)) return;

  const normalizedRoomCode = String(roomCode || "").trim().toUpperCase();

  if (!normalizedRoomCode) return;

  await supabaseRestRequest(config, `/game_states?room_code=eq.${encodeURIComponent(normalizedRoomCode)}`, {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal",
    },
  });
}


function getInitialSocketUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const serverFromUrl = params.get("server");

    if (serverFromUrl) return decodeURIComponent(serverFromUrl).replace(/\/+$/, "");

    const storedUrl = localStorage.getItem(SYNC_SOCKET_URL_STORAGE_KEY);

    if (!storedUrl) return DEFAULT_SYNC_SOCKET_URL;
    if (storedUrl === "http://localhost:3001") return DEFAULT_SYNC_SOCKET_URL;

    return storedUrl;
  } catch {
    return DEFAULT_SYNC_SOCKET_URL;
  }
}

export default function App() {
  const [gameState, dispatch] = useReducer(gameReducer, initialGameState, loadStoredGameState);

  const [playerName, setPlayerName] = useState("");
  const [playerNames, setPlayerNames] = useState(["Christoph", "Alex"]);
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [customTracks, setCustomTracks] = useState(() => loadStoredCustomTracks());
  const [selectedPreset, setSelectedPreset] = useState("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState("normal");
  const [selectedGameMode, setSelectedGameMode] = useState("solo");
  const [roomCode, setRoomCode] = useState(() => getInitialRoomCode());
  const [discordClientId, setDiscordClientId] = useState(() => localStorage.getItem(DISCORD_CLIENT_ID_STORAGE_KEY) || DISCORD_CLIENT_ID_DEFAULT);
  const [discordStatus, setDiscordStatus] = useState(() =>
    isDiscordLikeEnvironment() ? "Web-App erkannt." : "Browsermodus."
  );
  const [viewerPlayerId, setViewerPlayerId] = useState(() => getInitialViewerPlayerId());
  const [socketUrl, setSocketUrl] = useState(() => getInitialSocketUrl());
  const [supabaseConfig, setSupabaseConfig] = useState(() => getInitialSupabaseConfig());
  const [supabaseStatus, setSupabaseStatus] = useState(() =>
    isSupabaseConfigured(getInitialSupabaseConfig()) ? "Supabase vorbereitet." : "Supabase noch nicht aktiv."
  );
  const [supabaseRoomPlayers, setSupabaseRoomPlayers] = useState([]);
  const [supabaseStatsStatus, setSupabaseStatsStatus] = useState("Noch keine Statistik gespeichert.");
  const [authSession, setAuthSession] = useState(() => getInitialSupabaseAuthSession());
  const [authStatus, setAuthStatus] = useState(() => (getInitialSupabaseAuthSession() ? "Angemeldet." : "Gastmodus aktiv."));
  const [showStatsPage, setShowStatsPage] = useState(false);
  const [statsPageStatus, setStatsPageStatus] = useState("Statistiken noch nicht geladen.");
  const [playerStatsRows, setPlayerStatsRows] = useState([]);
  const [gameResultRows, setGameResultRows] = useState([]);
  const [syncEnabled, setSyncEnabled] = useState(() => localStorage.getItem(SYNC_ENABLED_STORAGE_KEY) === "true");
  const [syncStatus, setSyncStatus] = useState("Sync nicht verbunden.");
  const [syncClientCount, setSyncClientCount] = useState(1);
  const [roomClients, setRoomClients] = useState([]);
  const [clientInstanceId] = useState(() => getClientInstanceId());
  const [roomPlaybackTimer, setRoomPlaybackTimer] = useState({
    requestId: null,
    trackId: null,
    requester: "",
    remainingSeconds: 0,
    endsAt: 0,
  });
  const [spotifyJamMode, setSpotifyJamMode] = useState(() => localStorage.getItem(SPOTIFY_JAM_MODE_STORAGE_KEY) === "true");
  const [activeJokerBusy, setActiveJokerBusy] = useState(false);
  const [activeJokerFeedback, setActiveJokerFeedback] = useState(null);

  const lastRemoteStateRef = useRef("");
  const lastEmittedStateRef = useRef("");
  const currentGameStateRef = useRef(gameState);
  const pendingSupabaseWriteTimeoutRef = useRef(null);
  const latestPendingSupabaseWriteRef = useRef(null);
  const roomSpotifyAutoPauseTimeoutRef = useRef(null);

  const fullDeck = useMemo(() => dedupeTrackDeck([...BASE_TRACK_DECK, ...THEME_TRACK_DECK, ...CATEGORY_EXPANSION_TRACKS, ...VINTAGE_EXPANSION_TRACKS, ...ERA_BALANCE_EXPANSION_TRACKS, ...SONGPOOL_800_EXPANSION_TRACKS, ...customTracks]), [customTracks]);
  const presetDeck = useMemo(() => dedupeTrackDeck(filterDeckByPreset(fullDeck, selectedPreset)), [fullDeck, selectedPreset]);
  const availableDeck = useMemo(() => dedupeTrackDeck(filterDeckByDifficulty(presetDeck, selectedDifficulty)), [presetDeck, selectedDifficulty]);
  const trackCatalogById = useMemo(() => createTrackCatalogById(fullDeck), [fullDeck]);

  const activePlayer = gameState.players[gameState.activePlayerIndex];
  const activeTimeline = activePlayer ? sortTimeline(activePlayer.timeline) : [];
  const winner = getFinalWinner(gameState.players, gameState.targetScore);
  const activeRoomCode = gameState.room?.code || roomCode;
  const spotifyHelperUrl = getSupabaseSpotifyFunctionUrl(supabaseConfig) || socketUrl;

  const resolvedViewerPlayerId = (() => {
    if (viewerPlayerId === "auto-host") return gameState.room?.hostPlayerId || "spectator";

    if (viewerPlayerId === "auto-player") {
      const localName = playerNames[0];
      const playerByName = gameState.players.find((player) => player.name === localName && player.id !== gameState.room?.hostPlayerId);

      if (playerByName) return playerByName.id;

      const storedPlayerId = getStoredViewerPlayerId(activeRoomCode);
      const storedPlayer = gameState.players.find((player) => player.id === storedPlayerId);

      if (storedPlayer && storedPlayer.id !== gameState.room?.hostPlayerId) return storedPlayer.id;

      return (
        gameState.players.find((player) => player.id !== gameState.room?.hostPlayerId)?.id ||
        "spectator"
      );
    }

    return viewerPlayerId;
  })();
  const viewerRole = getViewerRoleFromPlayer(resolvedViewerPlayerId, gameState);
  const viewerPermissions = getViewerPermissions(viewerRole);
  const isSetupHost = viewerRole === "host" || viewerPlayerId === "auto-host";
  const showAdminPanels = isSetupHost;
  const showSpotifyPanel = showAdminPanels;

  const leaderboard = useMemo(() => {
    return [...gameState.players].sort((a, b) => b.score - a.score || a.wrong - b.wrong);
  }, [gameState.players]);

  useEffect(() => {
    currentGameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    localStorage.setItem(SPOTIFY_JAM_MODE_STORAGE_KEY, spotifyJamMode ? "true" : "false");
  }, [spotifyJamMode]);

  useEffect(() => {
    return () => {
      if (pendingSupabaseWriteTimeoutRef.current) {
        window.clearTimeout(pendingSupabaseWriteTimeoutRef.current);
      }

      if (roomSpotifyAutoPauseTimeoutRef.current) {
        window.clearTimeout(roomSpotifyAutoPauseTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(CUSTOM_TRACKS_STORAGE_KEY, JSON.stringify(customTracks));
  }, [customTracks]);

  useEffect(() => {
    localStorage.setItem(DISCORD_CLIENT_ID_STORAGE_KEY, discordClientId);
  }, [discordClientId]);

  useEffect(() => {
    localStorage.setItem(SYNC_SOCKET_URL_STORAGE_KEY, socketUrl);
  }, [socketUrl]);

  useEffect(() => {
    localStorage.setItem(SUPABASE_URL_STORAGE_KEY, supabaseConfig.url || "");
    localStorage.setItem(SUPABASE_ANON_KEY_STORAGE_KEY, supabaseConfig.anonKey || "");
    localStorage.setItem(SUPABASE_ENABLED_STORAGE_KEY, String(Boolean(supabaseConfig.enabled)));
  }, [supabaseConfig]);

  useEffect(() => {
    localStorage.setItem(SYNC_ENABLED_STORAGE_KEY, String(syncEnabled));
  }, [syncEnabled]);


  useEffect(() => {
    if (!isSupabaseConfigured(supabaseConfig) || gameState.phase !== "lobby" || showStartScreen) {
      setSupabaseRoomPlayers([]);
      return undefined;
    }

    let cancelled = false;
    const activeCode = String(gameState.room?.code || roomCode || "").trim().toUpperCase();

    async function loadSupabaseLobbyPlayers({ quiet = false } = {}) {
      if (!activeCode) return;

      try {
        const players = await fetchSupabaseRoomPlayers(supabaseConfig, activeCode);

        if (cancelled) return;

        setSupabaseRoomPlayers(players);
        setSyncClientCount(Math.max(1, players.length));

        const mergedNames = mergePlayerNamesWithSupabase(playerNames, players);

        if (!areNameListsEqual(playerNames, mergedNames)) {
          setPlayerNames(mergedNames);
        }

        if (!quiet) {
          setSupabaseStatus(`Supabase Lobby: ${players.length} Spieler gefunden.`);
        }
      } catch (error) {
        if (!cancelled) {
          setSupabaseStatus(`Supabase Lobby konnte nicht geladen werden: ${error.message || "Fehler"}`);
        }
      }
    }

    loadSupabaseLobbyPlayers();

    const intervalId = window.setInterval(() => {
      loadSupabaseLobbyPlayers({ quiet: true });
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    supabaseConfig.enabled,
    supabaseConfig.url,
    supabaseConfig.anonKey,
    gameState.phase,
    gameState.room?.code,
    roomCode,
    showStartScreen,
    playerNames,
  ]);


  useEffect(() => {
    if (!isSupabaseConfigured(supabaseConfig)) return;
    if (gameState.phase !== "finished") return;
    if (!isSetupHost) return;

    const resultKey = getGameResultKey(activeRoomCode, gameState);

    if (isSupabaseResultSaved(resultKey)) {
      setSupabaseStatsStatus("Statistik für dieses Spiel wurde bereits gespeichert.");
      return;
    }

    let cancelled = false;

    async function persistFinishedGame() {
      setSupabaseStatsStatus("Speichere Spielstatistik in Supabase...");

      try {
        const result = await saveSupabaseGameStats(supabaseConfig, gameState, activeRoomCode, supabaseRoomPlayers);

        if (cancelled) return;

        markSupabaseResultSaved(resultKey);
        setSupabaseStatsStatus(result.message || "Spielstatistik gespeichert.");
      } catch (error) {
        if (!cancelled) {
          setSupabaseStatsStatus(`Statistik konnte nicht gespeichert werden: ${error.message || "Fehler"}`);
        }
      }
    }

    persistFinishedGame();

    return () => {
      cancelled = true;
    };
  }, [
    supabaseConfig.enabled,
    supabaseConfig.url,
    supabaseConfig.anonKey,
    gameState.phase,
    gameState.eventHistory,
    gameState.players,
    activeRoomCode,
    isSetupHost,
    supabaseRoomPlayers,
  ]);

  useEffect(() => {
    if (!syncEnabled) {
      setSyncStatus("Supabase Sync deaktiviert.");
      setSyncClientCount(1);
      return undefined;
    }

    if (!isSupabaseConfigured(supabaseConfig)) {
      setSyncStatus("Supabase Sync wartet auf Konfiguration.");
      return undefined;
    }

    let cancelled = false;
    const activeCode = String(gameState.room?.code || roomCode || "").trim().toUpperCase();

    async function loadSupabaseGameState({ quiet = false } = {}) {
      if (!activeCode) return;

      try {
        const remoteState = await fetchSupabaseGameState(supabaseConfig, activeCode, trackCatalogById);

        if (cancelled || !remoteState) {
          if (!quiet && !cancelled) setSyncStatus(`Supabase Sync bereit: Raum ${activeCode}`);
          return;
        }

        const remoteVersion = getGameStateSyncVersion(remoteState);
        const localVersion = getGameStateSyncVersion(currentGameStateRef.current);

        if (remoteVersion && remoteVersion !== localVersion && remoteVersion !== lastRemoteStateRef.current) {
          if (!isRemoteSyncVersionNewer(remoteVersion, localVersion)) {
            if (!quiet) setSyncStatus(`Lokaler Spielstand ist aktueller als Supabase: ${activeCode}`);
            return;
          }

          lastRemoteStateRef.current = remoteVersion;
          lastEmittedStateRef.current = remoteVersion;
          dispatch({ type: "SERVER_STATE_RECEIVED", gameState: remoteState });

          if (!quiet) setSyncStatus(`Supabase Sync aktualisiert: ${activeCode}`);
          return;
        }

        if (!remoteVersion) {
          const serializedRemoteState = JSON.stringify(remoteState);
          const serializedLocalState = JSON.stringify(currentGameStateRef.current);

          if (serializedRemoteState !== serializedLocalState && serializedRemoteState !== lastRemoteStateRef.current) {
            lastRemoteStateRef.current = serializedRemoteState;
            lastEmittedStateRef.current = serializedRemoteState;
            dispatch({ type: "SERVER_STATE_RECEIVED", gameState: remoteState });

            if (!quiet) setSyncStatus(`Supabase Sync aktualisiert: ${activeCode}`);
            return;
          }
        }

        if (!quiet) setSyncStatus(`Supabase Sync verbunden: ${activeCode}`);
      } catch (error) {
        if (!cancelled) {
          setSyncStatus(`Supabase Sync Fehler: ${error.message || "Fehler"}`);
        }
      }
    }

    loadSupabaseGameState();

    const intervalId = window.setInterval(() => {
      loadSupabaseGameState({ quiet: true });
    }, 1200);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    syncEnabled,
    supabaseConfig.enabled,
    supabaseConfig.url,
    supabaseConfig.anonKey,
    roomCode,
    gameState.room?.code,
    trackCatalogById,
  ]);

  useEffect(() => {
    if (!resolvedViewerPlayerId || resolvedViewerPlayerId === "spectator" || resolvedViewerPlayerId.startsWith("auto-")) return;

    storeViewerPlayerId(activeRoomCode, resolvedViewerPlayerId);
  }, [activeRoomCode, resolvedViewerPlayerId]);


  useEffect(() => {
    // Supabase is the source of truth for resume/reconnect.
    // Avoid writing the full 1000-song gameState to localStorage on every reveal/next-player action,
    // because JSON.stringify + localStorage.setItem blocks the UI thread.
    localStorage.removeItem(GAME_STATE_STORAGE_KEY);
  }, [activeRoomCode]);

  useEffect(() => {
    const latestRequest = gameState.playbackRequests?.[0];

    if (!latestRequest || !gameState.currentTrack || gameState.phase !== "placing") return;
    if (latestRequest.trackId !== gameState.currentTrack.id) return;
    if (latestRequest.id === roomPlaybackTimer.requestId) return;

    const seconds = Math.max(1, Math.min(120, Number(latestRequest.playLimitSeconds || gameState.playLimitSeconds || DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS)));

    setRoomPlaybackTimer({
      requestId: latestRequest.id,
      trackId: latestRequest.trackId,
      requester: latestRequest.requester || "",
      remainingSeconds: seconds,
      endsAt: Date.now() + seconds * 1000,
    });
  }, [gameState.playbackRequests, gameState.currentTrack?.id, gameState.phase, gameState.playLimitSeconds, roomPlaybackTimer.requestId]);

  useEffect(() => {
    if (!roomPlaybackTimer.endsAt) return;

    const intervalId = window.setInterval(() => {
      const remainingSeconds = Math.max(0, Math.ceil((roomPlaybackTimer.endsAt - Date.now()) / 1000));

      setRoomPlaybackTimer((current) => ({
        ...current,
        remainingSeconds,
      }));

      if (remainingSeconds <= 0) {
        window.clearInterval(intervalId);
      }
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [roomPlaybackTimer.endsAt]);

  useEffect(() => {
    if (!["placing", "challenge"].includes(gameState.phase) || !gameState.currentTrack) {
      setRoomPlaybackTimer({
        requestId: null,
        trackId: null,
        requester: "",
        remainingSeconds: 0,
        endsAt: 0,
      });
    }
  }, [gameState.phase, gameState.currentTrack?.id]);

  async function handleSongStart() {
    const playLimitSeconds = DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS;
    const didStart = await requestRoomSpotifyPlayback(playLimitSeconds);

    if (!didStart) return;

    sendGameAction({
      type: "TRACK_PLAY_REQUESTED",
      requesterName: activePlayer?.name,
      playLimitSeconds,
    });

  }

  function handleRevealTrack() {
    sendGameAction({ type: "TRACK_REVEALED" });
  }

  function handleConfirmPlacement() {
    sendGameAction({ type: "PLACEMENT_CONFIRMED" });
  }

  function handleAwardSongGuessJoker() {
    sendGameAction({ type: "AWARD_SONG_GUESS_JOKER" });
  }

  function handleClearSongGuessClaim() {
    sendGameAction({ type: "CLEAR_SONG_GUESS_CLAIM" });
  }

  function handleJokerClaim() {
    sendGameAction({ type: "JOKER_CLAIM", playerId: resolvedViewerPlayerId });
  }

  function handleStartJokerDuel() {
    sendGameAction({ type: "START_JOKER_DUEL" });
  }

  function triggerActiveJokerFeedback(type) {
    const feedback =
      type === "swap"
        ? {
            id: createId("joker-ui"),
            type: "swap",
            title: "Tauschen-Joker eingesetzt",
            text: "1 Joker verbraucht · neuer Song wurde gezogen",
            icon: "🔄",
          }
        : {
            id: createId("joker-ui"),
            type: "secure",
            title: "Karte-sichern-Joker eingesetzt",
            text: "3 Joker verbraucht · Karte wurde automatisch gesichert",
            icon: "🛡️",
          };

    setActiveJokerBusy(true);
    setActiveJokerFeedback(feedback);

    window.setTimeout(() => setActiveJokerBusy(false), 1400);
    window.setTimeout(() => setActiveJokerFeedback(null), 2400);
  }

  function handleJokerDuelChoice(choice) {
    sendGameAction({ type: "JOKER_DUEL_CHOICE", playerId: resolvedViewerPlayerId, choice });
  }

  function handleSwapTrackJoker() {
    if (activeJokerBusy) return;

    triggerActiveJokerFeedback("swap");
    sendGameAction({ type: "TRACK_SWAP_JOKER" });
  }

  function handleAutoCardJoker() {
    if (activeJokerBusy) return;

    triggerActiveJokerFeedback("secure");
    sendGameAction({ type: "TRACK_AUTO_CARD_JOKER" });
  }

  function handleNextPlayer() {
    sendGameAction({ type: "NEXT_PLAYER" });
  }

  function scheduleRoomSpotifyAutoPause(playLimitSeconds = DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS) {
    const activeRoomCode = gameState.room?.code || roomCode;
    const serverBaseUrl = String(spotifyHelperUrl || "").trim().replace(/\/+$/, "");
    const limitedSeconds = Math.max(1, Math.min(120, Math.round(Number(playLimitSeconds) || DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS)));

    if (roomSpotifyAutoPauseTimeoutRef.current) {
      window.clearTimeout(roomSpotifyAutoPauseTimeoutRef.current);
      roomSpotifyAutoPauseTimeoutRef.current = null;
    }

    if (!serverBaseUrl || !activeRoomCode) return;

    roomSpotifyAutoPauseTimeoutRef.current = window.setTimeout(async () => {
      try {
        await fetch(`${serverBaseUrl}/room/${encodeURIComponent(activeRoomCode)}/spotify/pause`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jamMode: spotifyJamMode,
          }),
        });
      } catch {
        // The visible countdown/game flow should continue even if Spotify pause fails.
      } finally {
        roomSpotifyAutoPauseTimeoutRef.current = null;
      }
    }, limitedSeconds * 1000 + 250);
  }

  async function requestRoomSpotifyPlayback(playLimitSeconds = DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS) {
    const activeRoomCode = gameState.room?.code || roomCode;
    const serverBaseUrl = String(spotifyHelperUrl || "").trim().replace(/\/+$/, "");

    if (!serverBaseUrl) {
      window.alert("Supabase Spotify Function fehlt. Prüfe Supabase-Konfiguration oder deploye die Edge Function.");
      return;
    }

    if (!gameState.currentTrack) {
      window.alert("Kein Song gezogen.");
      return;
    }

    try {
      const response = await fetch(`${serverBaseUrl}/room/${encodeURIComponent(activeRoomCode)}/spotify/play`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playLimitSeconds,
          track: gameState.currentTrack,
          jamMode: spotifyJamMode,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      scheduleRoomSpotifyAutoPause(playLimitSeconds);

      return true;
    } catch (error) {
      window.alert(error.message || "Spotify Wiedergabe konnte nicht gestartet werden.");
      return false;
    }
  }
  function queueSupabaseGameStateWrite(syncedState, actionWithActor) {
    latestPendingSupabaseWriteRef.current = {
      syncedState,
      actionWithActor,
      roomCode: activeRoomCode,
      trackCatalogById,
    };

    if (pendingSupabaseWriteTimeoutRef.current) {
      window.clearTimeout(pendingSupabaseWriteTimeoutRef.current);
    }

    setSyncStatus(`Aktion ausgeführt, speichere ${actionWithActor.type}...`);

    pendingSupabaseWriteTimeoutRef.current = window.setTimeout(async () => {
      const pendingWrite = latestPendingSupabaseWriteRef.current;

      pendingSupabaseWriteTimeoutRef.current = null;

      if (!pendingWrite) return;

      try {
        await upsertSupabaseGameState(
          supabaseConfig,
          pendingWrite.roomCode,
          pendingWrite.syncedState,
          pendingWrite.actionWithActor,
          pendingWrite.trackCatalogById
        );
        setSyncStatus(`Supabase Sync gespeichert: ${pendingWrite.actionWithActor.type}`);
      } catch (error) {
        setSyncStatus(`Supabase Sync speichern fehlgeschlagen: ${error.message || "Fehler"}`);
      }
    }, 25);
  }



  async function sendGameAction(action) {
    const actorPlayerId = resolvedViewerPlayerId || null;
    const actorPlayer = gameState.players.find((player) => player.id === actorPlayerId);
    const actionWithActor = {
      ...action,
      actorPlayerId,
      actorName: actorPlayer?.name || playerNames[0] || "Spieler",
    };

    const nextState = gameReducer(gameState, actionWithActor);
    const syncedState = createSupabaseSyncedState(nextState, actionWithActor);
    const nextStateVersion = getGameStateSyncVersion(syncedState) || String(Date.now());

    lastRemoteStateRef.current = nextStateVersion;
    lastEmittedStateRef.current = nextStateVersion;
    dispatch({ type: "SERVER_STATE_RECEIVED", gameState: syncedState });

    if (!syncEnabled || !isSupabaseConfigured(supabaseConfig)) {
      setSyncStatus("Aktion lokal ausgeführt. Supabase Sync ist nicht aktiv.");
      return;
    }

    queueSupabaseGameStateWrite(syncedState, actionWithActor);
  }

  function updateSupabaseConfig(patch) {
    setSupabaseConfig((previous) => ({
      ...previous,
      ...patch,
    }));
  }

  async function handleTestSupabaseConnection() {
    if (!isSupabaseConfigured(supabaseConfig)) {
      setSupabaseStatus("Supabase URL oder anon public key fehlt.");
      return;
    }

    setSupabaseStatus("Supabase Verbindung wird geprüft...");

    try {
      await testSupabaseConnection(supabaseConfig);
      setSupabaseStatus("Supabase verbunden. Schema erreichbar.");
    } catch (error) {
      setSupabaseStatus(`Supabase nicht bereit: ${error.message || "Fehler"}`);
    }
  }

  async function loadStatsPageData() {
    if (!isSupabaseConfigured(supabaseConfig)) {
      setStatsPageStatus("Supabase ist nicht aktiv oder nicht konfiguriert.");
      setPlayerStatsRows([]);
      setGameResultRows([]);
      return;
    }

    setStatsPageStatus("Lade Statistiken aus Supabase...");

    try {
      const [players, results] = await Promise.all([
        fetchSupabasePlayerStats(supabaseConfig, 100),
        fetchSupabaseGameResults(supabaseConfig, 30),
      ]);

      setPlayerStatsRows(players);
      setGameResultRows(results);
      setStatsPageStatus(`${players.length} Spielerstatistiken · ${results.length} Spiele geladen.`);
    } catch (error) {
      setStatsPageStatus(`Statistiken konnten nicht geladen werden: ${error.message || "Fehler"}`);
    }
  }

  function openStatsPage() {
    setShowStatsPage(true);
    loadStatsPageData();
  }


  async function handleAuthSignUp({ email, password, displayName }) {
    if (!isSupabaseConfigured(supabaseConfig)) {
      setAuthStatus("Supabase ist nicht aktiv oder nicht konfiguriert.");
      return;
    }

    setAuthStatus("Account wird erstellt...");

    try {
      const session = await signUpWithSupabase(supabaseConfig, { email, password, displayName });

      if (session?.access_token) {
        setAuthSession(session);
        await createOrUpdateAuthProfile(supabaseConfig, session, displayName, clientInstanceId);
        setPlayerNames([getAuthDisplayName(session) || displayName || email]);
        setAuthStatus("Account erstellt und angemeldet.");
      } else {
        setAuthStatus("Account erstellt. Bitte bestätige ggf. deine E-Mail und melde dich danach an.");
      }
    } catch (error) {
      setAuthStatus(`Registrierung fehlgeschlagen: ${error.message || "Fehler"}`);
    }
  }

  async function handleAuthSignIn({ email, password }) {
    if (!isSupabaseConfigured(supabaseConfig)) {
      setAuthStatus("Supabase ist nicht aktiv oder nicht konfiguriert.");
      return;
    }

    setAuthStatus("Login läuft...");

    try {
      const session = await signInWithSupabase(supabaseConfig, { email, password });
      const displayName = getAuthDisplayName(session) || email;

      setAuthSession(session);
      await createOrUpdateAuthProfile(supabaseConfig, session, displayName, clientInstanceId);
      setPlayerNames([displayName]);
      setAuthStatus(`Angemeldet als ${displayName}.`);
    } catch (error) {
      setAuthStatus(`Login fehlgeschlagen: ${error.message || "Fehler"}`);
    }
  }

  async function handleAuthLogout() {
    try {
      if (authSession) {
        await signOutWithSupabase(supabaseConfig, authSession);
      }
    } catch {
      // local logout should still happen
    }

    setAuthSession(null);
    setAuthStatus("Abgemeldet. Gastmodus aktiv.");
  }

  async function applyStartSetup({ mode, name, roomCode: nextRoomCode }) {
    const safeName = String(name || getAuthDisplayName(authSession) || "").trim() || "Spieler";
    const safeRoomCode = String(nextRoomCode || createRoomCode()).trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || createRoomCode();

    setRoomCode(safeRoomCode);
    setPlayerName("");
    setPlayerNames((previous) => {
      if (mode === "create") return [safeName];

      return [safeName];
    });
    setViewerPlayerId(mode === "create" ? "auto-host" : "auto-player");
    setSyncEnabled(true);

    if (isSupabaseConfigured(supabaseConfig)) {
      setSupabaseStatus("Supabase Raum wird vorbereitet...");

      try {
        const result = await registerSupabaseRoomEntry(supabaseConfig, {
          mode,
          roomCode: safeRoomCode,
          name: safeName,
          clientInstanceId,
          authSession,
        });
        setSupabaseStatus(result.message);
      } catch (error) {
        setSupabaseStatus(`Supabase Vorbereitung fehlgeschlagen: ${error.message || "Fehler"}`);
      }
    }

    setShowStartScreen(false);

    try {
      const url = new URL(window.location.href);
      url.searchParams.set("room", safeRoomCode);
      url.searchParams.set("role", mode === "create" ? "host" : "player");
      url.searchParams.set("server", socketUrl);
      window.history.replaceState(null, "", url.toString());
    } catch {
      // ignore URL update
    }
  }

  function backToStartScreen() {
    if (gameState.phase !== "lobby") return;

    setShowStartScreen(true);
  }

  function addPlayer() {
    const name = playerName.trim();

    if (!name || playerNames.includes(name)) return;

    setPlayerNames([...playerNames, name]);
    setPlayerName("");
  }

  function removePlayer(name) {
    if (playerNames.length <= 1) return;

    setPlayerNames(playerNames.filter((player) => player !== name));
  }

  function addCustomTrack(form) {
    if (!isValidTrackForm(form)) return false;

    setCustomTracks((previous) => [...previous, sanitizeTrackForm(form)]);

    return true;
  }

  function removeCustomTrack(trackId) {
    setCustomTracks((previous) => previous.filter((track) => track.id !== trackId));
  }

  function clearCustomTracks() {
    setCustomTracks([]);
  }

  function importCustomTracks(input, mode = "append") {
    try {
      const importedTracks = parseImportedTracks(input);

      if (importedTracks.length === 0) {
        return {
          ok: false,
          message: "Keine gueltigen Songs gefunden.",
        };
      }

      setCustomTracks((previous) => {
        const nextTracks = mode === "replace" ? importedTracks : [...previous, ...importedTracks];
        const seen = new Set();

        return nextTracks.filter((track) => {
          const key = `${track.title.toLowerCase()}|${track.artist.toLowerCase()}|${track.year}`;

          if (seen.has(key)) return false;

          seen.add(key);

          return true;
        });
      });

      return {
        ok: true,
        message: `${importedTracks.length} Songs importiert.`,
      };
    } catch (error) {
      return {
        ok: false,
        message: error.message || "Import fehlgeschlagen.",
      };
    }
  }

  function exportCustomTracks() {
    downloadTextFile("trackline-custom-deck.json", exportTracksAsJson(customTracks));
  }

  function startGame(settings) {
    sendGameAction({
      type: "START_GAME",
      playerNames,
      deck: availableDeck,
      roomCode,
      targetScore: settings.targetScore,
      maxTurns: settings.maxTurns,
      playLimitSeconds: settings.playLimitSeconds,
      difficulty: selectedDifficulty,
      gameMode: settings.gameMode || "solo",
      teamConfig: settings.teamConfig || null,
      startPlayerName: settings.startPlayerName,
    });
  }

  function startNewRound() {
    sendGameAction({
      type: "NEW_ROUND",
      deck: filterUnusedDeck(availableDeck, gameState),
      targetScore: gameState.targetScore,
      maxTurns: gameState.maxTurns,
      playLimitSeconds: gameState.playLimitSeconds,
      difficulty: gameState.difficulty,
      gameMode: gameState.gameMode,
    });
  }

  async function resetGame() {
    localStorage.removeItem(GAME_STATE_STORAGE_KEY);

    if (isSupabaseConfigured(supabaseConfig)) {
      try {
        await clearSupabaseGameState(supabaseConfig, activeRoomCode);
      } catch {
        // local reset should still work even if remote clearing fails
      }
    }

    setShowStartScreen(true);
    sendGameAction({ type: "RESET_GAME" });
  }

  const twoColumnLayout = {
    display: "grid",
    gridTemplateColumns: "minmax(0, calc(100% - 286px)) 270px",
    gap: 12,
    alignItems: "start",
    width: "100%",
  };

  if (showStatsPage) {
    return (
      <StatsPage
        config={supabaseConfig}
        status={statsPageStatus}
        playerStats={playerStatsRows}
        gameResults={gameResultRows}
        onBack={() => setShowStatsPage(false)}
        onRefresh={loadStatsPageData}
      />
    );
  }

  if (gameState.phase === "lobby" && showStartScreen) {
    return (
      <StartScreen
        initialRoomCode={roomCode}
        initialName={getAuthDisplayName(authSession) || playerNames[0] || ""}
        socketUrl={socketUrl}
        syncStatus={syncStatus}
        supabaseConfig={supabaseConfig}
        supabaseStatus={supabaseStatus}
        supabaseStatsStatus={supabaseStatsStatus}
        authSession={authSession}
        authStatus={authStatus}
        onAuthSignUp={handleAuthSignUp}
        onAuthSignIn={handleAuthSignIn}
        onAuthLogout={handleAuthLogout}
        onSupabaseConfigChange={updateSupabaseConfig}
        onTestSupabase={handleTestSupabaseConnection}
        onOpenStatsPage={openStatsPage}
        onEnter={applyStartSetup}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, color: colors.text, padding: gameState.phase === "lobby" ? 12 : 8, fontFamily: "Inter, system-ui, sans-serif", overflowX: "hidden" }}>
      <div style={{ maxWidth: gameState.phase === "lobby" ? 1320 : "100%", margin: "0 auto", display: "grid", gap: gameState.phase === "lobby" ? 14 : 8 }}>
        {showAdminPanels ? (
          <HostControlArea onReset={resetGame} onOpenStatsPage={openStatsPage} authSession={authSession} authStatus={authStatus} onAuthLogout={handleAuthLogout} isInGame={gameState.phase !== "lobby"}>
            <WebsiteShareCard
              room={gameState.room}
              roomCode={roomCode}
              playerNames={playerNames}
              socketUrl={socketUrl}
              syncClientCount={syncClientCount}
              supabaseConfig={supabaseConfig}
            />

            <MultiplayerSyncCard
              roomCode={gameState.room?.code || roomCode}
              socketUrl={socketUrl}
              setSocketUrl={setSocketUrl}
              syncEnabled={syncEnabled}
              setSyncEnabled={setSyncEnabled}
              syncStatus={syncStatus}
              syncClientCount={syncClientCount}
            />

            <SupabaseFoundationCard
              config={supabaseConfig}
              status={supabaseStatus}
              statsStatus={supabaseStatsStatus}
              onChange={updateSupabaseConfig}
              onTest={handleTestSupabaseConnection}
              defaultOpen={false}
            />

            {showSpotifyPanel && (
              <SpotifyPlayerCard
                currentTrack={gameState.currentTrack}
                phase={gameState.phase}
                canPlayTrack={viewerPermissions.canPlayTrack}
                canManageSpotify={showAdminPanels}
                roomCode={gameState.room?.code || roomCode}
                spotifyAuthServerUrl={spotifyHelperUrl}
                roundPlayLimitSeconds={gameState.playLimitSeconds}
                jamMode={spotifyJamMode}
                setJamMode={setSpotifyJamMode}
                onPlaybackRequested={() =>
                  sendGameAction({
                    type: "TRACK_PLAY_REQUESTED",
                    requesterName: activePlayer?.name,
                    playLimitSeconds: gameState.playLimitSeconds || DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS,
                  })
                }
              />
            )}

            {gameState.phase !== "lobby" && (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 12 }}>
                <RoomCard room={gameState.room} players={gameState.players} activePlayerIndex={gameState.activePlayerIndex} />
                <TurnOrder players={gameState.players} activePlayerIndex={gameState.activePlayerIndex} />
              </div>
            )}

            {gameState.phase !== "lobby" && (
              <HostAdminDetails
                playbackRequests={gameState.playbackRequests}
                gameLog={gameState.gameLog}
                discardedTracks={gameState.discardedTracks}
                eventHistory={gameState.eventHistory}
                gameState={gameState}
                onGameAction={sendGameAction}
              />
            )}
          </HostControlArea>
        ) : (
          gameState.phase === "lobby" && <Header onReset={resetGame} isInGame={false} />
        )}

        {gameState.phase === "lobby" && isSetupHost && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(280px, 0.65fr)", gap: 24 }}>
            <main style={{ display: "grid", gap: 16, minWidth: 0 }}>
              <LobbyCard
                playerName={playerName}
                setPlayerName={setPlayerName}
                playerNames={playerNames}
                supabaseRoomPlayers={supabaseRoomPlayers}
                supabaseEnabled={isSupabaseConfigured(supabaseConfig)}
                addPlayer={addPlayer}
                removePlayer={removePlayer}
                startGame={startGame}
                backToStartScreen={backToStartScreen}
                onOpenStatsPage={openStatsPage}
                availableDeck={availableDeck}
                fullDeck={fullDeck}
                selectedPreset={selectedPreset}
                setSelectedPreset={setSelectedPreset}
                selectedDifficulty={selectedDifficulty}
                setSelectedDifficulty={setSelectedDifficulty}
                selectedGameMode={selectedGameMode}
                setSelectedGameMode={setSelectedGameMode}
                presetDeckCount={presetDeck.length}
                deckEraSummary={getDeckEraSummary(availableDeck)}
                roomCode={roomCode}
                setRoomCode={setRoomCode}
              />

            </main>

            <aside style={{ display: "grid", gap: 16, alignContent: "start", minWidth: 0 }}>
              <RulesCard />
            </aside>
          </div>
        )}

        {gameState.phase === "lobby" && !isSetupHost && (
          <PlayerLobbyWaitingView
            roomCode={roomCode}
            playerName={playerNames[0] || "Spieler"}
            supabaseRoomPlayers={supabaseRoomPlayers}
            syncStatus={syncStatus}
            supabaseStatus={supabaseStatus}
            onBack={() => setShowStartScreen(true)}
            onOpenStatsPage={openStatsPage}
          />
        )}

        {gameState.phase !== "lobby" && gameState.players.length > 0 && (
          <div style={twoColumnLayout}>
            <main style={{ display: "grid", gap: 16, minWidth: 0 }}>
              <Card style={{ minWidth: 0, overflow: "hidden" }}>
                <CardContent style={{ display: "grid", gap: 10, minWidth: 0 }}>
                  <GameHeader
                    activePlayer={activePlayer}
                    deck={gameState.deck}
                    turnNumber={gameState.turnNumber}
                    maxTurns={gameState.maxTurns}
                    targetScore={gameState.targetScore}
                    playLimitSeconds={gameState.playLimitSeconds}
                    difficulty={gameState.difficulty}
                    gameMode={gameState.gameMode}
                    overtime={gameState.overtime}
                    usedTrackCount={(gameState.usedTrackIds || []).length}
                    overtimePendingCount={(gameState.overtimePendingPlayerIds || []).length}
                    activeJokers={getPlayerJokers(activePlayer)}
                  />

                  <CurrentTrackPanel
                    phase={gameState.phase}
                    currentTrack={gameState.currentTrack}
                    showDebugSong={gameState.showDebugSong}
                    canHostControl={viewerPermissions.canHostControl}
                    canDrawTrack={viewerPermissions.canDrawTrack}
                    canPlayTrack={viewerPermissions.canPlayTrack}
                    canUseActiveJoker={viewerPermissions.canUseActiveJoker}
                    activeJokers={getPlayerJokers(activePlayer)}
                    jokerActionBusy={activeJokerBusy}
                    playbackRemainingSeconds={
                      roomPlaybackTimer.trackId === gameState.currentTrack?.id ? roomPlaybackTimer.remainingSeconds : 0
                    }
                    playbackTotalSeconds={gameState.playLimitSeconds}
                    playbackRequester={roomPlaybackTimer.requester}
                    onPlayTrack={handleSongStart}
                    onToggleDebug={() => sendGameAction({ type: "TOGGLE_DEBUG_SONG" })}
                    onDrawTrack={() => sendGameAction({ type: "TRACK_DRAWN" })}
                    onSwapTrack={handleSwapTrackJoker}
                    onAutoCard={handleAutoCardJoker}
                    onSkipTrack={() => sendGameAction({ type: "TRACK_SKIPPED" })}
                  />

                  <JokerActionNotice
                    localFeedback={activeJokerFeedback}
                    latestEvent={gameState.eventHistory?.[0]}
                  />

                  {gameState.phase === "placing" && gameState.currentTrack && (
                    <div
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 18,
                        padding: 10,
                        background: colors.bg,
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <strong>Position gewählt?</strong>
                        <p style={{ color: colors.muted, margin: "4px 0 0", fontSize: 13 }}>
                          Erst bestätigen, danach können andere Spieler einen Joker werfen.
                        </p>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <ActionPill
                          onClick={handleConfirmPlacement}
                          disabled={gameState.selectedInsertIndex === null || !viewerPermissions.canConfirmPlacement}
                          hint="Joker-Fenster öffnen"
                        >
                          Position bestätigen
                        </ActionPill>
                      </div>
                    </div>
                  )}

                  {gameState.phase === "challenge" && gameState.currentTrack && (
                    <JokerChallengePanel
                      gameState={gameState}
                      activePlayer={activePlayer}
                      viewerPlayerId={resolvedViewerPlayerId}
                      canReveal={viewerPermissions.canReveal}
                      canThrowJoker={canPlayerThrowJoker(gameState, resolvedViewerPlayerId)}
                      canResolveTie={viewerPermissions.canResolveJokerTie}
                      onThrowJoker={handleJokerClaim}
                      onStartDuel={handleStartJokerDuel}
                      onDuelChoice={handleJokerDuelChoice}
                      onReveal={handleRevealTrack}
                    />
                  )}

                  <TimelineChooser
                    playerName={getPlayerTurnLabel(activePlayer)}
                    timeline={activeTimeline}
                    phase={gameState.phase}
                    selectedInsertIndex={gameState.selectedInsertIndex}
                    setSelectedInsertIndex={(insertIndex) =>
                      sendGameAction({
                        type: "PLACEMENT_SELECTED",
                        insertIndex,
                      })
                    }
                    canPlace={viewerPermissions.canPlace}
                  />

                  {gameState.lastResult && (
                    <ResultPanel
                      result={gameState.lastResult}
                      timeline={activeTimeline}
                      onNext={handleNextPlayer}
                      canAdvance={viewerPermissions.canAdvance}
                      canAwardJoker={viewerPermissions.canAwardJoker}
                      jokerGuessReviewed={gameState.currentTrackJokerGuessReviewed}
                      jokerGuessAwarded={gameState.currentTrackJokerAwarded}
                      onAwardJoker={handleAwardSongGuessJoker}
                      onDenyJoker={handleClearSongGuessClaim}
                    />
                  )}

                  {gameState.phase === "finished" && (
                    <>
                      <FinishedPanel
                        leaderboard={leaderboard}
                        onNewRound={startNewRound}
                        canNewRound={viewerPermissions.canHostControl}
                      />

                      {isSupabaseConfigured(supabaseConfig) && (
                        <SupabaseStatsSavedNotice status={supabaseStatsStatus} />
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <AllTimelines players={gameState.players} activePlayerIndex={gameState.activePlayerIndex} />
            </main>

            <aside style={{ display: "grid", gap: 16, alignContent: "start", minWidth: 0 }}>
              <LocalRoleCard
                viewerPlayerId={viewerPlayerId}
                setViewerPlayerId={setViewerPlayerId}
                viewerRole={viewerRole}
                permissions={viewerPermissions}
                players={gameState.players}
                roomClients={roomClients}
                clientInstanceId={clientInstanceId}
                roomCode={activeRoomCode}
              />

              <Leaderboard players={leaderboard} />
            </aside>
          </div>
        )}

      </div>
    </div>
  );
}






function StatsPage({ config, status, playerStats = [], gameResults = [], onBack, onRefresh }) {
  const totalGames = gameResults.length;
  const totalCards = playerStats.reduce((sum, row) => sum + Number(row.cards_won || 0), 0);
  const totalWins = playerStats.reduce((sum, row) => sum + Number(row.wins || 0), 0);
  const topPlayer = playerStats[0] || null;

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, color: colors.text, fontFamily: "Inter, system-ui, sans-serif", padding: 18 }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 16 }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <Badge variant={isSupabaseConfigured(config) ? "default" : "secondary"}>Profil & Statistiken</Badge>
            <h1 style={{ margin: "8px 0 4px", fontSize: 38, letterSpacing: -1 }}>Trackline Statistiken</h1>
            <p style={{ margin: 0, color: colors.muted }}>
              Persönliche Werte, letzte Spiele und Joker-Auswertung aus Supabase.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="secondary" onClick={onRefresh}>
              Aktualisieren
            </Button>
            <Button variant="secondary" onClick={onBack}>
              Zurück
            </Button>
          </div>
        </header>

        <Card>
          <CardContent style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
            <InfoTile label="Geladene Spiele" value={`${totalGames}`} />
            <InfoTile label="Spielerprofile" value={`${playerStats.length}`} />
            <InfoTile label="Karten gesamt" value={`${totalCards}`} />
            <InfoTile label="Top-Spieler" value={topPlayer?.display_name || "-"} />
          </CardContent>
        </Card>

        <Card>
          <CardContent style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <strong>Status</strong>
              <Badge variant="secondary">{isSupabaseConfigured(config) ? "Supabase aktiv" : "Supabase fehlt"}</Badge>
            </div>
            <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>{status}</p>
          </CardContent>
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, 0.6fr)", gap: 16 }}>
          <Card>
            <CardContent style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <h2 style={{ margin: 0 }}>Spieler-Ranking</h2>
                <Badge variant="secondary">nach Siegen</Badge>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                  <thead>
                    <tr style={{ color: colors.muted, fontSize: 12, textAlign: "left" }}>
                      <th style={{ padding: "8px 6px" }}>#</th>
                      <th style={{ padding: "8px 6px" }}>Spieler</th>
                      <th style={{ padding: "8px 6px" }}>Spiele</th>
                      <th style={{ padding: "8px 6px" }}>Siege</th>
                      <th style={{ padding: "8px 6px" }}>Karten</th>
                      <th style={{ padding: "8px 6px" }}>Quote</th>
                      <th style={{ padding: "8px 6px" }}>Joker</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playerStats.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: 12, color: colors.muted }}>
                          Noch keine Spielerstatistiken vorhanden.
                        </td>
                      </tr>
                    )}

                    {playerStats.map((row, index) => (
                      <tr key={row.id || row.guest_id || row.display_name} style={{ borderTop: `1px solid ${colors.border}` }}>
                        <td style={{ padding: "10px 6px", fontWeight: 900 }}>{index + 1}</td>
                        <td style={{ padding: "10px 6px", fontWeight: 900 }}>{row.display_name}</td>
                        <td style={{ padding: "10px 6px" }}>{row.games_played || 0}</td>
                        <td style={{ padding: "10px 6px" }}>{row.wins || 0}</td>
                        <td style={{ padding: "10px 6px" }}>{row.cards_won || 0}</td>
                        <td style={{ padding: "10px 6px" }}>{getStatsAccuracy(row)}%</td>
                        <td style={{ padding: "10px 6px", color: colors.muted, fontSize: 12 }}>
                          🃏 +{row.earned_jokers || 0} · 🔄 {row.swap_jokers_used || 0} · 🛡️ {row.secure_card_jokers_used || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent style={{ display: "grid", gap: 12 }}>
              <h2 style={{ margin: 0 }}>Joker-Übersicht</h2>

              {playerStats.slice(0, 8).map((row) => (
                <div
                  key={`joker-${row.id || row.guest_id || row.display_name}`}
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 14,
                    padding: 10,
                    background: colors.bg,
                    display: "grid",
                    gap: 5,
                  }}
                >
                  <strong>{row.display_name}</strong>
                  <span style={{ color: colors.muted, fontSize: 12 }}>
                    Challenge: {row.challenge_jokers_used || 0} genutzt · {row.challenge_jokers_won || 0} gewonnen
                  </span>
                  <span style={{ color: colors.muted, fontSize: 12 }}>
                    Tauschen: {row.swap_jokers_used || 0} · Karte sichern: {row.secure_card_jokers_used || 0} · verdient: {row.earned_jokers || 0}
                  </span>
                </div>
              ))}

              {playerStats.length === 0 && <p style={{ margin: 0, color: colors.muted }}>Noch keine Joker-Statistiken.</p>}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0 }}>Letzte Spiele</h2>
              <Badge variant="secondary">{gameResults.length}</Badge>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {gameResults.length === 0 && <p style={{ margin: 0, color: colors.muted }}>Noch keine gespeicherten Spiele.</p>}

              {gameResults.map((result) => {
                const playerSummary = Array.isArray(result.summary?.players) ? result.summary.players : [];

                return (
                  <div
                    key={result.id}
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: 16,
                      padding: 12,
                      background: colors.bg,
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <strong>Raum {result.room_code || "-"} · Gewinner: {result.winner_name || "-"}</strong>
                      <Badge variant="secondary">{formatStatsDate(result.finished_at)}</Badge>
                    </div>

                    <p style={{ margin: 0, color: colors.muted, fontSize: 12 }}>
                      Modus: {result.game_mode || "-"} · Ziel: {result.target_score || "-"} Karten
                    </p>

                    {playerSummary.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {playerSummary.slice(0, 8).map((player) => (
                          <span
                            key={`${result.id}-${player.name}`}
                            style={{
                              border: `1px solid ${colors.border}`,
                              borderRadius: 999,
                              padding: "5px 8px",
                              color: colors.muted,
                              fontSize: 12,
                            }}
                          >
                            {player.name}: {player.score}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SupabaseStatsSavedNotice({ status }) {
  return (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 18,
        padding: 12,
        background: "rgba(126,87,255,0.10)",
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <div>
        <strong>Supabase-Statistiken</strong>
        <p style={{ margin: "4px 0 0", color: colors.muted, fontSize: 13 }}>{status || "Warte auf Speicherung..."}</p>
      </div>

      <Badge variant="secondary">Phase 4</Badge>
    </div>
  );
}

function PlayerLobbyWaitingView({ roomCode, playerName, supabaseRoomPlayers = [], syncStatus, supabaseStatus, onBack, onOpenStatsPage }) {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 16 }}>
      <Card>
        <CardContent style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              borderRadius: 24,
              padding: 18,
              background: cardTheme.table,
              border: `1px solid ${colors.border}`,
              display: "grid",
              gap: 8,
            }}
          >
            <Badge variant="secondary">Spieler-Lobby</Badge>
            <h2 style={{ fontSize: 32, margin: "4px 0 0", letterSpacing: -0.8 }}>Du bist im Raum {roomCode}</h2>
            <p style={{ color: colors.muted, margin: 0 }}>
              {playerName} ist beigetreten. Warte, bis der Host die Runde vorbereitet und startet.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            <InfoTile label="Raum" value={roomCode || "-"} />
            <InfoTile label="Sync" value={syncStatus || "-"} />
            <InfoTile label="Supabase" value={supabaseStatus || "-"} />
          </div>

          <div style={{ border: `1px solid ${colors.border}`, borderRadius: 16, padding: 12, background: colors.bg, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <strong>Spieler im Raum</strong>
              <Badge variant="secondary">{supabaseRoomPlayers.length}</Badge>
            </div>

            {supabaseRoomPlayers.length === 0 ? (
              <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>Noch keine Supabase-Spielerliste geladen.</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {supabaseRoomPlayers.map((player) => (
                  <span
                    key={`${player.guestId}-${player.displayName}`}
                    style={{
                      border: `1px solid ${player.isHost ? colors.primary : colors.border}`,
                      borderRadius: 999,
                      padding: "8px 11px",
                      background: player.isHost ? "rgba(126,87,255,0.18)" : colors.chip,
                      fontWeight: 850,
                    }}
                  >
                    {player.isHost ? "Host · " : ""}
                    {player.displayName}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="secondary" onClick={onOpenStatsPage}>
              Statistiken
            </Button>
            <Button variant="secondary" onClick={onBack}>
              Zurück zur Startseite
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


function AuthPanel({ session, status, defaultName, onSignUp, onSignIn, onLogout }) {
  const [mode, setMode] = useState("signin");
  const [displayName, setDisplayName] = useState(defaultName || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loggedInName = getAuthDisplayName(session);
  const canSubmit = email.trim() && password.length >= 6 && (mode === "signin" || displayName.trim());

  useEffect(() => {
    if (defaultName && !displayName.trim()) {
      setDisplayName(defaultName);
    }
  }, [defaultName]);

  if (session) {
    return (
      <Card>
        <CardContent style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <Badge>Login aktiv</Badge>
            <h2 style={{ margin: "8px 0 4px", letterSpacing: -0.5 }}>Angemeldet als {loggedInName || getAuthEmail(session)}</h2>
            <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>
              Räume und Statistiken werden mit deinem Profil verknüpft.
            </p>
          </div>

          <Button variant="secondary" onClick={onLogout}>
            Logout
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <Badge variant="secondary">Login optional</Badge>
            <h2 style={{ margin: "8px 0 4px", letterSpacing: -0.5 }}>Profil speichern</h2>
            <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>
              Mit Login bleiben deine Statistiken langfristig deinem Profil zugeordnet. Ohne Login kannst du weiter als Gast spielen.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <Button variant={mode === "signin" ? "primary" : "secondary"} onClick={() => setMode("signin")}>
              Einloggen
            </Button>
            <Button variant={mode === "signup" ? "primary" : "secondary"} onClick={() => setMode("signup")}>
              Registrieren
            </Button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: mode === "signup" ? "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1fr)", gap: 10 }}>
          {mode === "signup" && (
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ color: colors.muted, fontSize: 13 }}>Anzeigename</span>
              <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="z. B. Christoph" />
            </label>
          )}

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ color: colors.muted, fontSize: 13 }}>E-Mail</span>
            <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" type="email" />
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ color: colors.muted, fontSize: 13 }}>Passwort</span>
            <Input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="mind. 6 Zeichen"
              type="password"
              onKeyDown={(event) => {
                if (event.key === "Enter" && canSubmit) {
                  mode === "signin"
                    ? onSignIn?.({ email, password })
                    : onSignUp?.({ email, password, displayName });
                }
              }}
            />
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ color: colors.muted, fontSize: 12 }}>{status || "Gastmodus aktiv."}</span>
          <Button
            onClick={() =>
              mode === "signin"
                ? onSignIn?.({ email, password })
                : onSignUp?.({ email, password, displayName })
            }
            disabled={!canSubmit}
          >
            {mode === "signin" ? "Einloggen" : "Account erstellen"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SupabaseFoundationCard({ config, status, statsStatus, onChange, onTest, compact = false, defaultOpen = false }) {
  const enabled = Boolean(config?.enabled);
  const configured = isSupabaseConfigured(config);
  const title = compact ? "Technische Verbindung" : "System & Supabase";

  return (
    <Card>
      <details open={defaultOpen} style={{ display: "grid" }}>
        <summary
          style={{
            cursor: "pointer",
            listStyle: "none",
            padding: compact ? 12 : 14,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <Badge variant={configured ? "default" : "secondary"}>{configured ? "Supabase aktiv" : "Einrichtung"}</Badge>
            <h2 style={{ margin: "8px 0 4px", letterSpacing: -0.5, fontSize: compact ? 18 : 22 }}>{title}</h2>
            <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>
              {configured
                ? "Verbindung ist automatisch gefüllt. Nur öffnen, wenn etwas nicht funktioniert."
                : "Supabase ist noch nicht vollständig konfiguriert."}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "aktiv" : "aus"}</Badge>
            <Badge variant="secondary">Details</Badge>
          </div>
        </summary>

        <CardContent style={{ display: "grid", gap: compact ? 10 : 14, paddingTop: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr", gap: 10 }}>
            <div style={{ border: `1px solid ${colors.border}`, borderRadius: 14, padding: 10, background: colors.bg }}>
              <span style={{ display: "block", color: colors.muted, fontSize: 12 }}>Verbindung</span>
              <strong style={{ display: "block", marginTop: 4, fontSize: 13 }}>{status || "Nicht verbunden."}</strong>
            </div>

            <div style={{ border: `1px solid ${colors.border}`, borderRadius: 14, padding: 10, background: colors.bg }}>
              <span style={{ display: "block", color: colors.muted, fontSize: 12 }}>Statistiken</span>
              <strong style={{ display: "block", marginTop: 4, fontSize: 13 }}>{statsStatus || "Noch keine Statistik gespeichert."}</strong>
            </div>
          </div>

          <label style={{ display: "flex", gap: 8, alignItems: "center", color: colors.muted, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => onChange?.({ enabled: event.target.checked })}
            />
            Supabase aktivieren
          </label>

          <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "minmax(0, 1fr) minmax(0, 1fr)", gap: 10 }}>
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ color: colors.muted, fontSize: 13 }}>Project URL</span>
              <Input
                value={config?.url || ""}
                onChange={(event) => onChange?.({ url: event.target.value })}
                placeholder="https://xxxxx.supabase.co"
              />
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ color: colors.muted, fontSize: 13 }}>anon public key</span>
              <Input
                value={config?.anonKey || ""}
                onChange={(event) => onChange?.({ anonKey: event.target.value })}
                placeholder="eyJhbGciOi..."
                type="password"
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Button variant="secondary" onClick={onTest}>
              Verbindung testen
            </Button>
            <span style={{ color: colors.muted, fontSize: 12 }}>
              Normalerweise musst du hier nichts ändern. Die Werte kommen über Vercel Environment Variables oder aus dem Einladungslink.
            </span>
          </div>
        </CardContent>
      </details>
    </Card>
  );
}


function StartScreen({ initialRoomCode, initialName, socketUrl, syncStatus, supabaseConfig, supabaseStatus, supabaseStatsStatus, authSession, authStatus, onAuthSignUp, onAuthSignIn, onAuthLogout, onSupabaseConfigChange, onTestSupabase, onOpenStatsPage, onEnter }) {
  const [name, setName] = useState(initialName || "");
  const [joinCode, setJoinCode] = useState(String(initialRoomCode || "").toUpperCase());
  const [createdCode, setCreatedCode] = useState(() => createRoomCode());

  const profileRoomName = getAuthDisplayName(authSession);
  const visibleRoomName = profileRoomName || name;

  function normalizeCode(value) {
    return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  }

  function getPreferredRoomName() {
    return profileRoomName || name;
  }

  function createRoom() {
    const nextCode = normalizeCode(createdCode) || createRoomCode();

    onEnter({
      mode: "create",
      name: getPreferredRoomName(),
      roomCode: nextCode,
    });
  }

  function joinRoom() {
    const nextCode = normalizeCode(joinCode);

    if (!nextCode) {
      window.alert("Bitte gib einen Raumcode ein.");
      return;
    }

    onEnter({
      mode: "join",
      name: getPreferredRoomName(),
      roomCode: nextCode,
    });
  }

  function regenerateCode() {
    setCreatedCode(createRoomCode());
  }

  useEffect(() => {
    if (profileRoomName && name !== profileRoomName) {
      setName(profileRoomName);
    }
  }, [profileRoomName, name]);

  const canContinue = String(visibleRoomName || "").trim().length > 0;

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, color: colors.text, fontFamily: "Inter, system-ui, sans-serif", padding: 18, display: "grid", placeItems: "center" }}>
      <div style={{ width: "min(1040px, 100%)", display: "grid", gap: 18 }}>
        <header style={{ display: "grid", gap: 8, textAlign: "center" }}>
          <Badge variant="secondary">Trackline</Badge>
          <h1 style={{ margin: 0, fontSize: 46, letterSpacing: -1.4 }}>Trackline starten</h1>
          <p style={{ margin: "0 auto", color: colors.muted, maxWidth: 720, lineHeight: 1.5 }}>
            Erstelle einen privaten Raum oder tritt einem bestehenden Raum bei. Spotify bleibt unverändert optional – der Host kann weiterhin manuell, per Discord Stream oder Spotify Jam abspielen.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
            <Button variant="secondary" onClick={onOpenStatsPage}>
              Profil & Statistiken ansehen
            </Button>
          </div>
        </header>

        <AuthPanel
          session={authSession}
          status={authStatus}
          defaultName={visibleRoomName}
          onSignUp={onAuthSignUp}
          onSignIn={onAuthSignIn}
          onLogout={onAuthLogout}
        />

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 16 }}>
          <Card>
            <CardContent style={{ display: "grid", gap: 14 }}>
              <div>
                <Badge>Neuer Raum</Badge>
                <h2 style={{ margin: "8px 0 4px", letterSpacing: -0.5 }}>Raum erstellen</h2>
                <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>
                  Du wirst Host und kannst danach Spieler, Teams und Regeln vorbereiten.
                </p>
              </div>

              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ color: colors.muted, fontSize: 13 }}>Dein Name</span>
                <Input
                  value={visibleRoomName}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="z. B. Christoph"
                  readOnly={Boolean(authSession)}
                  title={authSession ? "Bei Login wird der Profilname verwendet." : ""}
                />
              </label>

              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ color: colors.muted, fontSize: 13 }}>Raumcode</span>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8 }}>
                  <Input value={createdCode} onChange={(event) => setCreatedCode(normalizeCode(event.target.value))} />
                  <Button variant="secondary" onClick={regenerateCode}>
                    Neu
                  </Button>
                </div>
              </label>

              <Button onClick={createRoom} disabled={!canContinue} style={{ padding: "14px 18px" }}>
                Raum erstellen
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent style={{ display: "grid", gap: 14 }}>
              <div>
                <Badge variant="secondary">Beitreten</Badge>
                <h2 style={{ margin: "8px 0 4px", letterSpacing: -0.5 }}>Raum beitreten</h2>
                <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>
                  Gib den Raumcode ein. Falls die Lobby noch vorbereitet wird, kann der Host dich wie bisher als Spieler hinzufügen.
                </p>
              </div>

              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ color: colors.muted, fontSize: 13 }}>Dein Name</span>
                <Input
                  value={visibleRoomName}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="z. B. Alex"
                  readOnly={Boolean(authSession)}
                  title={authSession ? "Bei Login wird der Profilname verwendet." : ""}
                />
              </label>

              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ color: colors.muted, fontSize: 13 }}>Raumcode</span>
                <Input
                  value={joinCode}
                  onChange={(event) => setJoinCode(normalizeCode(event.target.value))}
                  onKeyDown={(event) => event.key === "Enter" && canContinue && joinRoom()}
                  placeholder="ABC123"
                />
              </label>

              <Button onClick={joinRoom} disabled={!canContinue || !normalizeCode(joinCode)} style={{ padding: "14px 18px" }}>
                Raum beitreten
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            <InfoTile label="Online" value="bereit" />
            <InfoTile label="Spielstand" value="Supabase" />
            <InfoTile label="Spotify" value="optional" />
          </CardContent>
        </Card>

        <SupabaseFoundationCard
          compact
          config={supabaseConfig}
          status={supabaseStatus}
          statsStatus={supabaseStatsStatus}
          onChange={onSupabaseConfigChange}
          onTest={onTestSupabase}
        />
      </div>
    </div>
  );
}

function Header({ onReset, onOpenStatsPage, authSession, authStatus, onAuthLogout, isInGame }) {
  return (
    <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: -0.8 }}>Trackline</h1>
        <p style={{ margin: "4px 0 0", color: colors.muted, fontSize: 13 }}>Privates Musik-Timeline-Quiz als Web-Spiel</p>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {authSession && (
          <Badge variant="secondary">{getAuthDisplayName(authSession) || getAuthEmail(authSession)}</Badge>
        )}
        {authSession && onAuthLogout && (
          <Button variant="secondary" onClick={onAuthLogout}>
            Logout
          </Button>
        )}
        {onOpenStatsPage && (
          <Button variant="secondary" onClick={onOpenStatsPage}>
            Statistiken
          </Button>
        )}

        <Button variant="secondary" onClick={onReset}>
          {isInGame ? "Spiel beenden" : "Neustart"}
        </Button>
      </div>
    </header>
  );
}


function HostControlArea({ children, onReset, onOpenStatsPage, authSession, authStatus, onAuthLogout, isInGame }) {
  return (
    <details
      open={!isInGame}
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 20,
        background: "rgba(15,23,42,0.90)",
        overflow: "hidden",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          padding: "12px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          listStyle: "none",
        }}
      >
        <div>
          <strong style={{ fontSize: 18 }}>Host-Bereich</strong>
          <p style={{ margin: "3px 0 0", color: colors.muted, fontSize: 12 }}>
            Link, Spieler, Einstellungen und Spotify. Technisches ist eingeklappt.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Badge variant="secondary">{isInGame ? "Einstellungen" : "Setup"}</Badge>
          <Button variant="secondary" onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onReset();
          }}>
            {isInGame ? "Spiel beenden" : "Neustart"}
          </Button>
        </div>
      </summary>

      <div style={{ display: "grid", gap: 12, padding: "0 12px 12px" }}>
        <Header onReset={onReset} onOpenStatsPage={onOpenStatsPage} authSession={authSession} authStatus={authStatus} onAuthLogout={onAuthLogout} isInGame={isInGame} />
        {children}
      </div>
    </details>
  );
}


function WebsiteShareCard({ room, roomCode, playerNames, socketUrl, syncClientCount = 1, supabaseConfig }) {
  const activeRoomCode = room?.code || roomCode;
  const hostName = room?.hostName || playerNames[0] || "Host";
  const [copied, setCopied] = useState(false);
  const normalizedSocketUrl = String(socketUrl || "").trim().replace(/\/+$/, "");
  const supabaseParams = isSupabaseConfigured(supabaseConfig)
    ? `&supabaseUrl=${encodeURIComponent(normalizeSupabaseUrl(supabaseConfig.url))}&supabaseKey=${encodeURIComponent(supabaseConfig.anonKey)}`
    : "";
  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(activeRoomCode)}&role=player&server=${encodeURIComponent(normalizedSocketUrl)}${supabaseParams}`
      : "";

  async function copyJoinUrl() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card>
      <CardContent style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            borderRadius: 24,
            padding: 18,
            background: cardTheme.table,
            border: `1px solid ${colors.border}`,
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: 16,
            alignItems: "center",
          }}
        >
          <div>
            <Badge variant="secondary">Host</Badge>
            <h2 style={{ margin: "10px 0 6px", letterSpacing: -0.6 }}>Freunde einladen</h2>
            <p style={{ margin: 0, color: colors.muted }}>
              {syncClientCount} verbunden · Host: {hostName} · Raum {activeRoomCode}
            </p>
          </div>

          <Button onClick={copyJoinUrl} style={{ padding: "14px 18px" }}>
            {copied ? "Link kopiert" : "Einladungslink kopieren"}
          </Button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          <InfoTile label="Verbunden" value={`${syncClientCount}`} />
          <InfoTile label="Host" value={hostName} />
          <InfoTile label="Raum" value={activeRoomCode} />
        </div>

        <details style={{ border: `1px solid ${colors.border}`, borderRadius: 16, padding: 14, background: colors.bg }}>
          <summary style={{ cursor: "pointer", fontWeight: 900 }}>Einladungslink anzeigen</summary>
          <p style={{ margin: "10px 0 0", color: colors.muted, wordBreak: "break-all", fontSize: 13 }}>{joinUrl}</p>
          {isSupabaseConfigured(supabaseConfig) && (
            <p style={{ margin: "8px 0 0", color: colors.muted, fontSize: 12 }}>
              Der Link enthält alles Nötige, damit Freunde automatisch in dieser Lobby landen.
            </p>
          )}
        </details>
      </CardContent>
    </Card>
  );
}

function MultiplayerSyncCard({ roomCode, socketUrl, setSocketUrl, syncEnabled, setSyncEnabled, syncStatus, syncClientCount }) {
  return (
    <Card>
      <CardContent style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <Badge variant={syncEnabled ? "default" : "secondary"}>Online bereit</Badge>
            <h2 style={{ margin: "8px 0 4px" }}>Raumstatus</h2>
            <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>
              Spielstand, Lobby und Statistiken laufen über Supabase. Render wird nicht mehr benötigt.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Badge variant={syncEnabled ? "default" : "secondary"}>{syncEnabled ? "Sync aktiv" : "Sync aus"}</Badge>
            <Badge variant="secondary">{syncClientCount} Spieler/Client(s)</Badge>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          <InfoTile label="Raum" value={roomCode} />
          <InfoTile label="Status" value={syncStatus} />
        </div>

        <details style={{ border: `1px solid ${colors.border}`, borderRadius: 14, padding: 10, background: colors.bg }}>
          <summary style={{ cursor: "pointer", fontWeight: 900, listStyle: "none" }}>Technik / Fallback anzeigen</summary>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>
              Nur relevant, wenn du einen alten Render-/Legacy-Fallback testen möchtest. Für den normalen Betrieb ist dieses Feld nicht nötig.
            </p>

            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ color: colors.muted, fontSize: 13 }}>Legacy Server URL</span>
              <Input
                value={socketUrl}
                onChange={(event) => setSocketUrl(event.target.value)}
                placeholder="nicht nötig"
              />
            </label>

            <Button variant={syncEnabled ? "danger" : "primary"} onClick={() => setSyncEnabled(!syncEnabled)} style={{ justifySelf: "start" }}>
              {syncEnabled ? "Sync deaktivieren" : "Sync aktivieren"}
            </Button>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}


function SpotifyPlayerCard({ currentTrack, phase, canPlayTrack, canManageSpotify, roomCode, spotifyAuthServerUrl, roundPlayLimitSeconds = DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS, jamMode = false, setJamMode = () => {}, onPlaybackRequested }) {
  const [clientId] = useState(() => {
    const storedClientId = localStorage.getItem(SPOTIFY_CLIENT_ID_STORAGE_KEY);
    return storedClientId?.trim() || DEFAULT_SPOTIFY_CLIENT_ID;
  });
  const [status, setStatus] = useState("Spotify fuer diesen Raum noch nicht verbunden.");
  const [isBusy, setIsBusy] = useState(false);
  const [playLimitSeconds, setPlayLimitSeconds] = useState(DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [externalLoginUrl, setExternalLoginUrl] = useState("");
  const [externalLoginCopied, setExternalLoginCopied] = useState(false);
  const [serverLoginId, setServerLoginId] = useState("");
  const [serverLoginPending, setServerLoginPending] = useState(false);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyDevices, setSpotifyDevices] = useState([]);
  const [selectedSpotifyDeviceId, setSelectedSpotifyDeviceId] = useState("");
  const [savedDeviceId, setSavedDeviceId] = useState("");
  const [savedDeviceName, setSavedDeviceName] = useState("");
  const [spotifyDetailsOpen, setSpotifyDetailsOpen] = useState(false);

  const countdownIntervalRef = useRef(null);
  const autoPauseTimeoutRef = useRef(null);

  function getSpotifyAuthServerBaseUrl() {
    return String(spotifyAuthServerUrl || "").trim().replace(/\/+$/, "");
  }

  function getSpotifyServerRedirectUri() {
    const baseUrl = getSpotifyAuthServerBaseUrl();

    if (!baseUrl) return "Legacy Spotify/Auth Server fehlt";

    return `${baseUrl}/spotify/callback`;
  }

  function getRoomSpotifyUrl(path = "") {
    const baseUrl = getSpotifyAuthServerBaseUrl();

    if (!baseUrl) {
      throw new Error("Legacy Spotify/Auth Server fehlt.");
    }

    return `${baseUrl}/room/${encodeURIComponent(roomCode)}/spotify${path}`;
  }

  function clearCountdown() {
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    if (autoPauseTimeoutRef.current) {
      window.clearTimeout(autoPauseTimeoutRef.current);
      autoPauseTimeoutRef.current = null;
    }

    setRemainingSeconds(0);
  }

  function scheduleSpotifyAutoPause(seconds) {
    const limitedSeconds = Math.max(1, Math.min(120, Math.round(Number(seconds) || DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS)));

    if (autoPauseTimeoutRef.current) {
      window.clearTimeout(autoPauseTimeoutRef.current);
      autoPauseTimeoutRef.current = null;
    }

    autoPauseTimeoutRef.current = window.setTimeout(async () => {
      try {
        const response = await fetch(getRoomSpotifyUrl("/pause"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jamMode,
          }),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        setStatus(`Spotify nach ${limitedSeconds} Sekunden automatisch pausiert.`);
      } catch (error) {
        setStatus(error.message || "Automatische Spotify-Pause fehlgeschlagen.");
      } finally {
        autoPauseTimeoutRef.current = null;
      }
    }, limitedSeconds * 1000 + 250);
  }

  function startLocalCountdown(seconds) {
    clearCountdown();

    const limitedSeconds = Math.max(1, Math.min(120, Math.round(Number(seconds) || DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS)));
    const startedAt = Date.now();

    setRemainingSeconds(limitedSeconds);

    countdownIntervalRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const next = Math.max(limitedSeconds - elapsed, 0);

      setRemainingSeconds(next);

      if (next <= 0) {
        if (countdownIntervalRef.current) {
          window.clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setRemainingSeconds(0);
      }
    }, 250);
  }

  useEffect(() => {
    function handleExternalPlayRequest() {
      playCurrentTrack();
    }

    window.addEventListener(SPOTIFY_PLAY_EVENT_NAME, handleExternalPlayRequest);

    return () => {
      window.removeEventListener(SPOTIFY_PLAY_EVENT_NAME, handleExternalPlayRequest);
    };
  }, [currentTrack, phase, canPlayTrack, isBusy, roomCode, spotifyAuthServerUrl, playLimitSeconds, selectedSpotifyDeviceId, jamMode]);

  useEffect(() => {
    setPlayLimitSeconds(Math.max(1, Math.min(120, Number(roundPlayLimitSeconds || DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS))));
  }, [roundPlayLimitSeconds]);

  useEffect(() => {
    return () => {
      clearCountdown();
    };
  }, []);

  useEffect(() => {
    if (phase !== "placing" || !currentTrack) {
      clearCountdown();
    }
  }, [phase, currentTrack?.id]);

  useEffect(() => {
    refreshSpotifyStatus({ quiet: true });
  }, [roomCode, spotifyAuthServerUrl]);

  useEffect(() => {
    if (!canManageSpotify) return undefined;

    const intervalId = window.setInterval(() => {
      refreshSpotifyStatus({ quiet: true });
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [canManageSpotify, roomCode, spotifyAuthServerUrl]);

  useEffect(() => {
    if (!serverLoginId || !serverLoginPending) return;

    const baseUrl = getSpotifyAuthServerBaseUrl();
    if (!baseUrl) return;

    let cancelled = false;

    async function pollServerLogin() {
      try {
        const response = await fetch(`${baseUrl}/spotify/token/${encodeURIComponent(serverLoginId)}`);

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const data = await response.json();

        if (cancelled) return;

        if (data.status === "ready") {
          setServerLoginPending(false);
          setServerLoginId("");
          setExternalLoginUrl("");
          setSpotifyConnected(true);
          setStatus("Spotify Host-Account ist fuer diesen Raum verbunden. Jetzt Geraete laden und Zielgeraet speichern.");
          await refreshSpotifyDevices();
        } else if (data.status === "error") {
          setServerLoginPending(false);
          setStatus(data.message || "Spotify Login ist serverseitig fehlgeschlagen.");
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(error.message || "Spotify Login-Status konnte nicht abgefragt werden.");
        }
      }
    }

    pollServerLogin();
    const intervalId = window.setInterval(pollServerLogin, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [serverLoginId, serverLoginPending, spotifyAuthServerUrl]);

  async function refreshSpotifyStatus(options = {}) {
    const { quiet = false } = options;

    try {
      const response = await fetch(getRoomSpotifyUrl("/status"));

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();

      setSpotifyConnected(Boolean(data.connected));
      setSavedDeviceId(data.deviceId || "");
      setSavedDeviceName(data.deviceName || "");

      if (data.deviceId && !selectedSpotifyDeviceId) {
        setSelectedSpotifyDeviceId(data.deviceId);
      }

      if (!quiet) {
        setStatus(
          data.connected
            ? data.deviceName
              ? `Spotify verbunden, Zielgeraet: ${data.deviceName}.`
              : "Spotify verbunden, aber noch kein Zielgeraet gespeichert."
            : "Spotify ist fuer diesen Raum noch nicht verbunden."
        );
      }

      return data;
    } catch (error) {
      if (!quiet) {
        setStatus(error.message || "Spotify Status konnte nicht geladen werden.");
      }

      return null;
    }
  }

  async function createServerSpotifyLogin() {
    const baseUrl = getSpotifyAuthServerBaseUrl();

    if (!baseUrl) {
      throw new Error("Bitte zuerst eine Legacy Spotify/Auth Server eintragen.");
    }

    const response = await fetch(`${baseUrl}/spotify/create-login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clientId: (clientId || DEFAULT_SPOTIFY_CLIENT_ID).trim(),
        roomCode,
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  }

  async function handleLogin() {
    try {
      setExternalLoginUrl("");
      setExternalLoginCopied(false);
      setStatus("Spotify Host-Login wird ueber den Trackline-Server vorbereitet...");

      const login = await createServerSpotifyLogin();

      setServerLoginId(login.loginId);
      setExternalLoginUrl(login.authorizeUrl);
      setServerLoginPending(true);
      setStatus("Spotify Login-Link ist bereit. Host meldet sich an; danach ist Spotify fuer den Raum verbunden.");
    } catch (error) {
      setStatus(error.message || "Spotify Login konnte nicht gestartet werden.");
    }
  }

  async function copyExternalLoginUrl() {
    if (!externalLoginUrl) return;

    try {
      await navigator.clipboard.writeText(externalLoginUrl);
      setExternalLoginCopied(true);
      window.setTimeout(() => setExternalLoginCopied(false), 1200);
    } catch {
      setExternalLoginCopied(false);
    }
  }

  async function refreshSpotifyDevices() {
    try {
      setIsBusy(true);
      setStatus("Spotify-Geraete werden geladen...");

      const response = await fetch(getRoomSpotifyUrl("/devices"));

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      const devices = Array.isArray(data.devices) ? data.devices : [];

      setSpotifyDevices(devices);

      const savedDevice = devices.find((device) => device.id === data.deviceId);
      const activeDevice = devices.find((device) => device.is_active);
      const fallbackDevice = savedDevice || activeDevice || devices[0];

      if (fallbackDevice?.id) {
        setSelectedSpotifyDeviceId(fallbackDevice.id);
      }

      setSavedDeviceId(data.deviceId || savedDevice?.id || "");
      setSavedDeviceName(data.deviceName || savedDevice?.name || "");

      setStatus(
        devices.length
          ? `${devices.length} Spotify-Geraet(e) gefunden. Zielgeraet auswaehlen und speichern.`
          : "Kein Spotify-Geraet gefunden. Oeffne Spotify Desktop/Web/Handy einmal und starte dort kurz irgendeinen Song."
      );
    } catch (error) {
      setStatus(error.message || "Spotify-Geraete konnten nicht geladen werden.");
    } finally {
      setIsBusy(false);
    }
  }

  async function saveSpotifyDevice() {
    if (!selectedSpotifyDeviceId) {
      setStatus("Bitte zuerst ein Spotify-Geraet auswaehlen.");
      return;
    }

    const selectedDevice = spotifyDevices.find((device) => device.id === selectedSpotifyDeviceId);

    try {
      setIsBusy(true);

      const response = await fetch(getRoomSpotifyUrl("/device"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceId: selectedSpotifyDeviceId,
          deviceName: selectedDevice?.name || "Spotify-Geraet",
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setSavedDeviceId(selectedSpotifyDeviceId);
      setSavedDeviceName(selectedDevice?.name || "Spotify-Geraet");
      setStatus(`Zielgeraet gespeichert: ${selectedDevice?.name || "Spotify-Geraet"}.`);
    } catch (error) {
      setStatus(error.message || "Spotify-Geraet konnte nicht gespeichert werden.");
    } finally {
      setIsBusy(false);
    }
  }

  async function playCurrentTrack() {
    if (phase !== "placing") {
      setStatus("Spotify kann erst starten, nachdem ein Song gezogen wurde.");
      return;
    }

    if (!canPlayTrack) {
      setStatus("Deine aktuelle Rolle darf den Song nicht starten.");
      return;
    }

    if (!currentTrack) {
      setStatus("Kein Song gezogen.");
      return;
    }

    try {
      setIsBusy(true);
      setStatus(
        jamMode
          ? "Spotify-Helfer startet den aktuellen Supabase-Song im aktiven Spotify/Jam-Kontext..."
          : "Spotify-Helfer startet den aktuellen Supabase-Song auf dem gespeicherten Spotify-Geraet..."
      );

      const response = await fetch(getRoomSpotifyUrl("/play"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playLimitSeconds,
          track: currentTrack,
          jamMode,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      setSpotifyConnected(true);
      if (!jamMode) {
        setSavedDeviceId(data.deviceId || savedDeviceId);
        setSavedDeviceName(data.deviceName || savedDeviceName);
      }
      startLocalCountdown(playLimitSeconds);
      scheduleSpotifyAutoPause(playLimitSeconds);
      setStatus(
        jamMode
          ? `Verdeckter Song laeuft im aktiven Spotify/Jam-Kontext. TimeLimit: ${playLimitSeconds} Sekunden.`
          : `Verdeckter Song laeuft auf ${data.deviceName || "Spotify"}. TimeLimit: ${playLimitSeconds} Sekunden.`
      );
      onPlaybackRequested?.();
    } catch (error) {
      setStatus(error.message || "Spotify Wiedergabe fehlgeschlagen.");
    } finally {
      setIsBusy(false);
    }
  }

  async function pauseSpotify() {
    try {
      setIsBusy(true);
      clearCountdown();

      const response = await fetch(getRoomSpotifyUrl("/pause"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jamMode,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setStatus("Spotify pausiert.");
    } catch (error) {
      setStatus(error.message || "Pause fehlgeschlagen.");
    } finally {
      setIsBusy(false);
    }
  }

  const canStartSpotify = Boolean(currentTrack && phase === "placing" && canPlayTrack && !isBusy);
  const selectedDevice = spotifyDevices.find((device) => device.id === selectedSpotifyDeviceId);
  const hasPlayableSpotifyTarget = jamMode || Boolean(savedDeviceName);
  const spotifyTargetLabel = jamMode ? "Jam-Modus / aktiver Spotify-Kontext" : savedDeviceName;
  const showSpotifyDetails = !spotifyConnected || (!hasPlayableSpotifyTarget && !jamMode) || spotifyDetailsOpen || Boolean(externalLoginUrl);

  return (
    <Card>
      <CardContent style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <Badge variant="secondary">Spotify</Badge>
            <h2 style={{ margin: "10px 0 6px" }}>Ein Host-Account fuer den Raum</h2>
            <p style={{ margin: 0, color: colors.muted }}>
              Der Host verbindet Spotify in der Lobby oder im Spiel. Im Normalmodus wird ein Zielgeraet gespeichert; im Jam-Modus nutzt Trackline den aktiven Spotify/Jam-Kontext.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Badge variant={spotifyConnected ? "default" : "secondary"}>{spotifyConnected ? "Host Spotify verbunden" : "Nicht verbunden"}</Badge>
            <Badge variant={jamMode ? "default" : savedDeviceName ? "default" : "secondary"}>{jamMode ? "Jam-Modus" : savedDeviceName || "Kein Zielgeraet"}</Badge>
          </div>
        </div>

        {canManageSpotify && spotifyConnected && hasPlayableSpotifyTarget && (
          <div
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 18,
              padding: 14,
              background: colors.bg,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong>Spotify bereit</strong>
              <p style={{ margin: "4px 0 0", color: colors.muted, fontSize: 13 }}>
                {jamMode
                  ? "Jam-Modus: nutzt den aktuell aktiven Spotify/Jam-Kontext des Host-Accounts."
                  : <>Zielgeraet: {savedDeviceName}{savedDeviceId ? ` · ${savedDeviceId.slice(0, 6)}…` : ""}</>}
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="secondary" onClick={() => refreshSpotifyStatus()} disabled={isBusy}>
                Status prüfen
              </Button>
              <Button variant="secondary" onClick={() => setSpotifyDetailsOpen((value) => !value)}>
                {spotifyDetailsOpen ? "Spotify-Details ausblenden" : "Gerät / Login ändern"}
              </Button>
            </div>
          </div>
        )}

        {canManageSpotify && spotifyConnected && !savedDeviceName && !jamMode && (
          <div
            style={{
              border: "1px solid #f59e0b",
              borderRadius: 18,
              padding: 14,
              background: "rgba(245,158,11,0.12)",
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong>Spotify verbunden, aber kein Zielgeraet gespeichert</strong>
              <p style={{ margin: "4px 0 0", color: "#fde68a", fontSize: 13 }}>
                Öffne Spotify einmal auf dem Host-Geraet, lade die Geraete und speichere das richtige Zielgeraet.
              </p>
            </div>

            <Button variant="secondary" onClick={refreshSpotifyDevices} disabled={isBusy}>
              Geraete laden
            </Button>
          </div>
        )}

        {canManageSpotify && showSpotifyDetails && (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", gap: 10, alignItems: "center" }}>
              <div style={{ border: `1px solid ${colors.border}`, borderRadius: 16, padding: 14, background: colors.bg }}>
                <p style={{ margin: "0 0 6px", fontWeight: 800 }}>Spotify Host-Login</p>
                <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>
                  Spotify Client ID ist vorkonfiguriert. Der Host meldet sich einmal an; Spieler brauchen keinen Spotify-Account.
                </p>
              </div>

              <Button variant="secondary" onClick={handleLogin} disabled={isBusy}>
                Spotify neu verbinden
              </Button>

              <Button variant="secondary" onClick={() => refreshSpotifyStatus()} disabled={isBusy}>
                Status prüfen
              </Button>
            </div>

            {externalLoginUrl && (
              <div
                style={{
                  border: `2px solid ${colors.primary}`,
                  borderRadius: 18,
                  padding: 16,
                  background: colors.panelSoft,
                  display: "grid",
                  gap: 12,
                }}
              >
                <div>
                  <Badge variant="default">Spotify Login wartet</Badge>
                  <h3 style={{ margin: "10px 0 6px" }}>Spotify Host-Anmeldung abschliessen</h3>
                  <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>
                    Klicke auf den Login-Button, melde dich mit dem Host-Premium-Account an und kehre danach zu Trackline zurueck.
                  </p>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <a
                    href={externalLoginUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: `1px solid ${colors.primary}`,
                      borderRadius: 16,
                      padding: "12px 16px",
                      background: colors.primary,
                      color: colors.primaryText,
                      fontWeight: 900,
                      textDecoration: "none",
                    }}
                  >
                    Spotify Login oeffnen
                  </a>

                  <Button variant="secondary" onClick={copyExternalLoginUrl}>
                    {externalLoginCopied ? "Kopiert" : "Login-Link kopieren"}
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => {
                      setExternalLoginUrl("");
                      setServerLoginPending(false);
                      setServerLoginId("");
                      setStatus("Spotify Login abgebrochen.");
                    }}
                  >
                    Abbrechen
                  </Button>
                </div>

                {serverLoginPending && (
                  <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>
                    Warte auf Spotify Login... Trackline prueft alle 2 Sekunden den Server.
                  </p>
                )}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", gap: 10, alignItems: "end" }}>
              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ color: colors.muted, fontSize: 14 }}>Spotify-Zielgeraet fuer diese Runde</span>
                <Select value={selectedSpotifyDeviceId} onChange={(event) => setSelectedSpotifyDeviceId(event.target.value)}>
                  <option value="">Geraet auswaehlen</option>

                  {spotifyDevices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name} {device.is_active ? "(aktiv)" : ""}
                    </option>
                  ))}
                </Select>
              </label>

              <Button variant="secondary" onClick={refreshSpotifyDevices} disabled={isBusy || !spotifyConnected}>
                Geraete laden
              </Button>

              <Button onClick={saveSpotifyDevice} disabled={isBusy || !selectedSpotifyDeviceId}>
                Zielgeraet speichern
              </Button>
            </div>
          </div>
        )}

        <div
          style={{
            border: `1px solid ${jamMode ? colors.primary : colors.border}`,
            borderRadius: 18,
            padding: 14,
            background: jamMode ? "rgba(34,197,94,0.10)" : colors.bg,
            display: "grid",
            gap: 10,
          }}
        >
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={jamMode}
              onChange={(event) => setJamMode(Boolean(event.target.checked))}
              style={{ marginTop: 3 }}
            />
            <span>
              <strong>Spotify Jam-Modus verwenden</strong>
              <span style={{ display: "block", color: colors.muted, fontSize: 13, marginTop: 4 }}>
                Für Spotify Jam: Jam vorher in Spotify starten, Mitspieler joinen lassen und kurz prüfen, dass ein manuell gestarteter Song bei allen läuft.
                Trackline erzwingt dann kein Zielgerät und startet den Song im aktiven Spotify/Jam-Kontext.
              </span>
            </span>
          </label>

          {jamMode && (
            <p style={{ margin: 0, color: "#bbf7d0", fontSize: 13 }}>
              Hinweis: Wenn Spotify meldet, dass kein aktives Gerät vorhanden ist, starte in Spotify einmal manuell irgendeinen Song im Jam und drücke danach erneut „Song starten“.
            </p>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "180px minmax(0, 1fr)", gap: 10, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ color: colors.muted, fontSize: 14 }}>TimeLimit in Sekunden</span>
            <Input
              type="number"
              min="1"
              max="120"
              value={playLimitSeconds}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                setPlayLimitSeconds(Number.isFinite(nextValue) ? Math.max(1, Math.min(120, nextValue)) : DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS);
              }}
            />
          </label>

          <div style={{ border: `1px solid ${colors.border}`, borderRadius: 16, padding: 14, background: colors.bg }}>
            <p style={{ margin: 0, color: colors.muted }}>
              {remainingSeconds > 0 ? `${remainingSeconds} Sekunden verbleibend` : `Aktuelles Limit: ${playLimitSeconds} Sekunden pro Start`}
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", gap: 10, alignItems: "center" }}>
          <div style={{ border: `1px solid ${colors.border}`, borderRadius: 16, padding: 14, background: colors.bg }}>
            <p style={{ margin: "0 0 8px", color: colors.text, fontWeight: 800 }}>Status</p>
            <p style={{ margin: 0, color: colors.muted }}>{status}</p>
            <p style={{ margin: "6px 0 0", color: colors.muted, fontSize: 12 }}>
              Raum: {roomCode} | Spotify-Ziel: {spotifyTargetLabel || selectedDevice?.name || "-"}
            </p>
            <p style={{ margin: "6px 0 0", color: colors.muted, fontSize: 12 }}>
              Redirect URI fuer Spotify Dashboard: {getSpotifyServerRedirectUri()}
            </p>
          </div>

          <Button onClick={playCurrentTrack} disabled={!canStartSpotify}>
            {isBusy ? "Startet..." : jamMode ? `Jam-Song ${playLimitSeconds}s starten` : `Song ${playLimitSeconds}s starten`}
          </Button>

          <Button variant="secondary" onClick={pauseSpotify} disabled={isBusy || !spotifyConnected}>
            Pause
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoTile({ label, value }) {
  return (
    <div style={{ border: `1px solid ${colors.border}`, borderRadius: 16, padding: 12, background: colors.bg }}>
      <span style={{ display: "block", color: colors.muted, fontSize: 12 }}>{label}</span>
      <strong style={{ fontSize: 18 }}>{value || "-"}</strong>
    </div>
  );
}

function LobbyCard({
  playerName,
  setPlayerName,
  playerNames,
  supabaseRoomPlayers = [],
  supabaseEnabled = false,
  addPlayer,
  removePlayer,
  startGame,
  backToStartScreen,
  onOpenStatsPage,
  availableDeck,
  fullDeck,
  selectedPreset,
  setSelectedPreset,
  selectedDifficulty,
  setSelectedDifficulty,
  selectedGameMode,
  setSelectedGameMode,
  presetDeckCount,
  deckEraSummary,
  roomCode,
  setRoomCode,
}) {
  const [targetScore, setTargetScore] = useState(10);
  const [maxTurns, setMaxTurns] = useState(0);
  const [playLimitSeconds, setPlayLimitSeconds] = useState(DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS);
  const [startPlayerName, setStartPlayerName] = useState(playerNames[0] || "");
  const [teamCount, setTeamCount] = useState(2);
  const [teamNames, setTeamNames] = useState(["Team 1", "Team 2", "Team 3", "Team 4"]);
  const [teamAssignments, setTeamAssignments] = useState({});
  const targetScoreOptions = [5, 7, 10, 15];

  useEffect(() => {
    if (!playerNames.length) return;
    if (!playerNames.includes(startPlayerName)) setStartPlayerName(playerNames[0]);
  }, [playerNames, startPlayerName]);

  useEffect(() => {
    setTeamAssignments((previous) => {
      const next = {};

      playerNames.forEach((name, index) => {
        const previousValue = Number(previous[name]);
        next[name] = Number.isInteger(previousValue) && previousValue >= 0 && previousValue < teamCount ? previousValue : index % teamCount;
      });

      return next;
    });
  }, [playerNames, teamCount]);

  return (
    <Card>
      <CardContent style={{ display: "grid", gap: 18 }}>
        <div
          style={{
            borderRadius: 24,
            padding: 18,
            background: cardTheme.table,
            border: `1px solid ${colors.border}`,
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Badge variant="secondary">Lobby</Badge>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="secondary" onClick={onOpenStatsPage} style={{ padding: "7px 10px", borderRadius: 12 }}>
                Statistiken
              </Button>
              <Button variant="secondary" onClick={backToStartScreen} style={{ padding: "7px 10px", borderRadius: 12 }}>
                Zur Startseite
              </Button>
            </div>
          </div>
          <h2 style={{ fontSize: 30, margin: "4px 0 0", letterSpacing: -0.8 }}>Runde vorbereiten</h2>
          <p style={{ color: colors.muted, margin: 0 }}>
            Spieler hinzufügen, Ziel festlegen und dann die erste verdeckte Karte ziehen.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}>
          <Input
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && addPlayer()}
            placeholder="Spielername"
          />
          <Button onClick={addPlayer}>Hinzufuegen</Button>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <strong>Spieler</strong>
            <Badge variant="secondary">{playerNames.length}</Badge>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {playerNames.map((name, index) => (
              <button
                key={name}
                onClick={() => removePlayer(name)}
                style={{
                  border: `1px solid ${index === 0 ? colors.primary : colors.border}`,
                  borderRadius: 999,
                  background: index === 0 ? "rgba(126,87,255,0.18)" : colors.chip,
                  color: colors.text,
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontWeight: 850,
                }}
                title="Klicken zum Entfernen"
              >
                {index === 0 ? "Host · " : ""}
                {name}
              </button>
            ))}
          </div>
        </div>

        {supabaseEnabled && (
          <div
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 16,
              padding: 12,
              background: "rgba(126,87,255,0.10)",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <strong>Auto-Join über Supabase</strong>
              <Badge variant="secondary">{supabaseRoomPlayers.length} verbunden</Badge>
            </div>

            <p style={{ margin: 0, color: colors.muted, fontSize: 12 }}>
              Spieler, die auf der Startseite diesem Raum beitreten, werden automatisch in diese Lobby-Liste übernommen.
            </p>

            {supabaseRoomPlayers.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {supabaseRoomPlayers.map((player) => (
                  <span
                    key={`${player.guestId}-${player.displayName}`}
                    style={{
                      border: `1px solid ${player.isHost ? colors.primary : colors.border}`,
                      borderRadius: 999,
                      padding: "6px 9px",
                      background: player.isHost ? "rgba(126,87,255,0.18)" : colors.bg,
                      fontSize: 12,
                      fontWeight: 850,
                    }}
                  >
                    {player.isHost ? "Host · " : ""}
                    {player.displayName}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ color: colors.muted, fontSize: 14 }}>Startspieler</span>
          <Select value={startPlayerName} onChange={(event) => setStartPlayerName(event.target.value)}>
            {playerNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </label>

        <div style={{ display: "grid", gap: 8 }}>
          <span style={{ color: colors.muted, fontSize: 14 }}>Spielmodus</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            {GAME_MODE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedGameMode(option.id)}
                disabled={option.id === "teams" && playerNames.length < 2}
                style={{
                  border: `1px solid ${selectedGameMode === option.id ? colors.primary : colors.border}`,
                  borderRadius: 16,
                  padding: "11px 10px",
                  background: selectedGameMode === option.id ? "rgba(126,87,255,0.22)" : colors.bg,
                  color: colors.text,
                  cursor: option.id === "teams" && playerNames.length < 2 ? "not-allowed" : "pointer",
                  fontWeight: 950,
                  opacity: option.id === "teams" && playerNames.length < 2 ? 0.45 : 1,
                  boxShadow: selectedGameMode === option.id ? "0 0 0 4px rgba(126,87,255,0.12)" : "none",
                }}
                title={option.description}
              >
                {option.label}
              </button>
            ))}
          </div>

          {selectedGameMode === "teams" && (
            <div style={{ display: "grid", gap: 10, border: `1px solid ${colors.border}`, borderRadius: 18, padding: 12, background: colors.bg }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <strong>Teams einteilen</strong>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[2, 3, 4].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setTeamCount(count)}
                      disabled={playerNames.length < count}
                      style={{
                        border: `1px solid ${teamCount === count ? colors.primary : colors.border}`,
                        borderRadius: 999,
                        padding: "7px 10px",
                        background: teamCount === count ? "rgba(126,87,255,0.22)" : colors.panel,
                        color: colors.text,
                        cursor: playerNames.length < count ? "not-allowed" : "pointer",
                        opacity: playerNames.length < count ? 0.45 : 1,
                        fontWeight: 900,
                      }}
                    >
                      {count} Teams
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: `repeat(${teamCount}, minmax(0, 1fr))`, gap: 8 }}>
                {Array.from({ length: teamCount }, (_, index) => (
                  <Input
                    key={`team-name-${index}`}
                    value={teamNames[index] || `Team ${index + 1}`}
                    onChange={(event) =>
                      setTeamNames((previous) => {
                        const next = [...previous];
                        next[index] = event.target.value;
                        return next;
                      })
                    }
                    placeholder={`Team ${index + 1}`}
                  />
                ))}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {playerNames.map((name, index) => (
                  <div key={`assignment-${name}`} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 180px", gap: 8, alignItems: "center" }}>
                    <span style={{ fontWeight: 800 }}>{name}</span>
                    <Select
                      value={teamAssignments[name] ?? index % teamCount}
                      onChange={(event) =>
                        setTeamAssignments((previous) => ({
                          ...previous,
                          [name]: Number(event.target.value),
                        }))
                      }
                    >
                      {Array.from({ length: teamCount }, (_, teamIndex) => (
                        <option key={`${name}-team-${teamIndex}`} value={teamIndex}>
                          {teamNames[teamIndex] || `Team ${teamIndex + 1}`}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: `repeat(${teamCount}, minmax(0, 1fr))`, gap: 8 }}>
                {splitIntoTeams(playerNames, { teamCount, teamNames, assignments: teamAssignments }).map((team, index) => (
                  <div key={`team-preview-${index}`} style={{ border: `1px solid ${colors.border}`, borderRadius: 14, padding: 10, background: colors.panel }}>
                    <strong>{team.name}</strong>
                    <p style={{ margin: "4px 0 0", color: colors.muted, fontSize: 12 }}>{team.members.join(", ") || "-"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ color: colors.muted, fontSize: 14 }}>Raumcode</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <Input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase().slice(0, 8))} />
              <Button variant="secondary" onClick={() => setRoomCode(createRoomCode())}>
                Neu
              </Button>
            </div>
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ color: colors.muted, fontSize: 14 }}>Deck</span>
            <Select value={selectedPreset} onChange={(event) => setSelectedPreset(event.target.value)}>
              {DECK_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr 1fr", gap: 12 }}>
          <div style={{ border: `1px solid ${colors.border}`, borderRadius: 18, padding: "12px 14px", background: colors.bg }}>
            <span style={{ display: "block", color: colors.muted, fontSize: 12 }}>Aktives Deck</span>
            <strong>{availableDeck.length} Songs</strong>
            <p style={{ margin: "4px 0 0", color: colors.muted, fontSize: 11 }}>
              {presetDeckCount} vor Schwierigkeit · Dubletten entfernt · Epochen gemischt
            </p>
            {deckEraSummary && (
              <p style={{ margin: "4px 0 0", color: colors.muted, fontSize: 10, lineHeight: 1.25 }}>
                {deckEraSummary}
              </p>
            )}
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <span style={{ color: colors.muted, fontSize: 14 }}>Ziel-Karten</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
              {targetScoreOptions.map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => setTargetScore(score)}
                  style={{
                    border: `1px solid ${targetScore === score ? colors.primary : colors.border}`,
                    borderRadius: 16,
                    padding: "11px 10px",
                    background: targetScore === score ? "rgba(126,87,255,0.22)" : colors.bg,
                    color: colors.text,
                    cursor: "pointer",
                    fontWeight: 950,
                    boxShadow: targetScore === score ? "0 0 0 4px rgba(126,87,255,0.12)" : "none",
                  }}
                >
                  {score}
                </button>
              ))}
            </div>
          </div>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ color: colors.muted, fontSize: 14 }}>Max. Zuege</span>
            <Input type="number" min="0" max="99" value={maxTurns} onChange={(event) => setMaxTurns(Number(event.target.value))} />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <span style={{ color: colors.muted, fontSize: 14 }}>Songzeit</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
              {PLAY_LIMIT_OPTIONS.map((seconds) => (
                <button
                  key={seconds}
                  type="button"
                  onClick={() => setPlayLimitSeconds(seconds)}
                  style={{
                    border: `1px solid ${playLimitSeconds === seconds ? colors.primary : colors.border}`,
                    borderRadius: 16,
                    padding: "11px 10px",
                    background: playLimitSeconds === seconds ? "rgba(126,87,255,0.22)" : colors.bg,
                    color: colors.text,
                    cursor: "pointer",
                    fontWeight: 950,
                    boxShadow: playLimitSeconds === seconds ? "0 0 0 4px rgba(126,87,255,0.12)" : "none",
                  }}
                >
                  {seconds}s
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <span style={{ color: colors.muted, fontSize: 14 }}>Schwierigkeit</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
              {DIFFICULTY_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedDifficulty(option.id)}
                  style={{
                    border: `1px solid ${selectedDifficulty === option.id ? colors.primary : colors.border}`,
                    borderRadius: 16,
                    padding: "11px 10px",
                    background: selectedDifficulty === option.id ? "rgba(126,87,255,0.22)" : colors.bg,
                    color: colors.text,
                    cursor: "pointer",
                    fontWeight: 950,
                    boxShadow: selectedDifficulty === option.id ? "0 0 0 4px rgba(126,87,255,0.12)" : "none",
                  }}
                  title={option.description}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Button onClick={() => startGame({
            targetScore,
            maxTurns,
            playLimitSeconds,
            startPlayerName,
            gameMode: selectedGameMode,
            teamConfig: selectedGameMode === "teams" ? { teamCount, teamNames, assignments: teamAssignments } : null,
          })} disabled={playerNames.length < 1 || availableDeck.length < 1} style={{ padding: "14px 22px", fontSize: 16 }}>
          Spiel starten
        </Button>
      </CardContent>
    </Card>
  );
}

function DeckBuilder({ customTracks, addCustomTrack, removeCustomTrack, clearCustomTracks, importCustomTracks, exportCustomTracks, availableDeck }) {
  const [form, setForm] = useState({
    title: "",
    artist: "",
    year: "",
    genre: "Pop",
    spotifyUri: "",
  });

  const [importText, setImportText] = useState("");
  const [importMode, setImportMode] = useState("append");
  const [importMessage, setImportMessage] = useState("");

  function updateField(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function submitTrack() {
    const added = addCustomTrack(form);

    if (added) {
      setForm({
        title: "",
        artist: "",
        year: "",
        genre: "Pop",
        spotifyUri: "",
      });
    }
  }

  function submitImport() {
    const result = importCustomTracks(importText, importMode);

    setImportMessage(result.message);

    if (result.ok) {
      setImportText("");
    }
  }

  return (
    <Card>
      <CardContent style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: "0 0 6px" }}>Eigene Songs ergaenzen</h3>
            <p style={{ margin: 0, color: colors.muted }}>Diese Songs werden dem Deck fuer die naechste Partie hinzugefuegt.</p>
          </div>

          <Badge variant="secondary">{availableDeck.length} aktive Songs</Badge>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 0.6fr 0.8fr", gap: 10 }}>
          <Input value={form.title} onChange={(event) => updateField("title", event.target.value)} placeholder="Titel" />
          <Input value={form.artist} onChange={(event) => updateField("artist", event.target.value)} placeholder="Artist" />
          <Input value={form.year} onChange={(event) => updateField("year", event.target.value)} placeholder="Jahr" type="number" />

          <Select value={form.genre} onChange={(event) => updateField("genre", event.target.value)}>
            <option>Pop</option>
            <option>Rock</option>
            <option>Hip-Hop</option>
            <option>R&B</option>
            <option>Dance</option>
            <option>Indie</option>
            <option>Custom</option>
          </Select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
          <Input value={form.spotifyUri} onChange={(event) => updateField("spotifyUri", event.target.value)} placeholder="Optional fuer spaeter: spotify:track:..." />
          <Button onClick={submitTrack} disabled={!isValidTrackForm(form)}>
            Song hinzufuegen
          </Button>
        </div>

        <div style={{ display: "grid", gap: 12, borderTop: `1px solid ${colors.border}`, paddingTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <h4 style={{ margin: "0 0 4px" }}>Import / Export</h4>
              <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>
                JSON oder CSV einfuegen. CSV-Header: title,artist,year,genre,spotifyUri
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="secondary" onClick={exportCustomTracks} disabled={customTracks.length === 0}>
                Export JSON
              </Button>

              <Button variant="danger" onClick={clearCustomTracks} disabled={customTracks.length === 0}>
                Alle loeschen
              </Button>
            </div>
          </div>

          <textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder={CSV_EXAMPLE_PLACEHOLDER}
            rows={5}
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: `1px solid ${colors.border}`,
              borderRadius: 16,
              padding: 12,
              background: colors.bg,
              color: colors.text,
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
            <Select value={importMode} onChange={(event) => setImportMode(event.target.value)}>
              <option value="append">Import anhaengen</option>
              <option value="replace">Custom-Deck ersetzen</option>
            </Select>

            <Button onClick={submitImport} disabled={!importText.trim()}>
              Importieren
            </Button>
          </div>

          {importMessage && <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>{importMessage}</p>}
        </div>

        {customTracks.length > 0 && (
          <div style={{ display: "grid", gap: 8 }}>
            {customTracks.map((track) => (
              <div
                key={track.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "center",
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 14,
                  padding: 10,
                }}
              >
                <span style={{ color: colors.muted }}>
                  {track.year} - <strong style={{ color: colors.text }}>{track.title}</strong> - {track.artist}
                </span>

                <Button variant="danger" onClick={() => removeCustomTrack(track.id)} style={{ padding: "6px 10px", borderRadius: 12 }}>
                  Entfernen
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RulesCard() {
  return (
    <Card>
      <CardContent>
        <h3 style={{ marginTop: 0 }}>Regelablauf</h3>
        <ol style={{ color: colors.muted, lineHeight: 1.7, paddingLeft: 22 }}>
          <li>Jeder bekommt eine offene Startkarte als Referenz.</li>
          <li>Reihum ist genau ein Spieler aktiv.</li>
          <li>Ein verdeckter Song wird gezogen.</li>
          <li>Der aktive Spieler legt ihn in seine Timeline.</li>
          <li>Beim Reveal wird geprueft: richtig einsortiert oder falsch.</li>
          <li>Richtig: Karte bleibt. Falsch: Karte wird verworfen.</li>
        </ol>
      </CardContent>
    </Card>
  );
}

function DeckPreview({ tracks, selectedPreset }) {
  const sortedTracks = sortTimeline(tracks);
  const preset = DECK_PRESETS.find((item) => item.id === selectedPreset);

  return (
    <Card>
      <CardContent>
        <h3 style={{ marginTop: 0 }}>Deck-Vorschau</h3>
        <p style={{ marginTop: -6, color: colors.muted, fontSize: 13 }}>{preset?.description}</p>

        <div style={{ maxHeight: 360, overflowY: "auto", display: "grid", gap: 8 }}>
          {sortedTracks.map((track) => (
            <div key={track.id} style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: "8px 10px", background: colors.bg }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ fontSize: 13 }}>{track.title}</strong>
                <span style={{ color: colors.muted, fontSize: 12 }}>{track.year}</span>
              </div>

              <p style={{ margin: "4px 0 0", color: colors.muted, fontSize: 12 }}>{track.artist}</p>

              {!track.spotifyUri && (
                <p style={{ margin: "4px 0 0", color: "#fbbf24", fontSize: 11 }}>
                  Spotify URI fehlt - wird beim Abspielen gesucht
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GameHeader({ activePlayer, deck, turnNumber, maxTurns, targetScore, playLimitSeconds, difficulty, gameMode, overtime, usedTrackCount, overtimePendingCount, activeJokers }) {
  return (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 18,
        padding: 10,
        background: "rgba(2,6,23,0.38)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <div>
        <span style={{ display: "block", color: colors.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 900 }}>
          Am Zug
        </span>
        <strong style={{ fontSize: 22 }}>{getPlayerTurnLabel(activePlayer)}</strong>
        {gameMode === "teams" && getPlayerSubLabel(activePlayer) && (
          <span style={{ display: "block", color: colors.muted, fontSize: 12, marginTop: 2 }}>{getPlayerSubLabel(activePlayer)}</span>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <Badge variant="secondary">
          Runde {turnNumber}
          {maxTurns > 0 ? ` / ${maxTurns}` : ""}
        </Badge>
        <Badge variant="secondary">{deck.length} im Deck</Badge>
        <Badge variant="secondary">Ziel {targetScore}</Badge>
        <Badge variant="secondary">{playLimitSeconds || DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS}s</Badge>
        <Badge variant="secondary">{DIFFICULTY_OPTIONS.find((item) => item.id === difficulty)?.label || "Normal"}</Badge>
        <Badge variant="secondary">{gameMode === "teams" ? "Teammodus" : "Einzel"}</Badge>
        <Badge variant="secondary">Joker {activeJokers ?? 0}</Badge>
        {overtime && <Badge>Verlängerung · {overtimePendingCount || 1} offen</Badge>}
      </div>
    </div>
  );
}

function RoleStatusBanner({ viewerRole, activePlayer, permissions, syncEnabled, player }) {
  const isActive = viewerRole === "activePlayer";
  const roleLabel =
    {
      host: "Host/DJ",
      activePlayer: "Du bist dran",
      player: "Wartender Spieler",
      spectator: "Zuschauer",
    }[viewerRole] || viewerRole;

  const message = isActive
    ? "Song starten, Karte platzieren und danach aufdecken."
    : viewerRole === "host"
      ? "Du steuerst die Runde und Spotify."
      : "Du wartest und siehst den gemeinsamen Spielstand.";

  return (
    <div
      style={{
        border: `1px solid ${isActive || viewerRole === "host" ? colors.primary : colors.border}`,
        borderRadius: 24,
        padding: 16,
        background: isActive ? "rgba(126,87,255,0.20)" : colors.bg,
        boxShadow: isActive ? "0 18px 44px rgba(126,87,255,0.22)" : "none",
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <div>
        <Badge variant={isActive || viewerRole === "host" ? "default" : "secondary"}>{roleLabel}</Badge>
        <h3 style={{ margin: "10px 0 4px", fontSize: isActive ? 24 : 18 }}>
          {isActive ? "Jetzt bist du am Zug" : player?.name || "Deine Ansicht"}
        </h3>
        <p style={{ margin: 0, color: colors.muted }}>{message}</p>
      </div>

      <div style={{ display: "grid", gap: 4, textAlign: "right" }}>
        <strong>{player?.name || "Keine Spielerbindung"}</strong>
        <span style={{ color: colors.muted, fontSize: 12 }}>{syncEnabled ? "Server-Sync aktiv" : "Lokale Simulation"}</span>
        <span style={{ color: colors.muted, fontSize: 12 }}>Aktiv: {activePlayer?.name || "-"}</span>
      </div>
    </div>
  );
}


function SongTimerPill({ remainingSeconds, requester, totalSeconds = DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS }) {
  const total = Math.max(1, Math.min(120, Number(totalSeconds || DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS)));
  const safeRemaining = Math.max(0, Math.min(total, Number(remainingSeconds || 0)));
  const progress = total > 0 ? safeRemaining / total : 0;
  const circumference = 2 * Math.PI * 23;

  if (safeRemaining <= 0) return null;

  return (
    <div
      style={{
        display: "inline-grid",
        gridTemplateColumns: "58px minmax(0, 1fr)",
        gap: 12,
        alignItems: "center",
        border: `1px solid ${colors.primary}`,
        borderRadius: 20,
        padding: "10px 12px",
        background: "rgba(126,87,255,0.16)",
        boxShadow: "0 16px 34px rgba(126,87,255,0.14)",
        maxWidth: 320,
      }}
    >
      <div style={{ position: "relative", width: 54, height: 54 }}>
        <svg width="54" height="54" viewBox="0 0 54 54" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="27" cy="27" r="23" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="6" />
          <circle
            cx="27"
            cy="27"
            r="23"
            fill="none"
            stroke={colors.primary}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
          />
        </svg>
        <strong
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            fontSize: 18,
          }}
        >
          {safeRemaining}
        </strong>
      </div>

      <div style={{ minWidth: 0 }}>
        <span style={{ display: "block", color: colors.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 900 }}>
          Song läuft noch
        </span>
        <strong>{safeRemaining} Sekunden</strong>
        {requester && <p style={{ margin: "3px 0 0", color: colors.muted, fontSize: 12 }}>gestartet von {requester}</p>}
      </div>
    </div>
  );
}


function ActionPill({ children, onClick, disabled, variant = "primary", hint }) {
  const isSecondary = variant === "secondary";
  const isDanger = variant === "danger";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: `1px solid ${isDanger ? "#ef4444" : isSecondary ? colors.border : colors.primary}`,
        borderRadius: 18,
        padding: "14px 18px",
        background: disabled
          ? "rgba(15,23,42,0.55)"
          : isDanger
            ? "rgba(239,68,68,0.16)"
            : isSecondary
              ? "rgba(15,23,42,0.78)"
              : colors.primary,
        color: disabled ? "#64748b" : isSecondary || isDanger ? colors.text : colors.primaryText,
        fontWeight: 950,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: disabled || isSecondary ? "none" : "0 16px 34px rgba(126,87,255,0.22)",
        display: "grid",
        gap: 3,
        textAlign: "left",
        minWidth: 150,
        transition: "160ms ease",
      }}
    >
      <span>{children}</span>
      {hint && <span style={{ fontSize: 11, color: disabled ? "#475569" : isSecondary || isDanger ? colors.muted : "rgba(255,255,255,0.76)", fontWeight: 800 }}>{hint}</span>}
    </button>
  );
}




function getJokerActionNoticeFromEvent(event) {
  if (!event) return null;

  if (event.type === "TRACK_SWAPPED") {
    return {
      id: event.id,
      type: "swap",
      title: "Tauschen-Joker eingesetzt",
      text: event.details || "1 Joker verbraucht · neuer Song wurde gezogen",
      icon: "🔄",
    };
  }

  if (event.type === "TRACK_AUTO_CARD_JOKER") {
    return {
      id: event.id,
      type: "secure",
      title: "Karte-sichern-Joker eingesetzt",
      text: event.details || "3 Joker verbraucht · Karte wurde automatisch gesichert",
      icon: "🛡️",
    };
  }

  return null;
}

function JokerActionNotice({ localFeedback, latestEvent }) {
  const notice = localFeedback || getJokerActionNoticeFromEvent(latestEvent);

  if (!notice) return null;

  const isSecure = notice.type === "secure";

  return (
    <div
      key={notice.id}
      style={{
        border: `1px solid ${isSecure ? "#f59e0b" : colors.primary}`,
        borderRadius: 20,
        padding: "12px 14px",
        background: isSecure
          ? "linear-gradient(135deg, rgba(245,158,11,0.22), rgba(15,23,42,0.86))"
          : "linear-gradient(135deg, rgba(126,87,255,0.26), rgba(15,23,42,0.86))",
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "center",
        boxShadow: isSecure ? "0 18px 42px rgba(245,158,11,0.16)" : "0 18px 42px rgba(126,87,255,0.18)",
        animation: "tracklineJokerNoticeIn 520ms ease-out both, tracklineJokerNoticePulse 900ms ease-out 120ms",
      }}
    >
      <style>
        {`
          @keyframes tracklineJokerNoticeIn {
            0% { transform: translateY(-10px) scale(0.97); opacity: 0; }
            100% { transform: translateY(0) scale(1); opacity: 1; }
          }

          @keyframes tracklineJokerNoticePulse {
            0% { box-shadow: 0 0 0 0 rgba(245,158,11,0.00); }
            35% { box-shadow: 0 0 0 7px rgba(245,158,11,0.14), 0 18px 42px rgba(0,0,0,0.22); }
            100% { box-shadow: 0 18px 42px rgba(0,0,0,0.18); }
          }
        `}
      </style>

      <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: isSecure ? "rgba(245,158,11,0.24)" : "rgba(126,87,255,0.24)",
            border: `1px solid ${isSecure ? "#f59e0b" : colors.primary}`,
            fontSize: 24,
            flex: "0 0 auto",
          }}
        >
          {notice.icon}
        </div>

        <div style={{ minWidth: 0 }}>
          <strong style={{ display: "block", fontSize: 15 }}>{notice.title}</strong>
          <span style={{ display: "block", color: colors.muted, fontSize: 12, marginTop: 2 }}>{notice.text}</span>
        </div>
      </div>

      <Badge variant={isSecure ? "default" : "secondary"}>{isSecure ? "3 Joker" : "1 Joker"}</Badge>
    </div>
  );
}

function CurrentTrackPanel({
  phase,
  currentTrack,
  showDebugSong,
  canHostControl,
  canDrawTrack,
  canPlayTrack,
  canUseActiveJoker,
  activeJokers = 0,
  jokerActionBusy = false,
  playbackRemainingSeconds = 0,
  playbackTotalSeconds = DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS,
  playbackRequester = "",
  onPlayTrack,
  onToggleDebug,
  onDrawTrack,
  onSwapTrack,
  onAutoCard,
  onSkipTrack,
}) {
  const revealed = currentTrack && (phase === "reveal" || showDebugSong);

  return (
    <div
      style={{
        borderRadius: 22,
        border: `1px solid ${colors.border}`,
        background: cardTheme.table,
        padding: 14,
        display: "grid",
        gridTemplateColumns: "max-content minmax(0, 1fr)",
        gap: 14,
        alignItems: "center",
        overflow: "hidden",
        minWidth: 0,
        maxWidth: "100%",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 22px 60px rgba(0,0,0,0.22)",
      }}
    >
      <div>{currentTrack && revealed ? <TimelineTrackCard track={currentTrack} /> : <HiddenTrackCard />}</div>

      <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
        <div>
          <Badge variant={currentTrack ? "default" : "secondary"}>{currentTrack ? "Aktuelle Karte" : "Bereit"}</Badge>
          <h2 style={{ margin: "8px 0 4px", fontSize: 24, letterSpacing: -0.5 }}>
            {currentTrack && revealed ? currentTrack.title : currentTrack ? "Verdeckter Song" : "Noch kein Song gezogen"}
          </h2>
          <p style={{ margin: 0, color: colors.muted }}>
            {currentTrack && revealed
              ? `${currentTrack.artist} • ${currentTrack.year} • ${currentTrack.genre}`
              : currentTrack
                ? "Song starten, hoeren und die passende Stelle in der Timeline waehlen."
                : "Ziehe eine neue verdeckte Karte fuer den aktiven Spieler."}
          </p>
        </div>

        {currentTrack && phase === "placing" && (
          <SongTimerPill remainingSeconds={playbackRemainingSeconds} totalSeconds={playbackTotalSeconds} requester={playbackRequester} />
        )}

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            padding: 10,
            borderRadius: 22,
            border: `1px solid ${colors.border}`,
            background: "rgba(2,6,23,0.32)",
          }}
        >
          {!currentTrack && phase === "ready" && (
            <ActionPill onClick={onDrawTrack} disabled={!canDrawTrack} hint="neue Karte">
              Song ziehen
            </ActionPill>
          )}

          {currentTrack && phase === "placing" && (
            <>
              <ActionPill onClick={onPlayTrack} disabled={!canPlayTrack} hint="20s TimeLimit">
                Song starten
              </ActionPill>

              <ActionPill
                variant="secondary"
                onClick={onSwapTrack}
                disabled={jokerActionBusy || !canUseActiveJoker || activeJokers < 1}
                hint={jokerActionBusy ? "Joker läuft..." : "1 Joker"}
              >
                {jokerActionBusy ? "Wird genutzt..." : "Tauschen"}
              </ActionPill>

              <ActionPill
                variant="secondary"
                onClick={onAutoCard}
                disabled={jokerActionBusy || !canUseActiveJoker || activeJokers < 3}
                hint={jokerActionBusy ? "Joker läuft..." : "3 Joker"}
              >
                {jokerActionBusy ? "Wird genutzt..." : "Karte sichern"}
              </ActionPill>

              {canHostControl && (
                <ActionPill variant="secondary" onClick={onSkipTrack} hint="Host-only">
                  Ueberspringen
                </ActionPill>
              )}
            </>
          )}

          {currentTrack && canHostControl && (
            <ActionPill variant="secondary" onClick={onToggleDebug} disabled={phase === "reveal"} hint="Host-only">
              {showDebugSong ? "Wieder verdecken" : "Debug anzeigen"}
            </ActionPill>
          )}
        </div>
      </div>
    </div>
  );
}


function JokerChallengePanel({ gameState, activePlayer, viewerPlayerId, canReveal, canThrowJoker, canResolveTie, onThrowJoker, onStartDuel, onDuelChoice, onReveal }) {
  const claims = gameState.jokerClaims || [];
  const selectedChallenger = getSelectedJokerPlayer(gameState.players, gameState.selectedJokerPlayerId);
  const claimNames = getJokerClaimNames(gameState.players, claims);
  const duel = gameState.jokerDuel || createInitialJokerDuelState();
  const needsDuel = claims.length > 1 && !selectedChallenger;
  const duelActive = Boolean(needsDuel && duel.active);
  const revealDisabled = !canReveal || needsDuel || duelActive;
  const viewerPlayer = getPlayerById(gameState.players, viewerPlayerId);
  const duelPlayerIds = duelActive ? duel.playerIds || [] : claims.map((claim) => claim.playerId);
  const viewerIsInDuel = duelActive && duelPlayerIds.includes(viewerPlayerId);
  const viewerChoice = duel.choices?.[viewerPlayerId] || "";
  const lastDuelResult = duel.lastResult || null;

  return (
    <div
      style={{
        border: `1px solid ${needsDuel ? "#f59e0b" : colors.primary}`,
        borderRadius: 18,
        padding: 12,
        background: needsDuel ? "rgba(245,158,11,0.12)" : "rgba(126,87,255,0.12)",
        display: "grid",
        gap: 10,
      }}
    >
      <style>
        {`
          @keyframes jokerDuelPulse {
            0% { transform: scale(0.985); box-shadow: 0 0 0 rgba(245,158,11,0); }
            50% { transform: scale(1.025); box-shadow: 0 0 0 5px rgba(245,158,11,0.16); }
            100% { transform: scale(0.985); box-shadow: 0 0 0 rgba(245,158,11,0); }
          }

          @keyframes jokerWinnerPop {
            0% { transform: translateY(8px) scale(0.95); opacity: 0; }
            100% { transform: translateY(0) scale(1); opacity: 1; }
          }
        `}
      </style>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <strong>Joker-Fenster</strong>
          <p style={{ color: colors.muted, margin: "4px 0 0", fontSize: 13 }}>
            {getPlayerTurnLabel(activePlayer)} hat die Position bestätigt. Jetzt können andere Spieler anzweifeln.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge variant="secondary">{claims.length} Joker</Badge>
          {selectedChallenger && <Badge>{selectedChallenger.name} fordert heraus</Badge>}
        </div>
      </div>

      {claimNames.length > 0 ? (
        <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>
          Geworfene Joker: {claimNames.join(", ")}
        </p>
      ) : (
        <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>
          Noch kein Joker geworfen. Ohne Joker wird die Platzierung normal gewertet.
        </p>
      )}

      {claims.length > 1 && (
        <div style={{ border: `1px solid ${colors.border}`, borderRadius: 16, padding: 12, background: colors.bg, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <strong>Schere · Stein · Papier</strong>
            <Badge variant={selectedChallenger ? "default" : duelActive ? "default" : "secondary"}>
              {selectedChallenger ? "entschieden" : duelActive ? `Runde ${duel.round}` : "offen"}
            </Badge>
          </div>

          {lastDuelResult && (
            <div style={{ border: `1px solid ${colors.border}`, borderRadius: 14, padding: 10, background: colors.panel, display: "grid", gap: 8 }}>
              <strong style={{ fontSize: 13 }}>Letzte Duellrunde</strong>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(lastDuelResult.revealedChoices || []).map((item) => {
                  const eliminated = (lastDuelResult.eliminatedIds || []).includes(item.playerId);
                  const winner = lastDuelResult.winnerId === item.playerId;

                  return (
                    <span
                      key={`${item.playerId}-${item.choice}`}
                      style={{
                        border: `1px solid ${winner ? "#10b981" : eliminated ? "#ef4444" : colors.border}`,
                        borderRadius: 999,
                        padding: "6px 9px",
                        background: winner ? "rgba(16,185,129,0.14)" : eliminated ? "rgba(239,68,68,0.12)" : colors.bg,
                        color: colors.text,
                        fontSize: 12,
                        fontWeight: 850,
                      }}
                    >
                      {item.playerName}: {item.label}
                    </span>
                  );
                })}
              </div>
              <p style={{ margin: 0, color: colors.muted, fontSize: 12 }}>{lastDuelResult.reason}</p>
            </div>
          )}

          {!selectedChallenger && !duelActive && (
            <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>
              Mehrere Joker wurden geworfen. Starte das Duell, damit nur ein Challenger übrig bleibt.
            </p>
          )}

          {duelActive && (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(duelPlayerIds.length, 4)}, minmax(0, 1fr))`, gap: 8 }}>
                {duelPlayerIds.map((playerId) => {
                  const player = getPlayerById(gameState.players, playerId);
                  const hasChosen = Boolean(duel.choices?.[playerId]);
                  const isViewer = playerId === viewerPlayerId;

                  return (
                    <div
                      key={`duel-${playerId}`}
                      style={{
                        border: `1px solid ${hasChosen ? "#10b981" : isViewer ? "#f59e0b" : colors.border}`,
                        borderRadius: 14,
                        padding: 10,
                        background: isViewer ? "rgba(245,158,11,0.12)" : colors.panel,
                        textAlign: "center",
                        animation: !hasChosen && isViewer ? "jokerDuelPulse 900ms ease-in-out infinite" : "none",
                      }}
                    >
                      <div style={{ fontSize: 24 }}>{hasChosen ? "✅" : "🃏"}</div>
                      <strong style={{ display: "block", marginTop: 4 }}>{player?.name || "-"}</strong>
                      <span style={{ color: colors.muted, fontSize: 11 }}>
                        {hasChosen ? (isViewer ? `gewählt: ${getRpsChoiceLabel(viewerChoice)}` : "hat gewählt") : "wartet"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {viewerIsInDuel && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                  {RPS_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onDuelChoice(option.id)}
                      style={{
                        border: `1px solid ${viewerChoice === option.id ? colors.primary : colors.border}`,
                        borderRadius: 14,
                        padding: "11px 10px",
                        background: viewerChoice === option.id ? "rgba(126,87,255,0.22)" : colors.panel,
                        color: colors.text,
                        cursor: "pointer",
                        fontWeight: 950,
                      }}
                    >
                      <span style={{ display: "block", fontSize: 22 }}>{option.icon}</span>
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedChallenger && (
            <p style={{ margin: 0, color: "#fde68a", fontSize: 13, animation: "jokerWinnerPop 360ms ease-out both" }}>
              {selectedChallenger.name} gewinnt das Duell und setzt den Joker ein. Alle anderen behalten ihren Joker.
            </p>
          )}
        </div>
      )}

      {viewerPlayer && viewerPlayer.id !== activePlayer?.id && (
        <p style={{ margin: 0, color: colors.muted, fontSize: 12 }}>
          Deine Joker: {getPlayerJokers(viewerPlayer)}
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
        <Button variant="secondary" onClick={onThrowJoker} disabled={!canThrowJoker || duelActive}>
          Joker werfen
        </Button>

        {needsDuel && !duelActive && !selectedChallenger && (
          <Button variant="secondary" onClick={onStartDuel} disabled={!canResolveTie}>
            Duell starten
          </Button>
        )}

        <ActionPill onClick={onReveal} disabled={revealDisabled} hint={needsDuel ? "Erst Duell entscheiden" : "Wertung anzeigen"}>
          Aufdecken & werten
        </ActionPill>
      </div>
    </div>
  );
}


function TimelineChooser({ playerName, timeline, phase, selectedInsertIndex, setSelectedInsertIndex, canPlace }) {
  const orderedTimeline = sortTimeline(timeline);
  const disabled = phase !== "placing" || !canPlace;
  const isSlotDisabled = (insertIndex) => disabled || !isInsertSlotAllowed(orderedTimeline, insertIndex);

  return (
    <div style={{ display: "grid", gap: 8, minWidth: 0, maxWidth: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18 }}>Timeline von {playerName}</h3>
        </div>

        <Badge variant="secondary">{orderedTimeline.length} Karten</Badge>
      </div>

      <div
        style={{
          padding: "14px 12px 10px",
          borderRadius: 18,
          background: cardTheme.table,
          border: `1px solid ${colors.border}`,
          overflowX: "auto",
          overflowY: "hidden",
          maxWidth: "100%",
          minWidth: 0,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridAutoFlow: "column",
            gridAutoColumns: "max-content",
            alignItems: "end",
            gap: 8,
            minWidth: "max-content",
            paddingBottom: 8,
          }}
        >
          <PlacementButton selected={selectedInsertIndex === 0} disabled={isSlotDisabled(0)} onClick={() => setSelectedInsertIndex(0)} label="Davor" compact />

          {orderedTimeline.map((track, index) => (
            <React.Fragment key={track.id}>
              <TimelineTrackCard track={track} compact />
              <PlacementButton
                selected={selectedInsertIndex === index + 1}
                disabled={isSlotDisabled(index + 1)}
                onClick={() => setSelectedInsertIndex(index + 1)}
                label={!isInsertSlotAllowed(orderedTimeline, index + 1) ? "gleiches Jahr" : index + 1 === orderedTimeline.length ? "Danach" : "Hier"}
                compact
              />
            </React.Fragment>
          ))}
        </div>

        <div
          style={{
            height: 2,
            minWidth: "100%",
            background: "linear-gradient(90deg, transparent, rgba(226,232,240,0.45), transparent)",
          }}
        />
      </div>

    </div>
  );
}

function TimelineTrackCard({ track, compact, index = 0 }) {
  const genreColor = getGenreColor(track.genre);
  const width = compact ? 96 : 128;

  return (
    <div
      style={{
        width,
        minHeight: compact ? 126 : 170,
        borderRadius: 14,
        padding: compact ? 8 : 10,
        background: cardTheme.ivory,
        color: "#111827",
        boxShadow: "0 16px 32px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.7)",
        border: "1px solid rgba(20, 24, 36, 0.18)",
        position: "relative",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        gap: 8,
        overflow: "hidden",
        transition: "box-shadow 160ms ease",
      }}
      title={`${track.year} - ${track.title} - ${track.artist}`}
    >
      <div
        style={{
          position: "absolute",
          inset: 7,
          border: "1px solid rgba(17, 24, 39, 0.08)",
          borderRadius: 12,
          pointerEvents: "none",
        }}
      />

      <div style={{ display: "flex", justifyContent: "center" }}>
        <div
          style={{
            fontSize: compact ? 24 : 30,
            lineHeight: 1,
            letterSpacing: 2,
            fontWeight: 950,
            color: genreColor,
            textShadow: "0 1px 0 rgba(255,255,255,0.75)",
          }}
        >
          {track.year}
        </div>
      </div>

      <div style={{ alignSelf: "end" }}>
        <p
          style={{
            margin: "0 0 4px",
            fontSize: compact ? 12 : 13,
            fontWeight: 950,
            lineHeight: 1.05,
            color: "#111827",
          }}
        >
          {track.title}
        </p>
        <p style={{ margin: 0, fontSize: compact ? 11 : 12, color: "#475569", lineHeight: 1.15 }}>{track.artist}</p>
      </div>

      <div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            borderRadius: 999,
            padding: "4px 7px",
            background: genreColor,
            color: "white",
            fontSize: 9,
            fontWeight: 900,
            textTransform: "uppercase",
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {track.genre}
        </span>
      </div>
    </div>
  );
}


function MiniTimelineTrackCard({ track }) {
  const genreColor = getGenreColor(track.genre);

  return (
    <div
      title={`${track.year} - ${track.title} - ${track.artist}`}
      style={{
        width: 62,
        minHeight: 82,
        borderRadius: 10,
        padding: 7,
        background: cardTheme.ivory,
        color: "#111827",
        boxShadow: "0 8px 18px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(255,255,255,0.65)",
        border: "1px solid rgba(20, 24, 36, 0.15)",
        position: "relative",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        gap: 4,
        overflow: "hidden",
        flex: "0 0 auto",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 4,
          border: "1px solid rgba(17, 24, 39, 0.07)",
          borderRadius: 7,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          fontSize: 14,
          lineHeight: 1,
          letterSpacing: 1,
          fontWeight: 950,
          color: genreColor,
          textAlign: "center",
        }}
      >
        {track.year}
      </div>

      <div style={{ alignSelf: "end", minWidth: 0 }}>
        <p
          style={{
            margin: "0 0 2px",
            fontSize: 8,
            fontWeight: 950,
            lineHeight: 1.05,
            color: "#111827",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {track.title}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 7,
            color: "#475569",
            lineHeight: 1.05,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {track.artist}
        </p>
      </div>

      <span
        style={{
          width: 22,
          height: 4,
          borderRadius: 999,
          background: genreColor,
          display: "inline-block",
        }}
      />
    </div>
  );
}

function HiddenTrackCard({ compact = false }) {
  const ringSize = compact ? 88 : 110;
  const innerSize = compact ? 34 : 42;

  return (
    <div
      style={{
        width: compact ? 116 : 138,
        minHeight: compact ? 154 : 184,
        borderRadius: 16,
        padding: compact ? 10 : 12,
        background: cardTheme.back,
        color: "#f8fafc",
        boxShadow: "0 16px 32px rgba(0,0,0,0.42), 0 0 0 1px rgba(196,160,255,0.45)",
        border: "1px solid rgba(216, 180, 254, 0.55)",
        display: "grid",
        placeItems: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 9,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.16)",
        }}
      />

      <div
        style={{
          position: "absolute",
          width: ringSize,
          height: ringSize,
          borderRadius: "50%",
          background:
            "repeating-radial-gradient(circle, rgba(216,180,254,0.22) 0 1px, transparent 1px 8px), radial-gradient(circle at center, rgba(126,87,255,0.34), rgba(59,27,120,0.18) 34%, rgba(12,8,32,0.16) 68%)",
          border: "1px solid rgba(216,180,254,0.22)",
          boxShadow: "0 0 32px rgba(126,87,255,0.24)",
          opacity: 0.95,
        }}
      />

      <div
        style={{
          position: "absolute",
          width: innerSize,
          height: innerSize,
          borderRadius: "50%",
          background: "radial-gradient(circle, #8b5cf6 0%, #6d28d9 48%, #351371 100%)",
          border: "1px solid rgba(216,180,254,0.55)",
          boxShadow: "0 0 0 7px rgba(126,87,255,0.18), 0 0 22px rgba(196,160,255,0.30)",
        }}
      />

      <div style={{ position: "absolute", bottom: 18, left: 16, right: 16, display: "flex", alignItems: "end", justifyContent: "center", gap: 4 }}>
        {[14, 26, 18, 32, 22, 28, 16].map((height, index) => (
          <span
            key={index}
            style={{
              width: 4,
              height: compact ? Math.max(8, height - 8) : height,
              borderRadius: 999,
              background: index % 2 ? "#c4b5fd" : "#8b5cf6",
              opacity: 0.76,
              boxShadow: "0 0 10px rgba(196,160,255,0.22)",
            }}
          />
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", display: "grid", gap: 52 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 950, letterSpacing: 2, fontSize: compact ? 11 : 12 }}>TRACKLINE</p>
          <p style={{ margin: "5px 0 0", color: "#c4b5fd", fontSize: 10, letterSpacing: 1 }}>MUSIC TIMELINE</p>
        </div>
      </div>
    </div>
  );
}

function MiniTimeline({ timeline }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
      {timeline.map((track, index) => (
        <div key={`${track.id}-mini`} style={{ borderRadius: 12, background: colors.panelSoft, border: `1px solid ${colors.border}`, padding: "8px 10px" }}>
          <div style={{ color: colors.text, fontWeight: 900, fontSize: 13 }}>
            {index + 1}. {track.year}
          </div>
          <div style={{ color: colors.muted, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{track.title}</div>
        </div>
      ))}
    </div>
  );
}

function PlacementButton({ selected, disabled, onClick, label, helper, compact = false }) {
  const [hovered, setHovered] = useState(false);
  const isHot = selected || hovered;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: compact ? 76 : 108,
        minHeight: compact ? 126 : 156,
        borderRadius: 16,
        border: selected
          ? `2px solid ${colors.success}`
          : hovered && !disabled
            ? `2px solid ${colors.primary}`
            : `1.5px dashed rgba(226,232,240,0.35)`,
        background: selected
          ? "rgba(34,197,94,0.22)"
          : hovered && !disabled
            ? "rgba(126,87,255,0.22)"
            : "rgba(15,23,42,0.52)",
        color: selected ? "#bbf7d0" : hovered && !disabled ? "#ddd6fe" : colors.muted,
        display: "grid",
        placeItems: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: selected
          ? "0 0 0 5px rgba(34,197,94,0.18), 0 20px 42px rgba(34,197,94,0.18)"
          : hovered && !disabled
            ? "0 0 0 5px rgba(126,87,255,0.20), 0 18px 38px rgba(126,87,255,0.16)"
            : "inset 0 0 0 1px rgba(255,255,255,0.03)",
        opacity: disabled ? 0.42 : 1,
        padding: 10,
        transition: "160ms ease",
        transform: isHot && !disabled ? "translateY(-3px)" : "translateY(0)",
      }}
      title={helper || label}
    >
      <span style={{ display: "grid", justifyItems: "center", gap: 8 }}>
        <span style={{ fontSize: 30, lineHeight: 1 }}>{selected ? "✓" : "+"}</span>
        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 900 }}>
          {selected ? "Gewählt" : label}
        </span>
      </span>
    </button>
  );
}

function ResultPanel({ result, timeline = [], onNext, canAdvance, canAwardJoker, jokerGuessReviewed, jokerGuessAwarded, onAwardJoker, onDenyJoker }) {
  const isSkipped = Boolean(result.skipped);
  const isCorrect = result.correct && !isSkipped;
  const accent = isSkipped ? colors.warning : isCorrect ? colors.good : colors.bad;
  const borderColor = isSkipped ? "#f59e0b" : isCorrect ? "#10b981" : "#ef4444";
  const textColor = isSkipped ? "#fde68a" : isCorrect ? "#bbf7d0" : "#fecaca";
  const headline = result.autoJoker
    ? "Karte gesichert!"
    : result.jokerWasThrown
      ? result.challengerWon
        ? "Joker erfolgreich!"
        : "Joker verloren!"
      : isSkipped
        ? "Song übersprungen"
        : isCorrect
          ? "Richtig gelegt!"
          : "Knapp daneben";
  const icon = result.autoJoker ? "🃏" : isSkipped ? "↷" : isCorrect ? "✓" : "×";
  const correctPlacementLabel = getCorrectPlacementLabel(timeline, result.track);

  return (
    <div
      style={{
        border: `1px solid ${borderColor}`,
        background: accent,
        borderRadius: 24,
        padding: 20,
        display: "grid",
        gridTemplateColumns: "max-content minmax(0, 1fr)",
        gap: 20,
        alignItems: "center",
        boxShadow: `0 18px 48px ${isCorrect ? "rgba(16,185,129,0.16)" : "rgba(239,68,68,0.14)"}`,
        overflow: "hidden",
        position: "relative",
        animation: isSkipped ? "none" : isCorrect ? "tracklineCorrectGlow 900ms ease-out both" : "tracklineWrongShake 360ms ease-in-out both",
      }}
    >
      <style>
        {`
          @keyframes tracklineRevealPop {
            0% { transform: rotateY(86deg) scale(0.92); opacity: 0; }
            70% { transform: rotateY(-5deg) scale(1.04); opacity: 1; }
            100% { transform: rotateY(0deg) scale(1); opacity: 1; }
          }

          @keyframes tracklineResultPulse {
            0% { transform: scale(0.88); opacity: 0; }
            70% { transform: scale(1.08); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }

          @keyframes tracklineCorrectGlow {
            0% { box-shadow: 0 0 0 rgba(16,185,129,0); }
            45% { box-shadow: 0 0 0 8px rgba(16,185,129,0.18), 0 0 42px rgba(16,185,129,0.28); }
            100% { box-shadow: 0 18px 48px rgba(16,185,129,0.16); }
          }

          @keyframes tracklineWrongShake {
            0%, 100% { transform: translateX(0); }
            18% { transform: translateX(-8px); }
            36% { transform: translateX(7px); }
            54% { transform: translateX(-5px); }
            72% { transform: translateX(4px); }
          }

          @keyframes tracklineConfettiDot {
            0% { transform: translateY(0) scale(0.5); opacity: 0; }
            40% { opacity: 1; }
            100% { transform: translateY(-52px) scale(1); opacity: 0; }
          }
        `}
      </style>

      {isCorrect && [0, 1, 2, 3, 4].map((dot) => (
        <span
          key={dot}
          style={{
            position: "absolute",
            left: `${18 + dot * 14}%`,
            bottom: 14,
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: dot % 2 ? "#fde68a" : "#86efac",
            animation: "tracklineConfettiDot 900ms ease-out both",
            animationDelay: `${dot * 90}ms`,
            pointerEvents: "none",
          }}
        />
      ))}

      <div style={{ animation: "tracklineRevealPop 520ms ease-out both", transformStyle: "preserve-3d" }}>
        <TimelineTrackCard track={result.track} />
      </div>

      <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background: isCorrect ? "#10b981" : isSkipped ? "#f59e0b" : "#ef4444",
              color: "white",
              fontSize: 30,
              fontWeight: 950,
              animation: "tracklineResultPulse 420ms ease-out both",
              boxShadow: "0 12px 28px rgba(0,0,0,0.28)",
            }}
          >
            {icon}
          </div>

          <div>
            <h3 style={{ margin: 0, fontSize: 26 }}>{headline}</h3>
            <p style={{ margin: "5px 0 0", color: textColor }}>
              {result.track.title} von {result.track.artist} erschien {result.track.year}.
            </p>
            {result.autoJoker && (
              <p style={{ margin: "5px 0 0", color: textColor, fontSize: 13 }}>
                Die Karte wurde mit 3 Jokern automatisch gesichert und in die Timeline gelegt.
              </p>
            )}

            {result.jokerWasThrown && (
              <p style={{ margin: "5px 0 0", color: textColor, fontSize: 13 }}>
                {result.challengerWon
                  ? `${result.challengerName} bekommt die Karte, weil die Platzierung falsch war.`
                  : `${result.challengerName} verliert den Joker, weil die Platzierung korrekt war.`}
              </p>
            )}

            {!jokerGuessReviewed && !jokerGuessAwarded && (
              <div style={{ marginTop: 10, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 10, background: "rgba(0,0,0,0.14)", display: "grid", gap: 8 }}>
                <strong style={{ fontSize: 13 }}>Zusatz-Joker für Song+Interpret?</strong>
                <p style={{ margin: 0, color: textColor, fontSize: 12 }}>
                  Nach dem Aufdecken entscheiden, ob die aktive Person Song und Interpret korrekt nennen konnte.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Button onClick={onAwardJoker} disabled={!canAwardJoker} style={{ padding: "8px 10px", borderRadius: 12 }}>
                    +1 Joker vergeben
                  </Button>
                  <Button variant="secondary" onClick={onDenyJoker} disabled={!canAwardJoker} style={{ padding: "8px 10px", borderRadius: 12 }}>
                    Kein Joker
                  </Button>
                </div>
              </div>
            )}

            {jokerGuessAwarded && (
              <Badge>+1 Joker vergeben</Badge>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isCorrect || isSkipped || result.autoJoker ? "1fr" : "1fr 1fr", gap: 10 }}>
          <div
            style={{
              border: `1px solid ${borderColor}`,
              borderRadius: 18,
              padding: 14,
              background: "rgba(0,0,0,0.16)",
            }}
          >
            <span style={{ display: "block", color: textColor, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 900 }}>
              {result.autoJoker ? "Joker-Aktion" : "Gewählte Position"}
            </span>
            <strong style={{ display: "block", marginTop: 4 }}>{result.placementLabel}</strong>
          </div>

          {!isCorrect && !isSkipped && (
            <div
              style={{
                border: "1px solid rgba(187,247,208,0.35)",
                borderRadius: 18,
                padding: 14,
                background: "rgba(16,185,129,0.10)",
              }}
            >
              <span style={{ display: "block", color: "#bbf7d0", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 900 }}>
                Korrekte Position
              </span>
              <strong style={{ display: "block", marginTop: 4 }}>{correctPlacementLabel}</strong>
            </div>
          )}
        </div>

        {!isCorrect && !isSkipped && (
          <p style={{ margin: 0, color: textColor, fontSize: 13 }}>
            Die Karte wäre korrekt {correctPlacementLabel} gelandet.
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
          <Button onClick={onNext} disabled={!canAdvance}>
            Nächster Spieler
          </Button>
        </div>
      </div>
    </div>
  );
}

function FinishedPanel({ leaderboard, onNewRound, canNewRound }) {
  const winner = leaderboard[0];
  const podium = leaderboard.slice(0, 3);
  const topScore = winner?.score || 0;
  const tiedWinners = leaderboard.filter((player) => player.score === topScore && topScore > 0);

  return (
    <div
      style={{
        border: "1px solid #f59e0b",
        background:
          "radial-gradient(circle at top left, rgba(245,158,11,0.30), transparent 34%), radial-gradient(circle at bottom right, rgba(126,87,255,0.22), transparent 36%), rgba(15,23,42,0.92)",
        borderRadius: 26,
        padding: 20,
        display: "grid",
        gap: 16,
        boxShadow: "0 22px 60px rgba(0,0,0,0.30)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <style>
        {`
          @keyframes tracklinePodiumIn {
            0% { transform: translateY(16px) scale(0.96); opacity: 0; }
            100% { transform: translateY(0) scale(1); opacity: 1; }
          }
        `}
      </style>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <Badge variant="secondary">Finale</Badge>
          <h2 style={{ margin: "8px 0 4px", fontSize: 30, letterSpacing: -0.7 }}>
            {tiedWinners.length > 1 ? "Unentschieden" : "Spiel beendet"}
          </h2>
          <p style={{ margin: 0, color: "#fde68a" }}>
            {tiedWinners.length > 1
              ? `${tiedWinners.map((player) => player.name).join(" & ")} teilen sich Platz 1 mit ${topScore} Karten.`
              : `Gewinner: ${winner?.name || "-"} mit ${winner?.score || 0} Karten.`}
          </p>
        </div>

        <Button onClick={onNewRound} disabled={!canNewRound} style={{ padding: "13px 18px" }}>
          Neue Runde gleiche Spieler
        </Button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.25fr 1fr", gap: 10, alignItems: "end" }}>
        {[podium[1], podium[0], podium[2]].map((player, visualIndex) => {
          const place = visualIndex === 1 ? 1 : visualIndex === 0 ? 2 : 3;
          const isWinner = place === 1;

          return (
            <div
              key={player?.id || `empty-${place}`}
              style={{
                minHeight: isWinner ? 158 : 128,
                borderRadius: 22,
                padding: 14,
                background: isWinner ? cardTheme.ivory : "rgba(255,255,255,0.07)",
                color: isWinner ? "#111827" : colors.text,
                border: `1px solid ${isWinner ? "#f59e0b" : colors.border}`,
                textAlign: "center",
                display: "grid",
                alignContent: "center",
                gap: 8,
                animation: "tracklinePodiumIn 420ms ease-out both",
                animationDelay: `${visualIndex * 80}ms`,
              }}
            >
              <div style={{ fontSize: isWinner ? 34 : 24 }}>{isWinner ? "★" : place === 2 ? "②" : "③"}</div>
              <Badge variant={isWinner ? "default" : "secondary"}>#{place}</Badge>
              <strong style={{ display: "block", fontSize: isWinner ? 20 : 16 }}>{player?.name || "-"}</strong>
              <span style={{ color: isWinner ? "#475569" : colors.muted, fontSize: 12 }}>{player?.score || 0} Karten</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gap: 7 }}>
        {leaderboard.map((player, index) => (
          <div
            key={player.id}
            style={{
              display: "grid",
              gridTemplateColumns: "34px minmax(0, 1fr) auto",
              gap: 10,
              alignItems: "center",
              borderRadius: 14,
              background: index === 0 ? "rgba(245,158,11,0.14)" : colors.bg,
              border: `1px solid ${index === 0 ? "#f59e0b" : colors.border}`,
              padding: "8px 10px",
            }}
          >
            <Badge variant={index === 0 ? "default" : "secondary"}>#{index + 1}</Badge>
            <strong style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{player.name}</strong>
            <span style={{ color: colors.muted, fontSize: 12 }}>
              {player.score} Karten · {player.correct}✓ · {player.wrong}×
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AllTimelines({ players, activePlayerIndex }) {
  return (
    <Card style={{ minWidth: 0, overflow: "hidden" }}>
      <CardContent style={{ display: "grid", gap: 8, minWidth: 0, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Alle Timelines</h3>
          <Badge variant="secondary">{players.length} Spieler</Badge>
        </div>

        <div style={{ display: "grid", gap: 7, maxHeight: 230, overflowY: "auto", paddingRight: 2 }}>
          {[...players]
            .map((player, originalIndex) => ({ player, originalIndex }))
            .sort((a, b) => (a.originalIndex === activePlayerIndex ? -1 : b.originalIndex === activePlayerIndex ? 1 : a.originalIndex - b.originalIndex))
            .map(({ player, originalIndex }) => {
            const sortedTimeline = sortTimeline(player.timeline);
            const isActive = originalIndex === activePlayerIndex;

            return (
              <div
                key={player.id}
                style={{
                  border: `1px solid ${isActive ? colors.primary : colors.border}`,
                  borderRadius: 14,
                  padding: 8,
                  background: isActive ? "rgba(126,87,255,0.12)" : colors.bg,
                  boxShadow: isActive ? "0 10px 22px rgba(126,87,255,0.10)" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6, alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 1 }}>
                      <strong style={{ fontSize: 13 }}>{player.name}</strong>
                      {getPlayerSubLabel(player) && <span style={{ color: colors.muted, fontSize: 10 }}>{getPlayerSubLabel(player)}</span>}
                    </div>
                    {isActive && <Badge>am Zug</Badge>}
                  </div>
                  <Badge variant="secondary">{player.score}</Badge>
                </div>

                <div style={{ overflowX: "auto", overflowY: "hidden", maxWidth: "100%", minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 4, minWidth: "max-content", paddingBottom: 1, alignItems: "center" }}>
                    {sortedTimeline.length === 0 ? (
                      <span style={{ color: colors.muted, fontSize: 12 }}>Noch keine Karten</span>
                    ) : (
                      sortedTimeline.map((track) => <MiniTimelineTrackCard key={`${player.id}-${track.id}`} track={track} />)
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}


function PlayerFocusedCard({ viewerRole, activePlayer, permissions }) {
  const isActive = viewerRole === "activePlayer";
  const roleLabel =
    {
      activePlayer: "Du bist am Zug",
      player: "Du wartest",
      spectator: "Zuschauer",
      host: "Host",
    }[viewerRole] || viewerRole;

  return (
    <Card>
      <CardContent style={{ display: "grid", gap: 12 }}>
        <div
          style={{
            borderRadius: 22,
            border: `1px solid ${isActive ? colors.primary : colors.border}`,
            background: isActive ? "rgba(126,87,255,0.16)" : cardTheme.table,
            padding: 16,
            display: "grid",
            gap: 8,
          }}
        >
          <Badge variant={isActive ? "default" : "secondary"}>{roleLabel}</Badge>
          <h3 style={{ margin: 0 }}>{isActive ? "Jetzt spielen" : "Wartebereich"}</h3>
          <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>
            {isActive ? "Song starten, Karte platzieren und aufdecken." : "Aktueller Spieler ist unten angezeigt."}
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", borderRadius: 16, background: colors.bg, padding: 12 }}>
          <span style={{ color: colors.muted }}>Aktiv</span>
          <strong>{activePlayer?.name || "-"}</strong>
        </div>
      </CardContent>
    </Card>
  );
}

function LocalRoleCard({ viewerPlayerId, setViewerPlayerId, viewerRole, permissions, players, roomClients = [], clientInstanceId, roomCode }) {
  const claimedByOther = new Set(
    roomClients
      .filter((client) => client.clientInstanceId && client.clientInstanceId !== clientInstanceId)
      .map((client) => client.playerId)
      .filter(Boolean)
  );

  function handleViewerChange(event) {
    const nextPlayerId = event.target.value;

    setViewerPlayerId(nextPlayerId);
    storeViewerPlayerId(roomCode, nextPlayerId);
  }

  return (
    <Card>
      <CardContent style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Deine Ansicht</h3>
          <Badge variant="secondary">{players.some(isTeamPlayer) ? "Team" : "Name"}</Badge>
        </div>

        <Select value={viewerPlayerId} onChange={handleViewerChange}>
          <option value="auto-host">Host automatisch</option>
          <option value="auto-player">Automatisch per Einladungslink</option>

          {players.map((player) => {
            const isClaimedByOther = claimedByOther.has(player.id);

            return (
              <option key={player.id} value={player.id} disabled={isClaimedByOther}>
                {player.name}{isClaimedByOther ? " (belegt)" : ""}
              </option>
            );
          })}

          <option value="spectator">Zuschauer</option>
        </Select>
      </CardContent>
    </Card>
  );
}

function RoomCard({ room, players, activePlayerIndex }) {
  const activePlayer = players[activePlayerIndex];

  return (
    <Card>
      <CardContent style={{ display: "grid", gap: 12 }}>
        <div>
          <h3 style={{ margin: "0 0 6px" }}>Privater Raum</h3>
          <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>Privater Online-Raum fuer deine Runde.</p>
        </div>

        <div style={{ border: `1px solid ${colors.border}`, borderRadius: 16, padding: 12, background: colors.bg }}>
          <span style={{ display: "block", color: colors.muted, fontSize: 12 }}>Raumcode</span>
          <strong style={{ fontSize: 22, letterSpacing: 2 }}>{room?.code || "-"}</strong>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <InfoLine label="Host" value={room?.hostName || players[0]?.name || "-"} />
          <InfoLine label="Aktiv" value={activePlayer?.name || "-"} />

          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span style={{ color: colors.muted }}>Sichtbarkeit</span>
            <Badge variant="secondary">privat</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoLine({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <span style={{ color: colors.muted }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Leaderboard({ players }) {
  const topScore = players[0]?.score || 0;

  return (
    <Card>
      <CardContent style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Scoreboard</h3>
          <Badge variant="secondary">Karten</Badge>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {players.map((player, index) => {
            const isLeader = player.score === topScore && topScore > 0;

            return (
              <div
                key={player.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "28px minmax(0, 1fr) 62px",
                  gap: 10,
                  alignItems: "center",
                  borderRadius: 14,
                  border: `1px solid ${isLeader ? colors.primary : colors.border}`,
                  background: isLeader ? "rgba(126,87,255,0.14)" : colors.bg,
                  padding: "8px 10px",
                }}
              >
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    background: isLeader ? colors.primary : colors.panelSoft,
                    color: isLeader ? colors.primaryText : colors.text,
                    fontWeight: 950,
                    fontSize: 12,
                  }}
                >
                  {index + 1}
                </span>

                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 14 }}>{player.name}</strong>
                  <span style={{ color: colors.muted, fontSize: 11 }}>
                    {getPlayerSubLabel(player) ? `${getPlayerSubLabel(player)} · ` : ""}{player.correct}✓ · {player.wrong}×
                  </span>
                </div>

                <strong
                  style={{
                    justifySelf: "end",
                    fontSize: 22,
                    color: isLeader ? "#c4b5fd" : colors.text,
                  }}
                >
                  {player.score}
                  <span style={{ display: "block", color: colors.muted, fontSize: 10, fontWeight: 800 }}>🃏 {getPlayerJokers(player)}</span>
                </strong>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function TurnOrder({ players, activePlayerIndex }) {
  return (
    <Card>
      <CardContent>
        <h3 style={{ marginTop: 0 }}>Zugreihenfolge</h3>

        <div style={{ display: "grid", gap: 8 }}>
          {players.map((player, index) => (
            <div
              key={player.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: `1px solid ${index === activePlayerIndex ? colors.primary : colors.border}`,
                borderRadius: 14,
                padding: 10,
                background: index === activePlayerIndex ? colors.panelSoft : colors.bg,
              }}
            >
              <span>{player.name}</span>

              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {player.role === "host" && <Badge variant="secondary">Host</Badge>}
                {index === activePlayerIndex && <Badge>aktiv</Badge>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}


function HostAdminDetails({ playbackRequests, gameLog, discardedTracks, eventHistory, gameState, onGameAction }) {
  return (
    <details
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 20,
        background: colors.bg,
        overflow: "hidden",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          padding: 16,
          fontWeight: 900,
          listStyle: "none",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
        }}
      >
        <span>Admin / Debug</span>
        <Badge variant="secondary">einklappbar</Badge>
      </summary>

      <div style={{ display: "grid", gap: 14, padding: "0 16px 16px" }}>
        <SongQualityCard gameState={gameState} onGameAction={onGameAction} />
        <PlaybackQueue playbackRequests={playbackRequests} />
        <details style={{ border: `1px solid ${colors.border}`, borderRadius: 16, padding: 12, background: colors.panel }}>
          <summary style={{ cursor: "pointer", fontWeight: 900 }}>Weitere technische Details</summary>
          <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
            <DiscordCommandMap />
            <GameLog gameLog={gameLog} discardedTracks={discardedTracks} />
            <EventHistory eventHistory={eventHistory} />
            <SyncPreview gameState={gameState} />
          </div>
        </details>
      </div>
    </details>
  );
}



function SongQualityCard({ gameState, onGameAction }) {
  const playedTracks = gameState.playedTrackHistory || [];
  const reports = gameState.songReports || [];
  const blockedKeys = new Set(gameState.blockedTrackKeys || []);
  const lastTrack = gameState.lastResult?.track || gameState.currentTrack || null;

  function blockTrack(track, reason = "blockiert") {
    if (!track) return;

    onGameAction?.({
      type: "BLOCK_TRACK",
      track,
      trackKey: getTrackDedupeKey(track),
      reason,
    });
  }

  function reportTrack(track, reason) {
    if (!track) return;

    onGameAction?.({
      type: "REPORT_TRACK",
      track,
      reason,
    });
  }

  return (
    <Card>
      <CardContent style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: "0 0 6px" }}>Songpflege</h3>
            <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>
              Gespielte Songs prüfen, schlechte Treffer markieren und Songs dauerhaft für diesen Raum blockieren.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Badge variant="secondary">{playedTracks.length} gespielt</Badge>
            <Badge variant="secondary">{reports.length} markiert</Badge>
            <Badge variant={blockedKeys.size ? "default" : "secondary"}>{blockedKeys.size} blockiert</Badge>
          </div>
        </div>

        {lastTrack && (
          <div style={{ border: `1px solid ${colors.border}`, borderRadius: 16, padding: 12, background: colors.bg, display: "grid", gap: 10 }}>
            <div>
              <strong>Aktueller/letzter Song</strong>
              <p style={{ margin: "4px 0 0", color: colors.muted, fontSize: 13 }}>
                {lastTrack.title} · {lastTrack.artist} · {lastTrack.year}
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="secondary" onClick={() => reportTrack(lastTrack, "falscher Spotify-Treffer")}>
                Falscher Spotify-Treffer
              </Button>
              <Button variant="secondary" onClick={() => reportTrack(lastTrack, "zu unbekannt")}>
                Zu unbekannt
              </Button>
              <Button variant="danger" onClick={() => blockTrack(lastTrack, "blockiert")}>
                Song blockieren
              </Button>
            </div>
          </div>
        )}

        <details style={{ border: `1px solid ${colors.border}`, borderRadius: 16, padding: 12, background: colors.panel }}>
          <summary style={{ cursor: "pointer", fontWeight: 900 }}>Gespielte Songs</summary>
          <div style={{ display: "grid", gap: 8, maxHeight: 260, overflowY: "auto", marginTop: 12 }}>
            {playedTracks.length === 0 && <p style={{ margin: 0, color: colors.muted }}>Noch keine gespielten Songs.</p>}

            {playedTracks.slice(0, 30).map((entry) => {
              const entryTrack = {
                id: entry.trackId,
                title: entry.title,
                artist: entry.artist,
                year: entry.year,
                genre: entry.genre,
              };
              const blocked = blockedKeys.has(entry.trackKey);

              return (
                <div key={entry.id} style={{ border: `1px solid ${blocked ? "#ef4444" : colors.border}`, borderRadius: 12, padding: 10, background: colors.bg }}>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, alignItems: "center" }}>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {entry.title} · {entry.artist}
                      </strong>
                      <span style={{ color: colors.muted, fontSize: 12 }}>
                        {entry.year} · {entry.playerName} · {entry.skipped ? "übersprungen" : entry.correct ? "richtig" : "falsch"} · {entry.createdAt}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <Button variant="secondary" onClick={() => reportTrack(entryTrack, "falscher Spotify-Treffer")} style={{ padding: "6px 8px", borderRadius: 10 }}>
                        Spotify
                      </Button>
                      <Button variant="secondary" onClick={() => reportTrack(entryTrack, "zu unbekannt")} style={{ padding: "6px 8px", borderRadius: 10 }}>
                        unbekannt
                      </Button>
                      {blocked ? (
                        <Button
                          variant="secondary"
                          onClick={() => onGameAction?.({ type: "UNBLOCK_TRACK", trackKey: entry.trackKey })}
                          style={{ padding: "6px 8px", borderRadius: 10 }}
                        >
                          freigeben
                        </Button>
                      ) : (
                        <Button variant="danger" onClick={() => blockTrack(entryTrack, "blockiert")} style={{ padding: "6px 8px", borderRadius: 10 }}>
                          blocken
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </details>

        <details style={{ border: `1px solid ${colors.border}`, borderRadius: 16, padding: 12, background: colors.panel }}>
          <summary style={{ cursor: "pointer", fontWeight: 900 }}>Markierungen & Blacklist</summary>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="secondary" onClick={() => onGameAction?.({ type: "CLEAR_SONG_REPORTS" })} disabled={reports.length === 0}>
                Markierungen leeren
              </Button>
              <Button variant="danger" onClick={() => onGameAction?.({ type: "CLEAR_BLOCKED_TRACKS" })} disabled={blockedKeys.size === 0}>
                Blacklist leeren
              </Button>
            </div>

            <div style={{ display: "grid", gap: 8, maxHeight: 220, overflowY: "auto" }}>
              {reports.length === 0 && <p style={{ margin: 0, color: colors.muted }}>Noch keine Markierungen.</p>}

              {reports.slice(0, 40).map((report) => (
                <div key={report.id} style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: 10, background: colors.bg }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong style={{ fontSize: 13 }}>{report.title} · {report.artist}</strong>
                    <Badge variant="secondary">{report.reason}</Badge>
                  </div>
                  <p style={{ margin: "4px 0 0", color: colors.muted, fontSize: 12 }}>
                    {report.year} · {report.createdAt} · {blockedKeys.has(report.trackKey) ? "blockiert" : "nicht blockiert"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function PlaybackQueue({ playbackRequests }) {
  return (
    <Card>
      <CardContent style={{ display: "grid", gap: 12 }}>
        <div>
          <h3 style={{ margin: "0 0 6px" }}>Playback-Commands</h3>
          <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>Vorbereitung fuer Web-Steuerung oder Button-Interaktionen.</p>
        </div>

        <div style={{ display: "grid", gap: 8, maxHeight: 180, overflowY: "auto" }}>
          {playbackRequests.length === 0 && <p style={{ margin: 0, color: colors.muted }}>Noch keine Playback-Anfragen.</p>}

          {playbackRequests.map((request) => (
            <div key={request.id} style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: 10, background: colors.bg }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ fontSize: 12 }}>{request.hiddenLabel}</strong>
                <span style={{ color: colors.muted, fontSize: 11 }}>{request.createdAt}</span>
              </div>

              <p style={{ margin: "4px 0 0", color: colors.muted, fontSize: 12 }}>Angefordert von {request.requester}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DiscordCommandMap() {
  const commands = [
    { command: "Beitreten", role: "alle", purpose: "Spiel beitreten" },
    { command: "Song ziehen", role: "Host oder aktiver Spieler", purpose: "verdeckten Song ziehen" },
    { command: "Song starten", role: "Host oder aktiver Spieler", purpose: "Song starten / erneut abspielen" },
    { command: "Position waehlen", role: "aktiver Spieler", purpose: "Position in Timeline waehlen" },
    { command: "Tauschen", role: "aktiver Spieler", purpose: "1 Joker ausgeben und neuen Song ziehen" },
    { command: "Karte sichern", role: "aktiver Spieler", purpose: "3 Joker ausgeben und Karte automatisch erhalten" },
    { command: "Aufdecken", role: "Host/DJ", purpose: "Jahr aufdecken und werten" },
    { command: "Naechster Spieler", role: "Host/DJ", purpose: "naechster Spieler" },
  ];

  return (
    <Card>
      <CardContent style={{ display: "grid", gap: 12 }}>
        <div>
          <h3 style={{ margin: "0 0 6px" }}>Web-Steuerung</h3>
          <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>Uebersicht der Spielaktionen und wer sie ausfuehren darf.</p>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {commands.map((item) => (
            <div key={item.command} style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: 10, background: colors.bg }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <strong style={{ fontSize: 13 }}>{item.command}</strong>
                <Badge variant="secondary">{item.role}</Badge>
              </div>

              <p style={{ margin: "5px 0 0", color: colors.muted, fontSize: 12 }}>{item.purpose}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GameLog({ gameLog, discardedTracks }) {
  return (
    <Card>
      <CardContent style={{ display: "grid", gap: 16 }}>
        <div>
          <h3 style={{ margin: "0 0 6px" }}>Spielprotokoll</h3>
          <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>{discardedTracks.length} verworfene Songs</p>
        </div>

        <div style={{ display: "grid", gap: 8, maxHeight: 220, overflowY: "auto" }}>
          {gameLog.length === 0 && <p style={{ margin: 0, color: colors.muted }}>Noch keine Eintraege.</p>}

          {gameLog.map((entry) => (
            <div key={entry.id} style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: 10, background: colors.bg, color: colors.muted, fontSize: 13 }}>
              {entry.text}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EventHistory({ eventHistory }) {
  return (
    <Card>
      <CardContent style={{ display: "grid", gap: 12 }}>
        <div>
          <h3 style={{ margin: "0 0 6px" }}>Event-Stream</h3>
          <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>Technische Vorschau fuer spaeteren Multiplayer-Sync.</p>
        </div>

        <div style={{ display: "grid", gap: 8, maxHeight: 220, overflowY: "auto" }}>
          {eventHistory.length === 0 && <p style={{ margin: 0, color: colors.muted }}>Noch keine Events.</p>}

          {eventHistory.map((event) => (
            <div key={event.id} style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: 10, background: colors.bg }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ fontSize: 12 }}>{event.type}</strong>
                <span style={{ color: colors.muted, fontSize: 11 }}>Zug {event.turnNumber}</span>
              </div>

              {event.details && <p style={{ margin: "4px 0 0", color: colors.muted, fontSize: 12 }}>{event.details}</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SyncPreview({ gameState }) {
  const [copied, setCopied] = useState(false);
  const snapshotText = JSON.stringify(buildSyncSnapshot(gameState), null, 2);

  async function copySnapshot() {
    try {
      await navigator.clipboard.writeText(snapshotText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card>
      <CardContent style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div>
            <h3 style={{ margin: "0 0 6px" }}>Sync-Snapshot</h3>
            <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>Vorschau fuer spaetere Server-/Discord-Synchronisierung.</p>
          </div>

          <Button variant="secondary" onClick={copySnapshot} style={{ padding: "7px 10px", borderRadius: 12 }}>
            {copied ? "Kopiert" : "Kopieren"}
          </Button>
        </div>

        <pre
          style={{
            maxHeight: 220,
            overflow: "auto",
            margin: 0,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: 10,
            background: colors.bg,
            color: colors.muted,
            fontSize: 11,
          }}
        >
          {snapshotText}
        </pre>
      </CardContent>
    </Card>
  );
}