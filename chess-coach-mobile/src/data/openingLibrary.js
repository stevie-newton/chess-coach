export const openingDetails = {
  "Italian Game": {
    color: "White",
    mainLine: ["1. e4 e5", "2. Nf3 Nc6", "3. Bc4"],
    moveExplanations: [
      "e4 takes central space and opens lines for the queen and bishop.",
      "e5 matches White's central claim and keeps Black active.",
      "Nf3 develops a piece and attacks e5.",
      "Nc6 develops a piece, protects e5, and controls the center.",
      "Bc4 develops toward the active diagonal and pressures f7.",
    ],
    concepts: ["Control the center", "Castle early", "Attack the weak f7 square", "Develop pieces before pawn-grabbing", "Keep bishops active"],
    overview: "A classical king-pawn opening focused on fast development, central control, and pressure against f7.",
    variations: ["Giuoco Piano", "Evans Gambit", "Two Knights Defense", "Fried Liver Attack"],
    variationTree: [
      { name: "Giuoco Piano", line: "3...Bc5", idea: "Quiet development with c3 and d4 ideas." },
      { name: "Evans Gambit", line: "4. b4", idea: "Sacrifice a pawn for rapid development and open lines." },
      { name: "Two Knights Defense", line: "3...Nf6", idea: "Black counterattacks e4 and invites sharp tactics." },
      { name: "Fried Liver Attack", line: "4. Ng5", idea: "Target f7 immediately when Black allows it." },
    ],
    keyIdeas: ["Develop quickly", "Castle early", "Pressure f7", "Fight for d4"],
    traps: ["Fried Liver tactics on f7", "Evans Gambit development traps", "Early queen checks that lose time"],
    commonTraps: [
      {
        name: "Fried Liver Attack",
        setup: "If Black develops naturally but allows Ng5, White can jump into f7 with a forcing attack.",
        payoff: "White drags the king into the open and gains a dangerous initiative.",
        moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "Ng5", "d5", "exd5", "Nxd5", "Nxf7"],
      },
    ],
    famousGames: ["Greco attacking games", "Morphy vs Allies, Paris 1858", "Karpov model Italian structures"],
  },
  "Ruy Lopez": {
    color: "White",
    mainLine: ["1. e4 e5", "2. Nf3 Nc6", "3. Bb5"],
    moveExplanations: [
      "e4 claims the center and opens attacking lines.",
      "e5 challenges the center directly.",
      "Nf3 develops with tempo against e5.",
      "Nc6 develops and reinforces e5.",
      "Bb5 pressures the defender of e5 and creates long-term tension.",
    ],
    concepts: ["Control the center", "Develop with pressure", "Prepare king safety", "Preserve pawn structure", "Improve piece activity through tension"],
    overview: "A strategic opening that pressures the c6 knight and builds long-term central control.",
    variations: ["Closed Ruy Lopez", "Exchange Variation", "Berlin Defense", "Open Ruy Lopez"],
    variationTree: [
      { name: "Closed Ruy Lopez", line: "3...a6 4. Ba4 Nf6", idea: "Long maneuvering fight with central tension." },
      { name: "Exchange Variation", line: "4. Bxc6", idea: "Trade bishop for structure and endgame chances." },
      { name: "Berlin Defense", line: "3...Nf6", idea: "Challenge e4 and aim for a resilient endgame." },
      { name: "Open Ruy Lopez", line: "5...Nxe4", idea: "Black opens the center and accepts active piece play." },
    ],
    keyIdeas: ["Pressure e5", "Prepare c3 and d4", "Keep central tension", "Use queenside space"],
    traps: ["Noah's Ark trap", "Early e5 pawn tactics", "Loose bishop retreat squares"],
    famousGames: ["Fischer Ruy Lopez wins", "Kasparov vs Karpov Ruy Lopez battles", "Carlsen Berlin endgames"],
  },
  "London System": {
    color: "White",
    mainLine: ["1. d4 d5", "2. Bf4 Nf6", "3. e3"],
    moveExplanations: [
      "d4 takes central space and supports a stable setup.",
      "d5 contests the center immediately.",
      "Bf4 develops outside the pawn chain before e3.",
      "Nf6 develops and fights for e4.",
      "e3 supports d4 and opens the bishop path.",
    ],
    concepts: ["Build a stable center", "Develop pieces to natural squares", "Keep the king safe", "Use a solid pawn structure", "Create activity with Ne5 and Bd3"],
    overview: "A reliable setup opening built around Bf4, e3, Nf3, and a solid central structure.",
    variations: ["Classical London", "Jobava London", "Accelerated London", "Anti-King's Indian London"],
    variationTree: [
      { name: "Classical London", line: "d4, Bf4, e3, Nf3", idea: "Build a repeatable solid setup." },
      { name: "Jobava London", line: "Nc3 and Bf4", idea: "Add quick queenside pressure and tactical threats." },
      { name: "Accelerated London", line: "1. d4 2. Bf4", idea: "Develop the bishop before Black fixes the structure." },
      { name: "Anti-King's Indian London", line: "Bf4, e3, Be2", idea: "Stay compact against g6 setups." },
    ],
    keyIdeas: ["Build a stable triangle", "Control e5", "Attack h7 when possible", "Keep development simple"],
    traps: ["Bxh7+ Greek Gift ideas", "Qb3 pressure on b7", "Loose queenside pawns"],
    famousGames: ["Kamsky London games", "Carlsen rapid London wins", "Jobava creative London games"],
  },
  "Queen's Gambit": {
    color: "White",
    mainLine: ["1. d4 d5", "2. c4"],
    moveExplanations: [
      "d4 controls central squares and prepares c4.",
      "d5 matches White's central presence.",
      "c4 challenges Black's d5 pawn and opens queenside play.",
    ],
    concepts: ["Control the center", "Develop smoothly", "Castle before opening the position", "Use the c-pawn structure", "Activate rooks on open files"],
    overview: "A central opening that offers the c-pawn to challenge Black's d5 pawn and build space.",
    variations: ["Queen's Gambit Declined", "Queen's Gambit Accepted", "Slav Defense", "Tarrasch Defense"],
    variationTree: [
      { name: "Queen's Gambit Declined", line: "2...e6", idea: "Black keeps the center solid." },
      { name: "Queen's Gambit Accepted", line: "2...dxc4", idea: "Black accepts the pawn and must survive development pressure." },
      { name: "Slav Defense", line: "2...c6", idea: "Support d5 while freeing the light bishop." },
      { name: "Tarrasch Defense", line: "2...e6 3. Nc3 c5", idea: "Black accepts an isolated pawn for activity." },
    ],
    keyIdeas: ["Challenge d5", "Develop harmoniously", "Use queenside majority", "Open the c-file"],
    traps: ["Elephant trap", "QGA pawn-grab dangers", "Back-rank tactics on the c-file"],
    famousGames: ["Capablanca QGD games", "Alekhine attacking QG games", "Kramnik Catalan-style structures"],
  },
  "English Opening": {
    color: "White",
    mainLine: ["1. c4", "1... e5", "2. Nc3 Nf6", "3. g3"],
    moveExplanations: [
      "c4 controls d5 and keeps the central structure flexible.",
      "e5 takes central space against the flank opening.",
      "Nc3 increases pressure on d5 and supports central breaks.",
      "Nf6 develops and watches e4 and d5.",
      "g3 prepares a strong bishop on the long diagonal.",
    ],
    concepts: ["Control d5 from the flank", "Develop flexibly", "Keep king safety with g3 and Bg2", "Delay pawn-structure commitments", "Activate pieces on long diagonals"],
    overview: "A flexible flank opening that controls d5 and often transposes into reversed Sicilian or queen-pawn structures.",
    variations: ["Reversed Sicilian", "Symmetrical English", "Four Knights English", "Botvinnik setup"],
    variationTree: [
      { name: "Reversed Sicilian", line: "1...e5", idea: "White plays a Sicilian structure with an extra tempo." },
      { name: "Symmetrical English", line: "1...c5", idea: "Both sides contest d4 and d5 from the flank." },
      { name: "Four Knights English", line: "Nc3, Nf3, ...Nc6, ...Nf6", idea: "Natural development with central tension." },
      { name: "Botvinnik setup", line: "c4, g3, Bg2, e4", idea: "Build a strong dark-square bind." },
    ],
    keyIdeas: ["Control d5", "Fianchetto the bishop", "Delay central commitment", "Use queenside space"],
    traps: ["Early d5 breaks", "Tactics on the long diagonal", "Loose e5 pawn shots"],
    famousGames: ["Botvinnik English structures", "Karpov positional English wins", "Carlsen flexible English games"],
  },
  "Vienna Game": {
    color: "White",
    mainLine: ["1. e4 e5", "2. Nc3 Nf6", "3. f4"],
    moveExplanations: [
      "e4 takes the center and opens attacking lines.",
      "e5 fights for equal central space.",
      "Nc3 develops while supporting e4 and preparing f4.",
      "Nf6 develops and attacks e4.",
      "f4 starts the Vienna Gambit and builds kingside initiative.",
    ],
    concepts: ["Control the center", "Develop quickly", "Castle before attacking", "Use the f-pawn structure carefully", "Create active kingside pieces"],
    overview: "An aggressive e4 opening where White develops Nc3 and can launch a fast kingside attack.",
    variations: ["Vienna Gambit", "Mieses Variation", "Quiet Vienna", "Max Lange Defense"],
    variationTree: [
      { name: "Vienna Gambit", line: "3. f4", idea: "Attack quickly and challenge e5." },
      { name: "Mieses Variation", line: "3. g3", idea: "Fianchetto and play a slower strategic game." },
      { name: "Quiet Vienna", line: "3. Bc4", idea: "Develop naturally toward f7." },
      { name: "Max Lange Defense", line: "2...Nc6", idea: "Black develops and keeps symmetry." },
    ],
    keyIdeas: ["Support e4", "Prepare f4", "Attack the kingside", "Use quick development"],
    traps: ["Vienna Gambit tactics", "Nxe5 queen tricks", "Weak f7 pressure"],
    famousGames: ["Spielmann Vienna games", "Modern rapid Vienna attacks", "Romantic-era Vienna examples"],
  },
  "Sicilian Defense": {
    color: "Black",
    mainLine: ["1. e4 c5", "2. Nf3 d6", "3. d4 cxd4"],
    moveExplanations: [
      "e4 takes central space.",
      "c5 creates asymmetry and challenges d4 from the flank.",
      "Nf3 develops and prepares d4.",
      "d6 supports the center and controls e5.",
      "d4 opens the center.",
      "cxd4 trades into the open Sicilian and creates c-file counterplay.",
    ],
    concepts: ["Fight for central dark squares", "Develop before attacking", "Keep king safety under pressure", "Use asymmetrical pawn structure", "Create piece activity on the c-file"],
    overview: "A fighting defense to 1.e4 where Black creates asymmetry and counterplay from move one.",
    variations: ["Najdorf", "Dragon", "Classical Sicilian", "Scheveningen", "Accelerated Dragon"],
    variationTree: [
      { name: "Najdorf", line: "...a6", idea: "Flexible queenside control and sharp counterplay." },
      { name: "Dragon", line: "...g6", idea: "Fianchetto the bishop and attack along the long diagonal." },
      { name: "Classical Sicilian", line: "...Nc6 and ...d6", idea: "Develop naturally with central resilience." },
      { name: "Scheveningen", line: "...e6 and ...d6", idea: "Compact center with dynamic breaks." },
      { name: "Accelerated Dragon", line: "...Nc6 and ...g6", idea: "Reach Dragon pressure without early ...d6." },
    ],
    keyIdeas: ["Challenge d4", "Create queenside counterplay", "Use the half-open c-file", "Watch kingside attacks"],
    traps: ["Poisoned Pawn tactics", "Dragon exchange sacrifices", "Uncastled king tactics"],
    famousGames: ["Fischer Najdorf games", "Kasparov Sicilian wins", "Topalov-Kasparov 1999"],
  },
  "Sicilian Najdorf": {
    color: "Black",
    mainLine: ["1. e4 c5", "2. Nf3 d6", "3. d4 cxd4", "4. Nxd4 Nf6", "5. Nc3 a6"],
    moveExplanations: [
      "e4 takes central space.",
      "c5 creates asymmetry and fights for d4 from the flank.",
      "Nf3 develops and prepares d4.",
      "d6 supports e5 and keeps the center flexible.",
      "d4 opens the center.",
      "cxd4 trades into the open Sicilian.",
      "Nxd4 centralizes the knight.",
      "Nf6 develops with tempo on e4.",
      "Nc3 defends e4 and supports central control.",
      "a6 is the Najdorf move: it controls b5 and prepares flexible queenside counterplay.",
    ],
    concepts: ["Create asymmetry", "Control b5 and e5", "Develop before attacking", "Keep king safety under pressure", "Use queenside counterplay"],
    overview: "A sharp Sicilian system where Black plays ...a6 to control b5, keep flexible piece development, and prepare dynamic counterplay.",
    variations: ["English Attack", "Poisoned Pawn", "Classical Najdorf", "Scheveningen setups"],
    variationTree: [
      { name: "English Attack", line: "6. Be3", idea: "White attacks fast with f3, Qd2, and kingside pawn storms." },
      { name: "Poisoned Pawn", line: "6. Bg5 e6 7. f4 Qb6", idea: "Black grabs material while accepting tactical danger." },
      { name: "Classical Najdorf", line: "6. Be2", idea: "White develops calmly and Black chooses flexible counterplay." },
      { name: "Scheveningen setup", line: "...e6", idea: "Black builds a compact center before breaking with ...b5 or ...d5." },
    ],
    keyIdeas: ["Play ...a6 to stop Nb5", "Prepare ...e5 or ...e6", "Use the half-open c-file", "Counterattack instead of defending passively"],
    traps: ["Poisoned Pawn tactics", "Loose e4 pawn tricks", "Queenside counterplay against slow attacks"],
    famousGames: ["Fischer Najdorf wins", "Kasparov Najdorf battles", "Modern elite Najdorf games"],
  },
  "Sicilian Dragon": {
    color: "Black",
    mainLine: ["1. e4 c5", "2. Nf3 d6", "3. d4 cxd4", "4. Nxd4 Nf6", "5. Nc3 g6"],
    moveExplanations: [
      "e4 takes central space.",
      "c5 creates asymmetry and challenges d4.",
      "Nf3 develops and prepares d4.",
      "d6 supports the center and controls e5.",
      "d4 opens the center.",
      "cxd4 trades into the open Sicilian.",
      "Nxd4 centralizes the knight.",
      "Nf6 attacks e4 and develops.",
      "Nc3 defends e4.",
      "g6 prepares the Dragon bishop on g7.",
    ],
    concepts: ["Create counterplay", "Develop with tempo", "Castle carefully", "Use the Dragon pawn structure", "Activate the g7 bishop"],
    overview: "An aggressive Sicilian system where Black fianchettos the bishop and fights for dynamic counterplay.",
    variations: ["Yugoslav Attack", "Classical Dragon", "Accelerated Dragon"],
    variationTree: [
      { name: "Yugoslav Attack", line: "Be3, Qd2, f3", idea: "White attacks fast; Black counters on the c-file." },
      { name: "Classical Dragon", line: "Be2 and O-O", idea: "White plays a slower setup while Black builds activity." },
      { name: "Accelerated Dragon", line: "...Nc6 and ...g6", idea: "Black delays ...d6 for quicker pressure." },
    ],
    keyIdeas: ["Fianchetto the dark bishop", "Use the c-file", "Counterattack quickly", "Watch kingside sacrifices"],
    traps: ["Exchange sacrifice on c3", "Tactics on the long diagonal", "Back-rank mate threats"],
    famousGames: ["Fischer vs Larsen Dragon themes", "Kasparov Dragon attacking examples", "Topalov dynamic Sicilian games"],
  },
  "King's Gambit": {
    color: "White",
    mainLine: ["1. e4 e5", "2. f4"],
    moveExplanations: [
      "e4 takes central space and opens attacking lines.",
      "e5 fights for the center.",
      "f4 challenges e5 and starts a direct kingside initiative.",
    ],
    concepts: ["Attack early", "Develop rapidly", "Protect the king after opening lines", "Accept pawn-structure risk", "Activate pieces with tempo"],
    overview: "A romantic attacking opening where White sacrifices or offers a pawn for rapid development and kingside pressure.",
    variations: ["King's Gambit Accepted", "King's Gambit Declined", "Falkbeer Countergambit"],
    variationTree: [
      { name: "King's Gambit Accepted", line: "2...exf4", idea: "Black accepts the pawn; White attacks with rapid development." },
      { name: "King's Gambit Declined", line: "2...Bc5", idea: "Black avoids the pawn and develops actively." },
      { name: "Falkbeer Countergambit", line: "2...d5", idea: "Black counters in the center immediately." },
    ],
    keyIdeas: ["Open the f-file", "Develop with tempo", "Target f7", "Avoid slow pawn moves"],
    traps: ["Greedy pawn grabs", "Early queen exposure", "King safety mistakes"],
    famousGames: ["Anderssen attacking classics", "Spassky King's Gambit games", "Romantic-era model games"],
  },
  "French Defense": {
    color: "Black",
    mainLine: ["1. e4 e6", "2. d4 d5"],
    moveExplanations: [
      "e4 takes central space.",
      "e6 prepares d5 and builds a solid pawn chain.",
      "d4 reinforces White's center.",
      "d5 immediately challenges e4 and fixes the central tension.",
    ],
    concepts: ["Attack the pawn center", "Develop around the locked structure", "Prepare king safety before breaks", "Understand pawn-chain direction", "Activate the bad bishop"],
    overview: "A solid defense that challenges White's center and creates counterplay against d4 and e5.",
    variations: ["Winawer", "Classical", "Tarrasch", "Advance Variation", "Exchange Variation"],
    variationTree: [
      { name: "Winawer", line: "3. Nc3 Bb4", idea: "Pin the knight and pressure the center." },
      { name: "Classical", line: "3. Nc3 Nf6", idea: "Develop and attack e4 directly." },
      { name: "Tarrasch", line: "3. Nd2", idea: "Avoid pins and keep a flexible center." },
      { name: "Advance Variation", line: "3. e5", idea: "White gains space; Black attacks the chain." },
      { name: "Exchange Variation", line: "3. exd5", idea: "Symmetrical structure with simpler plans." },
    ],
    keyIdeas: ["Attack the pawn chain", "Break with c5 and f6", "Solve the light bishop", "Counterattack the center"],
    traps: ["Winawer poisoned pawn ideas", "Greek Gift risks", "Advance center breaks"],
    famousGames: ["Botvinnik French games", "Korchnoi Winawer games", "Uhlmann French masterpieces"],
  },
  "Caro-Kann": {
    color: "Black",
    mainLine: ["1. e4 c6", "2. d4 d5"],
    moveExplanations: [
      "e4 takes central space.",
      "c6 supports a solid d5 break.",
      "d4 builds the broad pawn center.",
      "d5 challenges e4 while keeping a healthy structure.",
    ],
    concepts: ["Challenge the center solidly", "Develop the light bishop early", "Castle safely", "Keep a healthy pawn structure", "Use active endgame pieces"],
    overview: "A sturdy defense that supports d5 with c6 and aims for a healthy pawn structure.",
    variations: ["Classical", "Advance Variation", "Exchange Variation", "Panov-Botvinnik Attack"],
    variationTree: [
      { name: "Classical", line: "3. Nc3 dxe4", idea: "Black develops solidly after resolving the center." },
      { name: "Advance Variation", line: "3. e5", idea: "White gains space; Black targets the chain." },
      { name: "Exchange Variation", line: "3. exd5", idea: "Balanced structure with clean development." },
      { name: "Panov-Botvinnik Attack", line: "3. exd5 cxd5 4. c4", idea: "White creates isolated-pawn activity." },
    ],
    keyIdeas: ["Develop the light bishop", "Challenge e4", "Keep a solid structure", "Trade into good endgames"],
    traps: ["Early queen sortie traps", "Bf5 tactical shots", "Panov isolated-pawn tactics"],
    famousGames: ["Karpov Caro-Kann games", "Anand defensive wins", "Dreev model games"],
  },
  "Scandinavian": {
    color: "Black",
    mainLine: ["1. e4 d5", "2. exd5 Qxd5", "3. Nc3 Qa5"],
    moveExplanations: [
      "e4 takes central space.",
      "d5 immediately challenges the e4 pawn.",
      "exd5 accepts the central trade.",
      "Qxd5 recaptures and keeps material balance.",
      "Nc3 develops with tempo on the queen.",
      "Qa5 keeps the queen active while avoiding further tempo loss.",
    ],
    concepts: ["Challenge the center immediately", "Develop while avoiding queen tempos", "Secure the king quickly", "Accept a simple pawn structure", "Activate pieces before pawn moves"],
    overview: "A direct defense that immediately challenges White's center and develops around queen activity.",
    variations: ["Qa5 Scandinavian", "Qd6 Scandinavian", "Nf6 Portuguese", "Modern Scandinavian"],
    variationTree: [
      { name: "Qa5 Scandinavian", line: "2...Qxd5 3. Nc3 Qa5", idea: "Keep the queen active but safer." },
      { name: "Qd6 Scandinavian", line: "2...Qxd5 3. Nc3 Qd6", idea: "Use a compact queen retreat." },
      { name: "Nf6 Portuguese", line: "2...Nf6", idea: "Gambit-style development and pressure." },
      { name: "Modern Scandinavian", line: "...c6 and ...Bf5", idea: "Develop simply around a solid shell." },
    ],
    keyIdeas: ["Trade central pawns", "Develop safely", "Use c6 and Bf5", "Avoid queen tempo losses"],
    traps: ["Portuguese Gambit tactics", "Loose queen tempo traps", "Back-rank development issues"],
    famousGames: ["Larsen Scandinavian games", "Tiviakov Scandinavian model games", "Modern rapid examples"],
  },
  "King's Indian": {
    color: "Black",
    mainLine: ["1. d4 Nf6", "2. c4 g6", "3. Nc3 Bg7"],
    moveExplanations: [
      "d4 takes central space.",
      "Nf6 develops and controls e4.",
      "c4 expands the center and queenside.",
      "g6 prepares a dark-square fianchetto.",
      "Nc3 supports d5 and central control.",
      "Bg7 completes the fianchetto and pressures the center.",
    ],
    concepts: ["Control the center from distance", "Develop the kingside first", "Castle early", "Attack pawn chains with breaks", "Create piece activity on dark squares"],
    overview: "A dynamic defense where Black allows White a big center, then attacks it with ...e5 or ...c5.",
    variations: ["Classical King's Indian", "Fianchetto Variation", "Sämisch", "Four Pawns Attack"],
    variationTree: [
      { name: "Classical King's Indian", line: "Nf3, Be2, O-O", idea: "Both sides race on opposite wings." },
      { name: "Fianchetto Variation", line: "g3 and Bg2", idea: "White fights the long diagonal with solidity." },
      { name: "Samisch", line: "f3", idea: "White builds a broad center and kingside space." },
      { name: "Four Pawns Attack", line: "f4", idea: "White grabs space; Black seeks counterbreaks." },
    ],
    keyIdeas: ["Fianchetto the bishop", "Strike with e5 or c5", "Attack the king", "Use dark-square pressure"],
    traps: ["Kingside pawn storm tactics", "Nxe4 central shots", "Exchange sacrifice on c3"],
    famousGames: ["Kasparov King's Indian wins", "Fischer King's Indian games", "Bronstein attacking classics"],
  },
  "Slav Defense": {
    color: "Black",
    mainLine: ["1. d4 d5", "2. c4 c6"],
    moveExplanations: [
      "d4 takes central space.",
      "d5 matches the central claim.",
      "c4 challenges d5.",
      "c6 supports d5 while keeping the light bishop flexible.",
    ],
    concepts: ["Support the center", "Develop the light bishop actively", "Castle before opening files", "Use a solid pawn structure", "Create activity on the c-file"],
    overview: "A solid answer to the Queen's Gambit that supports d5 while keeping the light bishop free.",
    variations: ["Main Line Slav", "Semi-Slav", "Chebanenko Slav", "Exchange Slav"],
    variationTree: [
      { name: "Main Line Slav", line: "3. Nf3 Nf6 4. Nc3 dxc4", idea: "Black grabs c4 after White commits development." },
      { name: "Semi-Slav", line: "...e6 and ...c6", idea: "Solid center with sharp tactical potential." },
      { name: "Chebanenko Slav", line: "...a6", idea: "Flexible queenside preparation." },
      { name: "Exchange Slav", line: "cxd5 cxd5", idea: "Symmetrical structure and technical play." },
    ],
    keyIdeas: ["Support d5", "Develop Bf5 or Bg4", "Use c-file counterplay", "Aim for sound structure"],
    traps: ["Bf5 queen traps", "Semi-Slav tactics", "Early c-pawn captures"],
    famousGames: ["Kramnik Slav games", "Anand Semi-Slav wins", "Shirov Botvinnik Semi-Slav attacks"],
  },
};

