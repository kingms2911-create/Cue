# Cue v2: Step 1 (Backend + core logic)

Ye Step 1 hai. Step 2 (UI: dashboard, styles, tabs) isi folder mein add hoga.

## Is step mein kya hai

```
api/generate.js       Gemini (AI ideas + scripts), key sirf server par
api/connections.js    GET  connected accounts ka status
api/upload-url.js     GET  video direct upload ke liye signed URL (Ayrshare)
api/publish.js        POST ek platform par publish ya schedule
lib/server.js         access key, rate limit, origin check
lib/providers.js      Ayrshare aur webhook (n8n / Make.com) integration
public/js/lib.js      pure logic: caption mapping, bio fonts, best-time, history stats
test/                 19 automated tests (npm test)
```

## 1. Pehle security

- Purani Gemini key chat mein share ho chuki hai. https://aistudio.google.com/apikey par use delete karke nayi banao.
- `CUE_ACCESS_KEY` zaroor set karo (lamba random password). Iske bina publishing endpoints chalte hi nahi (503), taaki koi bhi tumhare accounts par post na kar sake.

## 2. Environment variables

`.env.example` ko `.env.local` naam se copy karo (Vercel par: Project > Settings > Environment Variables).

| Variable | Kaam |
| --- | --- |
| `CUE_ACCESS_KEY` | Zaroori. Browser ye key `x-cue-key` header mein bhejta hai |
| `GEMINI_API_KEY` | AI ke liye (nayi key) |
| `AYRSHARE_API_KEY` | Option A: Ayrshare se publish + direct upload |
| `PUBLISH_WEBHOOK_URL` | Option B: n8n / Make.com webhook URL |
| `WEBHOOK_SECRET` | Optional: payload signature (`X-Cue-Signature: sha256=...`) |
| `CONNECTED_PLATFORMS` | Optional: webhook mode mein kaunse platforms handle hote hain |
| `ALLOWED_ORIGIN` | Optional: sirf apni site allow karo |

Dono provider set ho to Ayrshare use hota hai.

## 3. Test chalao

```
npm test
```
19 tests: access key, validation, Ayrshare (immediate, async Reels, scheduled, failed), webhook signature, Gemini streaming.

## 4. Deploy aur curl se check

```
npm i -g vercel
vercel dev        # local
vercel --prod     # deploy
```

```
curl -H "x-cue-key: YOUR_KEY" https://your-app.vercel.app/api/connections

curl -X POST https://your-app.vercel.app/api/publish \
  -H "x-cue-key: YOUR_KEY" -H "Content-Type: application/json" \
  -d '{"platform":"youtube","title":"Test","text":"Hello #shorts","mediaUrl":"https://example.com/video.mp4"}'
```

## Webhook payload (n8n / Make.com)

Har platform ke liye ek alag POST aata hai:

```json
{
  "event": "cue.publish", "version": 1, "id": "abc-instagram",
  "platform": "instagram", "title": "", "text": "caption #tags",
  "hashtags": ["#tags"], "mediaUrl": "https://...", "scheduleAt": null,
  "sentAt": "2026-09-20T10:00:00.000Z"
}
```
Response mein `{"status":"published","url":"..."}` ya `{"status":"scheduled"}` bhejo to Cue status dikhayega. Kuch na bhejo to "Bhej diya" dikhega.

## Dhyan rakhne wali baatein

- Instagram / Facebook Reels Ayrshare par async process hote hain, isliye status "Processing" dikhta hai.
- Direct video upload Ayrshare ke supported plan par hi chalta hai. Uploaded video ka link 30 din tak valid rehta hai. Webhook mode mein video ka public https URL do.
- Ayrshare ke options (`instagramOptions`, `youTubeOptions`, `faceBookOptions`) unke docs ke hisaab se hain. Live jaane se pehle apne account se ek test post zaroor karo.
- Rate limit abhi memory-based hai. Bechne ke liye Upstash / Vercel KV aur user login add karo.
