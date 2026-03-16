#!/usr/bin/env python3
"""Generate portraits + item icons for 3 new NPCs"""

import requests, base64, time, os, json, struct, zlib

API_KEY = "84b7f1aa-76f8-4f06-854c-9e8304e7a81b"
API_URL = "https://api.pixellab.ai/v2/generate-image-v2"
JOBS_URL = "https://api.pixellab.ai/v2/background-jobs"
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

def rgba_to_png(rgba_data, w, h):
    def make_chunk(chunk_type, data):
        c = chunk_type + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    raw_rows = b''
    for y in range(h):
        raw_rows += b'\x00' + rgba_data[y*w*4:(y+1)*w*4]
    idat = zlib.compress(raw_rows)
    png = b'\x89PNG\r\n\x1a\n'
    png += make_chunk(b'IHDR', ihdr)
    png += make_chunk(b'IDAT', idat)
    png += make_chunk(b'IEND', b'')
    return png

# Portraits (128x128) + Item Icons (128x128)
ASSETS = [
    # Portraits
    ("/data/agent-dashboard/public/images/npcs/gentleman-detective.png", 128, 128,
     "16-bit JRPG pixel art portrait, elegant skeleton gentleman in a fine dark suit and top hat, glowing eye sockets with blue fire, charming permanent grin, mysterious detective, dark background"),
    ("/data/agent-dashboard/public/images/npcs/archivarin-vex.png", 128, 128,
     "16-bit JRPG pixel art portrait, stern female librarian with round glasses, silver hair in a bun, dark robes covered in bookmark tabs, holding a glowing book, wise purple eyes, library background"),
    ("/data/agent-dashboard/public/images/npcs/captain-flint.png", 128, 128,
     "16-bit JRPG pixel art portrait, weathered sea captain with grey beard, eye patch, captain hat with anchor emblem, tanned skin, determined gaze, ocean mist background"),
    # Item Icons
    ("/data/agent-dashboard/public/images/icons/npc-gentleman-coat.png", 128, 128,
     "16-bit JRPG pixel art, elegant dark coat with silver buttons and high collar, gentleman fashion, purple epic glow, fantasy RPG equipment icon"),
    ("/data/agent-dashboard/public/images/icons/npc-vex-glasses.png", 128, 128,
     "16-bit JRPG pixel art, round magical reading glasses with glowing blue lenses, arcane knowledge aura, fantasy RPG equipment icon"),
    ("/data/agent-dashboard/public/images/icons/npc-flint-compass.png", 128, 128,
     "16-bit JRPG pixel art, ornate nautical compass with glowing needle pointing in impossible direction, fog swirling around it, epic ocean magic, fantasy RPG equipment icon"),
]

def generate(outfile, w, h, desc):
    if os.path.exists(outfile) and os.path.getsize(outfile) > 500:
        print(f"SKIP {os.path.basename(outfile)}")
        return True
    
    os.makedirs(os.path.dirname(outfile), exist_ok=True)
    resp = requests.post(API_URL, headers=HEADERS, json={
        "description": desc,
        "image_size": {"width": w, "height": h},
        "no_background": True if "/icons/" in outfile else False
    })
    data = resp.json()
    job_id = data.get("background_job_id")
    if not job_id:
        print(f"  ERR: {json.dumps(data)[:150]}")
        return False
    
    print(f"  Submitted {os.path.basename(outfile)} → {job_id[:8]}")
    
    for _ in range(40):
        time.sleep(5)
        r = requests.get(f"{JOBS_URL}/{job_id}", headers=HEADERS)
        d = r.json()
        if d.get("status") == "completed":
            lr = d.get("last_response", {})
            images = lr.get("images", [])
            if images:
                img = images[0]
                raw = base64.b64decode(img["base64"])
                png = rgba_to_png(raw, img.get("width", w), img.get("height", h))
                with open(outfile, "wb") as f:
                    f.write(png)
                print(f"  ✅ {os.path.basename(outfile)}")
                return True
            return False
        elif d.get("status") == "failed":
            print(f"  ❌ {os.path.basename(outfile)} FAILED")
            return False
    print(f"  ⏰ {os.path.basename(outfile)} timeout")
    return False

completed = 0
for outfile, w, h, desc in ASSETS:
    if generate(outfile, w, h, desc):
        completed += 1
    time.sleep(1)

print(f"\nDone: {completed}/{len(ASSETS)} assets generated")