export const openingLibrary = {
  White: Object.entries(openingDetails)
    .filter(([, detail]) => detail.color === "White")
    .map(([name]) => name),
  Black: Object.entries(openingDetails)
    .filter(([, detail]) => detail.color === "Black")
    .map(([name]) => name),
};

const openingStats = {
  "Italian Game": {
    winRate: "54%",
    popularity: "Very high",
    difficulty: "Medium",
    style: "Classical",
    famousPlayers: ["Magnus Carlsen", "Fabiano Caruana", "Anatoly Karpov"],
  },
  "Ruy Lopez": {
    winRate: "53%",
    popularity: "Very high",
    difficulty: "Hard",
    style: "Strategic",
    famousPlayers: ["Bobby Fischer", "Garry Kasparov", "Magnus Carlsen"],
  },
  "London System": {
    winRate: "51%",
    popularity: "High",
    difficulty: "Easy",
    style: "Positional",
    famousPlayers: ["Gata Kamsky", "Magnus Carlsen", "Vladimir Kramnik"],
  },
  "Queen's Gambit": {
    winRate: "52%",
    popularity: "Very high",
    difficulty: "Medium",
    style: "Classical",
    famousPlayers: ["Jose Raul Capablanca", "Anatoly Karpov", "Vladimir Kramnik"],
  },
  "English Opening": {
    winRate: "51%",
    popularity: "High",
    difficulty: "Medium",
    style: "Flexible",
    famousPlayers: ["Mikhail Botvinnik", "Anatoly Karpov", "Magnus Carlsen"],
  },
  "Vienna Game": {
    winRate: "53%",
    popularity: "Medium",
    difficulty: "Medium",
    style: "Aggressive",
    famousPlayers: ["Rudolf Spielmann", "Hikaru Nakamura", "Paul Morphy"],
  },
  "Sicilian Defense": {
    winRate: "52%",
    popularity: "Very high",
    difficulty: "Hard",
    style: "Aggressive",
    famousPlayers: ["Garry Kasparov", "Bobby Fischer", "Maxime Vachier-Lagrave"],
  },
  "Sicilian Najdorf": {
    winRate: "52%",
    popularity: "Very high",
    difficulty: "Hard",
    style: "Aggressive",
    famousPlayers: ["Bobby Fischer", "Garry Kasparov", "Maxime Vachier-Lagrave"],
  },
  "Sicilian Dragon": {
    winRate: "51%",
    popularity: "Medium",
    difficulty: "Hard",
    style: "Aggressive",
    famousPlayers: ["Garry Kasparov", "Veselin Topalov", "Hikaru Nakamura"],
  },
  "King's Gambit": {
    winRate: "50%",
    popularity: "Low",
    difficulty: "Hard",
    style: "Aggressive",
    famousPlayers: ["Boris Spassky", "Adolf Anderssen", "Hikaru Nakamura"],
  },
  "French Defense": {
    winRate: "49%",
    popularity: "High",
    difficulty: "Medium",
    style: "Counterattacking",
    famousPlayers: ["Viktor Korchnoi", "Mikhail Botvinnik", "Wolfgang Uhlmann"],
  },
  "Caro-Kann": {
    winRate: "50%",
    popularity: "High",
    difficulty: "Medium",
    style: "Positional",
    famousPlayers: ["Anatoly Karpov", "Viswanathan Anand", "Alexey Dreev"],
  },
  "Scandinavian": {
    winRate: "48%",
    popularity: "Medium",
    difficulty: "Easy",
    style: "Direct",
    famousPlayers: ["Bent Larsen", "Sergei Tiviakov", "Magnus Carlsen"],
  },
  "King's Indian": {
    winRate: "50%",
    popularity: "High",
    difficulty: "Hard",
    style: "Dynamic",
    famousPlayers: ["Garry Kasparov", "Bobby Fischer", "David Bronstein"],
  },
  "Slav Defense": {
    winRate: "50%",
    popularity: "High",
    difficulty: "Medium",
    style: "Solid",
    famousPlayers: ["Vladimir Kramnik", "Viswanathan Anand", "Alexey Shirov"],
  },
};

