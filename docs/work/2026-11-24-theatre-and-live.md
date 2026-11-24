# Theatre artwork, archive navigation and Live suggestions

## What the viewer sees

- Live offers nine different channels and excludes the current preview. On wide screens the player determines the height of the three-by-three grid. Wider tablets can stack the grid below the preview. Phones use compact horizontal cards.
- Films contains 29 original selections and 305 Featured works. The die draws from all 334. Search and filters display their match count against that total. Each Featured work has a synopsis and a short introduction. The editorial openings add individual viewing notes to 25 films and 12 archive records.
- Films and Featured display source artwork as soon as the viewer enters the shelf, including the opening film and each roll of the die. CATODO TV shows the poster for its current programme. Explore archives loads thumbnails as their cards approach the screen. The original shelf uses its local artwork.
- Archive cards show their destination under the title. Their cover and title select the matching Theatre edition or open the named source in a new tab. Returning from an in-app film restores keyboard focus to the original result. License and image-credit links can be operated independently. **Available in Theatre** filters by playback destination and combines with rights and category filters. An empty film search can carry its words into the full archive.

## Images and editions

`public/theatre/featured-artwork.json` records a frame for every Featured work, plus 66 posters and eight pieces of period publicity. Each entry names its edition URL, image source, credit, dimensions and type. The film catalog and artwork register are fetched together on first use. Matching both work ID and edition URL prevents a replacement copy from inheriting an unrelated frame. New or changed editions can use the existing catalog image while artwork is reviewed.

Archive stills were checked against the source media file and its derivatives. Safety Last! has a still from a parallel encode of the same work and running time in the same item. The Kid uses a Commons film frame. The Film-Makers’ Cooperative supplies a still for Dreams That Money Can Buy, and LaCinetek supplies a frame for Visit to Picasso. Just Imagine uses a Fox Film Corporation lobby card held on Wikimedia Commons. The browser loads source images directly while browsing. No remote image or film bytes are shipped with the register.

All 305 primary images were decoded, and their contact sheets were inspected. The checked-in register stores the selected still or cover, plus a separate still for every cover. If a source image fails, the visible credit follows the fallback. The catalogued Archive upload for Dreams That Money Can Buy currently reports restricted availability. Its distributor still is accessible. Recheck edition availability before promoting the film for playback.

## Catalog counts on 24 November 2026

The public lineup listed 37 channels across 48 manifest files, referring to 3,737 distinct Archive item identifiers. All 3,719 unrestricted items occur in CATODO's recordings index. The other 18 had restricted-item metadata on Archive. The combined directory has 33,352 records after exact-ID consolidation. These counts describe Archive items, some of which contain multiple media files.

Across the full directory, 161 records match a specific film selection in CATODO. Of the recordings identified through the lineup, 31 match an enabled Featured edition for CATODO TV. Playback availability and territorial rights still depend on the source. [Public lineup](https://spelunkr.tv/broadcast/lineup.json)

Of the 3,719 recordings, 3,226 have at least one category in the combined index and 493 still need cataloguing. Matching Internet Archive collections and subjects identified 446 additional recordings, including game shows, advertising, community television, VHS holdings and animation. The update preserved every item identifier, source field and rights declaration.

## Verification and next check

At 1,866 CSS pixels wide, both the six-card baseline and the new nine-card grid measured 699 pixels high. At 1,600 and 1,254 pixels wide, both versions measured 616 and 473 pixels respectively. The narrow phone list with nine cards is 61 pixels shorter than the previous six. The guide and metadata fit at 27 tested widths from 320 to 2,560 pixels, including long labels and two schedule rows.

Chromium checks covered keyboard and pointer destinations, retained filters and focus on return, moving a search between shelves, automatic images on first visit and with the old preference disabled, the die, fallback credits, the Featured player and two consecutive CATODO TV programmes. Just Imagine, Quasi at the Quackadero, Dreams That Money Can Buy and Visit to Picasso also loaded their images directly from the source servers. The playback checks used local media fixtures. Populated Live, Discover, TV Guide and Multiview ran at the desktop, phone and both Tesla viewport sizes. Favorite and schedule colors were measured across all 16 themes. Physical Tesla touch comfort and audibility still need an in-car check.

All 225 Node tests passed. Syntax, release metadata, production build, four PHP syntax checks and the generated catalog assets passed verification.
