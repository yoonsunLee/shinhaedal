# 화살표 아이콘 글꼴(assets/fonts/sh-arrows.woff2)을 만든다. 필요: pip install fonttools brotli
import math
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.recordingPen import RecordingPen
S=68; W=1.1*S/2; BASE=380
def P(x,y): return (x*S, BASE+(8-y)*S)
def circle(c,r,n=24): return [(c[0]+r*math.cos(2*math.pi*i/n), c[1]+r*math.sin(2*math.pi*i/n)) for i in range(n)]
def capsule(a,b,r=W,n=12):
    dx,dy=b[0]-a[0],b[1]-a[1]; ang=math.atan2(dy,dx); pts=[]
    for i in range(n+1):
        t=ang-math.pi/2+math.pi*i/n; pts.append((b[0]+r*math.cos(t),b[1]+r*math.sin(t)))
    for i in range(n+1):
        t=ang+math.pi/2+math.pi*i/n; pts.append((a[0]+r*math.cos(t),a[1]+r*math.sin(t)))
    pts.reverse()  # keep consistent orientation
    return pts
def arc(cx,cy,r,a0,a1,n=6): return [(cx+r*math.cos(math.radians(a0+(a1-a0)*i/n)),cy+r*math.sin(math.radians(a0+(a1-a0)*i/n))) for i in range(n+1)]
def polyline_segs(pts): return list(zip(pts,pts[1:]))
def glyph(segs,k=1.0):
    tt=TTGlyphPen(None)
    for a,b in segs:
        f=lambda q:(8+(q[0]-8)*k,8+(q[1]-8)*k)
        poly=capsule(P(*f(a)),P(*f(b)),W)
        area=sum(x0*y1-x1*y0 for (x0,y0),(x1,y1) in zip(poly,poly[1:]+poly[:1]))
        if area>0: poly=poly[::-1]
        tt.moveTo(tuple(map(round,poly[0])))
        for q in poly[1:]: tt.lineTo(tuple(map(round,q)))
        tt.closePath()
    return tt.glyph()
right=[((2,8),(13.5,8)),((9.5,4),(13.5,8)),((13.5,8),(9.5,12))]
left=[((14,8),(2.5,8)),((6.5,4),(2.5,8)),((2.5,8),(6.5,12))]
up=[((6,14),(6,2.5)),((2,6.5),(6,2.5)),((6,2.5),(10,6.5))]
down=[((6,2),(6,13.5)),((2,9.5),(6,13.5)),((6,13.5),(10,9.5))]
# box: M12 9.5 v3 a1 1 0 0 1 -1 1 H3.5 a1 1 0 0 1 -1-1 V5 a1 1 0 0 1 1-1 h3
box=[(12,9.5),(12,12.5)]+arc(11,12.5,1,0,90)+[(3.5,13.5)]+arc(3.5,12.5,1,90,180)+[(2.5,5)]+arc(3.5,5,1,180,270)+[(6.5,4)]
ext=[((9,2.5),(13.5,2.5)),((13.5,2.5),(13.5,7)),((13.5,2.5),(7.5,8.5))]+polyline_segs(box)
glyphs={'.notdef':glyph([]),'space':glyph([]),'arrowleft':glyph(left),'arrowup':glyph(up),'arrowright':glyph(right),'arrowdown':glyph(down),'arrowupright':glyph(ext,0.86)}
order=list(glyphs)
fb=FontBuilder(1000,isTTF=True); fb.setupGlyphOrder(order)
fb.setupCharacterMap({0x20:'space',0x2190:'arrowleft',0x2191:'arrowup',0x2192:'arrowright',0x2193:'arrowdown',0x2197:'arrowupright'})
fb.setupGlyf(glyphs)
adv=round(16*S)
fb.setupHorizontalMetrics({g:((round(12*S) if g in('arrowup','arrowdown') else adv) if g.startswith('arrow') else 300,0) for g in order})
fb.setupHorizontalHeader(ascent=900,descent=-250)
fb.setupNameTable({'familyName':'SH Arrows','styleName':'Regular'})
fb.setupOS2(sTypoAscender=900,sTypoDescender=-250,usWinAscent=900,usWinDescent=250)
fb.setupPost()
fb.font.flavor='woff2'
fb.save(__import__('os').path.join(__import__('os').path.dirname(__file__),'..','assets','fonts','sh-arrows.woff2'))
print('ok')
