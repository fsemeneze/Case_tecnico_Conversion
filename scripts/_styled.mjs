import { readFileSync, writeFileSync } from "node:fs";
const orig = "C:/Users/FSMENE~1/AppData/Local/Temp/dashboard-render.html";
const dest = "C:/Users/fsmenezes/AppData/Local/Temp/opencode/dashboard-styled.html";
let h = readFileSync(orig, "utf8");
h = h.split('href="/_next/').join('href="https://planops-co.vercel.app/_next/');
h = h.split('src="/_next/').join('src="https://planops-co.vercel.app/_next/');
writeFileSync(dest, h, "utf8");
console.log("href vercel:", h.includes('href="https://planops-co.vercel.app/_next/'));
console.log("ainda relativo:", h.includes('href="/_next/'));