# Static illustrations from exact lesson mesh data, not browser screenshots.
# From the repository: node tools/export-joist-render-data.mjs
# Then: python tools/render-joist-picture.py [--font FONT.ttf] [--font-bold BOLD.ttf]
# Development-only dependencies: python -m pip install Pillow numpy
# Reads test/out/joist-render-data.json; writes images/floor-joists.png and
# images/floor-joist-connection.png. Windows Segoe UI preserves the original
# layout; other fonts can change text metrics. No website runtime dependencies.
import argparse, json, math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description='Render the exported floor-joist lesson mesh as two annotated PNGs.')
parser.add_argument('--font',help='Regular TrueType font path; defaults to Windows Segoe UI, then DejaVu Sans.')
parser.add_argument('--font-bold',help='Bold TrueType font path; otherwise uses --font when provided.')
args=parser.parse_args()
data=json.loads((ROOT/'test/out/joist-render-data.json').read_text(encoding='utf-8'))
W,H=1200,940
NAVY='#173b56'
def font(size,bold=False):
    override=(args.font_bold or args.font) if bold else args.font
    if override:
        return ImageFont.truetype(override,size)
    for name in ['C:/Windows/Fonts/segoeui'+('b' if bold else '')+'.ttf',
                 'DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf']:
        try:
            return ImageFont.truetype(name,size)
        except OSError:
            pass
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()

def scene(target=None,extent=None,yaw=.78,pitch=.70):
    bg=np.full((H,W,3),[237,242,246],dtype=np.uint8)
    depth=np.full((H,W),-np.inf)
    cam=np.array([math.sin(yaw)*math.cos(pitch),math.sin(pitch),math.cos(yaw)*math.cos(pitch)])
    right=np.array([math.cos(yaw),0,-math.sin(yaw)])
    up=np.cross(cam,right)
    points=np.array([v for g in data['groups'] for t in g['triangles'] for v in t['positions']])
    if target is None:
        px=points@right; py=points@up
        scale=min(1040/(px.max()-px.min()),490/(py.max()-py.min()))
        midx=(px.max()+px.min())/2; midy=(py.max()+py.min())/2
    else:
        midx=np.dot(target,right);midy=np.dot(target,up);scale=1000/extent
    def project(p):
        p=np.asarray(p)
        return np.array([600+(np.dot(p,right)-midx)*scale,420-(np.dot(p,up)-midy)*scale])
    light=cam+np.array([.0,1,.2]);light/=np.linalg.norm(light)
    for g in data['groups']:
        tint=np.array(g['material']['tint'])
        rgb=np.where(tint<=.0031308,tint*12.92,1.055*tint**(1/2.4)-.055)*255
        for t in g['triangles']:
            p=np.array(t['positions']); normal=np.array(t['normals'][0])
            if np.dot(normal,cam)<1e-8:continue
            s=np.array([project(v) for v in p]); z=p@cam
            x0=max(25,math.floor(s[:,0].min()));x1=min(W-26,math.ceil(s[:,0].max()))
            y0=max(145,math.floor(s[:,1].min()));y1=min(705,math.ceil(s[:,1].max()))
            if x1<x0 or y1<y0:continue
            a,b,c=s
            den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
            if abs(den)<1e-9:continue
            yy,xx=np.mgrid[y0:y1+1,x0:x1+1];xx=xx+.5;yy=yy+.5
            u=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den
            v=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den
            w=1-u-v;zz=u*z[0]+v*z[1]+w*z[2]
            sl=depth[y0:y1+1,x0:x1+1]
            mask=(u>=-1e-7)&(v>=-1e-7)&(w>=-1e-7)&(zz>sl)
            if not mask.any():continue
            world=u[...,None]*p[0]+v[...,None]*p[1]+w[...,None]*p[2]
            axis=0 if t['part']=='floor-frame' else 2
            across=world[...,1] if abs(normal[1])<.6 else world[...,2 if axis==0 else 0]
            grain=1+.034*np.sin(across*310+3*np.sin(world[...,axis]*2))+.017*np.sin(across*790+world[...,axis]*5)
            shade=.64+.43*max(0,float(np.dot(normal,light)))
            color=np.clip(rgb[None,None,:]*shade*grain[...,None],0,255).astype(np.uint8)
            bg[y0:y1+1,x0:x1+1][mask]=color[mask];sl[mask]=zz[mask]
    return Image.fromarray(bg),project

