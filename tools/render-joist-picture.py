# Static illustrations from exact lesson mesh data, not browser screenshots.
# From the repository: node tools/export-joist-render-data.mjs
# Then: python tools/render-joist-picture.py [--font FONT.ttf] [--font-bold BOLD.ttf]
# Development-only dependencies: python -m pip install Pillow numpy
# Reads test/out/joist-render-data.json; writes images/floor-joists.png and
# images/floor-joist-connection.png and images/floor-end-backing.png.
# Pass --deck to both the Node exporter and this script to write only
# images/flooring.png, flooring-closeup.png and flooring-layout.png from flooring-render-data.json.
# Windows Segoe UI preserves the original
# layout; other fonts can change text metrics. No website runtime dependencies.
import argparse, json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description='Render exact floor-lesson meshes as annotated PNGs.')
parser.add_argument('--deck',action='store_true',help='Read flooring-render-data.json and render flooring overview and layout only.')
parser.add_argument('--font',help='Regular TrueType font path; defaults to Windows Segoe UI, then DejaVu Sans.')
parser.add_argument('--font-bold',help='Bold TrueType font path; otherwise uses --font when provided.')
args=parser.parse_args()
data=json.loads((ROOT/('test/out/flooring-render-data.json' if args.deck else 'test/out/joist-render-data.json')).read_text(encoding='utf-8'))
W,H=1200,940
NAVY='#173b56'
textures={name:np.frombuffer((ROOT/'test/out'/spec['file']).read_bytes(),dtype=np.uint8).reshape(spec['height'],spec['width'],4)
          for name,spec in data.get('textures',{}).items()}
