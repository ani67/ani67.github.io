"""Build original Galactic Numerals (fonttools + brotli); Kilo is left unmodified."""
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.transformPen import TransformPen
from fontTools.svgLib.path import parse_path
from fontTools.ttLib import TTFont
ROOT=Path(__file__).resolve().parents[1]/'public/galactic-racers/fonts'
# Original closed outlines, with broad shoulders, rounded terminals and open counters.
P={
'0':'M270 0 C80 0 30 100 30 300 C30 500 80 600 270 600 C460 600 510 500 510 300 C510 100 460 0 270 0 Z M270 140 C340 140 355 195 355 300 C355 405 340 460 270 460 C200 460 185 405 185 300 C185 195 200 140 270 140 Z',
'1':'M125 395 Q70 395 100 450 L210 575 Q230 600 275 600 L335 600 Q370 600 370 555 L370 145 L430 145 Q500 145 500 75 Q500 0 430 0 L125 0 Q55 0 55 75 Q55 145 125 145 L205 145 L205 425 L165 400 Q145 390 125 395 Z',
'2':'M45 450 C60 560 150 600 270 600 C430 600 505 535 505 420 C505 310 400 255 310 210 L205 150 L435 150 Q510 150 510 75 Q510 0 435 0 L115 0 Q30 0 30 80 C30 175 105 240 220 300 C310 345 350 380 350 420 C350 460 320 475 275 475 C230 475 205 458 190 425 C160 350 30 365 45 450 Z',
'3':'M105 600 L305 600 C440 600 505 545 505 450 C505 370 460 330 420 307 C480 285 515 235 515 170 C515 55 435 0 300 0 L100 0 Q30 0 30 70 Q30 140 100 140 L285 140 Q355 140 355 188 Q355 240 285 240 L210 240 Q145 240 145 305 Q145 365 210 365 L280 365 Q350 365 350 412 Q350 460 280 460 L105 460 Q35 460 35 530 Q35 600 105 600 Z',
'4':'M350 0 Q285 0 285 70 L285 165 L100 165 Q25 165 25 235 Q25 255 45 290 L215 560 Q245 610 300 580 Q355 550 320 495 L195 300 L285 300 L285 410 Q285 480 355 480 Q425 480 425 410 L425 300 L455 300 Q515 300 515 232 Q515 165 455 165 L425 165 L425 70 Q425 0 350 0 Z',
'5':'M120 600 L430 600 Q500 600 500 530 Q500 460 430 460 L200 460 L190 365 L300 365 C440 365 515 300 515 185 C515 65 425 0 280 0 L110 0 Q35 0 35 70 Q35 140 110 140 L270 140 Q355 140 355 190 Q355 240 270 240 L100 240 Q25 240 35 315 L55 535 Q60 600 120 600 Z',
'6':'M430 600 Q500 600 500 530 Q500 460 430 460 L285 460 Q200 460 185 365 L300 365 C445 365 510 290 510 185 C510 65 420 0 275 0 C90 0 30 100 30 285 C30 495 95 600 275 600 Z M275 130 Q355 130 355 188 Q355 245 275 245 L180 245 Q180 130 275 130 Z',
'7':'M100 600 L435 600 Q510 600 510 535 Q510 510 490 475 L270 40 Q240 -15 175 10 Q105 35 140 105 L325 450 L100 450 Q25 450 25 525 Q25 600 100 600 Z',
'8':'M270 600 C430 600 500 535 500 445 C500 380 465 340 425 310 C480 280 515 235 515 170 C515 55 425 0 270 0 C115 0 25 55 25 170 C25 235 60 280 115 310 C75 340 40 380 40 445 C40 535 110 600 270 600 Z M270 365 Q345 365 345 420 Q345 475 270 475 Q195 475 195 420 Q195 365 270 365 Z M270 130 Q355 130 355 190 Q355 250 270 250 Q185 250 185 190 Q185 130 270 130 Z',
'9':'M110 0 Q40 0 40 70 Q40 140 110 140 L255 140 Q340 140 355 235 L240 235 C95 235 30 310 30 415 C30 535 120 600 265 600 C450 600 510 500 510 315 C510 105 445 0 265 0 Z M265 470 Q185 470 185 412 Q185 355 265 355 L360 355 Q360 470 265 470 Z',
'.':'M195 65 Q195 135 265 135 Q335 135 335 65 Q335 -5 265 -5 Q195 -5 195 65 Z',
'-':'M100 225 Q30 225 30 295 Q30 365 100 365 L440 365 Q510 365 510 295 Q510 225 440 225 Z',
'+':'M100 225 Q30 225 30 295 Q30 365 100 365 L200 365 L200 465 Q200 535 270 535 Q340 535 340 465 L340 365 L440 365 Q510 365 510 295 Q510 225 440 225 L340 225 L340 125 Q340 55 270 55 Q200 55 200 125 L200 225 Z',
'/':'M95 25 Q40 55 75 115 L345 550 Q380 610 435 580 Q490 550 455 490 L185 55 Q150 -5 95 25 Z',
':':'M195 65 Q195 135 265 135 Q335 135 335 65 Q335 -5 265 -5 Q195 -5 195 65 Z M195 380 Q195 450 265 450 Q335 450 335 380 Q335 310 265 310 Q195 310 195 380 Z'
}
order=['.notdef','space']+[f'uni{ord(c):04X}' for c in P]
fb=FontBuilder(1000,isTTF=True);fb.setupGlyphOrder(order)
glyphs={};metrics={}
for name in order:
 pen=TTGlyphPen(None)
 if name.startswith('uni'):
  ch=chr(int(name[3:],16));parse_path(P[ch],TransformPen(Cu2QuPen(pen,1,reverse_direction=True),(1.15,0,.16,.9,35,0)))
 glyphs[name]=pen.glyph();metrics[name]=(760,35) if name!='space' else (300,0)
fb.setupGlyf(glyphs);fb.setupHorizontalMetrics(metrics);fb.setupHorizontalHeader(ascent=872,descent=-330)
fb.setupCharacterMap({32:'space',**{ord(c):f'uni{ord(c):04X}' for c in P}})
fb.setupNameTable({'familyName':'Galactic Numerals','styleName':'Regular','uniqueFontIdentifier':'GalacticNumerals-Regular-1.0','fullName':'Galactic Numerals Regular','psName':'GalacticNumerals-Regular','version':'Version 1.0','copyright':'Original numeral outlines created for Galactic Racers, 2026.'})
fb.setupOS2(sTypoAscender=872,sTypoDescender=-330,usWinAscent=872,usWinDescent=330);fb.setupPost();fb.setupMaxp()
fb.save(ROOT/'GalacticNumerals-Regular.ttf');fb.font.flavor='woff2';fb.save(ROOT/'GalacticNumerals-Regular.woff2')
f=TTFont(ROOT/'GalacticNumerals-Regular.woff2');assert len({bytes(f['glyf'][f.getBestCmap()[ord(c)]].compile(f['glyf'])) for c in '0123456789'})==10
print('Built 10 distinct tabular numerals plus HUD punctuation.')