def leader(d,point,box,title,lines):
    x,y,width,height=box
    endpoint=(x+width/2,y if point[1]<y else y+height)
    d.line([tuple(point),endpoint],fill='white',width=8)
    d.line([tuple(point),endpoint],fill=NAVY,width=3)
    d.ellipse((point[0]-6,point[1]-6,point[0]+6,point[1]+6),fill=NAVY,outline='white',width=2)
    d.rounded_rectangle((x,y,x+width,y+height),radius=12,fill='white',outline='#bdccd8',width=2)
    d.text((x+20,y+12),title,font=font(28,True),fill=NAVY)
    for i,line in enumerate(lines): d.text((x+20,y+53+i*31),line,font=font(24),fill=NAVY)

def title(d,main,sub):
    d.rectangle((0,0,W,128),fill='#0a2c49')
    d.text((38,22),main,font=font(44,True),fill='white')
    d.text((40,80),sub,font=font(25),fill='#d5e5f0')

joint=data['metadata']['joint']; j=joint['joist']; skid=joint['skid']; notch=joint['notch']
im,project=scene()
d=ImageDraw.Draw(im)
title(d,'Floor joists','10 × 16 lesson · confirmed name')
leader(d,project([3,j['bounds']['y1Ft'],j['center'][2]]),(620,730,540,124),'Floor joist',['2×6 nominal · 1½ × 5½ in actual','16 in on center · cut length to confirm'])
leader(d,project([skid['xFt'],.20,7.5]),(40,730,540,124),'Skids',['Treated 4×6 · 3½ × 5½ in actual','16 ft long'])
d.text((40,884),'Exact model geometry · joist cut length and first position still to confirm',font=font(23),fill='#526879')
(ROOT/'images').mkdir(exist_ok=True)
im.save(ROOT/'images/floor-joists.png')

target=[skid['xFt'],.48,j['center'][2]]
im,project=scene(target,3.35,yaw=.9,pitch=.52)
d=ImageDraw.Draw(im)
title(d,'Joist in the skid notch','The floor joist sits 1 inch down into the skid')
leader(d,project([skid['xFt']+.55,j['bounds']['y1Ft'],j['center'][2]]),(40,152,385,115),'Floor joist',['1½ in thick × 5½ in tall'])
edge=[skid['x1Ft'],notch['seatYFt'],notch['z1Ft']]
leader(d,project(edge),(670,736,490,115),'Notch · 1 in deep',['The joist rests on this seat'])
leader(d,project([skid['x1Ft'],.20,notch['z1Ft']+.32]),(40,736,480,115),'Skid',['Treated wood'])
p=project(edge);q=project([edge[0],notch['topYFt'],edge[2]])
off=np.array([82,0]);a=p+off;b=q+off
d.line([tuple(p),tuple(a)],fill=NAVY,width=3);d.line([tuple(q),tuple(b)],fill=NAVY,width=3)
d.line([tuple(a),tuple(b)],fill=NAVY,width=3)
for t in [a,b]:d.line([(t[0]-8,t[1]),(t[0]+8,t[1])],fill=NAVY,width=3)
d.rounded_rectangle((a[0]+10,(a[1]+b[1])/2-20,a[0]+77,(a[1]+b[1])/2+20),radius=5,fill='white')
d.text((a[0]+18,(a[1]+b[1])/2-18),'1 in',font=font(24,True),fill=NAVY)
d.text((40,884),'Exact model geometry · adjoining joists remain at 16 in on center',font=font(23),fill='#526879')
im.save(ROOT/'images/floor-joist-connection.png')
print('Saved exact-mesh overview and connection PNGs.')
