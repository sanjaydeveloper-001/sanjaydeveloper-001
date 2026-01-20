import fetch from "node-fetch";
import fs from "fs";

const TOKEN = process.env.GITHUB_TOKEN;
const USERNAME =
  process.env.GITHUB_USER || process.env.GITHUB_REPOSITORY_OWNER;

const CELL = 14;
const PADDING = 20;

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

function generateSVG(weeks) {
  const cols = weeks.length;
  const rows = 7;

  const width = cols * CELL + PADDING * 2;
  const height = rows * CELL + PADDING * 2;

  let dots = "";
  let path = [];

  weeks.forEach((week, x) => {
    week.contributionDays.forEach((day, y) => {
      if (day.contributionCount > 0) {
        const cx = PADDING + x * CELL;
        const cy = PADDING + y * CELL;
        dots += `<circle cx="${cx}" cy="${cy}" r="3" fill="#2ea44f"/>`;
        path.push({ x: cx, y: cy });
      }
    });
  });

  // If user has no contributions, avoid empty path crash
  if (path.length === 0) {
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="20" y="40" fill="gray">No contributions yet 😅</text>
    </svg>`;
  }

  return `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="transparent"/>

    ${dots}

    <!-- Pac-Man -->
    <g>
      <circle r="6" fill="gold">
        <animateMotion dur="${path.length * 0.15}s" repeatCount="indefinite"
          path="M ${path.map(p => `${p.x} ${p.y}`).join(" L ")}"/>
      </circle>

      <!-- Mouth -->
      <path d="M0 0 L6 -4 A6 6 0 1 1 6 4 Z" fill="black">
        <animateTransform attributeName="transform" type="scale"
          values="1;0.1;1" dur="0.3s" repeatCount="indefinite"/>
      </path>
    </g>
  </svg>
  `;
}

(async () => {
  const weeks = await getContributions();
  const svg = generateSVG(weeks);

  fs.mkdirSync("dist", { recursive: true });
  fs.writeFileSync("dist/pacman.svg", svg);

  console.log("✅ pacman.svg generated");
})();
