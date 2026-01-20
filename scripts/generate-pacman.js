import fetch from "node-fetch";
import fs from "fs";

const TOKEN = process.env.GITHUB_TOKEN;
const USERNAME = process.env.GITHUB_USER || process.env.GITHUB_REPOSITORY_OWNER;

// Grid sizing (GitHub contribution graph style)
const CELL = 14;
const PADDING = 20;
const DOT_R = 3;

// Pac-Man sizing
const PAC_R = 7; // radius

async function getContributions() {
  const query = `
    query {
      user(login: "${USERNAME}") {
        contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays {
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query })
  });

  const json = await res.json();
  return json.data.user.contributionsCollection.contributionCalendar.weeks;
}

/**
 * We generate stable dot IDs so Pac-Man can "eat" them with a timed animation.
 */
function generateSVG(weeks) {
  const cols = weeks.length;
  const rows = 7;

  const width = cols * CELL + PADDING * 2;
  const height = rows * CELL + PADDING * 2;

  // Build dots and a path visiting every green dot
  let dots = "";
  const path = [];

  let dotIndex = 0;
  weeks.forEach((week, x) => {
    week.contributionDays.forEach((day, y) => {
      if (day.contributionCount > 0) {
        const cx = PADDING + x * CELL;
        const cy = PADDING + y * CELL;
        const id = `d${dotIndex++}`;
        dots += `\n<circle id="${id}" cx="${cx}" cy="${cy}" r="${DOT_R}" fill="#39d353" opacity="1"/>`;
        path.push({ x: cx, y: cy, id });
      }
    });
  });

  // No contributions edge-case
  if (path.length === 0) {
    return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="transparent"/>
  <text x="${PADDING}" y="${PADDING + 20}" fill="#8b949e" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace" font-size="14">
    No contributions yet 😅
  </text>
</svg>`;
  }

  // Timing
  const STEP = 0.22; // seconds per dot
  const DURATION = Math.max(2, path.length * STEP);

  // animateMotion "keyPoints" + "keyTimes" gives us a precise time for each dot.
  // We also use the same keyTimes to fade out each dot right when Pac-Man reaches it.
  const keyTimes = path.map((_, i) => (i / (path.length - 1)).toFixed(6)).join(";");
  const keyPoints = path
    .map((p) => (p.x / width).toFixed(6) + "," + (p.y / height).toFixed(6))
    .join(";");

  // Path string for motion
  const motionPath = `M ${path.map((p) => `${p.x} ${p.y}`).join(" L ")}`;

  // Eat animation for each dot (opacity goes to 0 when Pac-Man reaches it)
  // Using begin="0s" and keyTimes aligned with motion.
  const eatAnimations = path
    .map(
      (p, i) => `
  <animate xlink:href="#${p.id}" attributeName="opacity"
    dur="${DURATION}s" repeatCount="indefinite"
    keyTimes="0;${(i / (path.length - 1)).toFixed(6)};1"
    values="1;0;0" fill="freeze" />`
    )
    .join("\n");

  // A little glow and background vibe
  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <rect width="100%" height="100%" fill="transparent"/>

  <!-- Green dots (contributions) -->
  <g>
    ${dots}
  </g>

  <!-- Make dots disappear as Pac-Man reaches them -->
  <g>
    ${eatAnimations}
  </g>

  <!-- Pac-Man -->
  <g filter="url(#glow)">
    <!-- Body -->
    <circle r="${PAC_R}" fill="#f6d32d">
      <animateMotion dur="${DURATION}s" repeatCount="indefinite" rotate="auto"
        path="${motionPath}" keyTimes="${keyTimes}" keyPoints="${keyPoints}" calcMode="linear" />
    </circle>

    <!-- Mouth wedge (chomp effect) -->
    <path d="M0 0 L${PAC_R} ${-PAC_R * 0.55} A${PAC_R} ${PAC_R} 0 1 1 ${PAC_R} ${PAC_R * 0.55} Z" fill="#0d1117">
      <animateTransform attributeName="transform" type="scale" values="1;0.15;1" dur="0.28s" repeatCount="indefinite" />
      <animateMotion dur="${DURATION}s" repeatCount="indefinite" rotate="auto"
        path="${motionPath}" keyTimes="${keyTimes}" keyPoints="${keyPoints}" calcMode="linear" />
    </path>
  </g>
</svg>`;
}

(async () => {
  if (!TOKEN) {
    console.error("❌ Missing GITHUB_TOKEN env var");
    process.exit(1);
  }

  const weeks = await getContributions();
  const svg = generateSVG(weeks);

  fs.mkdirSync("dist", { recursive: true });
  fs.writeFileSync("dist/pacman.svg", svg);

  console.log("✅ dist/pacman.svg generated");
})();
