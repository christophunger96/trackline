import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { io } from "socket.io-client";

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
const DEFAULT_SYNC_SOCKET_URL = import.meta.env?.VITE_SOCKET_URL || "http://127.0.0.1:3001";

const SPOTIFY_CLIENT_ID_STORAGE_KEY = "trackline.spotify.clientId";
const DEFAULT_SPOTIFY_CLIENT_ID = "eb70ba4d164248d8810e52caae6b40cb";
const SPOTIFY_CODE_VERIFIER_STORAGE_KEY = "trackline.spotify.codeVerifier";
const SPOTIFY_TOKEN_STORAGE_KEY = "trackline.spotify.token";
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
  { id: "t263", title: "An Tagen wie diesen", artist: "Die Toten Hosen", year: 2012, genre: "Rock" },
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

const initialGameState = {
  phase: "lobby",
  room: null,
  players: [],
  deck: [],
  activePlayerIndex: 0,
  currentTrack: null,
  selectedInsertIndex: null,
  lastResult: null,
  targetScore: 10,
  maxTurns: 0,
  playLimitSeconds: DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS,
  difficulty: "normal",
  turnNumber: 1,
  showDebugSong: false,
  discardedTracks: [],
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
  return <div style={{ padding: 24, ...style }}>{children}</div>;
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

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function sortTimeline(timeline) {
  return [...timeline].sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
}

function createInitialPlayers(names) {
  const starters = shuffle(STARTING_TRACKS);

  return names.map((name, index) => ({
    id: createId("player"),
    name,
    role: index === 0 ? "host" : "player",
    timeline: [starters[index % starters.length]],
    score: 1,
    correct: 0,
    wrong: 0,
  }));
}

function resetPlayersForNewRound(players) {
  const starters = shuffle(STARTING_TRACKS);

  return players.map((player, index) => ({
    ...player,
    role: index === 0 ? "host" : "player",
    timeline: [starters[index % starters.length]],
    score: 1,
    correct: 0,
    wrong: 0,
  }));
}

function isCorrectPlacement(timeline, track, insertIndex) {
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

      const deck = Array.isArray(action.deck) ? action.deck : [];
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
        deck: shuffle(deck),
        targetScore: Number(action.targetScore || state.targetScore || 10),
        maxTurns: Number(action.maxTurns ?? state.maxTurns ?? 0),
        playLimitSeconds: Math.max(1, Math.min(120, Number(action.playLimitSeconds || state.playLimitSeconds || DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS))),
        difficulty: action.difficulty || state.difficulty || "normal",
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
      const players = createInitialPlayers(action.playerNames);

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
        deck: shuffle(action.deck),
        targetScore: Number(action.targetScore || 10),
        maxTurns: Number(action.maxTurns || 0),
        playLimitSeconds: Math.max(1, Math.min(120, Number(action.playLimitSeconds || DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS))),
        difficulty: action.difficulty || "normal",
        gameLog: [
          {
            id: createId("log"),
            text: `Spiel gestartet mit ${action.playerNames.length} Spielern und ${action.deck.length} Songs im Deck.`,
          },
        ],
      };

      return addEvent(nextState, "GAME_STARTED", `${action.playerNames.length} Spieler, ${action.deck.length} Songs`);
    }

    case "TRACK_DRAWN": {
      if (state.phase !== "ready" || state.deck.length === 0) return state;

      const [nextTrack, ...remainingDeck] = state.deck;

      return addEvent(
        {
          ...state,
          phase: "placing",
          currentTrack: nextTrack,
          deck: remainingDeck,
          selectedInsertIndex: null,
          lastResult: null,
          showDebugSong: false,
        },
        "TRACK_DRAWN",
        "Verdeckter Song gezogen"
      );
    }

    case "PLACEMENT_SELECTED": {
      if (state.phase !== "placing") return state;

      return addEvent(
        {
          ...state,
          selectedInsertIndex: action.insertIndex,
        },
        "PLACEMENT_SELECTED",
        `Index ${action.insertIndex}`
      );
    }

    case "TRACK_PLAY_REQUESTED": {
      if (state.phase !== "placing" || !state.currentTrack) return state;

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
      if (state.phase !== "placing" || !state.currentTrack || state.selectedInsertIndex === null) return state;

      const activePlayer = state.players[state.activePlayerIndex];
      if (!activePlayer) return state;

      const correct = isCorrectPlacement(activePlayer.timeline, state.currentTrack, state.selectedInsertIndex);
      const placementLabel = getPlacementLabel(activePlayer.timeline, state.selectedInsertIndex);

      const players = state.players.map((player, index) => {
        if (index !== state.activePlayerIndex) return player;

        return {
          ...player,
          timeline: correct ? sortedWithInsert(player.timeline, state.currentTrack) : player.timeline,
          score: correct ? player.score + 1 : player.score,
          correct: correct ? player.correct + 1 : player.correct,
          wrong: correct ? player.wrong : player.wrong + 1,
        };
      });

      const logText = correct
        ? `${activePlayer.name} hat ${state.currentTrack.title} (${state.currentTrack.year}) richtig ${placementLabel} einsortiert.`
        : `${activePlayer.name} lag mit ${state.currentTrack.title} (${state.currentTrack.year}) falsch. Gewaehlt: ${placementLabel}.`;

      return addEvent(
        {
          ...state,
          players,
          phase: "reveal",
          lastResult: {
            correct,
            placementLabel,
            playerName: activePlayer.name,
            track: state.currentTrack,
          },
          discardedTracks: correct ? state.discardedTracks : [state.currentTrack, ...state.discardedTracks],
          gameLog: [{ id: createId("log"), text: logText }, ...state.gameLog].slice(0, 12),
        },
        "TRACK_REVEALED",
        correct ? "richtig" : "falsch"
      );
    }

    case "TRACK_SKIPPED": {
      if (state.phase !== "placing" || !state.currentTrack) return state;

      const activePlayer = state.players[state.activePlayerIndex];
      if (!activePlayer) return state;

      return addEvent(
        {
          ...state,
          phase: "reveal",
          showDebugSong: true,
          discardedTracks: [state.currentTrack, ...state.discardedTracks],
          lastResult: {
            correct: false,
            skipped: true,
            placementLabel: "uebersprungen",
            playerName: activePlayer.name,
            track: state.currentTrack,
          },
          gameLog: [
            {
              id: createId("log"),
              text: `${activePlayer.name} hat ${state.currentTrack.title} uebersprungen.`,
            },
            ...state.gameLog,
          ].slice(0, 12),
        },
        "TRACK_SKIPPED",
        "Song uebersprungen"
      );
    }

    case "NEXT_PLAYER": {
      const winner = getWinner(state.players, state.targetScore);
      const turnsFinished = state.maxTurns > 0 && state.turnNumber >= state.maxTurns;
      const deckFinished = state.deck.length === 0;

      if (winner || turnsFinished || deckFinished) {
        return addEvent(
          {
            ...state,
            phase: "finished",
          },
          "GAME_FINISHED",
          winner ? `Gewinner: ${winner.name}` : "Limit erreicht"
        );
      }

      const nextIndex = (state.activePlayerIndex + 1) % state.players.length;

      return addEvent(
        {
          ...state,
          activePlayerIndex: nextIndex,
          turnNumber: state.turnNumber + 1,
          currentTrack: null,
          selectedInsertIndex: null,
          lastResult: null,
          showDebugSong: false,
          phase: "ready",
        },
        "NEXT_PLAYER",
        state.players[nextIndex]?.name || "naechster Spieler"
      );
    }

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

