import os
import sys
import glob
import asyncio
import subprocess
from playwright.async_api import async_playwright

PROD_URL = "https://pharos-whalewatch-agent.vercel.app"
DEMO_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_VIDEO_DIR = os.path.join(DEMO_DIR, "raw_video")
VOICEOVER_PATH = os.path.join(DEMO_DIR, "voiceover.mp3")
SRT_PATH = os.path.join(DEMO_DIR, "narration.srt")
FINAL_MP4 = os.path.join(DEMO_DIR, "pharos-whalewatch-agent-demo.mp4")
CLEAN_MP4 = os.path.join(DEMO_DIR, "pharos-whalewatch-agent-demo-clean.mp4")

NARRATION_TEXT = (
    "Welcome to the Pharos Whale-Watching Agent, an autonomous capital flow monitoring system for Pharos Atlantic Testnet. "
    "Connected directly to the official Pharos Model Context Protocol server, the agent monitors high-volume capital flow in real time. "
    "Requirement one: The agent actively tracks at least five configurable addresses, maintaining an immutable five-address security guarantee. "
    "Requirement two: Significance thresholds are fully configurable per token or in USD value terms for Atlantic USDC and PHAROS. "
    "Triggering an on-demand scan of recent Atlantic blocks demonstrates immediate live log ingestion across testnet contracts. "
    "Requirement three: Each report contextually explains the movement, what moved, how much, flow direction, and verified PharosScan links. "
    "Requirement four: The Cross-Watchlist Capital Flow Matrix synthesizes aggregated volume, net inflow, and individual whale breakdown. "
    "Fully verified, tested, and deployed to production on Vercel."
)

CURSOR_JS = """
() => {
  if (document.getElementById('demo-cursor')) return;
  const cursor = document.createElement('div');
  cursor.id = 'demo-cursor';
  Object.assign(cursor.style, {
    position: 'fixed', top: '0px', left: '0px',
    width: '20px', height: '20px',
    background: 'rgba(6, 182, 212, 0.9)',
    border: '2px solid white', borderRadius: '50%',
    boxShadow: '0 0 15px rgba(6, 182, 212, 0.8)',
    pointerEvents: 'none', zIndex: '999999',
    transition: 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
    transform: 'translate(-50%, -50%)'
  });
  document.body.appendChild(cursor);

  document.addEventListener('mousemove', e => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  });
  document.addEventListener('mousedown', e => {
    cursor.style.transform = 'translate(-50%, -50%) scale(0.7)';
    const ripple = document.createElement('div');
    Object.assign(ripple.style, {
      position: 'fixed', left: e.clientX + 'px', top: e.clientY + 'px',
      width: '10px', height: '10px', borderRadius: '50%',
      border: '2px solid rgba(6, 182, 212, 0.95)',
      transform: 'translate(-50%, -50%) scale(1)',
      opacity: '1', pointerEvents: 'none', zIndex: '999998',
      transition: 'all 0.4s ease-out'
    });
    document.body.appendChild(ripple);
    requestAnimationFrame(() => {
      ripple.style.transform = 'translate(-50%, -50%) scale(4)';
      ripple.style.opacity = '0';
    });
    setTimeout(() => ripple.remove(), 400);
  });
  document.addEventListener('mouseup', () => {
    cursor.style.transform = 'translate(-50%, -50%) scale(1)';
  });
}
"""

async def generate_voiceover():
    print("[Voiceover] Generating narration using edge-tts...")
    try:
        import edge_tts
        communicate = edge_tts.Communicate(NARRATION_TEXT, "en-US-ChristopherNeural")
        await communicate.save(VOICEOVER_PATH)
        print("[Voiceover] Saved to:", VOICEOVER_PATH)
    except Exception as e:
        print("[Voiceover] edge-tts error, falling back to powershell SAPI:", e)
        escaped = NARRATION_TEXT.replace('"', '`"')
        cmd = f'pwsh -Command "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile(\'{VOICEOVER_PATH}\'); $s.Speak(\'{escaped}\'); $s.Dispose()"'
        subprocess.run(cmd, shell=True, check=True)

async def smooth_move(page, target_x, target_y, steps=25):
    await page.mouse.move(target_x, target_y, steps=steps)
    await asyncio.sleep(0.1)

async def smooth_click(page, selector: str, pause_after: float = 1.5):
    loc = page.locator(selector).first
    await loc.wait_for(state="visible", timeout=12000)
    await loc.scroll_into_view_if_needed()
    box = await loc.bounding_box()
    if box:
        target_x = box["x"] + box["width"] / 2
        target_y = box["y"] + box["height"] / 2
        await smooth_move(page, target_x, target_y, steps=25)
        await asyncio.sleep(0.2)
        await page.mouse.click(target_x, target_y)
    else:
        await loc.click()
    await asyncio.sleep(pause_after)

