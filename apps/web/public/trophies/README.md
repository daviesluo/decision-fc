# Trophy artwork

The trophy and award images the game shows. Trophy designs are trademarks of
their respective owners and are used with permission. They are not licensed by
this repository's `LICENSE`.

Resolution in `apps/web/src/components/Trophy.tsx`:

1. The competition's own image — `league-eng-1.png`, `fa-cup.png`,
   `champions-league.png`…
2. The generic family image (`generic-league.svg` / `generic-cup.svg`) for
   competitions with no dedicated art (Portuguese/Dutch/Belgian/Saudi/Japanese/
   Chinese cups and second tiers, AFC/CAF club competitions).
3. A drawn SVG silhouette, if a file is missing or fails to load — a broken
   image can never appear.

Naming:

```
league-<league id, dot flattened>.png   league-eng-1.png, league-esp-2.png
<cup name>.png                          fa-cup.png, copa-del-rey.png…
<continental>.png|svg                   champions-league.png, europa-league.png
<nations cup>.png|svg                   euro.svg, copa-america.png…
world-cup.png · club-world-cup.png
ballon-dor.png · golden-boot.png · golden-glove.png   (individual awards)
generic-league.svg · generic-cup.svg    family fallbacks
```

To add art for a competition that currently falls back to a generic image,
drop the file here and add one line to the matching map in `Trophy.tsx`
(`LEAGUE_ART` / `CUP_ART` / `ELITE_ART` / `SECONDARY_ART` / `NATIONS_ART`).