function getTrackDedupeKey(track) {
  return `${normalizeTrackText(track.title)}::${normalizeTrackText(track.artist)}`;
}

function dedupeTrackDeck(tracks) {
  const seen = new Set();
  const result = [];

  for (const track of tracks) {
    const key = getTrackDedupeKey(track);

    if (!key || seen.has(key)) continue;

    seen.add(key);
    result.push(track);
  }

  return result;
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
    canReveal: isHost || isActivePlayer,
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
  const [customTracks, setCustomTracks] = useState(() => loadStoredCustomTracks());
  const [selectedPreset, setSelectedPreset] = useState("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState("normal");
  const [roomCode, setRoomCode] = useState(() => getInitialRoomCode());
  const [discordClientId, setDiscordClientId] = useState(() => localStorage.getItem(DISCORD_CLIENT_ID_STORAGE_KEY) || DISCORD_CLIENT_ID_DEFAULT);
  const [discordStatus, setDiscordStatus] = useState(() =>
    isDiscordLikeEnvironment() ? "Web-App erkannt." : "Browsermodus."
  );
  const [viewerPlayerId, setViewerPlayerId] = useState(() => getInitialViewerPlayerId());
  const [socketUrl, setSocketUrl] = useState(() => getInitialSocketUrl());
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

  const socketRef = useRef(null);
  const lastRemoteStateRef = useRef("");
  const lastEmittedStateRef = useRef("");

  const fullDeck = useMemo(() => dedupeTrackDeck([...BASE_TRACK_DECK, ...THEME_TRACK_DECK, ...CATEGORY_EXPANSION_TRACKS, ...customTracks]), [customTracks]);
  const presetDeck = useMemo(() => filterDeckByPreset(fullDeck, selectedPreset), [fullDeck, selectedPreset]);
  const availableDeck = useMemo(() => filterDeckByDifficulty(presetDeck, selectedDifficulty), [presetDeck, selectedDifficulty]);

  const activePlayer = gameState.players[gameState.activePlayerIndex];
  const activeTimeline = activePlayer ? sortTimeline(activePlayer.timeline) : [];
  const winner = getWinner(gameState.players, gameState.targetScore);
  const activeRoomCode = gameState.room?.code || roomCode;

  const resolvedViewerPlayerId = (() => {
    if (viewerPlayerId === "auto-host") return gameState.room?.hostPlayerId || "spectator";

    if (viewerPlayerId === "auto-player") {
      const storedPlayerId = getStoredViewerPlayerId(activeRoomCode);
      const storedPlayer = gameState.players.find((player) => player.id === storedPlayerId);

      if (storedPlayer && storedPlayer.id !== gameState.room?.hostPlayerId) return storedPlayer.id;

      const claimedByOther = new Set(
        roomClients
          .filter((client) => client.clientInstanceId && client.clientInstanceId !== clientInstanceId)
          .map((client) => client.playerId)
          .filter(Boolean)
      );

      return (
        gameState.players.find((player) => player.id !== gameState.room?.hostPlayerId && !claimedByOther.has(player.id))?.id ||
        gameState.players.find((player) => player.id !== gameState.room?.hostPlayerId)?.id ||
        "spectator"
      );
    }

    return viewerPlayerId;
  })();
  const viewerRole = getViewerRoleFromPlayer(resolvedViewerPlayerId, gameState);
  const viewerPermissions = getViewerPermissions(viewerRole);
  const showAdminPanels = gameState.phase === "lobby" || viewerRole === "host";
  const showSpotifyPanel = showAdminPanels;

  const leaderboard = useMemo(() => {
    return [...gameState.players].sort((a, b) => b.score - a.score || a.wrong - b.wrong);
  }, [gameState.players]);

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
    localStorage.setItem(SYNC_ENABLED_STORAGE_KEY, String(syncEnabled));
  }, [syncEnabled]);

  useEffect(() => {
    if (!syncEnabled) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      setSyncStatus("Sync deaktiviert.");
      setSyncClientCount(1);
      return;
    }

    const activeRoomCode = gameState.room?.code || roomCode;
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;
    setSyncStatus("Sync verbindet...");

    socket.on("connect", () => {
      setSyncStatus(`Sync verbunden: ${socket.id}`);
      socket.emit("room:join", {
        roomCode: activeRoomCode,
        playerName: playerNames[0] || "Spieler",
        clientInstanceId,
      });
    });

    socket.on("connect_error", (error) => {
      setSyncStatus(`Sync Fehler: ${error.message}`);
    });

    socket.on("disconnect", () => {
      setSyncStatus("Sync getrennt.");
      setSyncClientCount(1);
    });

    socket.on("room:joined", ({ roomCode: joinedRoomCode, gameState: remoteGameState, clientCount, clients }) => {
      setSyncStatus(`Raum ${joinedRoomCode} verbunden.`);
      setSyncClientCount(clientCount || 1);
      setRoomClients(Array.isArray(clients) ? clients : []);

      if (remoteGameState && remoteGameState.phase !== "lobby") {
        const serializedRemoteState = JSON.stringify(remoteGameState);
        lastRemoteStateRef.current = serializedRemoteState;
        lastEmittedStateRef.current = serializedRemoteState;
        dispatch({ type: "SERVER_STATE_RECEIVED", gameState: remoteGameState });
      }
    });

    socket.on("room:state", ({ gameState: remoteGameState, clientCount, clients }) => {
      setSyncClientCount(clientCount || 1);
      if (Array.isArray(clients)) setRoomClients(clients);

      if (!remoteGameState) return;

      const serializedRemoteState = JSON.stringify(remoteGameState);
      if (serializedRemoteState === lastEmittedStateRef.current) return;

      lastRemoteStateRef.current = serializedRemoteState;
      lastEmittedStateRef.current = serializedRemoteState;
      dispatch({ type: "SERVER_STATE_RECEIVED", gameState: remoteGameState });
    });

    socket.on("room:presence", ({ clientCount, clients }) => {
      setSyncClientCount(clientCount || 1);
      setRoomClients(Array.isArray(clients) ? clients : []);
    });

    socket.on("room:claimResult", ({ ok, playerId, playerName, message }) => {
      if (ok) {
        setSyncStatus(`${playerName || "Spieler"} verbunden.`);
        storeViewerPlayerId(activeRoomCode, playerId);
      } else {
        setSyncStatus(`Namensauswahl abgelehnt: ${message}`);
      }
    });

    socket.on("room:error", ({ message }) => {
      setSyncStatus(`Sync Aktion abgelehnt: ${message}`);
    });

    return () => {
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [syncEnabled, socketUrl, roomCode, gameState.room?.code, playerNames[0], clientInstanceId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!syncEnabled || !socket?.connected) return;
    if (viewerPlayerId === "auto-host") return;
    if (!resolvedViewerPlayerId || resolvedViewerPlayerId === "spectator") return;

    const activeRoomCode = gameState.room?.code || roomCode;
    const claimedPlayer = gameState.players.find((player) => player.id === resolvedViewerPlayerId);

    socket.emit("room:claimPlayer", {
      roomCode: activeRoomCode,
      playerId: resolvedViewerPlayerId,
      playerName: claimedPlayer?.name || playerNames[0] || "Spieler",
      clientInstanceId,
    });
  }, [syncEnabled, viewerPlayerId, resolvedViewerPlayerId, gameState.room?.code, roomCode, gameState.players, playerNames, clientInstanceId]);

  useEffect(() => {
    if (!resolvedViewerPlayerId || resolvedViewerPlayerId === "spectator" || resolvedViewerPlayerId.startsWith("auto-")) return;

    storeViewerPlayerId(activeRoomCode, resolvedViewerPlayerId);
  }, [activeRoomCode, resolvedViewerPlayerId]);


  useEffect(() => {
    if (gameState.phase === "lobby") {
      localStorage.removeItem(GAME_STATE_STORAGE_KEY);
      return;
    }

    localStorage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(gameState));
  }, [gameState]);

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
    if (gameState.phase !== "placing" || !gameState.currentTrack) {
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

  function handleNextPlayer() {
    sendGameAction({ type: "NEXT_PLAYER" });
  }

  async function requestRoomSpotifyPlayback(playLimitSeconds = DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS) {
    const activeRoomCode = gameState.room?.code || roomCode;
    const serverBaseUrl = String(socketUrl || "").trim().replace(/\/+$/, "");

    if (!serverBaseUrl) {
      window.alert("Socket Server URL fehlt. Der Host muss die Server-URL setzen.");
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
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return true;
    } catch (error) {
      window.alert(error.message || "Spotify Wiedergabe konnte nicht gestartet werden.");
      return false;
    }
  }

  function sendGameAction(action) {
    const socket = socketRef.current;
    const actorPlayerId = resolvedViewerPlayerId || null;
    const actorPlayer = gameState.players.find((player) => player.id === actorPlayerId);
    const actionWithActor = {
      ...action,
      actorPlayerId,
      actorName: actorPlayer?.name || playerNames[0] || "Spieler",
    };


    if (syncEnabled && socket?.connected) {
      socket.emit("room:event", {
        roomCode: activeRoomCode,
        action: actionWithActor,
      });
      return;
    }

    dispatch(actionWithActor);
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
    });
  }

  function startNewRound() {
    sendGameAction({
      type: "NEW_ROUND",
      deck: availableDeck,
      targetScore: gameState.targetScore,
      maxTurns: gameState.maxTurns,
      playLimitSeconds: gameState.playLimitSeconds,
      difficulty: gameState.difficulty,
    });
  }

  function resetGame() {
    localStorage.removeItem(GAME_STATE_STORAGE_KEY);
    sendGameAction({ type: "RESET_GAME" });
  }

  const twoColumnLayout = {
    display: "grid",
    gridTemplateColumns: "minmax(0, calc(100% - 364px)) 340px",
    gap: 24,
    alignItems: "start",
    width: "100%",
  };

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, color: colors.text, padding: 24, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: 24 }}>
        <Header onReset={resetGame} isInGame={gameState.phase !== "lobby"} />

        {showAdminPanels && (
          <WebsiteShareCard
            room={gameState.room}
            roomCode={roomCode}
            playerNames={playerNames}
            socketUrl={socketUrl}
            syncClientCount={syncClientCount}
          />
        )}

        {showAdminPanels && (
          <MultiplayerSyncCard
            roomCode={gameState.room?.code || roomCode}
            socketUrl={socketUrl}
            setSocketUrl={setSocketUrl}
            syncEnabled={syncEnabled}
            setSyncEnabled={setSyncEnabled}
            syncStatus={syncStatus}
            syncClientCount={syncClientCount}
          />
        )}

        {showSpotifyPanel && (
          <SpotifyPlayerCard
            currentTrack={gameState.currentTrack}
            phase={gameState.phase}
            canPlayTrack={viewerPermissions.canPlayTrack}
            canManageSpotify={showAdminPanels}
            roomCode={gameState.room?.code || roomCode}
            spotifyAuthServerUrl={socketUrl}
            roundPlayLimitSeconds={gameState.playLimitSeconds}
            onPlaybackRequested={() =>
              sendGameAction({
                type: "TRACK_PLAY_REQUESTED",
                requesterName: activePlayer?.name,
                playLimitSeconds: gameState.playLimitSeconds || DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS,
              })
            }
          />
        )}

        {gameState.phase === "lobby" && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(280px, 0.65fr)", gap: 24 }}>
            <main style={{ display: "grid", gap: 24, minWidth: 0 }}>
              <LobbyCard
                playerName={playerName}
                setPlayerName={setPlayerName}
                playerNames={playerNames}
                addPlayer={addPlayer}
                removePlayer={removePlayer}
                startGame={startGame}
                availableDeck={availableDeck}
                fullDeck={fullDeck}
                selectedPreset={selectedPreset}
                setSelectedPreset={setSelectedPreset}
                selectedDifficulty={selectedDifficulty}
                setSelectedDifficulty={setSelectedDifficulty}
                presetDeckCount={presetDeck.length}
                roomCode={roomCode}
                setRoomCode={setRoomCode}
              />

            </main>

            <aside style={{ display: "grid", gap: 24, alignContent: "start", minWidth: 0 }}>
              <RulesCard />
            </aside>
          </div>
        )}

        {gameState.phase !== "lobby" && gameState.players.length > 0 && (
          <div style={twoColumnLayout}>
            <main style={{ display: "grid", gap: 24, minWidth: 0 }}>
              <Card style={{ minWidth: 0, overflow: "hidden" }}>
                <CardContent style={{ display: "grid", gap: 20, minWidth: 0 }}>
                  <RoleStatusBanner
                    viewerRole={viewerRole}
                    activePlayer={activePlayer}
                    permissions={viewerPermissions}
                    syncEnabled={syncEnabled}
                    player={gameState.players.find((item) => item.id === resolvedViewerPlayerId)}
                  />

                  <GameHeader
                    activePlayer={activePlayer}
                    deck={gameState.deck}
                    turnNumber={gameState.turnNumber}
                    maxTurns={gameState.maxTurns}
                    targetScore={gameState.targetScore}
                    playLimitSeconds={gameState.playLimitSeconds}
                    difficulty={gameState.difficulty}
                  />

                  <CurrentTrackPanel
                    phase={gameState.phase}
                    currentTrack={gameState.currentTrack}
                    showDebugSong={gameState.showDebugSong}
                    canHostControl={viewerPermissions.canHostControl}
                    canDrawTrack={viewerPermissions.canDrawTrack}
                    canPlayTrack={viewerPermissions.canPlayTrack}
                    playbackRemainingSeconds={
                      roomPlaybackTimer.trackId === gameState.currentTrack?.id ? roomPlaybackTimer.remainingSeconds : 0
                    }
                    playbackTotalSeconds={gameState.playLimitSeconds}
                    playbackRequester={roomPlaybackTimer.requester}
                    onPlayTrack={handleSongStart}
                    onToggleDebug={() => sendGameAction({ type: "TOGGLE_DEBUG_SONG" })}
                    onDrawTrack={() => sendGameAction({ type: "TRACK_DRAWN" })}
                    onSkipTrack={() => sendGameAction({ type: "TRACK_SKIPPED" })}
                  />

                  {gameState.phase === "placing" && gameState.currentTrack && (
                    <div
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 22,
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
                        <strong>Position gewählt?</strong>
                        <p style={{ color: colors.muted, margin: "4px 0 0", fontSize: 13 }}>Dann decke die Karte auf und prüfe das Jahr.</p>
                      </div>

                      <ActionPill
                        onClick={handleRevealTrack}
                        disabled={gameState.selectedInsertIndex === null || !viewerPermissions.canReveal}
                        hint="Karte drehen"
                      >
                        Aufdecken
                      </ActionPill>
                    </div>
                  )}

                  <TimelineChooser
                    playerName={activePlayer?.name}
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
                    />
                  )}

                  {(winner || gameState.phase === "finished") && (
                    <FinishedPanel
                      leaderboard={leaderboard}
                      onNewRound={startNewRound}
                      canNewRound={viewerPermissions.canHostControl}
                    />
                  )}
                </CardContent>
              </Card>

              <AllTimelines players={gameState.players} activePlayerIndex={gameState.activePlayerIndex} />
            </main>

            <aside style={{ display: "grid", gap: 24, alignContent: "start", minWidth: 0 }}>
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

              {showAdminPanels && <RoomCard room={gameState.room} players={gameState.players} activePlayerIndex={gameState.activePlayerIndex} />}
              <Leaderboard players={leaderboard} />
              <TurnOrder players={gameState.players} activePlayerIndex={gameState.activePlayerIndex} />

              {showAdminPanels ? (
                <HostAdminDetails
                  playbackRequests={gameState.playbackRequests}
                  gameLog={gameState.gameLog}
                  discardedTracks={gameState.discardedTracks}
                  eventHistory={gameState.eventHistory}
                  gameState={gameState}
                />
              ) : (
                <PlayerFocusedCard viewerRole={viewerRole} activePlayer={activePlayer} permissions={viewerPermissions} />
              )}
            </aside>
          </div>
        )}

      </div>
    </div>
  );
}