flooring_mips={}
for name,tex in textures.items():
    if not name.startswith('lessonFlooring-'): continue
    levels=[tex]
    while min(levels[-1].shape[:2])>1:
        h,w=levels[-1].shape[:2]
        levels.append(np.asarray(Image.fromarray(levels[-1]).resize((max(1,w//2),max(1,h//2)),Image.Resampling.BOX)))
    flooring_mips[name]=levels

def sample_flooring(name,mapped,uv,s):
    # Match the browser's mipmapped linear sampling: very fine ribs become
    # quiet at overview scale instead of aliasing into broad false bands.
    levels=flooring_mips[name]
    derivatives=np.linalg.solve(np.array([s[1]-s[0],s[2]-s[0]]),np.array([uv[1]-uv[0],uv[2]-uv[0]]))
    texels=derivatives*np.array([levels[0].shape[1],levels[0].shape[0]])
    lod=max(0,min(len(levels)-1,math.log2(max(1,np.linalg.norm(texels[0]),np.linalg.norm(texels[1])))))
    def bilinear(tex):
        h,w=tex.shape[:2]
        x=(mapped[...,0]%1)*w-.5;y=(mapped[...,1]%1)*h-.5
        ix=np.floor(x).astype(int);iy=np.floor(y).astype(int)
        fx=(x-ix)[...,None];fy=(y-iy)[...,None]
        return ((1-fx)*(1-fy)*tex[iy%h,ix%w,:3]+fx*(1-fy)*tex[iy%h,(ix+1)%w,:3]
                +(1-fx)*fy*tex[(iy+1)%h,ix%w,:3]+fx*fy*tex[(iy+1)%h,(ix+1)%w,:3])/255
    low=math.floor(lod);high=min(low+1,len(levels)-1);blend=lod-low
    return bilinear(levels[low])*(1-blend)+bilinear(levels[high])*blend
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
            tex=textures.get(g['material']['texture'])
            grain=np.ones((*u.shape,3))
            if tex is not None:
                uv=np.array(t['uv'])
                mapped=u[...,None]*uv[0]+v[...,None]*uv[1]+w[...,None]*uv[2]
                if g['material']['texture'] in flooring_mips:
                    grain=sample_flooring(g['material']['texture'],mapped,uv,s)
                else:
                    tx=np.floor((mapped[...,0]%1)*tex.shape[1]).astype(int)
                    ty=np.floor((mapped[...,1]%1)*tex.shape[0]).astype(int)
                    grain=tex[ty,tx,:3]/255.0
            shade=.64+.43*max(0,float(np.dot(normal,light)))
            color=np.clip(rgb[None,None,:]*shade*grain,0,255).astype(np.uint8)
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

def dimension(d,project,p,q,label,offset=(0,0)):
    p=project(p);q=project(q);off=np.array(offset);a=p+off;b=q+off
    for start,end in [(p,a),(q,b),(a,b)]:
        d.line([tuple(start),tuple(end)],fill='white',width=7)
        d.line([tuple(start),tuple(end)],fill=NAVY,width=2)
    along=(b-a)/np.linalg.norm(b-a);cross=np.array([-along[1],along[0]])*7
    for point in [a,b]:d.line([tuple(point-cross),tuple(point+cross)],fill=NAVY,width=3)
    middle=(a+b)/2;f=font(23,True);box=d.textbbox((0,0),label,font=f)
    width=box[2]-box[0]+22
    d.rounded_rectangle((middle[0]-width/2,middle[1]-19,middle[0]+width/2,middle[1]+23),radius=5,fill='white')
    d.text((middle[0]-width/2+11,middle[1]-15),label,font=f,fill=NAVY)

def render_flooring():
    deck=data['metadata']['deck'];b=deck['bounds'];rows=deck['rows']
    assert len(deck['sheets'])==7 and len(rows)==3
    assert abs(deck['thicknessFt']*12-.625)<1e-9
    assert abs(b['x1Ft']-b['x0Ft']-10)<1e-9 and abs(b['z1Ft']-b['z0Ft']-16)<1e-9
    assert [[round(s['alongFt'],6) for s in row['sheets']] for row in rows]==[[8,8],[4,8,4],[8,8]]
    assert [round(row['widthFt'],6) for row in rows]==[4,4,2]
    (ROOT/'images').mkdir(exist_ok=True)
    im,project=scene()
    d=ImageDraw.Draw(im)
    title(d,'Flooring · 10 × 16','4 × 8 ft sheets · ⅝ in thick · tongue and groove')
    def seam_lines(im,project):
        edges={};overlay=Image.new('RGBA',im.size);od=ImageDraw.Draw(overlay)
        for s in deck['sheets']:
            y=s['bounds']['y1Ft']
            points=[(x,y,z) for x,z in [(s['x0Ft'],s['z0Ft']),(s['x1Ft'],s['z0Ft']),
                     (s['x1Ft'],s['z1Ft']),(s['x0Ft'],s['z1Ft'])]]
            for a,c in zip(points,points[1:]+points[:1]):
                axis=0 if a[0]!=c[0] else 2;fixed=2 if axis==0 else 0
                key=(axis,a[fixed],y)
                edges.setdefault(key,[]).append(sorted((a[axis],c[axis])))
        # Staggered panels share partial long edges. Merge their intervals,
        # not just identical segments, to keep every seam the same faint tone.
        for (axis,fixed,y),intervals in edges.items():
            merged=[]
            for lo,hi in sorted(intervals):
                if merged and lo<=merged[-1][1]+1e-9:merged[-1][1]=max(merged[-1][1],hi)
                else:merged.append([lo,hi])
            for lo,hi in merged:
                a=(lo,y,fixed) if axis==0 else (fixed,y,lo)
                c=(hi,y,fixed) if axis==0 else (fixed,y,hi)
                od.line([tuple(project(a)),tuple(project(c))],fill=(85,80,70,90),width=1)
        crop=overlay.crop((25,145,W-25,706));im.paste(crop,(25,145),crop)
    seam_lines(im,project)
    yt=b['y1Ft']
    dimension(d,project,[b['x0Ft'],yt,b['z0Ft']],[b['x0Ft'],yt,b['z1Ft']],'16 ft',(-20,-30))
    dimension(d,project,[b['x0Ft'],yt,b['z1Ft']],[b['x1Ft'],yt,b['z1Ft']],'10 ft',(0,38))
    dimension(d,project,[b['x1Ft'],b['y0Ft'],b['z0Ft']],[b['x1Ft'],yt,b['z0Ft']],'⅝ in',(35,0))
    for i,row in enumerate(rows):
        x=(row['x0Ft']+row['x1Ft'])/2
        point=project([x,yt,0 if i!=1 else 2])
        texts=[('Row 1 · 4 ft wide',['8 ft + 8 ft']),('Row 2 · staggered',['4 ft + 8 ft + 4 ft']),
               ('Row 3 · trimmed',['2 ft wide · 8 ft + 8 ft'])]
        label,lines=texts[i]
        leader(d,point,(40+i*390,748,355,110),label,lines)
    d.text((40,890),'Fine ribbed surface from your photo reference · subtle sheet joints',font=font(23),fill='#526879')
    im.save(ROOT/'images/flooring.png')

    im,project=scene([-1,b['y1Ft'],-4],1.65,yaw=.18,pitch=1.04)
    seam_lines(im,project);d=ImageDraw.Draw(im)
    title(d,'Flooring · surface close-up','Fine parallel ribs · matte taupe-brown finish · quieter seams')
    leader(d,project([-.78,b['y1Ft'],-3.95]),(620,748,540,110),'Fine ribbed texture',['Based on your close-up photo'])
    leader(d,project([-1,b['y1Ft'],-4.18]),(40,748,530,110),'Tight sheet joint',['Hairline drawn at the real sheet edge'])
    d.text((40,890),'Surface detail is illustrative; the sheet sizes and ⅝ in thickness are unchanged.',font=font(22),fill='#526879')
    im.save(ROOT/'images/flooring-closeup.png')

    # Orthographic plan drawn directly from the same seven measured sheet rectangles.
    plan=Image.new('RGB',(1200,1080),'#edf2f6');d=ImageDraw.Draw(plan)
    title(d,'Flooring · staggered seams','Top view · each rectangle is one laid piece · dimensions in feet')
    left,top,scale=125,260,59
    def point(x,z):
        return (left+(z-b['z0Ft'])*scale,top+(x-b['x0Ft'])*scale)
    colors=['#d9bd89','#e5cca3','#cae0df']
    def centered(text,x,y,size=29,bold=True,color=NAVY):
        d.text((x,y),text,font=font(size,bold),fill=color,anchor='mm')
    for row in rows:
        i=row['row']
        for s in row['sheets']:
            a=point(s['x0Ft'],s['z0Ft']);c=point(s['x1Ft'],s['z1Ft'])
            d.rectangle((*a,*c),fill=colors[i],outline='#827965',width=1)
            cx=(a[0]+c[0])/2;cy=(a[1]+c[1])/2
            centered(f"{s['acrossFt']:g} × {s['alongFt']:g} ft",cx,cy-14,31)
            centered('Trimmed width' if row['trimmed'] else ('Half sheet' if s['alongFt']==4 else 'Full sheet'),cx,cy+24,23,False)
        y=(point(row['x0Ft'],b['z0Ft'])[1]+point(row['x1Ft'],b['z0Ft'])[1])/2
        centered(f"Row {i+1}",64,y-20,22)
        centered(f"{row['widthFt']:g} ft",64,y+13,25)
    # Highlight only the sheet end joints, so their alternating positions read clearly.
    for joint in deck['endJoints']:
        a=point(joint['x0Ft'],joint['zFt']);c=point(joint['x1Ft'],joint['zFt'])
        d.line([a,c],fill='#827965',width=2)
    d.line([(left,218),(left+16*scale,218)],fill=NAVY,width=2)
    for ft in [0,4,8,12,16]:
        x=left+ft*scale
        d.line([(x,207),(x,230)],fill=NAVY,width=3)
        centered(f'{ft} ft',x,186,25)
    d.line([(left+16*scale+37,top),(left+16*scale+37,top+10*scale)],fill=NAVY,width=2)
    for y in [top,top+10*scale]:d.line([(left+16*scale+27,y),(left+16*scale+47,y)],fill=NAVY,width=3)
    centered('10 ft',1122,top+5*scale,23)
    d.rounded_rectangle((40,885,1160,1000),radius=12,fill='white',outline='#bdccd8',width=2)
    d.text((62,902),'Staggered = the next row’s end seams move over.',font=font(29,True),fill=NAVY)
    d.text((62,948),'Row 2: 4 + 8 + 4 ft. Final row width: 10 − 4 − 4 = 2 ft.',font=font(27),fill=NAVY)
    d.text((40,1030),'⅝ in tongue-and-groove flooring · 7 laid pieces · colors distinguish the rows',font=font(23),fill='#526879')
    plan.save(ROOT/'images/flooring-layout.png')

if args.deck:
    render_flooring()
    print('Saved exact-mesh flooring overview, surface close-up and measured sheet-layout PNGs.')
    sys.exit(0)

joint=data['metadata']['joint']; j=joint['joist']; skid=joint['skid']; notch=joint['notch']
frame=data['metadata']['frame']; bounds=frame['bounds']
ends=frame['endBoards'];outer=frame['outerBoards']
double=[m for m in ends if m['member']['meta']['endRebate']=='negative']
single=[m for m in ends if m['member']['meta']['endRebate']=='positive']
assert len(double)==2 and len(single)==1
assert abs(j['lengthFt']*12-117)<1e-8
assert abs((bounds['x1Ft']-bounds['x0Ft'])*12-120)<1e-8
im,project=scene()
d=ImageDraw.Draw(im)
title(d,'Floor joists + outer boards','10 ft overall width · treated wood · different grain and knots on each board')
# Exact top-face seams show the two touching end boards as separate pieces.
for m in frame['members']:
    b=m['bounds'];y=b['y1Ft']
    polygon=[project([x,y,z]) for x,z in [(b['x0Ft'],b['z0Ft']),(b['x1Ft'],b['z0Ft']),(b['x1Ft'],b['z1Ft']),(b['x0Ft'],b['z1Ft'])]]
    d.line([tuple(p) for p in polygon+[polygon[0]]],fill='#78694f',width=1)
leader(d,project([0,double[0]['bounds']['y1Ft'],double[0]['center'][2]]),(790,150,370,100),'Two end boards',['Together: 3 in thick'])
leader(d,project([0,single[0]['bounds']['y1Ft'],single[0]['center'][2]]),(40,152,325,100),'One end board',['1½ in thick'])
near=next(m for m in outer if m['center'][0]>0)
leader(d,project([near['center'][0],near['bounds']['y1Ft'],1.7]),(790,580,370,100),'Outer board',['1½ in thick each side'])
leader(d,project([1,j['bounds']['y1Ft'],j['center'][2]]),(40,730,515,124),'Floor joist · 9 ft 9 in',['2×6 nominal · 1½ × 5½ in actual','16 in on center'])
dimension(d,project,[bounds['x0Ft'],j['bounds']['y1Ft'],bounds['z1Ft']],[bounds['x1Ft'],j['bounds']['y1Ft'],bounds['z1Ft']],'10 ft outside to outside',(0,42))
d.rounded_rectangle((590,730,1160,854),radius=12,fill='white',outline='#bdccd8',width=2)
d.text((610,742),'Why the joist is 3 inches shorter',font=font(27,True),fill=NAVY)
d.text((610,786),'120 in − 1½ in − 1½ in = 117 in',font=font(26),fill=NAVY)
d.text((40,884),'First joist position and skid count still to confirm · end names not assigned',font=font(23),fill='#526879')
(ROOT/'images').mkdir(exist_ok=True)
im.save(ROOT/'images/floor-joists.png')

target=[skid['xFt'],.48,j['center'][2]]
im,project=scene(target,3.35,yaw=.9,pitch=.52)
d=ImageDraw.Draw(im)
title(d,'Joist in the skid notch','Treated floor joist · 9 ft 9 in long · seated 1 inch into the skid')
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

backing=frame.get('backing')
if backing:
    bb=backing['bounds'];z=backing['center'][2]
    im,project=scene([skid['xFt'],.48,z],3.4,yaw=.82,pitch=.70)
    d=ImageDraw.Draw(im)
    title(d,'Board the mule hooks onto','Flat treated 2×4 · 93 in (7 ft 9 in) long · rests on the skids')
    edge_layer=Image.new('RGBA',(W,H),(0,0,0,0));edge_draw=ImageDraw.Draw(edge_layer)
    for m in double:
        b=m['bounds'];yt=b['y1Ft']
        pts=[project([x,yt,zz]) for x,zz in [(b['x0Ft'],b['z0Ft']),(b['x1Ft'],b['z0Ft']),(b['x1Ft'],b['z1Ft']),(b['x0Ft'],b['z1Ft'])]]
        edge_draw.line([tuple(p) for p in pts+[pts[0]]],fill='#78694f',width=2)
    edge_crop=edge_layer.crop((25,145,W-25,706));im.paste(edge_crop,(25,145),edge_crop)
    d=ImageDraw.Draw(im)
    leader(d,project([skid['xFt']+.35,double[-1]['bounds']['y1Ft'],double[-1]['center'][2]]),(790,152,370,115),'Two end boards',['Standing on edge'])
    leader(d,project([skid['xFt']+.35,bb['y1Ft'],z]),(600,736,560,115),'Board the mule hooks onto',['Treated 2×4 · 3½ in wide × 1½ in tall'])
    leader(d,project([skid['x1Ft'],bb['y0Ft']-.09,bb['z1Ft']+.22]),(40,736,510,115),'Skid',['The flat 2×4 rests on its top'])
    edgeX=skid['xFt']+.7
    dimension(d,project,[edgeX,bb['y0Ft'],bb['z1Ft']],[edgeX,bb['y1Ft'],bb['z1Ft']],'1½ in',(45,10))
    assert abs(backing['lengthFt']*12-93)<1e-8
    d.text((40,884),'93 in cut length confirmed · shown centered; side-to-side position still to confirm',font=font(23),fill='#526879')
    im.save(ROOT/'images/floor-end-backing.png')
print('Saved exact-mesh floor overview and connection PNGs.')
