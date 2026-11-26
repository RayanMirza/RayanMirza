import fs from "node:fs";

const profile = JSON.parse(fs.readFileSync("config/profile.json", "utf8"));

const token = process.env.GITHUB_TOKEN;

if (!token) {
  throw new Error("GITHUB_TOKEN is required");
}

// Fetch real GitHub contribution data
const response = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    query: `
      query($username: String!) {
        user(login: $username) {
          contributionsCollection {
            totalCommitContributions
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  date
                  contributionCount
                }
              }
            }
          }
        }
      }
    `,
    variables: {
      username: profile.username,
    },
  }),
});

const data = await response.json();

if (!response.ok || data.errors || !data.data?.user) {
  throw new Error(JSON.stringify(data));
}

const collection = data.data.user.contributionsCollection;
const calendar = collection.contributionCalendar;

const days = calendar.weeks.flatMap((week) => week.contributionDays);

const activeDays = days.filter((day) => day.contributionCount > 0);

const totalCommits = collection.totalCommitContributions;
const peak = Math.max(0, ...days.map((day) => day.contributionCount));

// Generate radar signals
const signals = days
  .map((day, i) => {
    if (!day.contributionCount) return "";

    const angle = (i / days.length) * Math.PI * 2;
    const radius = 30 + ((i * 37) % 140);

    const x = 450 + Math.sin(angle) * radius;
    const y = 300 - Math.cos(angle) * radius;

    const size = Math.min(8, 2 + Math.sqrt(day.contributionCount));

    const delay = (i / days.length) * 8;

    return `
    <circle cx="${x}" cy="${y}" r="${size}"
      fill="#ff405f" opacity="0.25">
      <animate
        attributeName="opacity"
        values="0.25;1;0.25;0.25"
        keyTimes="0;0.04;0.35;1"
        begin="${delay}s"
        dur="8s"
        repeatCount="indefinite"/>
    </circle>
  `;
  })
  .join("");

// Generate contribution calendar
const colors = ["#21151d", "#501426", "#921d39", "#cc294b", "#ff526b"];

const cells = calendar.weeks
  .map((week, x) =>
    week.contributionDays
      .map((day) => {
        const y = new Date(day.date + "T00:00:00Z").getUTCDay();
        const count = day.contributionCount;

        const level =
          count === 0
            ? 0
            : Math.min(4, Math.ceil((count / Math.max(1, peak)) * 4));

        return `
      <rect
        x="${53 + x * 15}"
        y="${540 + y * 15}"
        width="11"
        height="11"
        rx="2"
        fill="${colors[level]}">
        <title>${day.date}: ${count} contributions</title>
      </rect>
    `;
      })
      .join(""),
  )
  .join("");

// Create animated SVG
const svg = `
<svg xmlns="http://www.w3.org/2000/svg"
     width="900" height="700"
     viewBox="0 0 900 700">

  <defs>
    <radialGradient id="background">
      <stop stop-color="#310c1b"/>
      <stop offset="1" stop-color="#09090d"/>
    </radialGradient>

    <linearGradient id="beam">
      <stop stop-color="#ff304f" stop-opacity="0"/>
      <stop offset="1" stop-color="#ff304f" stop-opacity="0.4"/>
    </linearGradient>
  </defs>

  <rect width="900" height="700"
    rx="8" fill="url(#background)"
    stroke="#602032"/>

  <g font-family="monospace">

    <text x="25" y="30" fill="#ff405f" font-size="15">
      GHOST_PROTOCOL // CONTRIBUTION INTELLIGENCE
    </text>

    <text x="875" y="30" fill="#ff405f"
      font-size="13" text-anchor="end">
      SYSTEM ONLINE
      <animate attributeName="opacity"
        values="1;0.3;1" dur="2s"
        repeatCount="indefinite"/>
    </text>

    <g text-anchor="middle">
      <text x="150" y="85" fill="#ff405f" font-size="32">
        ${totalCommits}
      </text>
      <text x="150" y="108" fill="#aaa" font-size="13">
        TOTAL COMMITS
      </text>

      <text x="450" y="85" fill="#ff405f" font-size="32">
        ${activeDays.length}
      </text>
      <text x="450" y="108" fill="#aaa" font-size="13">
        ACTIVE DAYS
      </text>

      <text x="750" y="85" fill="#ff405f" font-size="32">
        ${peak}
      </text>
      <text x="750" y="108" fill="#aaa" font-size="13">
        PEAK DAILY ACTIVITY
      </text>
    </g>

    <g fill="none" stroke="#682139">
      <circle cx="450" cy="300" r="45"/>
      <circle cx="450" cy="300" r="90"/>
      <circle cx="450" cy="300" r="135"/>
      <circle cx="450" cy="300" r="180"/>
      <path d="M270 300H630 M450 120V480"/>
      <path d="M323 173L577 427 M323 427L577 173"/>
    </g>

    ${signals}

    <g>
      <path d="M450 300L323 173
        A180 180 0 0 1 450 120Z"
        fill="url(#beam)"/>

      <path d="M450 300V120"
        stroke="#ff405f" stroke-width="2"/>

      <animateTransform
        attributeName="transform"
        type="rotate"
        from="0 450 300"
        to="360 450 300"
        dur="8s"
        repeatCount="indefinite"/>
    </g>

    <circle cx="450" cy="300" r="5" fill="#ff405f"/>

    <circle cx="450" cy="300" r="8"
      fill="none" stroke="#ff405f">
      <animate attributeName="r"
        values="5;22;5" dur="2s"
        repeatCount="indefinite"/>
      <animate attributeName="opacity"
        values="1;0;1" dur="2s"
        repeatCount="indefinite"/>
    </circle>

    <text x="53" y="520" fill="#ff405f" font-size="14">
      ANNUAL CONTRIBUTION MAP
    </text>

    ${cells}

    <path d="M25 660H875" stroke="#602032"/>

    <text x="25" y="682" fill="#ff405f" font-size="12">
      SIGNALS DETECTED: ${calendar.totalContributions}
    </text>

    <text x="875" y="682" fill="#ff405f"
      font-size="12" text-anchor="end">
      SCAN COMPLETE // ${new Date().toISOString().slice(0, 10)}
    </text>

  </g>
</svg>
`;

fs.mkdirSync("assets", { recursive: true });
fs.writeFileSync("assets/radar.svg", svg);

console.log("Contribution radar generated successfully.");
