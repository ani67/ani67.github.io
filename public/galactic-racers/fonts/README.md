# Kilo by HVNTER

HVKiloV2.otf is the creator’s 2025 update. Downloaded 2026-09-13 from the public Google Drive folder linked at https://hvnter.net/free-stuff-1.

Original package information and licensing statement are preserved in Kilo-Info.rtf: “100% free to use for all commercial project scopes.”

Product: https://hvnter.net/products/p/kilo-free-typeface
Source folder: https://drive.google.com/drive/folders/12Lxtte8-whKVtUlR4sP9CoPOPMvrb2DD

## Galactic Numerals

GalacticNumerals-Regular.ttf and .woff2 contain original 0–9 and HUD punctuation designed for this game. They do not contain or modify HVNTER's outlines. CSS combines the two fonts under the game's Kilo family using unicode-range. This replaces the original font's identical decorative digit glyphs with distinct, equal-width numerals.

Rebuild with `python scripts/build-racer-numerals.py` (requires fonttools and brotli). The TTF can be opened in a font editor; the game serves the smaller WOFF2. Review at `/galactic-racers/numerals.html`.
