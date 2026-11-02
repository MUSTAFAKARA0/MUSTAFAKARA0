# KARAYS tanıtım videosu için özgün arka plan müziği (sentez; dış örnek/kayıt yok → telif sorunu yok)
import numpy as np, wave, sys
SR=44100; DUR=59.4
t=np.arange(int(SR*DUR))/SR
def midi(n): return 440*2**((n-69)/12)
# 4 akor (Cmaj9 – Am7 – Fmaj7 – G6), her biri 3.6 sn, döngü
chords=[[48,55,64,71,74],[45,52,60,67,71],[41,48,57,64,69],[43,50,59,64,67]]
L=3.6
out=np.zeros((len(t),2))
def env(n, a, r):
    e=np.ones(n); A=int(a*SR); R=int(r*SR)
    e[:A]=np.linspace(0,1,A); e[-R:]=np.linspace(1,0,R); return e
k=0; pos=0.0
rng=np.random.default_rng(7)
while pos<DUR:
    ch=chords[k%4]; s=int(pos*SR); n=min(int((L+1.2)*SR), len(t)-s)
    if n<=0: break
    tt=np.arange(n)/SR; e=env(n,0.9,1.4)
    pad=np.zeros(n)
    for i,m in enumerate(ch):
        f=midi(m)
        for det in (-0.12,0.12):
            pad+=np.sin(2*np.pi*f*(1+det/100)*tt+rng.uniform(0,6))*(0.5 if i==0 else 0.28)
    pad*=e*0.10
    out[s:s+n,0]+=pad; out[s:s+n,1]+=np.roll(pad,180)
    # yumuşak arpej (sekizlikler, 100 bpm)
    step=0.3; notes=[m+12 for m in ch[1:]]+[ch[2]+24]
    for j in range(int(L/step)):
        st=s+int(j*step*SR); ln=int(0.9*SR)
        if st+ln>len(t): break
        f=midi(notes[j%len(notes)]); tt2=np.arange(ln)/SR
        pl=(np.sin(2*np.pi*f*tt2)+0.3*np.sin(4*np.pi*f*tt2))*np.exp(-tt2*4.5)*0.045
        pan=0.5+0.35*np.sin(j)
        out[st:st+ln,0]+=pl*(1-pan); out[st:st+ln,1]+=pl*pan
    # bas
    bf=midi(ch[0]-12); bn=int(L*SR); bn=min(bn,len(t)-s); tb=np.arange(bn)/SR
    bass=np.sin(2*np.pi*bf*tb)*env(bn,0.05,0.8)*0.07
    out[s:s+bn,0]+=bass; out[s:s+bn,1]+=bass
    pos+=L; k+=1
# basit yankı
d=int(0.27*SR)
for g in (0.28,0.14):
    out[d:]+=out[:-d]*g; d*=2
# giriş/çıkış kararması
fi=int(2.0*SR); fo=int(3.5*SR)
out[:fi]*=np.linspace(0,1,fi)[:,None]; out[-fo:]*=np.linspace(1,0,fo)[:,None]
out/=np.max(np.abs(out)); out*=0.5
pcm=(out*32767).astype(np.int16)
with wave.open(sys.argv[1],'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
