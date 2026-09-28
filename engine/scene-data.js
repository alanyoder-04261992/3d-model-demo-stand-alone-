/* WHERE THE BUILDING STANDS: the light, the sky the shiny parts reflect, the
   haze the floor fades into and the backdrop behind it. Node-safe: plain data.

   Three settings, as in Barnwright (3ddesign.html lines 1452-1509):
     studio -- a plain cool-white sweep, the way a catalogue photographs a
               product. THE DEFAULT, and what every saved thumbnail uses.
     yard   -- a lawn under a Florida sky.
     paper  -- the studio sweep in a warm paper colour. Not used by default.

   Everything in one setting has to agree -- the colour the metal mirrors, the
   ambient light, the haze colour and the backdrop -- or the picture looks
   pasted together. In particular `fogC` (the haze) must equal the flat bottom
   colour of `stage` (the CSS backdrop behind the see-through 3D canvas) or a
   line shows where the floor meets the wall: studio fogC 0.9137 x 255 = 233
   = #E9E9E5 in Barnwright.

   SCENES is Barnwright's table, number for number (the golden test and the
   look test run against it).

   TRUE_SCENES is the same table for a company that turns on
   `look.trueColour` -- the Yoder site's Sep 20 2026 fix (design.html lines
   1768-1830): Alan saw "a slight yellow tint" on a Bellemont Blue barn and it
   measured -- the studio's lights all sat a few points warm. In the true-
   colour studio every light is GREY at the SAME BRIGHTNESS it had (Rec.709
   luminance), the floor and backdrop are neutral, and two new entries say
   what a shiny surface sees above (envUp) and below (envDn) the horizon,
   because the true-colour shader (FSTRUE) reads them from the scene instead
   of having a blue sky and a green lawn typed into it. The glass keeps its
   blue daylight (skyG) on purpose -- a grey pane vanishes into its frame.
   The yard and paper settings keep Barnwright's numbers and just gain
   envUp/envDn equal to the colours Barnwright's shader has built in, so they
   look the same under either shader apart from the sun. (The Yoder yard
   backdrop names a sky photograph that is not in this repo; the true yard
   here keeps Barnwright's plain gradient.)

   sceneFor(name, trueColour) picks one; an unknown name falls back to the
   yard exactly as Barnwright's SC() does.

   SUN_OFF / SUN_EL: the sun sits 66 degrees over the viewer's left shoulder
   (SUN_OFF, relative to the camera) and 33 degrees up (SUN_EL), and follows
   the camera round, so one wall is sunlit, the next in soft shade, and the
   shadow falls where you can see it (Barnwright 1433-1446). */

export const SUN_OFF = -1.15, SUN_EL = 0.575;

export const DEFAULT_SCENE = "studio";

function deepFreeze(o) {
  Object.values(o).forEach(function (v) { if (v && typeof v === "object") deepFreeze(v); });
  return Object.freeze(o);
}

