# Creating buddies

Everything you make for Pixling, a whole buddy or a hat, is one small text file: a **Pixling file**, ending in `.pixling.json`. You can draw one in the studio, write one by hand, or let an AI assistant make one. Anyone with Pixling can add your file in a second.

## Sharing and adding

- **Draw one:** open the **Studio** from the menu, or click **Draw your own…** in the wardrobe.
- **Share one:** in the studio, under *Your creations*, click **Share** to save it as a file in Downloads, or **Copy** to paste it into a chat, an email or a note.
- **Add one:** drop the file on your buddy (it says hello to its new friend), or drop it on the studio window. You can also click **Add a file…** in the studio and paste the text or pick the file. Something you add is put to use right away; switch back in the wardrobe.

## With an AI assistant

1. In the studio, click **Copy AI prompt**.
2. Paste it into your AI assistant (ChatGPT, Claude, Gemini, …) and add what you'd like, for example *"a small cactus with a pink flower on its head"* or *"a pirate hat"*.
3. Copy the whole answer and paste it into **Add a file…**. Text around the JSON (a ```json fence, a sentence) is fine; Pixling finds the file inside.

If something is wrong, Pixling says what and where, for example `layer "body", row 12, column 7: unknown colour key "Z"`. Paste that message back to the assistant and ask it to fix the file.

## What a buddy file looks like

```json
{
  "pixling": 1,
  "type": "buddy",
  "name": "Cactus",
  "author": "You",
  "outline": true,
  "colors": { "b": "#7bc96f", "s": "#4f9a52", "h": "#b4e39a", "a": "#fff3c4", "c": "#ff9fb8", "o": "#1f4a2c", "1": "#ff7eb6" },
  "layers": {
    "back": ["…32 rows…"],
    "top": ["…"],
    "body": ["…"],
    "feet": ["…"],
    "face": ["…"]
  }
}
```

The full cactus is in [`examples/cactus.pixling.json`](../examples/cactus.pixling.json).

| Field | Required | What it is |
| --- | --- | --- |
| `pixling` | yes | Always `1` (the version of the format) |
| `type` | yes | `"buddy"` |
| `name` | yes | At most 24 characters |
| `author` | no | Who made it; shown in the studio |
| `outline` | no | `true` (default) adds a 1-pixel outline around the body, feet, top and back layers |
| `colors` | no | The buddy's own colours, and extra colours (see *Colours*) |
| `layers` | yes | The drawing, see below |
| `floats` | no | `true` for a buddy without feet that hovers, like the ghost |
| `anchors` | no | Where hats, glasses and held things go, see *Anchors* |

### Layers

Every layer is a list of up to 32 strings of up to 32 characters: a 32×32 grid where row 0 is the top and column 0 the left. A `.` (or a space) is transparent; every other character is a colour key. Writing all 32 rows of 32 characters makes coordinates easy to read; Pixling's own files do that.

| Layer | What goes in it | How it moves |
| --- | --- | --- |
| `body` (required) | The main shape | Breathes: one pixel down every other beat (a floating buddy bobs up) |
| `feet` | Feet or legs | Stays on the ground; the left half lifts, then the right half, while walking |
| `face` | Eyes (`e`), a glint (`w`), a mouth, cheeks (`c`) | Drawn on top without an outline; follows the cursor; the eyes blink |
| `top` | An antenna, a leaf, a tuft, steam | Breathes with the body; hidden when the buddy wears a hat |
| `back` | Wings, a tail, ears | Breathes with the body; drawn behind everything |

Pixling animates the buddy, so you only draw one still pose.

- **Breathing** moves the body, face, top and back one pixel down; the feet stay.
- **Walking** lifts whatever is left of column 16 in the feet layer, then whatever is right of it.
- **Blinking** hides every eye pixel (`e`) that has another eye pixel right below it, and the glint (`w`) above an eye. Eyes of 2×3 pixels close to a 2×1 line.
- **Looking** shifts the whole face one pixel left or right.
- **Standing:** Pixling moves the drawing up or down so the lowest pixel of the body, feet, top and back stands on row 28. Draw the feet on rows 27 and 28 and nothing changes.

### Colours

| Key | Colour | Changes with the wardrobe colour |
| --- | --- | --- |
| `b` | body | yes |
| `s` | shade | yes |
| `h` | highlight | yes |
| `a` | accent | yes |
| `c` | cheeks | yes |
| `o` | outline (also good for a mouth) | yes |
| `e` | eyes | yes (only charcoal changes it) |
| `w` `n` | white, black | no |
| `r` `R` | red, dark red | no |
| `m` `y` `Y` | pink, gold, dark gold | no |
| `k` `g` `G` | brown, green, dark green | no |
| `t` `u` `q` | light blue, indigo, cyan | no |
| `X` `N` | light grey, dark grey | no |

`colors` sets the buddy's own colours for `b`, `s`, `h`, `a`, `c`, `o` and `e`: that's how it looks with **Own colours** in the wardrobe. Picking another colour in the wardrobe recolours exactly those keys, so use them for the parts that should change.

Any other single character can be an extra colour of your own: add it to `colors` as `"#rrggbb"`. Digits (`"1"` to `"9"`, `"0"`) are the easiest. Extra colours never change, and they never clash with another file's colours, even with the same key.

### Anchors

Pixling works out where things go:

- **Hats** rest on the top row of the body, centred on it.
- **Glasses** are centred on the eyes, starting at their top row.
- **Held things** go to the right of the buddy.

If that doesn't fit your shape, set them yourself in grid coordinates of your drawing:

```json
"anchors": { "hat": [13, 9], "glasses": [10, 16], "hand": [23, 19] }
```

- `hat` is the left column of a 6-wide hat and the row its bottom rests on.
- `glasses` is the top-left corner of 12-wide glasses.
- `hand` is the top-left corner of a held thing.

## What an accessory file looks like

```json
{
  "pixling": 1,
  "type": "accessory",
  "name": "Top hat",
  "slot": "hat",
  "outline": true,
  "colors": { "1": "#34314a", "2": "#c2407e" },
  "pixels": [
    "..11111111..",
    "..11111111..",
    "..22222222..",
    "111111111111"
  ]
}
```

| Slot | Biggest size | Where it goes |
| --- | --- | --- |
| `hat` | 16 wide, 12 tall | Centred on the head; its bottom row rests on the head. Empty rows at the bottom are dropped |
| `face` | 16 wide, 6 tall | Centred on the eyes, like 12-wide glasses with lenses over columns 0–4 and 7–11 |
| `hand` | 12 wide, 12 tall | Held at the side |

`outline` defaults to `true` for hats and held things and to `false` for things on the face. Keys `b`, `s`, `h`, `a` and `c` take the colours of whoever wears it.

A file can also hold a list: `[ {…}, {…} ]` adds several things at once.

## Style guide

Pixling's buddies share a style. Yours will look at home when it follows it too.

- **Front view, stylised.** No side views, no realistic animals. Think of an object or creature with a face, like a robot, a ghost, a plant in a pot, a mushroom or a mug.
- **Its own silhouette.** It should be recognisable as a black shape. Give it one or two features that stick out: a tuft, ears, a handle, a cap.
- **About 18 pixels wide**, centred around column 16, body from about row 10 to row 26, feet on rows 27–28.
- **Big face, simple face.** Eyes of 2×3 pixels about 6 pixels apart, with a white glint on the top-left pixel. A small mouth (`o..o` above `.oo.`). Cheeks of 2×1 in `c` under the eyes.
- **Three tones per colour:** `h` on the top-left edges, `b` for most of it, `s` on the right edge and the bottom rows. Light comes from the top left.
- **No outline in the drawing.** Leave `outline` on; Pixling draws one pixel of `o` around every layer, so the buddy reads on any background.
- **Leave room.** Keep the top rows free for hats, and don't put the eyes too close to the edge of the body: glasses are 12 pixels wide.
- **Symmetric is easiest.** The studio mirrors as you draw. A little asymmetry (a tuft to one side) adds character.

### Checklist

- [ ] It has a body, and feet on rows 27–28 (or `"floats": true`).
- [ ] The eyes use `e` and are at least 2 pixels tall, so it can blink.
- [ ] Every colour key is built in or in `colors`.
- [ ] It looks good with a hat (the studio shows a party hat), with headphones or a boombox, and with a laptop.
- [ ] It still looks good in another wardrobe colour (the studio shows *Your colours*).

## Examples

- [`examples/cactus.pixling.json`](../examples/cactus.pixling.json): a buddy with arms in the back layer, a flower on top and extra colours
- [`examples/top-hat.pixling.json`](../examples/top-hat.pixling.json): a hat with its own colours
- [`examples/heart-glasses.pixling.json`](../examples/heart-glasses.pixling.json): something for the face

The studio's starting point, *Blob*, is another example: draw a new buddy and click **Share**.