async def record_walkthrough():
    os.makedirs(RAW_VIDEO_DIR, exist_ok=True)
    for f in glob.glob(os.path.join(RAW_VIDEO_DIR, "*")):
        try: os.remove(f)
        except: pass

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            record_video_dir=RAW_VIDEO_DIR,
            record_video_size={"width": 1920, "height": 1080}
        )
        page = await context.new_page()

        print("[Browser] Navigating to production app:", PROD_URL)
        await page.goto(PROD_URL, wait_until="networkidle")
        await page.evaluate(CURSOR_JS)
        await asyncio.sleep(2.0)

        # 1. Hover top status bar (Pharos Atlantic & MCP status)
        print("[Walkthrough] Hovering network and MCP status pills...")
        await smooth_move(page, 1500, 35, steps=30)
        await asyncio.sleep(2.0)

        # 2. Hover over summary metrics
        print("[Walkthrough] Showcasing summary metrics row...")
        await smooth_move(page, 400, 160, steps=25)
        await asyncio.sleep(1.5)
        await smooth_move(page, 800, 160, steps=25)
        await asyncio.sleep(1.5)

        # 3. Open Watchlist Manager Modal (Req 01)
        print("[Walkthrough] Opening Watchlist Manager (Req 01)...")
        await smooth_click(page, "#btnOpenWatchlist", pause_after=2.0)
        await smooth_move(page, 960, 480, steps=25) # Scroll through watchlist
        await asyncio.sleep(3.0)
        await smooth_click(page, "#btnCloseWatchlist", pause_after=1.5)

        # 4. Open Thresholds Modal (Req 02)
        print("[Walkthrough] Opening Thresholds Modal (Req 02)...")
        await smooth_click(page, "#btnOpenThresholds", pause_after=2.0)
        await smooth_move(page, 960, 450, steps=25)
        await asyncio.sleep(2.5)
        await smooth_click(page, "#btnCloseThresholds", pause_after=1.5)

        # 5. Trigger Scan Now
        print("[Walkthrough] Triggering on-demand block scan...")
        await smooth_click(page, "#btnManualScan", pause_after=3.5)

        # 6. Switch to Live Movement Stream Tab (Req 03)
        print("[Walkthrough] Switching to Live Movement Stream Tab (Req 03)...")
        await smooth_click(page, "button[data-tab='movements-tab']", pause_after=2.0)
        await smooth_move(page, 960, 420, steps=25)
        await asyncio.sleep(3.5)

        # 7. Switch back to Summary Matrix (Req 04)
        print("[Walkthrough] Returning to Cross-Watchlist Matrix (Req 04)...")
        await smooth_click(page, "button[data-tab='summary-tab']", pause_after=2.0)
        await smooth_move(page, 960, 450, steps=25)
        await asyncio.sleep(4.0)

        await context.close()
        await browser.close()
        print("[Browser] Recording finalized.")

def merge_video():
    raw_files = glob.glob(os.path.join(RAW_VIDEO_DIR, "*.webm"))
    if not raw_files:
        raise RuntimeError("No raw webm recording found!")
    raw_webm = raw_files[0]
    print("[FFmpeg] Merging video with audio...", raw_webm)

    # 1. Clean MP4
    cmd_clean = [
        "ffmpeg", "-y",
        "-i", raw_webm,
        "-i", VOICEOVER_PATH,
        "-c:v", "libx264", "-preset", "fast", "-crf", "22", "-r", "30",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        CLEAN_MP4
    ]
    subprocess.run(cmd_clean, check=True)
    print("[FFmpeg] Clean MP4 created:", CLEAN_MP4)

    # 2. Subtitled MP4
    escaped_srt = SRT_PATH.replace("\\", "/").replace(":", "\\:")
    cmd_sub = [
        "ffmpeg", "-y",
        "-i", raw_webm,
        "-i", VOICEOVER_PATH,
        "-vf", f"subtitles='{escaped_srt}':force_style='FontSize=20,PrimaryColour=&H00FFFFFF,BackColour=&H80000000,BorderStyle=4,Outline=1'",
        "-c:v", "libx264", "-preset", "fast", "-crf", "22", "-r", "30",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        FINAL_MP4
    ]
    try:
        subprocess.run(cmd_sub, check=True)
        print("[FFmpeg] Subtitled MP4 created:", FINAL_MP4)
    except Exception as e:
        print("[FFmpeg] Subtitle overlay failed, copying clean as final:", e)
        import shutil
        shutil.copyfile(CLEAN_MP4, FINAL_MP4)

async def main():
    await generate_voiceover()
    await record_walkthrough()
    merge_video()
    print("=== DEMO VIDEO COMPLETE ===")

if __name__ == "__main__":
    asyncio.run(main())
