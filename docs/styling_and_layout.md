I’ll assume a reference canvas size of 600×820 px (very close to your screenshot).
All sizes are given both as pixels for that size and as relative formulas so you can scale.

0. Global Layout

Orientation: portrait.

Reference size: cw = 600, ch = 820.

Main elements (top → bottom):

Score row (left score, right crown+highscore).

Square grid container (board).

Next piece preview centered below the board.

Background:

Top color: #4A6FA5

Bottom color: darker blue #314F7A

Apply as a vertical linear gradient:

gradient(0, 0) → #4A6FA5

gradient(0, ch) → #314F7A

1. Board (Grid Container)
1.1 Position & size

Board is a centered square.

Width/height:

const boardW = Math.round(cw * 0.80); // ~480px on 600px width
const boardH = boardW;


Top-left:

const boardX = Math.round((cw - boardW) / 2); // ~60px
const boardY = Math.round(ch * 0.18);         // ~148px

1.2 Outer frame

Shape: rounded rectangle.

Corner radius: r = 0.08 * cellSize.

const cellSize = boardW / 10;            // 10×10 grid → ~48px
const boardRadius = Math.round(cellSize * 0.4); // ~19px


Fill: dark navy #101936 (or #111a34).

Inner border / outline:

Color: #1c2847.

Width: 2–3 px.

Shadow:

Offset: (0, 4 px).

Blur: 8–10 px.

Color: rgba(0, 0, 0, 0.35).

2. Grid Cells (Empty)

Inside the board we have a 10×10 grid of subtle cells.

2.1 Cell geometry

10 columns × 10 rows.

cellSize = boardW / 10 (≈ 48 px).

No gutter between cells – they touch.

Coordinates:

for (let row = 0; row < 10; row++) {
  for (let col = 0; col < 10; col++) {
    const x = boardX + col * cellSize;
    const y = boardY + row * cellSize;
  }
}

2.2 Cell styling

Fill color: slightly lighter than board background, e.g. #18223b.

Opacity: ~0.85 so grid is very subtle.

No individual shadows.

Optional: inner border on each cell:

Color: rgba(0, 0, 0, 0.35) or #10172d.

Width: 1 px.

Draw as simple rect strokes to create the “grid squares” you see.

Result: a flat, uniform dark board with a barely visible grid.

3. Blocks (Filled Cells)

Every block is a square tile snapping to the cell grid.

3.1 Placement

One tile = exactly one cell: tileSize = cellSize.

Same coordinates as cells.

3.2 Per-tile styling

Color palette (approx):

Orange: #F58B2B

Pink: #E45BBF

Green: #3FBF4E

3D look

For each tile:

Base rectangle

Fill: base color.

Slightly inset from full cell (to show grid underneath):

Inset margin: margin = cellSize * 0.06 (≈ 3 px on 48).

Draw at x + margin, y + margin, size tileSize - 2*margin.

Bevel shading

Top-left highlight:

Draw a smaller rect/gradient on top area.

Color: lighter tint of base color (e.g. +20–30% brightness).

Bottom-right shade:

Overlay dark gradient from center to bottom-right edge.

Color: darker tint (e.g. –25–30% brightness).

Inner plate / “bump”

Optional tiny inner inset (1–2 px) with a slightly different shading to give “plated” look.

Drop shadow

Offset: (0, 4 px) relative to tile.

Blur: 4–6 px.

Color: rgba(0, 0, 0, 0.45).

This is what creates the very strong sense of depth.

Finish: matte/satin – no strong specular highlight.

4. Score Row (Top UI)

Located above the board, aligned to the board’s horizontal bounds.

4.1 Baseline Y
const scoreY = boardY - Math.round(boardW * 0.08); // ≈ 480*0.08 ≈ 38px above board


So scoreBaselineY ≈ boardY - 40 in the reference.

4.2 Left score (current score)

Position:

const currentScoreX = boardX; // left edge of board
const currentScoreY = scoreY;


Text: integer (“5” in screenshot).

Font: bold sans-serif, e.g. 700 40px "Inter" or similar.

Size: fontSizeScore = boardW * 0.075 (≈ 36 px).

Color: pure white #FFFFFF.

Alignment:

textAlign = "left".

textBaseline = "alphabetic" or middle depending on taste.

No outline, no icon.

4.3 Right side: crown + high score

Two stacked elements on the right board edge.

Coordinates:

const highScoreX = boardX + boardW; // right edge of board
const crownY     = scoreY - fontSizeScore * 0.9; // crown slightly above number
const highScoreY = scoreY;                       // same baseline as current score

Crown icon

Centered above the numeric high score.

Size: about fontSizeScore * 1.1 (≈ 40–44 px).

Fill: golden yellow #FFD700 or #FFC928.

No outline, simple flat icon.

If using an image:

Draw with center at (highScoreX, crownY).

High score text

Position: (highScoreX, highScoreY).

Text: integer (“4467”).

Font: same family as left score, but slightly smaller:

fontSizeHigh = boardW * 0.07 (≈ 34 px).

Color: golden yellow #FFC928.

Alignment: textAlign = "right".

Optional subtle shadow:

ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
ctx.shadowBlur = 4;
ctx.shadowOffsetY = 2;

5. Next Piece Preview

Centered horizontally below the board.

5.1 Position
const previewCenterX = cw / 2;
const previewCenterY = boardY + boardH + boardW * 0.22; // ~ one fifth board below


So on 600×820:

boardY ≈ 148, boardH = 480.

previewCenterY ≈ 148 + 480 + 105 ≈ 733.

5.2 Layout

In the screenshot the preview shows a 3×3 or 4×4 cluster of tiles:

Tile size equal to main cellSize or slightly smaller (0.9×) for a “preview” feel:

const previewTileSize = cellSize * 0.9;


Arrange shape around center:

// example square 3x3
const shapeCols = 3;
const shapeRows = 3;
const shapeW = shapeCols * previewTileSize;
const shapeH = shapeRows * previewTileSize;
const originX = previewCenterX - shapeW / 2;
const originY = previewCenterY - shapeH / 2;


Reuse exact same tile styling as main grid (shadow, bevel).

No visible container or border around the preview.

6. Layer Order (z-index)

From back to front:

Background gradient.

Board outer frame.

Empty grid cells.

Filled block tiles (main board and preview).

Shadows/effects (if drawn separately).

Score row (text + crown).