Object.entries(openingStats).forEach(([name, stats]) => {
  if (openingDetails[name]) {
    openingDetails[name].stats = stats;
  }
});

const legendaryGames = [
  {
    player: "Magnus Carlsen",
    game: "Carlsen vs Anand",
    event: "World Championship",
    year: "2013",
    lesson: "Watch how small pressure, safer king placement, and patient piece improvement become a winning plan.",
  },
  {
    player: "Garry Kasparov",
    game: "Kasparov vs Topalov",
    event: "Wijk aan Zee",
    year: "1999",
    lesson: "A model of calculation, initiative, and piece activity when the position becomes tactical.",
  },
  {
    player: "Bobby Fischer",
    game: "Fischer vs Spassky",
    event: "World Championship Game 6",
    year: "1972",
    lesson: "A classic lesson in central control, smooth development, and converting positional pressure.",
  },
];

Object.values(openingDetails).forEach((opening) => {
  opening.legendaryGames = legendaryGames;
});

Object.entries(openingDetails).forEach(([name, opening]) => {
  const mainLineMoves = opening.mainLine
    .flatMap((line) => line.split(/\s+/))
    .filter((token) => token && !/^\d+\.+$/.test(token));
  const nextMove = mainLineMoves[Math.min(2, mainLineMoves.length - 1)] || mainLineMoves[0];
  const concept = opening.concepts[0] || "Control the center";
  const keyIdea = opening.keyIdeas[0] || concept;

  opening.quiz = [
    {
      prompt: "What is the main idea in this opening?",
      options: [
        concept,
        "Move the same piece many times",
        "Ignore king safety",
      ],
      answer: concept,
      explanation: `${name} is built around ${concept.toLowerCase()} before looking for tactics.`,
    },
    {
      prompt: "Find the best continuation from the main line.",
      options: [
        nextMove,
        "h4",
        "Ra3",
      ],
      answer: nextMove,
      explanation: `${nextMove} belongs to the main line and supports the opening plan.`,
    },
    {
      prompt: "What should you watch for here?",
      options: [
        keyIdea,
        "Trade every piece immediately",
        "Leave the center undefended",
      ],
      answer: keyIdea,
      explanation: `${keyIdea} is one of the key ideas that makes this opening work.`,
    },
  ];
});

export const recommendedOpenings = [
  {
    style: "Aggressive Player",
    openings: ["Sicilian Najdorf", "Sicilian Dragon", "King's Gambit"],
    note: "Choose sharp openings with early initiative, tactical chances, and attacking plans.",
  },
  {
    style: "Positional Player",
    openings: ["London System", "Caro-Kann"],
    note: "Choose stable structures, clear plans, and long-term piece improvement.",
  },
  {
    style: "Classical Player",
    openings: ["Italian Game", "Queen's Gambit"],
    note: "Choose principled development, central control, and natural king safety.",
  },
];