function Header({ onReset, isInGame }) {
  return (
    <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 36, letterSpacing: -1 }}>Trackline</h1>
        <p style={{ margin: "6px 0 0", color: colors.muted }}>Privates Musik-Timeline-Quiz als Web-Spiel</p>
      </div>

      <Button variant="secondary" onClick={onReset}>
        {isInGame ? "Spiel beenden" : "Neustart"}
      </Button>
    </header>
  );
}

function WebsiteShareCard({ room, roomCode, playerNames, socketUrl, syncClientCount = 1 }) {
  const activeRoomCode = room?.code || roomCode;
  const hostName = room?.hostName || playerNames[0] || "Host";
  const [copied, setCopied] = useState(false);
  const normalizedSocketUrl = String(socketUrl || "").trim().replace(/\/+$/, "");
  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(activeRoomCode)}&role=player&server=${encodeURIComponent(normalizedSocketUrl)}`
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
            <Badge variant="secondary">Host-Dashboard</Badge>
            <h2 style={{ margin: "10px 0 6px", letterSpacing: -0.6 }}>Runde bereitstellen</h2>
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
        </details>
      </CardContent>
    </Card>
  );
}

function MultiplayerSyncCard({ roomCode, socketUrl, setSocketUrl, syncEnabled, setSyncEnabled, syncStatus, syncClientCount }) {
  return (
    <Card>
      <CardContent style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <Badge variant="secondary">Multiplayer Sync</Badge>
            <h2 style={{ margin: "10px 0 6px" }}>Room-State synchronisieren</h2>
            <p style={{ margin: 0, color: colors.muted }}>
              Verbindet alle Browser mit gleichem Raumcode. Clients senden nur Aktionen; der Server berechnet den GameState.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Badge variant={syncEnabled ? "default" : "secondary"}>{syncEnabled ? "Sync aktiv" : "Sync aus"}</Badge>
            <Badge variant="secondary">{syncClientCount} Client(s)</Badge>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ color: colors.muted, fontSize: 14 }}>Socket Server URL</span>
            <Input
              value={socketUrl}
              onChange={(event) => setSocketUrl(event.target.value)}
              placeholder="http://127.0.0.1:3001"
            />
          </label>

          <Button variant={syncEnabled ? "danger" : "primary"} onClick={() => setSyncEnabled(!syncEnabled)}>
            {syncEnabled ? "Sync trennen" : "Sync verbinden"}
          </Button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          <InfoTile label="Sync-Raum" value={roomCode} />
          <InfoTile label="Status" value={syncStatus} />
        </div>

        <div style={{ border: `1px solid ${colors.border}`, borderRadius: 16, padding: 14, background: colors.bg }}>
          <p style={{ margin: "0 0 6px", fontWeight: 800 }}>Testablauf</p>
          <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>
            Oeffne denselben Raum in zwei Browserfenstern oder bei zwei Freunden, stelle denselben Raumcode ein und aktiviere Sync.
            Aktionen wie Spielstart, Song ziehen, Platzierung und Reveal werden an den Server gesendet und dann an alle Clients verteilt.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SpotifyPlayerCard({ currentTrack, phase, canPlayTrack, canManageSpotify, roomCode, spotifyAuthServerUrl, roundPlayLimitSeconds = DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS, onPlaybackRequested }) {
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
  const [savedDeviceName, setSavedDeviceName] = useState("");
  const [spotifyDetailsOpen, setSpotifyDetailsOpen] = useState(false);

  const countdownIntervalRef = useRef(null);

  function getSpotifyAuthServerBaseUrl() {
    return String(spotifyAuthServerUrl || "").trim().replace(/\/+$/, "");
  }

  function getSpotifyServerRedirectUri() {
    const baseUrl = getSpotifyAuthServerBaseUrl();

    if (!baseUrl) return "Socket Server URL fehlt";

    return `${baseUrl}/spotify/callback`;
  }

  function getRoomSpotifyUrl(path = "") {
    const baseUrl = getSpotifyAuthServerBaseUrl();

    if (!baseUrl) {
      throw new Error("Socket Server URL fehlt.");
    }

    return `${baseUrl}/room/${encodeURIComponent(roomCode)}/spotify${path}`;
  }

  function clearCountdown() {
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    setRemainingSeconds(0);
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
        clearCountdown();
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
  }, [currentTrack, phase, canPlayTrack, isBusy, roomCode, spotifyAuthServerUrl, playLimitSeconds, selectedSpotifyDeviceId]);

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
      setSavedDeviceName(data.deviceName || "");

      if (data.deviceId && !selectedSpotifyDeviceId) {
        setSelectedSpotifyDeviceId(data.deviceId);
      }

      if (!quiet) {
        setStatus(
          data.connected
            ? `Spotify verbunden${data.deviceName ? `, Zielgeraet: ${data.deviceName}` : ""}.`
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
      throw new Error("Bitte zuerst eine Socket Server URL eintragen.");
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
      setStatus("Server startet den verdeckten Song auf dem gespeicherten Spotify-Geraet...");

      const response = await fetch(getRoomSpotifyUrl("/play"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playLimitSeconds,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      setSpotifyConnected(true);
      setSavedDeviceName(data.deviceName || savedDeviceName);
      startLocalCountdown(playLimitSeconds);
      setStatus(`Verdeckter Song laeuft auf ${data.deviceName || "Spotify"}. TimeLimit: ${playLimitSeconds} Sekunden.`);
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
  const showSpotifyDetails = !spotifyConnected || !savedDeviceName || spotifyDetailsOpen || Boolean(externalLoginUrl);

  return (
    <Card>
      <CardContent style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <Badge variant="secondary">Spotify</Badge>
            <h2 style={{ margin: "10px 0 6px" }}>Ein Host-Account fuer den Raum</h2>
            <p style={{ margin: 0, color: colors.muted }}>
              Der Host verbindet Spotify in der Lobby oder im Spiel und speichert ein Zielgeraet. Der Spotify-Bereich ist nur fuer den Host sichtbar.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Badge variant={spotifyConnected ? "default" : "secondary"}>{spotifyConnected ? "Host Spotify verbunden" : "Nicht verbunden"}</Badge>
            <Badge variant={savedDeviceName ? "default" : "secondary"}>{savedDeviceName || "Kein Zielgeraet"}</Badge>
          </div>
        </div>

        {canManageSpotify && spotifyConnected && savedDeviceName && (
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
              <p style={{ margin: "4px 0 0", color: colors.muted, fontSize: 13 }}>Zielgeraet: {savedDeviceName}</p>
            </div>

            <Button variant="secondary" onClick={() => setSpotifyDetailsOpen((value) => !value)}>
              {spotifyDetailsOpen ? "Spotify-Details ausblenden" : "Gerät / Login ändern"}
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
                Spotify Login vorbereiten
              </Button>

              <Button variant="secondary" onClick={() => refreshSpotifyStatus()} disabled={isBusy}>
                Status laden
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
              Raum: {roomCode} | Zielgeraet: {savedDeviceName || selectedDevice?.name || "-"}
            </p>
            <p style={{ margin: "6px 0 0", color: colors.muted, fontSize: 12 }}>
              Redirect URI fuer Spotify Dashboard: {getSpotifyServerRedirectUri()}
            </p>
          </div>

          <Button onClick={playCurrentTrack} disabled={!canStartSpotify}>
            {isBusy ? "Startet..." : `Song ${playLimitSeconds}s starten`}
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
  addPlayer,
  removePlayer,
  startGame,
  availableDeck,
  fullDeck,
  selectedPreset,
  setSelectedPreset,
  selectedDifficulty,
  setSelectedDifficulty,
  presetDeckCount,
  roomCode,
  setRoomCode,
}) {
  const [targetScore, setTargetScore] = useState(10);
  const [maxTurns, setMaxTurns] = useState(0);
  const [playLimitSeconds, setPlayLimitSeconds] = useState(DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS);
  const targetScoreOptions = [5, 7, 10, 15];

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
          <Badge variant="secondary">Lobby</Badge>
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
              {presetDeckCount} vor Schwierigkeit · Dubletten entfernt
            </p>
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

        <Button onClick={() => startGame({ targetScore, maxTurns, playLimitSeconds })} disabled={playerNames.length < 1 || availableDeck.length < 1} style={{ padding: "14px 22px", fontSize: 16 }}>
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

function GameHeader({ activePlayer, deck, turnNumber, maxTurns, targetScore, playLimitSeconds, difficulty }) {
  return (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 22,
        padding: 16,
        background: "rgba(2,6,23,0.38)",
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <Badge variant="secondary">Spielstatus</Badge>
          <h2 style={{ fontSize: 30, margin: "10px 0 4px", letterSpacing: -0.8 }}>
            {activePlayer?.name || "-"} ist dran
          </h2>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge variant="secondary">
            Runde {turnNumber}
            {maxTurns > 0 ? ` / ${maxTurns}` : ""}
          </Badge>
          <Badge variant="secondary">{deck.length} im Deck</Badge>
          <Badge variant="secondary">Ziel: {targetScore} Karten</Badge>
          <Badge variant="secondary">{playLimitSeconds || DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS}s Songzeit</Badge>
          <Badge variant="secondary">{DIFFICULTY_OPTIONS.find((item) => item.id === difficulty)?.label || "Normal"}</Badge>
        </div>
      </div>

      <div style={{ color: colors.muted, fontSize: 13 }}>
        Runde {turnNumber} · {activePlayer?.name || "-"} ist dran · {deck.length} Karten im Deck · Ziel: {targetScore} Karten · Songzeit: {playLimitSeconds || DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS}s
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



function CurrentTrackPanel({
  phase,
  currentTrack,
  showDebugSong,
  canHostControl,
  canDrawTrack,
  canPlayTrack,
  playbackRemainingSeconds = 0,
  playbackTotalSeconds = DEFAULT_SPOTIFY_PLAY_LIMIT_SECONDS,
  playbackRequester = "",
  onPlayTrack,
  onToggleDebug,
  onDrawTrack,
  onSkipTrack,
}) {
  const revealed = currentTrack && (phase === "reveal" || showDebugSong);

  return (
    <div
      style={{
        borderRadius: 28,
        border: `1px solid ${colors.border}`,
        background: cardTheme.table,
        padding: 22,
        display: "grid",
        gridTemplateColumns: "max-content minmax(0, 1fr)",
        gap: 24,
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
          <h2 style={{ margin: "12px 0 6px", fontSize: 30, letterSpacing: -0.6 }}>
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

function TimelineChooser({ playerName, timeline, phase, selectedInsertIndex, setSelectedInsertIndex, canPlace }) {
  const orderedTimeline = sortTimeline(timeline);
  const disabled = phase !== "placing" || !canPlace;

  return (
    <div style={{ display: "grid", gap: 14, minWidth: 0, maxWidth: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0 }}>Timeline von {playerName}</h3>
          <p style={{ margin: "6px 0 0", color: colors.muted, fontSize: 13 }}>
            Chronologisch von links nach rechts. Freie Kartenplaetze markieren moegliche Positionen.
          </p>
        </div>

        <Badge variant="secondary">{orderedTimeline.length} Karten</Badge>
      </div>

      <div
        style={{
          padding: "24px 18px 18px",
          borderRadius: 24,
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
            gap: 10,
            minWidth: "max-content",
            paddingBottom: 14,
          }}
        >
          <PlacementButton selected={selectedInsertIndex === 0} disabled={disabled} onClick={() => setSelectedInsertIndex(0)} label="Davor" compact />

          {orderedTimeline.map((track, index) => (
            <React.Fragment key={track.id}>
              <TimelineTrackCard track={track} compact />
              <PlacementButton
                selected={selectedInsertIndex === index + 1}
                disabled={disabled}
                onClick={() => setSelectedInsertIndex(index + 1)}
                label={index + 1 === orderedTimeline.length ? "Danach" : "Hier"}
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
  const width = compact ? 116 : 138;

  return (
    <div
      style={{
        width,
        minHeight: compact ? 154 : 184,
        borderRadius: 16,
        padding: compact ? 10 : 12,
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
        width: compact ? 96 : 118,
        minHeight: compact ? 154 : 170,
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

function ResultPanel({ result, timeline = [], onNext, canAdvance }) {
  const isSkipped = Boolean(result.skipped);
  const isCorrect = result.correct && !isSkipped;
  const accent = isSkipped ? colors.warning : isCorrect ? colors.good : colors.bad;
  const borderColor = isSkipped ? "#f59e0b" : isCorrect ? "#10b981" : "#ef4444";
  const textColor = isSkipped ? "#fde68a" : isCorrect ? "#bbf7d0" : "#fecaca";
  const headline = isSkipped ? "Song übersprungen" : isCorrect ? "Richtig gelegt!" : "Knapp daneben";
  const icon = isSkipped ? "↷" : isCorrect ? "✓" : "×";
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
        `}
      </style>

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
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isCorrect || isSkipped ? "1fr" : "1fr 1fr", gap: 10 }}>
          <div
            style={{
              border: `1px solid ${borderColor}`,
              borderRadius: 18,
              padding: 14,
              background: "rgba(0,0,0,0.16)",
            }}
          >
            <span style={{ display: "block", color: textColor, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 900 }}>
              Gewählte Position
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

  return (
    <div
      style={{
        border: "1px solid #f59e0b",
        background: "radial-gradient(circle at top, rgba(245,158,11,0.22), transparent 34%), rgba(120,53,15,0.35)",
        borderRadius: 26,
        padding: 22,
        display: "grid",
        gap: 18,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <Badge variant="secondary">Finale</Badge>
          <h2 style={{ margin: "10px 0 4px", fontSize: 30 }}>Spiel beendet</h2>
          <p style={{ margin: 0, color: "#fde68a" }}>Gewinner: {winner?.name || "-"} mit {winner?.score || 0} Karten.</p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div
            style={{
              minWidth: 120,
              borderRadius: 20,
              padding: 16,
              background: cardTheme.ivory,
              color: "#111827",
              textAlign: "center",
              boxShadow: "0 18px 38px rgba(0,0,0,0.24)",
            }}
          >
            <div style={{ fontSize: 30 }}>★</div>
            <strong style={{ display: "block", fontSize: 24 }}>{winner?.score || 0}</strong>
            <span style={{ color: "#64748b", fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>Karten</span>
          </div>

          <Button onClick={onNewRound} disabled={!canNewRound} style={{ padding: "14px 18px" }}>
            Neue Runde gleiche Spieler
          </Button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        {leaderboard.slice(0, 3).map((player, index) => (
          <div
            key={player.id}
            style={{
              borderRadius: 18,
              padding: 14,
              background: index === 0 ? "rgba(245,158,11,0.18)" : colors.bg,
              border: `1px solid ${index === 0 ? "#f59e0b" : colors.border}`,
              textAlign: "center",
            }}
          >
            <Badge variant={index === 0 ? "default" : "secondary"}>#{index + 1}</Badge>
            <strong style={{ display: "block", marginTop: 8 }}>{player.name}</strong>
            <span style={{ color: colors.muted, fontSize: 12 }}>{player.score} Karten</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AllTimelines({ players, activePlayerIndex }) {
  return (
    <Card style={{ minWidth: 0, overflow: "hidden" }}>
      <CardContent style={{ display: "grid", gap: 12, minWidth: 0, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: 0 }}>Alle Timelines</h3>
            <p style={{ margin: "4px 0 0", color: colors.muted, fontSize: 12 }}>Kompakte Übersicht aller Spieler.</p>
          </div>

          <Badge variant="secondary">{players.length} Spieler</Badge>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {players.map((player, index) => {
            const sortedTimeline = sortTimeline(player.timeline);
            const isActive = index === activePlayerIndex;

            return (
              <div
                key={player.id}
                style={{
                  border: `1px solid ${isActive ? colors.primary : colors.border}`,
                  borderRadius: 16,
                  padding: 10,
                  background: isActive ? "rgba(126,87,255,0.12)" : colors.bg,
                  boxShadow: isActive ? "0 12px 28px rgba(126,87,255,0.10)" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8, alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 14 }}>{player.name}</strong>
                    {isActive && <Badge>am Zug</Badge>}
                  </div>
                  <Badge variant="secondary">{player.score} Karten</Badge>
                </div>

                <div style={{ overflowX: "auto", overflowY: "hidden", maxWidth: "100%", minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 5, minWidth: "max-content", paddingBottom: 2, alignItems: "center" }}>
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
  const roleLabel =
    {
      host: "Host",
      activePlayer: "Aktiver Spieler",
      player: "Spieler",
      spectator: "Zuschauer",
    }[viewerRole] || viewerRole;

  const selectedPlayer = players.find((player) => player.id === viewerPlayerId);
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
      <CardContent style={{ display: "grid", gap: 14 }}>
        <div>
          <h3 style={{ margin: "0 0 6px" }}>Deine Ansicht</h3>
          <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>
            Waehle deinen Namen aus. Bereits belegte Namen sind gesperrt.
          </p>
        </div>

        <Select value={viewerPlayerId} onChange={handleViewerChange}>
          <option value="auto-host">Host automatisch beim Spielstart</option>
          <option value="auto-player">Automatisch: Spieler per Einladungslink</option>

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

        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 18,
            padding: 14,
            background: cardTheme.table,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div>
            <span style={{ display: "block", color: colors.muted, fontSize: 12 }}>Aktuelle Ansicht</span>
            <strong>{selectedPlayer?.name || roleLabel}</strong>
          </div>

          <Badge variant={viewerRole === "activePlayer" ? "default" : "secondary"}>{roleLabel}</Badge>
        </div>
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
                  gridTemplateColumns: "28px minmax(0, 1fr) 44px",
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
                  <span style={{ color: colors.muted, fontSize: 11 }}>{player.correct}✓ · {player.wrong}×</span>
                </div>

                <strong
                  style={{
                    justifySelf: "end",
                    fontSize: 22,
                    color: isLeader ? "#c4b5fd" : colors.text,
                  }}
                >
                  {player.score}
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


function HostAdminDetails({ playbackRequests, gameLog, discardedTracks, eventHistory, gameState }) {
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