/* Barnwright's three settings, byte for byte. */
export const SCENES = deepFreeze({
  /* A LAWN UNDER A FLORIDA SKY. The grass is generated in JavaScript like
     everything else; the backdrop is a plain gradient, so this scene needs no
     files either. */
  yard:{
    sky:[0.34,0.50,0.78],                                  /* what the metal mirrors */
    skyG:[0.34,0.50,0.78],                                 /* and what the glass mirrors */
    ambLo:[0.40,0.41,0.44], ambHi:[0.60,0.64,0.71],        /* ground bounce / open sky */
    bounce:[0.10,0.085,0.06],                              /* warm light off the grass */
    fogC:[0.796,0.834,0.838], fogN:0.66, fogF:1.005,
    ground:{tint:[0.700,0.720,0.560], tex:"grass", spec:0.03, gloss:12, bump:1.05, turf:1},
    stage:"linear-gradient(180deg,#6FA5D2 0%,#7FB0D8 8%,#95BDDD 15%,#AAC8DD 21%,#BACFDA 26%,#C5D3D8 31%,#CBD5D6 37%,#CBD5D6 100%)"
  },
  /* A SWEEP, the way a catalogue shoots a product. The floor has to melt into
     the wall behind it with no line where one becomes the other, so the haze
     colour is the backdrop colour EXACTLY and the backdrop is flat from the
     point the floor could ever reach -- then it does not matter where the
     ground actually ends, because you cannot see it end. */
  studio:{
    sky:[0.76,0.762,0.765],                                /* a white room, not a blue sky */
    skyG:[0.355,0.495,0.735],                              /* but the windows keep a daylight cast */
    ambLo:[0.52,0.52,0.515], ambHi:[0.665,0.667,0.670],
    bounce:[0.075,0.074,0.070],
    fogC:[0.9137,0.9137,0.8980], fogN:0.18, fogF:0.62,
    ground:{tint:[0.855,0.853,0.840], tex:"flat", spec:0.03, gloss:14, bump:0, turf:0},
    stage:"linear-gradient(180deg,#F7F7F4 0%,#F1F1EE 16%,#E9E9E5 27%,#E9E9E5 100%)"
  },
  /* the same sweep in the paper the rest of the site is printed on */
  paper:{
    sky:[0.77,0.755,0.725],
    skyG:[0.375,0.495,0.715],
    ambLo:[0.525,0.518,0.500], ambHi:[0.672,0.664,0.645],
    bounce:[0.082,0.077,0.066],
    fogC:[0.9333,0.9216,0.8863], fogN:0.18, fogF:0.62,
    ground:{tint:[0.872,0.860,0.826], tex:"flat", spec:0.03, gloss:14, bump:0, turf:0},
    stage:"linear-gradient(180deg,#FBFAF6 0%,#F6F4EE 16%,#EEEBE2 27%,#EEEBE2 100%)"
  }
});

/* The colours Barnwright's shader has typed in for what a shiny surface sees:
   sky above the horizon, lawn below (FS: vec3(0.66,0.69,0.72) and
   vec3(0.19,0.20,0.17)). The true-colour shader reads them from the scene. */
export const ENV_UP_BUILT_IN = Object.freeze([0.66,0.69,0.72]);
export const ENV_DN_BUILT_IN = Object.freeze([0.19,0.20,0.17]);

/* The Yoder site's true-colour settings (design.html 1768-1830). */
export const TRUE_SCENES = deepFreeze({
  yard: Object.assign({}, SCENES.yard, {
    envUp:[0.66,0.69,0.72], envDn:[0.19,0.20,0.17]         /* real sky, real lawn */
  }),
  /* A WHITE ROOM IS WHITE (Alan, Sep 20 2026). Every number used to sit a few
     points warm, and a room that is a little yellow makes every colour in it a
     little wrong. EVERY ONE IS THE SAME BRIGHTNESS IT WAS, by Rec.709
     luminance. Nothing got darker or lighter; it stopped having a colour. */
  studio:{
    sky:[0.762,0.762,0.762],                               /* a white room, not a blue sky */
    /* THE GLASS KEEPS ITS DAYLIGHT, on purpose and unchanged. */
    skyG:[0.355,0.495,0.735],
    ambLo:[0.520,0.520,0.520], ambHi:[0.667,0.667,0.667],
    bounce:[0.074,0.074,0.074],
    envUp:[0.686,0.686,0.686], envDn:[0.196,0.196,0.196],  /* the room, above and below */
    fogC:[0.9137,0.9137,0.9137], fogN:0.18, fogF:0.62,
    ground:{tint:[0.8525,0.8525,0.8525], tex:"flat", spec:0.03, gloss:14, bump:0, turf:0},
    /* THE HAZE COLOUR IS THE BACKDROP COLOUR EXACTLY -- 0.9137 x 255 = 233 =
       #E9E9E9 -- which is what stops there being a line where the floor
       becomes the wall. Change one and the other has to move with it. */
    stage:"linear-gradient(180deg,#F7F7F7 0%,#F1F1F1 16%,#E9E9E9 27%,#E9E9E9 100%)"
  },
  /* the paper sweep is left warm on purpose; it is not what ships */
  paper: Object.assign({}, SCENES.paper, {
    envUp:[0.66,0.69,0.72], envDn:[0.19,0.20,0.17]
  })
});

/* Barnwright's SC(): the named setting, or the yard when the name is unknown. */
export function sceneFor(name, trueColour) {
  var T = trueColour ? TRUE_SCENES : SCENES;
  return T[name] || T.yard;
}
