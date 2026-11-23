// The opening sequence alternates forms, decades and kinds of discovery.
const filmPicks = [
  ['quasi-at-the-quackadero', 'A cartoon duck takes a robot and a friend to a carnival where the rides can change your age or take you back through time. Start here for the colour, then notice how casually the film treats the impossible.'],
  ['trip-down-market-street', 'A camera rides the front of a San Francisco streetcar days before the 1906 earthquake. Watch the people crossing in front of it: the traffic has rules of its own.'],
  ['one-got-fat', 'A bicycle-safety lesson follows a picnic party in monkey masks. Each rule is taught through an accident, with a matter-of-fact narrator that makes the whole thing stranger.'],
  ['code-rush', 'Follow the engineers racing to open Netscape’s source code. The late nights and half-finished conversations catch open source becoming a practice in front of the camera.'],
  ['snow-white-betty-boop', 'The showpiece is Cab Calloway’s singing and dancing, traced into a ghost who glides through a cave. In seven minutes it turns a familiar fairy tale into something else entirely.'],
  ['destination-earth', 'A Martian spy comes to Earth to find out why Americans have so many cars. The oil industry’s answer arrives as an improbably bright mid-century cartoon.'],
  ['third-avenue-el', 'From the windows of New York’s elevated railway, station steel and apartment windows keep sliding into the frame. The city is easiest to read in the glimpses between stations.'],
  ['haxan', 'A silent film tries to explain the history of witchcraft through staged trials, demons and lessons in superstition. Its urge to put everything on screen is what still makes it unsettling.'],
  ['bbs-documentary', 'Dial-up users tell the story of the tiny online communities they ran before the web. Listen for what it meant to belong to a computer network you mostly reached with a local phone call.'],
  ['can-dialectics-break-bricks', 'A dubbed martial-arts film turns fights and confrontations into arguments about class struggle. The actors keep their original timing while the dialogue changes what the whole scene means.'],
  ['on-guard-story-of-sage', 'The control room is the attraction. An enormous early computer and its operators track incoming aircraft on screens that make Cold War air defence look almost like an arcade.'],
  ['metamorphosis-mr-samsa', 'Caroline Leaf redraws Gregor Samsa’s room in sand on glass. A door or a face can become something else in a single movement of the animator’s hand.'],
  ['how-to-use-the-dial-phone', 'Before a rotary telephone could be ordinary, somebody had to teach the public how to use one. Here are the pauses, wrong moves and small rituals that instruction made visible.'],
  ['wattstax', 'Concert sets share the screen with interviews and street scenes in Los Angeles. The result catches as much of the life around the stage as the performances themselves.'],
  ['design-for-dreaming', 'A woman wanders from a show full of concept cars into a kitchen that promises to do the work for her. General Motors puts the sales pitch to music.'],
  ['glass-harmonica', 'A glass instrument briefly changes the way people see their city. The imagery is full of art-history fragments that are worth spotting even if you know nothing about the film’s censorship.'],
  ['operation-cue', 'A model town built for a nuclear test shows how an ordinary living room became a measuring instrument. The film’s calm explanation is part of the historical record.'],
  ['toute-la-memoire-du-monde', 'Alain Resnais follows a book through the corridors of the Bibliothèque nationale. Watching the machinery of classification is the pleasure here.'],
  ['shy-guy', 'A teenage Dick York receives a lesson in fitting in at school. The instructions are so specific that they become a record of what one era expected from a boy.'],
  ['a-is-for-atom', 'General Electric explains nuclear energy with friendly giants and bright diagrams. Pay attention to the difference between how much the animation reveals and how much it tries to reassure.'],
  ['tears-of-steel', 'A science-fiction film shot in Amsterdam became a test piece for Blender’s open visual-effects pipeline. The streets are real, even when the machinery taking them over is not.'],
  ['a-page-of-madness', 'This Japanese silent film builds its asylum out of restless camera movement and distorted images. Once you stop looking for conventional explanations, the cuts tell you where to look.'],
  ['superman-mechanical-monsters', 'A robber sends robots to do his work, and the Fleischer animators give the machines a crisp industrial rhythm. Watch how cleanly the action reads in silhouette.'],
  ['social-sex-attitudes', 'A school film turns dating and sex into an orderly set of instructions. Its period vocabulary is revealing, right down to the things it can only talk around.'],
  ['vampyr', 'Carl Theodor Dreyer allows fog, shadows and strange points of view to do most of the horror work. The famous coffin sequence is worth arriving at without an explanation.'],
];

const archivePicks = [
  ['EXPTVSalinaPublicAccess101', 'Start with what public access could do: in 1996 a crew in Salina, Kansas, made its own comedy programme and put it on local television. There is a whole production culture in that small gesture.'],
  ['ComputerChronicles-SearchEngines_861', 'A television demo of finding things online in 1996, when AltaVista, Zip2 and several other contenders still offered different ideas of the web. Watch it as a guided tour of a world before Google.'],
  ['098064', 'A 1950s family road film with double exposures. The homemade camera tricks give a familiar collection of holiday scenes the character of a small experimental film.'],
  ['63564-community-shelter-planning-vwr', 'Follow a county commissioner through the paperwork of civil defence. Gene Hackman appears as the official who explains how a community is supposed to plan for fallout.'],
  ['Computer1984', 'John Chowning and early music-software makers show what computers could do with sound in 1984. Watch the demonstrations for the instruments and interfaces as much as for the music.'],
  ['202881_Home_Movie_010849', 'A family station wagon links the motel stops and historic sites. The night footage turns the signs of New York, Reno and Las Vegas into a small collection of disappearing street light.'],
  ['Glendora', 'This is a surviving fragment of a 1995 New York public-access show. Its uploader kept the bit with Glendora’s cat, which is a different kind of editorial decision from the usual television archive.'],
  ['virtualreali', 'Among the early virtual-reality demos in this broadcast are gloves, a virtual hand and architectural walkthroughs. Watch what the presenters could already imagine and what the hardware could actually do.'],
  ['000404_202005', 'An African American family’s home movies record Long Beach in the 1950s. They give the period a family’s point of view, away from the polished version California sold to visitors.'],
  ['CC1623SHOWCASE', 'A report from a 1999 internet trade show, with an early look at TiVo and digital television. Several things the presenters treat as inventions now sound like ordinary living-room furniture.'],
  ['170003_202005', 'A road trip through 1940s California moves between the landscape, agriculture and blimps. It preserves details a commissioned travel film might have driven past.'],
  ['CyberPri98', 'A 1998 guide to making yourself harder to track online. It pairs early encryption and anonymity tools with advice about identity theft and scams on eBay.'],
];

function indexPicks(picks) {
  return new Map(picks.map(([id, note], rank) => [id, { rank, note }]));
}

export const FILM_EDITORIAL = indexPicks(filmPicks);
export const ARCHIVE_EDITORIAL = indexPicks(archivePicks);
